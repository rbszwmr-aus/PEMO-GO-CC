/**
 * Entry point.
 *
 * The stylesheets are imported before the app so the generated token layers land
 * ahead of the layout rules that consume them.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './theme/palette.g.css';
import './theme/severity-tokens.g.css';
import './theme/style-4s.g.css';
import './theme/base.css';
import { App, initialRoute, preloadScreen } from './app.tsx';
import { loadFixtures } from './data/fixture-gate.ts';
import { DEFAULT_LOCALE, isLocale } from './i18n/locale.ts';
import { BootFailure } from './shell/LoadFailure.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

// The fixture corpus is its own chunk; in fixture mode the app renders once it has loaded (nothing in the entry reads a
// corpus). Live mode does not need it to start: a screen that renders from it fetches it then (`useFixtures`).
// The first route's screen chunks load in parallel, so the first paint is the screen, not a blank. If the corpus cannot
// load there is no app to show, so the page says so (with a way to try again) instead of staying white.
const { screen, live } = initialRoute();
void Promise.all([live ? undefined : loadFixtures(), preloadScreen(screen)])
  .then(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('The app could not start', error);
    const lang = new URLSearchParams(window.location.search).get('lang');
    createRoot(root).render(<BootFailure locale={isLocale(lang) ? lang : DEFAULT_LOCALE} />);
  });
