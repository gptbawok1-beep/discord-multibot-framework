/**
 * Boombox — Top4Top Uploader
 *
 * Single upload entry point for all providers.
 * Every upload in the system MUST go through this module.
 * To switch uploaders in the future: only modify this file.
 *
 * Phase 1: STUB — returns NotImplemented.
 * Phase 2: Implement multipart upload to top4top.net API.
 *          Returns a direct MP3 URL compatible with GTA SA:MP Boombox.
 */

export const top4topUploader = Object.freeze({
  name: 'top4top',

  /**
   * Upload an audio buffer and return a public, direct MP3 URL.
   *
   * @param {Buffer}  audioBuffer  - Raw audio data (MP3/AAC)
   * @param {string}  filename     - e.g. "dQw4w9WgXcQ.mp3"
   * @returns {Promise<string>}    - Public direct URL
   */
  async upload(audioBuffer, filename) {
    // ── Phase 2 implementation outline ──────────────────────────────────────
    // 1. Build a multipart/form-data request to top4top.net upload endpoint
    // 2. Set the correct API key header (from Replit Secrets)
    // 3. POST the buffer with the given filename
    // 4. Parse the JSON response and extract the direct download URL
    // 5. Verify the URL is reachable before returning
    // 6. Return the direct MP3 URL string
    //
    // Example (Phase 2):
    // const form = new FormData();
    // form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), filename);
    // const res  = await fetch('https://top4top.net/api/upload', {
    //   method: 'POST',
    //   headers: { 'Authorization': process.env.TOP4TOP_API_KEY },
    //   body: form,
    // });
    // const json = await res.json();
    // return json.direct_url;
    // ────────────────────────────────────────────────────────────────────────

    throw new Error('Top4Top uploader not yet implemented (Phase 2).');
  },

  /**
   * Verify a previously uploaded URL is still alive.
   * Used by the retry flow to detect dead links.
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  async verify(url) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  },
});
