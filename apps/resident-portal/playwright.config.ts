import { defineConfig } from '@playwright/test';

/**
 * The browser suite runs against the PRODUCTION build (served in-process by the
 * harness), not the dev server — so the dev toolbar is genuinely absent and the
 * states are reached by URL, which is how they are addressable in the first place.
 *
 * The font-capability check is a PROJECT DEPENDENCY, not just the first file.
 * Playwright does not order files, so "runs first" is structural: every shell
 * project depends on `font-capability`, so a host that cannot draw Traditional
 * Chinese never runs the layout assertions — rather than running them against
 * tofu (UI-019-ST F3).
 */
export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    viewport: { width: 1440, height: 900 },
    locale: 'en-HK',
    timezoneId: 'Asia/Hong_Kong',
  },
  projects: [
    { name: 'font-capability', testMatch: /font-capability\.spec\.ts/ },
    {
      name: 'shell',
      testIgnore: /font-capability\.spec\.ts/,
      dependencies: ['font-capability'],
    },
  ],
});
