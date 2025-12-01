import { AssetMetadata } from '../types/domain';

export const SequenceService = {
    /**
     * Generates a unique ID for a new asset.
     * Uses UUID v4 to avoid conflicts during data import.
     * 
     * @returns Unique ID as a string
     */
    generateId(): string {
        return crypto.randomUUID();
    },

    /**
     * @deprecated Use generateId() instead.
     * Generates the next auto-incrementing ID based on existing assets.
     */
    getNextId(_assets: AssetMetadata[]): string {
        // Return UUID instead of auto-incrementing number
        return this.generateId();
    }
};
