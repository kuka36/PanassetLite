import React from 'react';
import logo from '@/_image/logo.svg';

interface LogoProps {
    className?: string;
    collapsed?: boolean;
    title?: string;
    subTitle?: string;
}

export const Logo: React.FC<LogoProps> = ({className = "", collapsed = false, title, subTitle}) => {
    if (collapsed) {
        return (
            <img
                src={logo}
                alt="PanassetLite Logo"
                className={className}
                width={32}
                height={32}
                style={{objectFit: 'contain'}}
            />
        );
    }

    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 32" width="180" height="32">
            <defs>
                <linearGradient id="cyber-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#17EAD9"/>
                    <stop offset="100%" stopColor="#6078EA"/>
                </linearGradient>
            </defs>
            <text
                x="0"
                y="22"
                fontFamily="'Inter', sans-serif"
                fontWeight="700"
                fontSize="18"
                fill="url(#cyber-gradient)"
                letterSpacing="-0.02em"
            >
                {title}.{subTitle}
            </text>
        </svg>
    );
};