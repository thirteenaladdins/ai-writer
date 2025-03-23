// In $lib/stores/document.ts
import { writable } from 'svelte/store';

function createDocumentTitleStore() {
    const { subscribe, set: originalSet, update } = writable('Untitled Document');
    
    return {
        subscribe,
        set: (value: string) => {
            // Always set the value as is, let components handle defaults
            originalSet(value);
        },
        update
    };
}

export const documentTitle = createDocumentTitleStore();
