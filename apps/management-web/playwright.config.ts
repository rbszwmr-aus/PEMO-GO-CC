import { defineConfig } from '@playwright/test';

/**
 * The font-capability check is a PROJECT DEPENDENCY, not just the first file.
 *
 * Playwright does not order test files, so "runs first" has to be structural.
 * Every browser project depends on `font-capability`, so if this host cannot
 * draw Traditional Chinese the layout assertions never run at all — rather than
 * running and passing against tofu, which is UI-019-ST finding F3.
 */
export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  forbidOnly: true,
  reporter: process.env.CI ? 'list' : 'list',
  use: {
    // 1440 wide matches the export's declared preview width. The HEIGHT is this
    // suite's own choice: the export declares 840, not 900. The comment that
    // stood here claimed 900 was the export's figure, which was false — the
    // third comment on this project asserting something untrue about the code
    // beside it. The VALUE is a fine choice for a layout suite and stays; only
    // the claim was wrong. Fixing the viewport instead would repair the wrong
    // artefact.
    viewport: { width: 1440, height: 900 },
    locale: 'en-HK',
    timezoneId: 'Asia/Hong_Kong',
  },
  projects: [
    { name: 'font-capability', testMatch: /font-capability\.spec\.ts/ },
    {
      name: 'screens',
      testIgnore: /font-capability\.spec\.ts/,
      dependencies: ['font-capability'],
    },
  ],
});
