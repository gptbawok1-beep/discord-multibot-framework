class ProviderHealth {
  constructor() {
    this.states = {
      "YouTube": { status: "ONLINE", consecutiveFailures: 0, totalSuccess: 0, totalFailure: 0, totalSkipped: 0 },
      "TikTok":  { status: "ONLINE", consecutiveFailures: 0, totalSuccess: 0, totalFailure: 0, totalSkipped: 0 },
      "Spotify": { status: "ONLINE", consecutiveFailures: 0, totalSuccess: 0, totalFailure: 0, totalSkipped: 0 },
    };
  }

  getAllStatuses() {
    return this.states;
  }

  recordSuccess(provider) {
    const s = this.states[provider] || { status: "ONLINE", consecutiveFailures: 0, totalSuccess: 0, totalFailure: 0, totalSkipped: 0 };
    s.status = "ONLINE";
    s.consecutiveFailures = 0;
    s.totalSuccess++;
    this.states[provider] = s;
  }

  recordFailure(provider) {
    const s = this.states[provider] || { status: "ONLINE", consecutiveFailures: 0, totalSuccess: 0, totalFailure: 0, totalSkipped: 0 };
    s.consecutiveFailures++;
    s.totalFailure++;
    if (s.consecutiveFailures >= 3) {
      s.status = "OFFLINE";
    }
    this.states[provider] = s;
  }

  recordSkip(provider) {
    const s = this.states[provider] || { status: "ONLINE", consecutiveFailures: 0, totalSuccess: 0, totalFailure: 0, totalSkipped: 0 };
    s.totalSkipped++;
    this.states[provider] = s;
  }
}

export const providerHealth = new ProviderHealth();
export default providerHealth;
