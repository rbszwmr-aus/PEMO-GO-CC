/**
 * Entry point. Stylesheets import before the app so the generated token layers
 * land ahead of the layout rules that consume them.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './theme/palette.g.css';
import './theme/severity-tokens.g.css';
import './theme/style-4s.g.css';
import './theme/base.css';
import './theme/helpdesk.css';
import './theme/invoices.css';
import './theme/visitor-pass.css';
import { App } from './app.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
