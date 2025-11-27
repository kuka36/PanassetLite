import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext';
import { Layout } from './components/Layout';
import { TransactionHistory } from './components/TransactionHistory';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { AssetsView } from './components/AssetsView';
import { DashboardView } from './components/DashboardView';

const App: React.FC = () => {
  return (
    <PortfolioProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/assets" element={<AssetsView />} />
            <Route path="/history" element={<TransactionHistory />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </HashRouter>
    </PortfolioProvider>
  );
};

export default App;