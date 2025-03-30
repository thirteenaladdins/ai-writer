export function insertTextAtCursor(
    editor: HTMLDivElement,
    text: string,
    selection: Selection | null = window.getSelection()
): void {
    if (!editor || !selection || !selection.rangeCount) {
        console.error('Editor element not found or no selection');
        return;
    }

    const range = selection.getRangeAt(0);
    if (range.commonAncestorContainer === editor || editor.contains(range.commonAncestorContainer)) {
        // Create a text node with the content
        const textNode = document.createTextNode(text);

        // Delete any selected text and insert the new content
        range.deleteContents();
        range.insertNode(textNode);

        // Move cursor to end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        // If cursor is not in editor, append to the end
        editor.innerHTML += text;
    }
}

export function insertLineBreak(
    editor: HTMLDivElement,
    selection: Selection | null = window.getSelection()
): void {
    if (!editor || !selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const br = document.createElement('br');
    range.insertNode(br);
    range.setStartAfter(br);
    range.setEndAfter(br);
    selection.removeAllRanges();
    selection.addRange(range);
}

export function updateWordAndCharCount(editor: HTMLDivElement): { wordCount: number; charCount: number } {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editor.innerHTML || '';
    const text = tempDiv.textContent || '';

    const wordCount = text
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
    const charCount = text.length;

    return { wordCount, charCount };
}

export function removePlaceholders(editor: HTMLDivElement): void {
    const placeholders = editor.querySelectorAll('.cmd-placeholder');
    placeholders.forEach((p) => p.remove());
}

export function insertPlaceholder(
    editor: HTMLDivElement,
    selection: Selection,
    text: string = '⌘K to generate'
): void {
    const placeholder = document.createElement('span');
    placeholder.className = 'cmd-placeholder';
    placeholder.textContent = text;
    placeholder.style.color = '#999';
    placeholder.style.opacity = '0.5';
    placeholder.style.background = 'transparent';
    placeholder.style.textDecoration = 'none';
    placeholder.style.border = 'none';
    placeholder.style.outline = 'none';
    placeholder.contentEditable = 'false';

    const range = selection.getRangeAt(0);
    range.insertNode(placeholder);

    // Move the caret just after the inserted placeholder
    range.setStartAfter(placeholder);
    range.setEndAfter(placeholder);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.classList.add('hide-caret');
} 