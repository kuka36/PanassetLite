
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PieChart, Wallet, Settings, Menu, X, History, ChevronLeft, ChevronRight, BookOpen, Sparkles } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { AIChatAssistant } from './AIChatAssistant';
import { Logo } from './ui/Logo';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, settings } = usePortfolio();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Initialize from localStorage or default to expanded (false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('investflow_sidebar_collapsed');
    return saved === 'true';
  });

  // Persist state changes
  useEffect(() => {
    localStorage.setItem('investflow_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Logic: AI Assistant is enabled if the Key is present (Gemini or DeepSeek).
  const isAiEnabled = !!(settings.geminiApiKey || settings.deepSeekApiKey);

    const title = settings.language === 'zh' ? "盘资产" : "Panasset";
    const subTitle = settings.language === 'zh' ? "轻" : "Lite";

  const NavItem = ({ to, icon, label, onClick }: { to: string, icon: React.ReactNode, label: string, onClick?: () => void }) => (
    <NavLink 
      to={to} 
      onClick={onClick}
      className={({ isActive }) => `
        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative
        ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-100'}
        ${isCollapsed ? 'justify-center px-2' : ''}
      `}
      title={isCollapsed ? label : undefined}
    >
      <div className="shrink-0">{icon}</div>
      {!isCollapsed && <span className="font-medium whitespace-nowrap overflow-hidden transition-all duration-300 opacity-100">{label}</span>}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      {/* Sidebar Desktop */}
      <aside 
        className={`hidden md:flex flex-col bg-white border-r border-slate-100 h-screen fixed left-0 top-0 z-20 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Header / Logo */}
        <div className={`p-6 flex flex-col justify-center ${isCollapsed ? 'items-center px-0' : ''}`}>
            {/* Logo Component */}
            <div className={`transition-all duration-300 ${isCollapsed ? 'scale-90' : ''}`}>
                <Logo collapsed={isCollapsed} title={title} subTitle={subTitle} />
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-2 mt-2 overflow-y-auto overflow-x-hidden">
          <NavItem to="/" icon={<LayoutDashboard size={20}/>} label={t('dashboard')} />
          <NavItem to="/assets" icon={<Wallet size={20}/>} label={t('assets')} />
          <NavItem to="/history" icon={<History size={20}/>} label={t('history')} />
          <NavItem to="/analytics" icon={<PieChart size={20}/>} label={t('analytics')} />
          <NavItem to="/settings" icon={<Settings size={20}/>} label={t('settings')} />
        </nav>

        {/* Footer / Toggle */}
        <div className="p-4 border-t border-slate-100 flex flex-col gap-4">
            
            {/* AI Assistant Trigger (Desktop) */}
            {isAiEnabled && (
                <button
                    onClick={() => setIsChatOpen(prev => !prev)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border border-transparent ${
                        isChatOpen 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-200'
                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                    title={t('aiAssistant')}
                >
                    <Sparkles size={20} className={isChatOpen ? "text-white" : "text-indigo-600"} />
                    {!isCollapsed && <span className="font-semibold">{t('aiAssistant')}</span>}
                </button>
            )}

            {/* Toggle Button */}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>

            {!isCollapsed ? (
              <div className="animate-fade-in">
                <a 
                    href="https://mp.weixin.qq.com/s/du0wh1As2s-casSadFAgZQ"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 text-sm font-medium text-slate-600 hover:text-green-600 transition-colors mb-2 group px-2"
                >
                    <BookOpen size={18} className="text-slate-400 group-hover:text-green-500 shrink-0"/>
                    <span className="whitespace-nowrap">{t('about')}</span>
                </a>

                <div className="text-xs text-slate-400 px-2 leading-tight">
                    {t('disclaimer')}
                </div>
              </div>
            ) : (
               <div className="flex flex-col gap-2 items-center">
                 <a 
                    href="https://mp.weixin.qq.com/s/du0wh1As2s-casSadFAgZQ"
                    target="_blank"
                    rel="noreferrer"
                    className="flex justify-center text-slate-400 hover:text-green-600 transition-colors"
                    title={t('about')}
                >
                    <BookOpen size={20} />
                </a>
               </div>
            )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white z-30 px-4 py-3 border-b border-slate-100 flex justify-between items-center shadow-sm">
        <div className="flex items-center">
             <Logo collapsed={false} className="h-8 w-auto" />
        </div>
        <div className="flex items-center gap-2">
            {isAiEnabled && (
                <button 
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`p-2 rounded-lg transition-colors ${isChatOpen ? 'bg-indigo-600 text-white' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                >
                    <Sparkles size={20} />
                </button>
            )}
            <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-20 bg-slate-900/20 backdrop-blur-sm md:hidden pt-16" onClick={() => setIsMobileMenuOpen(false)}>
           <div className="bg-white border-b border-slate-100 shadow-xl p-4 animate-in slide-in-from-top-5 duration-200" onClick={e => e.stopPropagation()}>
              <nav className="space-y-2">
                 <NavItem to="/" icon={<LayoutDashboard size={20}/>} label={t('dashboard')} onClick={() => setIsMobileMenuOpen(false)} />
                 <NavItem to="/assets" icon={<Wallet size={20}/>} label={t('assets')} onClick={() => setIsMobileMenuOpen(false)} />
                 <NavItem to="/history" icon={<History size={20}/>} label={t('history')} onClick={() => setIsMobileMenuOpen(false)} />
                 <NavItem to="/analytics" icon={<PieChart size={20}/>} label={t('analytics')} onClick={() => setIsMobileMenuOpen(false)} />
                 <NavItem to="/settings" icon={<Settings size={20}/>} label={t('settings')} onClick={() => setIsMobileMenuOpen(false)} />
                 
                 <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                    <a 
                        href="https://mp.weixin.qq.com/s/du0wh1As2s-casSadFAgZQ"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        <BookOpen size={20}/>
                        <span className="font-medium">{t('about')}</span>
                    </a>
                 </div>
              </nav>
           </div>
        </div>
      )}

      {/* Main Content - Dynamic Margin based on Sidebar State */}
      <main 
        className={`flex-1 pt-20 md:pt-8 md:p-8 p-4 w-full transition-all duration-300 ease-in-out ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}
      >
        {children}
      </main>
      
      {/* Global AI Chat Assistant */}
      {isAiEnabled && (
        <AIChatAssistant 
           isOpen={isChatOpen} 
           onClose={() => setIsChatOpen(false)}
           isSidebarCollapsed={isCollapsed}
        />
      )}
    </div>
  );
};
