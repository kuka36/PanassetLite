import { AssetMetadata, Transaction } from '../types/domain';
import { AppSettings } from '../types/store';

export interface PortfolioState {
    assetMetas: AssetMetadata[];
    transactions: Transaction[];
    settings: AppSettings;
}

export type PortfolioAction =
    | { type: 'SET_INITIAL_DATA'; payload: { assetMetas: AssetMetadata[]; transactions: Transaction[]; settings?: AppSettings } }
    | { type: 'ADD_ASSET'; payload: { meta: AssetMetadata; initialTransaction?: Transaction } }
    | { type: 'EDIT_ASSET'; payload: AssetMetadata }
    | { type: 'DELETE_ASSET'; payload: string }
    | { type: 'ADD_TRANSACTION'; payload: Transaction }
    | { type: 'EDIT_TRANSACTION'; payload: Transaction }
    | { type: 'DELETE_TRANSACTION'; payload: string }
    | { type: 'UPDATE_ASSET_PRICE'; payload: { id: string; price: number } }
    | { type: 'UPDATE_METAS'; payload: AssetMetadata[] | ((prev: AssetMetadata[]) => AssetMetadata[]) }
    | { type: 'UPDATE_TRANSACTIONS'; payload: Transaction[] | ((prev: Transaction[]) => Transaction[]) }
    | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
    | { type: 'CLEAR_DATA' };

export const portfolioReducer = (state: PortfolioState, action: PortfolioAction): PortfolioState => {
    switch (action.type) {
        case 'SET_INITIAL_DATA':
            return {
                ...state,
                assetMetas: action.payload.assetMetas,
                transactions: action.payload.transactions,
                settings: action.payload.settings || state.settings
            };

        case 'ADD_ASSET': {
            const newState = {
                ...state,
                assetMetas: [...state.assetMetas, action.payload.meta]
            };
            if (action.payload.initialTransaction) {
                newState.transactions = [...state.transactions, action.payload.initialTransaction];
            }
            return newState;
        }

        case 'EDIT_ASSET':
            return {
                ...state,
                assetMetas: state.assetMetas.map(m => m.id === action.payload.id ? action.payload : m)
            };

        case 'DELETE_ASSET':
            return {
                ...state,
                assetMetas: state.assetMetas.filter(m => m.id !== action.payload),
                transactions: state.transactions.filter(t => t.assetId !== action.payload)
            };

        case 'ADD_TRANSACTION':
            return {
                ...state,
                transactions: [...state.transactions, action.payload]
            };

        case 'EDIT_TRANSACTION':
            return {
                ...state,
                transactions: state.transactions.map(t => t.id === action.payload.id ? action.payload : t)
            };

        case 'DELETE_TRANSACTION':
            return {
                ...state,
                transactions: state.transactions.filter(t => t.id !== action.payload)
            };

        case 'UPDATE_ASSET_PRICE':
            return {
                ...state,
                assetMetas: state.assetMetas.map(a =>
                    a.id === action.payload.id
                        ? { ...a, currentPrice: action.payload.price, lastUpdated: Date.now() }
                        : a
                )
            };

        case 'UPDATE_METAS':
            return {
                ...state,
                assetMetas: typeof action.payload === 'function'
                    ? action.payload(state.assetMetas)
                    : action.payload
            };

        case 'UPDATE_TRANSACTIONS':
            return {
                ...state,
                transactions: typeof action.payload === 'function'
                    ? action.payload(state.transactions)
                    : action.payload
            };

        case 'UPDATE_SETTINGS':
            return {
                ...state,
                settings: { ...state.settings, ...action.payload }
            };

        case 'CLEAR_DATA':
            return {
                ...state,
                assetMetas: [],
                transactions: []
            };

        default:
            return state;
    }
};
