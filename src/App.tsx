import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { AddMemoryPage } from './pages/AddMemoryPage';
import { HomePage } from './pages/HomePage';
import { MemoriesPage } from './pages/MemoriesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PhotosPage } from './pages/PhotosPage';
import { UploadPhotosPage } from './pages/UploadPhotosPage';

export function App() {
  return (
    <SiteConfigProvider>
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Skip to the main content
        </a>

        <Header />

        <main id="main-content" className="app-main" tabIndex={-1}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/memories" element={<MemoriesPage />} />
              <Route path="/photos" element={<PhotosPage />} />
              <Route path="/add-memory" element={<AddMemoryPage />} />
              <Route path="/upload-photos" element={<UploadPhotosPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </main>

        <Footer />
      </div>
    </SiteConfigProvider>
  );
}
