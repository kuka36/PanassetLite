import React from 'react';
import { Github, ExternalLink } from 'lucide-react';
import { Card } from '../ui/Card';
import { Language } from '../../types/store';

interface FeedbackCardProps {
  t: (key: string) => string;
  language: Language;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ t, language }) => {
  return (
    <>
      <Card title={t('feedback')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg shrink-0">
              <Github size={22} />
            </div>
            <div>
              <div className="font-medium text-slate-800">{t('reportBug')}</div>
              <div className="text-sm text-slate-500">{t('githubDesc')}</div>
            </div>
          </div>
          <a
            href="https://github.com/kuka36/PanassetLite/issues"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0"
          >
            <Github size={16} />
            <span>{t('githubLinkText')}</span>
            <ExternalLink size={14} className="opacity-70" />
          </a>
        </div>
      </Card>

      <div className="text-center text-slate-400 text-sm pt-4">
        {language === 'zh' ? "盘资产·轻 v1.2.1 • 本地数据存储" : "PanassetLite v1.2.1 • Local Data Storage"}
      </div>
    </>
  );
};