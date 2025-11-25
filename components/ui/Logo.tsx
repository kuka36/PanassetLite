
import React from 'react';

interface LogoProps {
  className?: string;
  collapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "", collapsed = false }) => {
  // Brand Colors
  const colorPrimary = "#2563eb"; // blue-600
  const colorDark = "#1e293b";    // slate-800
  const colorLightBlue = "#eff6ff"; // blue-50

  if (collapsed) {
    return (
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="PanassetLite Logo"
      >
        <rect x="0" y="0" width="32" height="32" rx="8" fill={colorPrimary} />
        <path d="M10 10H16C19.3137 10 22 12.6863 22 16C22 19.3137 19.3137 22 16 22H13V22V26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="16" r="2" fill="white" />
      </svg>
    );
  }

  return (
    <svg 
      width="180" 
      height="32" 
      viewBox="0 0 180 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PanassetLite Logo"
    >
      {/* Icon Symbol */}
      <rect x="0" y="0" width="32" height="32" rx="8" fill={colorPrimary} />
      <path d="M10 10H16C19.3137 10 22 12.6863 22 16C22 19.3137 19.3137 22 16 22H13V22V26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="16" cy="16" r="2" fill="white" />

      {/* Text: Panasset */}
      <text 
        x="40" 
        y="22" 
        fontFamily="'Inter', sans-serif" 
        fontWeight="700" 
        fontSize="18" 
        fill={colorDark}
        letterSpacing="-0.02em"
      >
        Panasset
      </text>

      {/* Text: Lite (Styled as a sub-brand) */}
      {/* Using a decorative pill background for Lite */}
      <rect x="124" y="7" width="38" height="18" rx="6" fill={colorLightBlue} />
      <text 
        x="143" 
        y="20" 
        fontFamily="'Inter', sans-serif" 
        fontWeight="600" 
        fontSize="11" 
        fill={colorPrimary} 
        textAnchor="middle"
      >
        Lite
      </text>
    </svg>
  );
};
