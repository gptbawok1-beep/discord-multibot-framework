/**
 * Dynamic Import Utility
 *
 * Resolves a file path and imports it as an ES module at runtime.
 * Returns the default export of the module.
 *
 * Platform notes:
 *   - Uses pathToFileURL() to produce a valid file:// URL on all platforms.
 *     This is required on Windows where paths like C:\... are not valid
 *     import() specifiers without being converted to file:///C:/... first.
 *   - path.resolve() normalizes separators before conversion, so both
 *     absolute and relative paths work on every OS.
 */

import { pathToFileURL } from 'url';
import { resolve } from 'path';

/**
 * Dynamically import a file and return its default export.
 * @param {string} filePath - Absolute or relative file path (any OS).
 * @returns {Promise<any>}
 */
async function dynamicImport(filePath) {
  // resolve() handles both Unix (/) and Windows (\) separators
  const absolutePath = resolve(filePath);
  // pathToFileURL() produces a proper file:// URL on all platforms
  const fileUrl = pathToFileURL(absolutePath).href;
  const module = await import(fileUrl);
  return module.default ?? module;
}

export { dynamicImport };
export default dynamicImport;
