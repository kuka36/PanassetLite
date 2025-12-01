import { AssetType } from '../types/domain';

export const isManualValuation = (type: AssetType) =>
    type === AssetType.REAL_ESTATE || type === AssetType.LIABILITY || type === AssetType.OTHER || type === AssetType.CASH;
