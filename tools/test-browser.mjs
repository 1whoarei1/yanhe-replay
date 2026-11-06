import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import {cp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';

// The bundled Chromium channel supports MV3 extensions in headless mode.
// An explicit executable override is useful when verifying an installed browser.
export async function launchTestBrowser(profile, extension) {
  // Keep synthetic API fixtures independent of real bundled metadata.
  const fixtureExtension=join(profile,'fixture-extension');
  await cp(extension,fixtureExtension,{recursive:true});
  await writeFile(join(fixtureExtension,'bundled-catalogs.json'),JSON.stringify({schema:1,catalogs:{}}));
  await rm(join(fixtureExtension,'legacy-session-index.json'),{force:true});
  extension=fixtureExtension;
  const executablePath = process.env.BROWSER_EXECUTABLE || process.env.EDGE_EXECUTABLE;
  if (executablePath && !existsSync(executablePath)) {
    throw new Error('BROWSER_EXECUTABLE does not exist.');
  }
  return chromium.launchPersistentContext(profile, {
    ...(executablePath ? { executablePath } : { channel: 'chromium' }),
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1440, height: 1000 }
  });
}
