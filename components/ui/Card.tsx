import React, { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, children, className = "", action }) => {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex justify-between items-center">
          {title && <div className="font-semibold text-slate-800 text-base sm:text-lg flex items-center gap-3">{title}</div>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
};