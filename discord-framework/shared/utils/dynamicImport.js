/**
 * Dynamic Import Utility
 *
 * Resolves and imports a module from a file path at runtime.
 * Returns the default export of the module.
 */

import { pathToFileURL } from 'url';
import { resolve } from 'path';

/**
 * Dynamically import a file and return its default export.
 * @param {string} filePath - Absolute or relative file path.
 * @returns {Promise<any>}
 */
async function dynamicImport(filePath) {
  const absolutePath = resolve(filePath);
  const fileUrl = pathToFileURL(absolutePath).href;
  const module = await import(fileUrl);
  return module.default ?? module;
}

export { dynamicImport };
export default dynamicImport;
