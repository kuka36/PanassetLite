import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext';
import { Layout } from './components/Layout';
import { Toast } from './components/ui/Toast';

const DashboardView = lazy(() =>
  import('./components/DashboardView').then(m => ({ default: m.DashboardView }))
);
const AssetsView = lazy(() =>
  import('./components/AssetsView').then(m => ({ default: m.AssetsView }))
);
const TransactionHistory = lazy(() =>
  import('./components/TransactionHistory').then(m => ({ default: m.TransactionHistory }))
);
const Analytics = lazy(() =>
  import('./components/Analytics').then(m => ({ default: m.Analytics }))
);
const Settings = lazy(() =>
  import('./components/Settings').then(m => ({ default: m.Settings }))
);

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh] text-slate-400 text-sm">
    Loading…
  </div>
);

const App: React.FC = () => {
  return (
    <>
      <PortfolioProvider>
        <HashRouter>
          <Layout>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<DashboardView />} />
                <Route path="/assets" element={<AssetsView />} />
                <Route path="/history" element={<TransactionHistory />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </Layout>
        </HashRouter>
      </PortfolioProvider>
      <Toast />
    </>
  );
};

export default App;
