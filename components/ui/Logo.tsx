import React from 'react';

interface LogoProps {
    className?: string;
    collapsed?: boolean;
    title?: String;
    subTitle?: String;
}

export const Logo: React.FC<LogoProps> = ({className = "", collapsed = false, title, subTitle}) => {
    // Brand Colors
    const colorPrimary = "#2563eb"; // blue-600
    const colorDark = "#1e293b";    // slate-800
    const colorLightBlue = "#eff6ff"; // blue-50

    if (collapsed) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"
                 aria-label="PanassetLite Logo">
                <defs>
                    <linearGradient id="cyber-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#17EAD9"/>
                        <stop offset="100%" stop-color="#6078EA"/>
                    </linearGradient>
                </defs>

                <g transform="translate(16, 16) scale(0.12)">
                    <rect x="-18" y="-6" width="36" height="12" rx="3" fill="url(#cyber-gradient)"/>
                </g>
                <g transform="translate(16, 16) scale(0.12) rotate(-90)">
                    <path fill="url(#cyber-gradient)"
                          d="M 100 100
                      H 0
                      V 80 H 80 V -80 H -80 V 0 H -100 V -100 H 100 Z"/>
                </g>
            </svg>
        );
    }

    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 32" width="180" height="32"
             aria-label="PanassetLite Logo">
            <defs>
                <linearGradient id="cyber-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#17EAD9"/>
                    <stop offset="100%" stop-color="#6078EA"/>
                </linearGradient>
            </defs>

            <g transform="translate(16, 16) scale(0.12)">
                <rect x="-18" y="-6" width="36" height="12" rx="3" fill="url(#cyber-gradient)"/>
            </g>
            <g transform="translate(16, 16) scale(0.12) rotate(-90)">
                <path fill="url(#cyber-gradient)"
                      d="M 100 100
                      H 0
                      V 80 H 80 V -80 H -80 V 0 H -100 V -100 H 100 Z"/>
            </g>

            <text
                x="40"
                y="22"
                fontFamily="'Inter', sans-serif"
                fontWeight="700"
                fontSize="18"
                fill={colorDark}
                letterSpacing="-0.02em"
            >
                {title}
            </text>

            <rect x="124" y="7" width="38" height="18" rx="6" fill={colorLightBlue}/>
            <text
                x="143"
                y="20"
                fontFamily="'Inter', sans-serif"
                fontWeight="600"
                fontSize="11"
                fill={colorPrimary}
                textAnchor="middle"
            >
                {subTitle}
            </text>
        </svg>
    );
};
