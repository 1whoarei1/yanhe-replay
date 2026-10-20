import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

// The bundled Chromium channel supports MV3 extensions in headless mode.
// An explicit executable override is useful when verifying an installed browser.
export function launchTestBrowser(profile, extension) {
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
