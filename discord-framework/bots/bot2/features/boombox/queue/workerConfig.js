export const PRIORITY = Object.freeze({
  OWNER: 0,
  DEVELOPER: 1,
  PREMIUM: 2,
  FREE: 3,
});

export const DEFAULT_WORKER_CONFIG = {
  youtube: {
    maxConcurrent: 2,
    timeoutMs: 90000, // 90 seconds
    maxRetries: 3,
  },
  tiktok: {
    maxConcurrent: 2,
    timeoutMs: 90000,
    maxRetries: 3,
  },
  spotify: {
    maxConcurrent: 2,
    timeoutMs: 90000,
    maxRetries: 3,
  },
};
