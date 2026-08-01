/**
 * Boombox — Router
 *
 * Maps platform name → provider module.
 * Import all providers here so the rest of the system only talks to the router.
 */

import { youtubeProvider } from './providers/youtube.js';
import { tiktokProvider }  from './providers/tiktok.js';
import { spotifyProvider } from './providers/spotify.js';

const PROVIDERS = Object.freeze({
  youtube: youtubeProvider,
  tiktok:  tiktokProvider,
  spotify: spotifyProvider,
});

class Router {
  /**
   * Get the provider for a platform.
   * @param {'youtube'|'tiktok'|'spotify'} platform
   * @returns {import('./providers/youtube.js').Provider|null}
   */
  getProvider(platform) {
    return PROVIDERS[platform] ?? null;
  }

  /**
   * List all registered platform names.
   * @returns {string[]}
   */
  listPlatforms() {
    return Object.keys(PROVIDERS);
  }
}

export const router = new Router();
