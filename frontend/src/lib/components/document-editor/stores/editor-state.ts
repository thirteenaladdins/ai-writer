import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface EditorState {
    isLoading: boolean;
    error: string | null;
    wordCount: number;
    charCount: number;
    saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden';
    hasUnsavedChanges: boolean;
    isOffline: boolean;
    lastSaveTime: string;
    currentChapterId: string | null;
}

const initialState: EditorState = {
    isLoading: true,
    error: null,
    wordCount: 0,
    charCount: 0,
    saveStatus: 'saved',
    hasUnsavedChanges: false,
    isOffline: false,
    lastSaveTime: new Date().toISOString(),
    currentChapterId: null
};

function createEditorStore() {
    const { subscribe, set, update } = writable<EditorState>(initialState);

    return {
        subscribe,
        set,
        update,
        setLoading: (loading: boolean) => update(state => ({ ...state, isLoading: loading })),
        setError: (error: string | null) => update(state => ({ ...state, error })),
        updateCounts: (wordCount: number, charCount: number) => 
            update(state => ({ ...state, wordCount, charCount })),
        setSaveStatus: (saveStatus: EditorState['saveStatus']) => 
            update(state => ({ ...state, saveStatus })),
        setUnsavedChanges: (hasUnsavedChanges: boolean) => 
            update(state => ({ ...state, hasUnsavedChanges })),
        setOffline: (isOffline: boolean) => 
            update(state => ({ ...state, isOffline })),
        updateLastSaveTime: () => 
            update(state => ({ ...state, lastSaveTime: new Date().toISOString() })),
        setCurrentChapter: (chapterId: string | null) => 
            update(state => ({ ...state, currentChapterId: chapterId })),
        reset: () => set(initialState)
    };
}

export const editorState = createEditorStore(); 