import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { appConfig } from './config/appConfig';
import './styles/global.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Could not find the #root element to mount the application into.');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      {/*
        Real URLs rather than hash URLs, so the same routes work unchanged on
        Cloudflare Pages. `basename` comes from the build's base path, which is
        "/" locally and "/<repository>/" on GitHub Pages.
      */}
      <BrowserRouter basename={appConfig.routerBasename}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
