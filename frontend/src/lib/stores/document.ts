// In $lib/stores/document.ts
import { writable } from 'svelte/store';

export const DEFAULT_TITLE = 'Untitled Document';

interface DocumentTitleStore {
    subscribe: (run: (value: string) => void) => () => void;
    set: (value: string) => void;
    update: (updater: (value: string) => string) => void;
}

function createDocumentTitleStore(): DocumentTitleStore {
    const { subscribe, set: originalSet, update } = writable<string>(DEFAULT_TITLE);
    
    return {
        subscribe,
        set: (value: string) => {
            // Validate input
            if (typeof value !== 'string') {
                console.error('Invalid document title type:', typeof value);
                return;
            }
            
            // Trim whitespace and ensure max length
            const trimmedValue = value.trim();
            const finalValue = trimmedValue.slice(0, 100); // Reasonable max length
            
            originalSet(finalValue);
        },
        update
    };
}

export const documentTitle = createDocumentTitleStore();
