export interface CursorPosition {
    x: number;
    y: number;
    lineHeight: number;
}

export function getCursorPosition(editor: HTMLDivElement, selection: Selection): CursorPosition {
    // Create a range to measure
    const range = selection.getRangeAt(0).cloneRange();

    // Get the computed line height from the editor
    const computedStyle = window.getComputedStyle(editor);
    const lineHeight = parseFloat(computedStyle.lineHeight);

    // Create a temporary container for measurement
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.visibility = 'hidden';
    container.style.height = `${lineHeight * 2}px`; // Two lines height

    // Insert at cursor position
    range.insertNode(container);

    // Get position relative to editor
    const rect = container.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();

    // Clean up
    container.remove();

    // Restore selection
    selection.removeAllRanges();
    selection.addRange(range);

    return {
        x: rect.left - editorRect.left + editor.scrollLeft,
        y: rect.top - editorRect.top + editor.scrollTop,
        lineHeight
    };
}

export function getCurrentLineRange(editor: HTMLDivElement, node: Node): { 
    startNode: Node, 
    endNode: Node,
    lineText: string 
} {
    let startNode = node;
    let endNode = node;

    // Find the previous <br> or the start of the editor
    while (startNode && startNode !== editor) {
        const prevSibling = startNode.previousSibling;
        if ((prevSibling && prevSibling.nodeName === 'BR') || startNode === editor.firstChild) {
            break;
        }
        startNode = prevSibling || startNode.parentNode || startNode;
    }

    // Find the next <br> or the end of the editor
    while (endNode && endNode !== editor) {
        const nextSibling = endNode.nextSibling;
        if ((nextSibling && nextSibling.nodeName === 'BR') || endNode === editor.lastChild) {
            break;
        }
        endNode = nextSibling || endNode.parentNode || endNode;
    }

    // Create a range for the current line
    const lineRange = document.createRange();
    const startPoint = startNode.previousSibling && startNode.previousSibling.nodeName === 'BR'
        ? startNode.previousSibling
        : editor;
    const endPoint = endNode.nextSibling && endNode.nextSibling.nodeName === 'BR'
        ? endNode.nextSibling
        : editor.lastChild || editor;

    // Set the range and get the line text
    lineRange.setStartAfter(startPoint);
    lineRange.setEndBefore(endPoint);
    const lineText = lineRange.toString().trim();

    return { startNode, endNode, lineText };
}

export function isAtLineStart(node: Node, offset: number): boolean {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return false;
    return offset === 0 || node.textContent.substring(0, offset).endsWith('\n');
}

export function hasTextAfterCursor(node: Node, offset: number): boolean {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return false;
    const textAfterCursor = node.textContent.substring(offset).replace(/^\n+/, '');
    return textAfterCursor.trim() !== '';
} 