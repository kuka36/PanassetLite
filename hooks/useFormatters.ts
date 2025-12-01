import { usePortfolio } from '../context/PortfolioContext';

export const useFormatters = () => {
    const { settings } = usePortfolio();

    const formatCurrency = (val: number) => {
        if (settings.isPrivacyMode) return '••••••';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: settings.baseCurrency,
            maximumFractionDigits: 0
        }).format(val);
    };

    const formatPercent = (val: number) => {
        if (settings.isPrivacyMode) return '•••%';
        return `${val.toFixed(2)}%`;
    };

    return {
        formatCurrency,
        formatPercent
    };
};
