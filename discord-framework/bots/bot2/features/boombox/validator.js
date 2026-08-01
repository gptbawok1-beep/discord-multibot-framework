/**
 * Boombox — URL Validator
 *
 * Validates and extracts platform identity from a user-supplied URL.
 * Returns a structured result so the router knows exactly where to send the job.
 */

// ─── Platform Patterns ────────────────────────────────────────────────────────

const PATTERNS = Object.freeze({
  youtube: [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
  ],
  tiktok: [
    /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
    /vm\.tiktok\.com\/([A-Za-z0-9]+)/,
  ],
  spotify: [
    /spotify\.com\/(track)\/([A-Za-z0-9]+)/,
  ],
});

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {'youtube'|'tiktok'|'spotify'|null} platform
 * @property {string|null} id        - Unique platform identifier (video/track ID)
 * @property {string|null} error     - Human-readable error if invalid
 */

/**
 * Validate a URL and extract its platform identity.
 * @param {string} input
 * @returns {ValidationResult}
 */
export function validateURL(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, platform: null, id: null, error: 'URL tidak boleh kosong.' };
  }

  const url = input.trim();

  // Basic URL sanity check
  try {
    new URL(url);
  } catch {
    return { valid: false, platform: null, id: null, error: 'Format URL tidak valid.' };
  }

  for (const [platform, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        // For spotify the ID is capture group 2; for others it's group 1
        const id = platform === 'spotify' ? match[2] : match[1];
        return { valid: true, platform, id, error: null };
      }
    }
  }

  return {
    valid: false,
    platform: null,
    id: null,
    error: 'URL tidak didukung. Gunakan link YouTube, TikTok, atau Spotify.',
  };
}

/**
 * Build a canonical cache key from platform + id.
 * @param {string} platform
 * @param {string} id
 * @returns {string}
 */
export function buildCacheKey(platform, id) {
  return `${platform}:${id}`;
}
