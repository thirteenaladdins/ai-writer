import { writable } from 'svelte/store';

export interface Document {
    id: string;
    title: string;
    content: string;
    updatedAt: Date;
}

function createDocumentsStore() {
    const { subscribe, set, update } = writable<Record<string, Document>>({});

    return {
        subscribe,
        set: (value: Record<string, Document>) => {
            // Persist to localStorage when setting the entire store
            Object.entries(value).forEach(([id, doc]) => {
                localStorage.setItem(
                    `document_${id}`,
                    JSON.stringify({
                        title: doc.title,
                        content: doc.content,
                        updatedAt: doc.updatedAt.toISOString()
                    })
                );
            });
            set(value);
        },
        update: (updater: (value: Record<string, Document>) => Record<string, Document>) => {
            update(store => {
                const newStore = updater(store);
                // Persist changes to localStorage
                Object.entries(newStore).forEach(([id, doc]) => {
                    localStorage.setItem(
                        `document_${id}`,
                        JSON.stringify({
                            title: doc.title,
                            content: doc.content,
                            updatedAt: doc.updatedAt.toISOString()
                        })
                    );
                });
                return newStore;
            });
        },
        loadFromStorage: () => {
            const docs: Record<string, Document> = {};
            
            // First check if we need to migrate legacy document format
            const legacyContent = localStorage.getItem('document_content');
            const legacyTitle = localStorage.getItem('document_title');
            
            if (legacyContent && !localStorage.getItem('document_default-document')) {
                console.log('Migrating legacy document to new format');
                localStorage.setItem(
                    'document_default-document',
                    JSON.stringify({
                        title: legacyTitle || 'Untitled Document',
                        content: legacyContent,
                        updatedAt: new Date().toISOString()
                    })
                );
            }
            
            // Now load all documents in the new format
            Object.entries(localStorage)
                .filter(([key]) => key.startsWith('document_') && !['document_content', 'document_title', 'document_version', 'document_settings'].includes(key))
                .forEach(([key, value]) => {
                    try {
                        const doc = JSON.parse(value);
                        const id = key.replace('document_', '');
                        docs[id] = {
                            id,
                            title: doc.title || 'Untitled Document',
                            content: doc.content || '',
                            updatedAt: new Date(doc.updatedAt || Date.now())
                        };
                        console.log(`Loaded document: ${id} - ${doc.title}`);
                    } catch (e) {
                        console.error(`Failed to parse document: ${key}`, e);
                    }
                });
            
            console.log(`Loaded ${Object.keys(docs).length} documents`);
            set(docs);
        }
    };
}

export const documents = createDocumentsStore(); 