import { editorState } from '../stores/editor-state';
import { debouncedSave, saveImmediately } from './save-manager';
import { insertLineBreak, insertTextAtCursor, removePlaceholders, updateWordAndCharCount, insertPlaceholder } from './text-manipulation';
import { getCursorPosition, isAtLineStart, hasTextAfterCursor, getCurrentLineRange } from './cursor';
import type { CursorPosition } from './cursor';
import { v4 as uuidv4 } from 'uuid';

interface Block {
    id: string;
    content: string;
    type: 'text' | 'heading' | 'list' | 'code';
    order: number;
    selected?: boolean;
}

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
    initializeEditor: (editor: HTMLDivElement) => void;
    handleSelectionChange: (editor: HTMLDivElement) => void;
}

export function createEditorEventHandlers(storyId: string): EditorEventHandlers {
    let blocks: Block[] = [];
    let activeBlockId: string | null = null;

    function getBlockFromNode(node: Node): { block: Block | null; element: HTMLElement | null } {
        const blockElement = node.nodeType === Node.TEXT_NODE 
            ? node.parentElement?.closest('[data-block-id]')
            : (node as HTMLElement).closest('[data-block-id]');
        
        if (!blockElement) return { block: null, element: null };
        
        const blockId = blockElement.getAttribute('data-block-id');
        const block = blockId ? blocks.find(b => b.id === blockId) ?? null : null;
        
        return { block, element: blockElement as HTMLElement };
    }

    function updateBlockSelection(editor: HTMLDivElement, selection: Selection) {
        // Reset all block selections
        blocks.forEach(block => block.selected = false);
        
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const { block: startBlock } = getBlockFromNode(range.startContainer);
        const { block: endBlock } = getBlockFromNode(range.endContainer);
        
        if (!startBlock || !endBlock) return;
        
        const startIdx = blocks.findIndex(b => b.id === startBlock.id);
        const endIdx = blocks.findIndex(b => b.id === endBlock.id);
        
        if (startIdx === -1 || endIdx === -1) return;
        
        // Mark blocks as selected
        for (let i = Math.min(startIdx, endIdx); i <= Math.max(startIdx, endIdx); i++) {
            blocks[i].selected = true;
            const element = editor.querySelector(`[data-block-id="${blocks[i].id}"]`);
            if (element) {
                element.classList.add('selected');
            }
        }
    }

    function initializeEditor(editor: HTMLDivElement): void {
        // Make the container contenteditable
        editor.contentEditable = 'true';
        
        // Create initial block if none exists
        if (blocks.length === 0) {
            const initialBlock: Block = {
                id: uuidv4(),
                content: '',
                type: 'text',
                order: 0,
                selected: false
            };
            blocks.push(initialBlock);
            
            const blockElement = document.createElement('div');
            blockElement.className = 'block';
            blockElement.setAttribute('data-block-id', initialBlock.id);
            blockElement.setAttribute('role', 'textbox');
            blockElement.setAttribute('aria-multiline', 'true');
            editor.appendChild(blockElement);
        }

        // Add selection change listener
        document.addEventListener('selectionchange', () => {
            handleSelectionChange(editor);
        });
    }

    function handleSelectionChange(editor: HTMLDivElement): void {
        const selection = window.getSelection();
        if (!selection) return;
        
        updateBlockSelection(editor, selection);
        
        // Update active block
        if (selection.rangeCount) {
            const { block } = getBlockFromNode(selection.getRangeAt(0).startContainer);
            if (block) {
                activeBlockId = block.id;
                // Update active block styling
                editor.querySelectorAll('.block').forEach(el => el.classList.remove('active'));
                const activeElement = editor.querySelector(`[data-block-id="${block.id}"]`);
                if (activeElement) {
                    activeElement.classList.add('active');
                }
            }
        }
    }

    function handleInput(editor: HTMLDivElement): void {
        const { wordCount, charCount } = updateWordAndCharCount(editor);
        editorState.updateCounts(wordCount, charCount);
        editorState.setUnsavedChanges(true);
        
        // Update all blocks content
        const blockElements = editor.querySelectorAll('[data-block-id]');
        blockElements.forEach(element => {
            const blockId = element.getAttribute('data-block-id');
            if (blockId) {
                const blockIndex = blocks.findIndex(b => b.id === blockId);
                if (blockIndex !== -1) {
                    const content = element.textContent || '';
                    blocks[blockIndex].content = content;
                    
                    // Remove any BR elements that might have been added
                    const brs = element.getElementsByTagName('br');
                    Array.from(brs).forEach(br => br.remove());
                    
                    // Ensure empty blocks maintain height
                    if (content === '') {
                        element.innerHTML = '';
                    }
                }
            }
        });
        
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
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const { block: startBlock, element: startElement } = getBlockFromNode(range.startContainer);
        const { block: endBlock, element: endElement } = getBlockFromNode(range.endContainer);

        if (!startBlock || !startElement) return;

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();

            // Handle multi-block selection
            if (endBlock && endBlock !== startBlock) {
                // Delete selected blocks
                const startIndex = blocks.findIndex(b => b.id === startBlock.id);
                const endIndex = blocks.findIndex(b => b.id === endBlock.id);
                if (startIndex === -1 || endIndex === -1) return;

                const blocksToRemove = blocks.slice(startIndex + 1, endIndex + 1);
                blocksToRemove.forEach(block => {
                    const element = editor.querySelector(`[data-block-id="${block.id}"]`);
                    element?.remove();
                });
                blocks = blocks.filter(b => !blocksToRemove.includes(b));
            }

            const cursorOffset = range.startOffset;
            const blockContent = startElement.textContent || '';

            // Split content at cursor position
            const contentBefore = blockContent.slice(0, cursorOffset);
            const contentAfter = blockContent.slice(cursorOffset);

            // Update current block
            startBlock.content = contentBefore;
            startElement.textContent = contentBefore;

            // Create new block
            const newBlock: Block = {
                id: uuidv4(),
                content: contentAfter,
                type: 'text',
                order: startBlock.order + 1,
                selected: false
            };

            // Update order of subsequent blocks
            blocks = blocks.map(b => 
                b.order > startBlock.order 
                    ? { ...b, order: b.order + 1 } 
                    : b
            );

            // Insert new block
            const blockIndex = blocks.findIndex(b => b.id === startBlock.id);
            blocks.splice(blockIndex + 1, 0, newBlock);

            // Create and insert new block element
            const newBlockElement = document.createElement('div');
            newBlockElement.className = 'block';
            newBlockElement.setAttribute('data-block-id', newBlock.id);
            newBlockElement.textContent = contentAfter;
            startElement.after(newBlockElement);

            // Focus new block
            const newRange = document.createRange();
            newRange.setStart(newBlockElement.firstChild || newBlockElement, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            activeBlockId = newBlock.id;
            handleInput(editor);

        } else if (event.key === 'Backspace' && range.startOffset === 0) {
            const blockIndex = blocks.findIndex(b => b.id === startBlock.id);
            if (blockIndex > 0) {
                event.preventDefault();

                // Handle multi-block selection
                if (endBlock && endBlock !== startBlock) {
                    // Delete selected blocks
                    const endIndex = blocks.findIndex(b => b.id === endBlock.id);
                    if (endIndex === -1) return;

                    const blocksToRemove = blocks.slice(blockIndex, endIndex + 1);
                    blocksToRemove.forEach(block => {
                        const element = editor.querySelector(`[data-block-id="${block.id}"]`);
                        element?.remove();
                    });
                    blocks = blocks.filter(b => !blocksToRemove.includes(b));

                    // Update order of remaining blocks
                    blocks = blocks.map((b, i) => ({ ...b, order: i }));

                    // Focus previous block at end
                    const prevBlock = blocks[blockIndex - 1];
                    const prevElement = editor.querySelector(`[data-block-id="${prevBlock.id}"]`);
                    if (prevElement) {
                        const range = document.createRange();
                        range.setStart(prevElement.firstChild || prevElement, (prevElement.textContent || '').length);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                        activeBlockId = prevBlock.id;
                    }
                } else {
                    // Merge with previous block
                    const prevBlock = blocks[blockIndex - 1];
                    const prevElement = editor.querySelector(`[data-block-id="${prevBlock.id}"]`);
                    if (!prevElement) return;

                    const currentContent = startElement.textContent || '';
                    const prevContent = prevElement.textContent || '';
                    const mergedContent = prevContent + currentContent;

                    // Update previous block
                    prevBlock.content = mergedContent;
                    prevElement.textContent = mergedContent;

                    // Remove current block
                    blocks = blocks.filter(b => b.id !== startBlock.id);
                    startElement.remove();

                    // Update order of remaining blocks
                    blocks = blocks.map((b, i) => ({ ...b, order: i }));

                    // Set cursor position at merge point
                    const range = document.createRange();
                    range.setStart(prevElement.firstChild || prevElement, prevContent.length);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    activeBlockId = prevBlock.id;
                }

                handleInput(editor);
            }
        } else if (event.key.toLowerCase() === 'l' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            const pos = getCursorPosition(editor, selection);
            showInlinePrompt(pos);
        }

        removePlaceholders(editor);
    }

    function handleClick(event: MouseEvent, editor: HTMLDivElement): void {
        if (!editor) return;

        removePlaceholders(editor);

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const { block, element: blockElement } = getBlockFromNode(range.startContainer);
        
        if (block && blockElement) {
            activeBlockId = block.id;
            
            const node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                const atLineStart = isAtLineStart(node, range.startOffset);
                const hasTextAfter = hasTextAfterCursor(node, range.startOffset);

                if ((node.textContent.trim() !== '' && !atLineStart) || (atLineStart && hasTextAfter)) {
                    return;
                }
            }

            const { lineText } = getCurrentLineRange(editor, node);
            if (lineText === '') {
                insertPlaceholder(editor, selection);
            }
        }
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
        handleBeforeUnload,
        initializeEditor,
        handleSelectionChange
    };
} 