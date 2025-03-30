import { browser } from '$app/environment';
import { documents } from '$lib/stores/documents';
import { debounce } from 'lodash-es';
import type { EditorState } from '../stores/editor-state';
import { editorState } from '../stores/editor-state';

export function saveCurrentChapter(storyId: string, chapterId: string): void {
    if (!browser) return;
    localStorage.setItem(`current_chapter_${storyId}`, chapterId);
}

export function loadSavedChapter(storyId: string): string | null {
    if (!browser) return null;
    return localStorage.getItem(`current_chapter_${storyId}`);
}

export const debouncedSave = debounce(async (
    storyId: string,
    chapterId: string,
    content: string
) => {
    if (!browser) return;

    try {
        editorState.setSaveStatus('saving');
        await documents.saveChapter(storyId, chapterId, content);
        editorState.updateLastSaveTime();
        editorState.setUnsavedChanges(false);
        editorState.setSaveStatus('saved');
    } catch (err) {
        console.error('Error saving document:', err);
        editorState.setSaveStatus('error');
    }
}, 1000);

export async function saveImmediately(
    storyId: string,
    chapterId: string,
    content: string
): Promise<void> {
    if (!browser) return;

    try {
        await documents.saveChapter(storyId, chapterId, content);
        editorState.updateLastSaveTime();
        editorState.setUnsavedChanges(false);
    } catch (err) {
        console.error('Error saving document:', err);
    }
}

export function updateOnlineStatus(): void {
    if (!browser) return;
    const isOffline = !navigator.onLine;
    editorState.setOffline(isOffline);
    const state = editorState.subscribe((state) => {
        editorState.setSaveStatus(isOffline ? 'offline' : state.hasUnsavedChanges ? 'saving' : 'saved');
    });
    state(); // Unsubscribe
} 