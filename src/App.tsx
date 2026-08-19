import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { RequireRole } from './components/RequireRole';
import { SessionProvider } from './context/SessionContext';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { AddMemoryPage } from './pages/AddMemoryPage';
import { HomePage } from './pages/HomePage';
import { InvitePage } from './pages/InvitePage';
import { MemoriesPage } from './pages/MemoriesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PhotosPage } from './pages/PhotosPage';
import { UploadPhotosPage } from './pages/UploadPhotosPage';

export function App() {
  return (
    <SiteConfigProvider>
      <SessionProvider>
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
                <Route
                  path="/add-memory"
                  element={
                    <RequireRole action="add a memory">
                      <AddMemoryPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/upload-photos"
                  element={
                    <RequireRole action="upload photographs">
                      <UploadPhotosPage />
                    </RequireRole>
                  }
                />
                <Route path="/invite/:token" element={<InvitePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ErrorBoundary>
          </main>

          <Footer />
        </div>
      </SessionProvider>
    </SiteConfigProvider>
  );
}
