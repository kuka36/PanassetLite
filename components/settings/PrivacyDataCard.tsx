import React from 'react';
import { Shield, Eye, EyeOff, Download, FileText, Upload, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';

interface PrivacyDataCardProps {
  isPrivacyMode: boolean;
  onPrivacyToggle: () => void;
  importStatus: { msg: string; type: 'success' | 'error' | 'warning' } | null;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportClick: () => void;
  onResetClick: () => void;
  t: (key: string) => string;
}

export const PrivacyDataCard: React.FC<PrivacyDataCardProps> = ({
  isPrivacyMode,
  onPrivacyToggle,
  importStatus,
  onExport,
  onImport,
  fileInputRef,
  onImportClick,
  onResetClick,
  t,
}) => {
  return (
    <Card title={t('privacyDataManagement')}>
      <div className="space-y-6">
        {/* Privacy Mode Professional Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl transition-all ${isPrivacyMode ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-400'}`}>
              {isPrivacyMode ? <EyeOff size={24} /> : <Eye size={24} />}
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-base">{t('privacyMode')}</div>
              <div className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{t('privacyModeDesc')}</div>
            </div>
          </div>

          <button
            onClick={onPrivacyToggle}
            className={`relative w-14 h-8 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isPrivacyMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <span
              className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${isPrivacyMode ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
          <Shield size={20} className="text-emerald-600 mt-0.5 shrink-0" />
          <span className="text-sm text-emerald-800 leading-relaxed font-medium">
            {t('localDataSecurity')}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 my-4"></div>

        {/* Data Management Section */}
        {importStatus && (
          <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${importStatus.type === 'success' ? 'bg-green-50 text-green-700' : (importStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700')}`}>
            {importStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {importStatus.msg}
          </div>
        )}

        {/* Data Import/Export Grid - Unified Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Card */}
          <div className="group bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 bg-blue-500 text-white rounded-lg group-hover:bg-blue-600 transition-colors shadow-sm">
                <Download size={20} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-800 text-sm mb-1">
                  {t('exportUnified')}
                </div>
                <div className="text-xs text-slate-600 leading-relaxed">
                  {t('exportUnifiedDesc')}
                </div>
              </div>
            </div>
            <button
              onClick={onExport}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm shadow-sm flex items-center justify-center gap-2"
            >
              <FileText size={16} />
              {t('exportUnified')}
            </button>
          </div>

          {/* Import Card */}
          <div className="group bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 hover:shadow-md hover:border-emerald-200 transition-all">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 bg-emerald-500 text-white rounded-lg group-hover:bg-emerald-600 transition-colors shadow-sm">
                <Upload size={20} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-800 text-sm mb-1">
                  {t('importUnified')}
                </div>
                <div className="text-xs text-slate-600 leading-relaxed">
                  {t('importUnifiedDesc')}
                </div>
              </div>
            </div>
            <button
              onClick={onImportClick}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors text-sm shadow-sm flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              {t('importUnified')}
            </button>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={onImport}
              className="hidden"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 my-2"></div>

        {/* Reset */}
        <button
          onClick={onResetClick}
          className="w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
        >
          <Trash2 size={16} />
          {t('resetData')}
        </button>
      </div>
    </Card>
  );
};
