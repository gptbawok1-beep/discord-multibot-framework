import { PRIORITY, DEFAULT_WORKER_CONFIG } from "./workerConfig.js";
import { db } from "../database.js";
import { createLogger } from "../../../../../shared/logger/index.js";

const logger = createLogger("WorkerManager");

class PlatformWorkerQueue {
  constructor(name, config) {
    this.name = name;
    this.maxConcurrent = config.maxConcurrent;
    this.timeoutMs = config.timeoutMs;
    this.maxRetries = config.maxRetries;

    /** @type {Array<{ id: string, priority: number, run: (signal: AbortSignal) => Promise<any>, callbacks: any, resolve: Function, reject: Function, createdAt: number, retries: number }>} */
    this.queue = [];
    /** @type {Set<string>} active job IDs */
    this.activeJobs = new Set();
    /** @type {Map<string, { abortController: AbortController, timer: NodeJS.Timeout }>} */
    this.runningControllers = new Map();
  }

  getPendingCount() {
    return this.queue.length;
  }

  getActiveCount() {
    return this.activeJobs.size;
  }

  getSnapshot() {
    return {
      name: this.name,
      active: this.getActiveCount(),
      queued: this.getPendingCount(),
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Enqueue a task.
   */
  enqueue(run, options = {}) {
    const priority = options.priority ?? PRIORITY.FREE;
    const jobId = options.jobId ?? `job_${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    return new Promise((resolve, reject) => {
      const task = {
        id: jobId,
        priority,
        run,
        callbacks: options,
        resolve,
        reject,
        createdAt: Date.now(),
        retries: 0,
      };

      // Priority queue insertion (lower priority number means higher priority, e.g. OWNER=0 before FREE=3)
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        if (task.priority < this.queue[i].priority) {
          this.queue.splice(i, 0, task);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.queue.push(task);
      }

      if (options.onQueued) {
        try {
          options.onQueued(this.queue.indexOf(task) + 1, this.queue.length, this.estimateEtaSec());
        } catch (e) {
          logger.warn(`onQueued callback error: ${e.message}`);
        }
      }

      logger.info(`[${this.name}] Enqueued job ${jobId} with priority ${priority}. Queued count: ${this.queue.length}`);
      this._tick();
    });
  }

  estimateEtaSec() {
    // Basic heuristic: 15 seconds per job, divided by concurrency
    const totalJobs = this.queue.length + this.activeJobs.size;
    return Math.max(0, Math.ceil((totalJobs * 15) / this.maxConcurrent));
  }

  _tick() {
    while (this.getActiveCount() < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this._runTask(task);
    }
  }

  async _runTask(task) {
    this.activeJobs.add(task.id);
    if (task.callbacks.onStart) {
      try { task.callbacks.onStart(); } catch (e) { logger.warn(`onStart callback error: ${e.message}`); }
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const timeoutTimer = setTimeout(() => {
      logger.warn(`[${this.name}] Job ${task.id} exceeded hard timeout of ${this.timeoutMs}ms. Aborting.`);
      abortController.abort();
    }, this.timeoutMs);

    this.runningControllers.set(task.id, { abortController, timer: timeoutTimer });

    try {
      logger.info(`[${this.name}] Processing job ${task.id}...`);
      const result = await task.run(signal);

      // Success! Clean up timeout
      clearTimeout(timeoutTimer);
      this.runningControllers.delete(task.id);
      this.activeJobs.delete(task.id);

      task.resolve(result);
      this._tick();
    } catch (err) {
      clearTimeout(timeoutTimer);
      this.runningControllers.delete(task.id);

      const isTimeout = signal.aborted || err?.code === "BOOMBOX_STAGE_TIMEOUT";
      if (isTimeout) {
        const abortErr = new Error("BOOMBOX_STAGE_TIMEOUT");
        abortErr.code = "BOOMBOX_STAGE_TIMEOUT";
        this._handleFailure(task, abortErr);
      } else {
        this._handleFailure(task, err);
      }
    }
  }

  _handleFailure(task, error) {
    this.activeJobs.delete(task.id);

    // If it is NOT a stage timeout and we have remaining retries
    if (error?.code !== "BOOMBOX_STAGE_TIMEOUT" && task.retries < this.maxRetries) {
      task.retries++;
      const backoffMs = 2000 * task.retries;
      logger.warn(`[${this.name}] Job ${task.id} failed: ${error.message}. Retrying ${task.retries}/${this.maxRetries} in ${backoffMs}ms...`);

      setTimeout(() => {
        // Put back into priority queue at the front of its priority class
        let inserted = false;
        for (let i = 0; i < this.queue.length; i++) {
          if (task.priority <= this.queue[i].priority) {
            this.queue.splice(i, 0, task);
            inserted = true;
            break;
          }
        }
        if (!inserted) {
          this.queue.push(task);
        }
        this._tick();
      }, backoffMs);
    } else {
      logger.error(`[${this.name}] Job ${task.id} failed permanently: ${error.message}`);
      task.reject(error);
      this._tick();
    }
  }

  cancelJob(jobId) {
    const running = this.runningControllers.get(jobId);
    if (running) {
      running.abortController.abort();
      clearTimeout(running.timer);
      this.runningControllers.delete(jobId);
      this.activeJobs.delete(jobId);
      logger.info(`[${this.name}] Cancelled active job ${jobId}`);
      this._tick();
      return true;
    }

    const idx = this.queue.findIndex(t => t.id === jobId);
    if (idx !== -1) {
      const [task] = this.queue.splice(idx, 1);
      task.reject(new Error("Job cancelled by user."));
      logger.info(`[${this.name}] Cancelled queued job ${jobId}`);
      return true;
    }

    return false;
  }
}

class WorkerManager {
  constructor() {
    this.workers = {};
    const persistedConfig = db.getWorkerConfig();

    for (const [platform, defaultConfig] of Object.entries(DEFAULT_WORKER_CONFIG)) {
      const conf = {
        ...defaultConfig,
        ...(persistedConfig[platform] || {}),
      };
      this.workers[platform] = new PlatformWorkerQueue(platform, conf);
    }

    // Run periodic health checks (clean up timed out or dead jobs) every 5 minutes
    this.healthCheckTimer = setInterval(() => this.runHealthCheck(), 5 * 60 * 1000);
    if (this.healthCheckTimer.unref) this.healthCheckTimer.unref();
  }

  enqueue(platform, run, options = {}) {
    const w = this.workers[platform.toLowerCase()];
    if (!w) {
      throw new Error(`Unsupported platform worker queue: ${platform}`);
    }
    return w.enqueue(run, options);
  }

  cancel(jobId) {
    for (const worker of Object.values(this.workers)) {
      if (worker.cancelJob(jobId)) return true;
    }
    return false;
  }

  getAllSnapshots() {
    return Object.values(this.workers).map(w => w.getSnapshot());
  }

  runHealthCheck() {
    logger.info("Running worker queue health check...");
    for (const [name, worker] of Object.entries(this.workers)) {
      logger.info(`Worker [${name}] — Concurrency: ${worker.getActiveCount()}/${worker.maxConcurrent} | Queue: ${worker.getPendingCount()}`);

      // Look for any orphaned running controllers or aborted signals without clean removal
      for (const [jobId, ctrl] of worker.runningControllers.entries()) {
        if (ctrl.abortController.signal.aborted) {
          logger.warn(`Found stale aborted job [${jobId}] in worker [${name}]. Cleaning up.`);
          clearTimeout(ctrl.timer);
          worker.runningControllers.delete(jobId);
          worker.activeJobs.delete(jobId);
        }
      }
    }
  }

  updateWorkerConfig(platform, newConfig) {
    const worker = this.workers[platform.toLowerCase()];
    if (!worker) return false;

    if (newConfig.maxConcurrent !== undefined) worker.maxConcurrent = Math.max(1, newConfig.maxConcurrent);
    if (newConfig.timeoutMs !== undefined) worker.timeoutMs = Math.max(1000, newConfig.timeoutMs);
    if (newConfig.maxRetries !== undefined) worker.maxRetries = Math.max(0, newConfig.maxRetries);

    // Save configuration override to db
    const currentOverridden = db.getWorkerConfig();
    currentOverridden[platform.toLowerCase()] = {
      maxConcurrent: worker.maxConcurrent,
      timeoutMs: worker.timeoutMs,
      maxRetries: worker.maxRetries,
    };
    db.setWorkerConfig(currentOverridden);
    logger.info(`Updated worker config for ${platform}: maxConcurrent=${worker.maxConcurrent}, timeoutMs=${worker.timeoutMs}, maxRetries=${worker.maxRetries}`);
    return true;
  }
}

export const workerManager = new WorkerManager();
export const enqueue = (workerName, run, options) => workerManager.enqueue(workerName, run, options);
export const getAllSnapshots = () => workerManager.getAllSnapshots();
