import React, { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AssetList } from './components/AssetList';
import { AddAssetModal } from './components/AddAssetModal';
import { GeminiAdvisor } from './components/GeminiAdvisor';
import { Plus, RefreshCw } from 'lucide-react';

const DashboardView: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { refreshPrices } = usePortfolio();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Overview</h1>
          <p className="text-slate-500">Welcome back, here's your portfolio performance.</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={refreshPrices}
            className="px-4 py-2.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium rounded-xl shadow-sm transition-all flex items-center gap-2"
           >
             <RefreshCw size={18}/>
             <span className="hidden sm:inline">Refresh</span>
           </button>
           <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
           >
             <Plus size={20}/>
             <span>Add Asset</span>
           </button>
        </div>
      </div>

      <GeminiAdvisor />
      <Dashboard />
      <AssetList />
      
      <AddAssetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

const AssetsView: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800">Assets Management</h1>
             <button 
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm flex items-center gap-2"
            >
                <Plus size={18}/> Add
            </button>
        </div>
        <AssetList />
        <AddAssetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

// Placeholder for other routes
const Placeholder: React.FC<{title: string}> = ({title}) => (
    <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-2xl">
        <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-400">{title}</h2>
            <p className="text-slate-400">Coming soon in v2.0</p>
        </div>
    </div>
);

const App: React.FC = () => {
  return (
    <PortfolioProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/assets" element={<AssetsView />} />
            <Route path="/analytics" element={<Placeholder title="Advanced Analytics" />} />
            <Route path="/settings" element={<Placeholder title="Settings" />} />
          </Routes>
        </Layout>
      </HashRouter>
    </PortfolioProvider>
  );
};

export default App;