import { editorState } from '../stores/editor-state';
import { debouncedSave, saveImmediately } from './save-manager';
import { insertLineBreak, insertTextAtCursor, removePlaceholders, updateWordAndCharCount, insertPlaceholder } from './text-manipulation';
import { getCursorPosition, isAtLineStart, hasTextAfterCursor, getCurrentLineRange } from './cursor';
import type { CursorPosition } from './cursor';

export interface EditorEventHandlers {
    handleInput: (editor: HTMLDivElement) => void;
    handleBlur: (editor: HTMLDivElement, storyId: string, chapterId: string | null) => void;
    handleKeydown: (
        event: KeyboardEvent,
        editor: HTMLDivElement,
        showInlinePrompt: (position: CursorPosition) => void
    ) => void;
    handleClick: (event: MouseEvent, editor: HTMLDivElement) => void;
    handleBeforeUnload: (event: BeforeUnloadEvent) => void;
}

export function createEditorEventHandlers(storyId: string): EditorEventHandlers {
    function handleInput(editor: HTMLDivElement): void {
        const { wordCount, charCount } = updateWordAndCharCount(editor);
        editorState.updateCounts(wordCount, charCount);
        editorState.setUnsavedChanges(true);
        
        const state = editorState.subscribe(state => {
            if (state.currentChapterId) {
                debouncedSave(storyId, state.currentChapterId, editor.innerHTML || '');
            }
        });
        state(); // Unsubscribe
    }

    function handleBlur(editor: HTMLDivElement, storyId: string, chapterId: string | null): void {
        const state = editorState.subscribe(state => {
            if (state.hasUnsavedChanges && chapterId) {
                saveImmediately(storyId, chapterId, editor.innerHTML || '');
            }
        });
        state(); // Unsubscribe
    }

    function handleKeydown(
        event: KeyboardEvent,
        editor: HTMLDivElement,
        showInlinePrompt: (position: CursorPosition) => void
    ): void {
        console.log('Keydown event:', event.key, event.metaKey, event.ctrlKey);

        if (event.key === 'Enter') {
            event.preventDefault();
            const selection = window.getSelection();
            if (selection) {
                insertLineBreak(editor, selection);
                handleInput(editor);
            }
        } else if (event.key.toLowerCase() === 'l' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const pos = getCursorPosition(editor, selection);
                showInlinePrompt(pos);
            }
        }

        removePlaceholders(editor);
    }

    function handleClick(event: MouseEvent, editor: HTMLDivElement): void {
        if (!editor) return;

        removePlaceholders(editor);

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // Check if we're directly clicking on text
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            const atLineStart = isAtLineStart(node, range.startOffset);
            const hasTextAfter = hasTextAfterCursor(node, range.startOffset);

            if ((node.textContent.trim() !== '' && !atLineStart) || (atLineStart && hasTextAfter)) {
                return;
            }
        }

        const { lineText } = getCurrentLineRange(editor, node);
        if (lineText !== '') return;

        // Insert placeholder at cursor position
        insertPlaceholder(editor, selection);
    }

    function handleBeforeUnload(event: BeforeUnloadEvent): void {
        const state = editorState.subscribe(state => {
            if (state.hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
        state(); // Unsubscribe
    }

    return {
        handleInput,
        handleBlur,
        handleKeydown,
        handleClick,
        handleBeforeUnload
    };
} 