<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { documents } from '$lib/stores/documents';
	import { documentTitle } from '$lib/stores/document';
	import { browser } from '$app/environment';
	import { debounce } from 'lodash-es';
	import type { Chapter } from '$lib/stores/documents';
	import { get } from 'svelte/store';
	import InlineAiPrompt from './inline-ai-prompt.svelte';

	export let storyId: string;
	export let selectedFont: string;
	export let selectedSize: string;
	export let aiText: string | null = null;

	// State
	let isLoading = true;
	let error: string | null = null;
	let editor: HTMLDivElement;
	let wordCount = 0;
	let charCount = 0;
	let lastSaveTime = new Date().toISOString();
	let currentChapterId: string | null = null;
	let unsubscribe: () => void;

	// Save status indicators
	let saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden' = 'saved';
	let isOffline = false;
	let hasUnsavedChanges = false;
	let statusHideTimeout: ReturnType<typeof setTimeout>;

	let showInlinePrompt = false;
	let promptPosition = { x: 0, y: 0, lineHeight: 0 };

	const dispatch = createEventDispatcher<{
		stateUpdate: {
			wordCount: number;
			charCount: number;
			saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden';
		};
	}>();

	// Custom event interfaces
	interface ChapterContentEvent extends CustomEvent {
		detail: {
			content: string;
			chapterId: string;
		};
	}

	// Save current chapter ID
	function saveCurrentChapter(chapterId: string) {
		if (!browser) return;
		localStorage.setItem(`current_chapter_${storyId}`, chapterId);
	}

	// Load saved chapter ID
	function loadSavedChapter(): string | null {
		if (!browser) return null;
		return localStorage.getItem(`current_chapter_${storyId}`);
	}

	// Load initial content and subscribe to changes
	async function initializeContent() {
		if (!browser) return;

		try {
			// Try to load saved chapter ID first
			const savedChapterId = loadSavedChapter();

			// Subscribe to document changes
			unsubscribe = documents.subscribe((docs) => {
				const doc = docs[storyId];
				if (doc) {
					// If we have a saved chapter ID and it exists in the document, use it
					if (savedChapterId && doc.chapters.find((c) => c.id === savedChapterId)) {
						if (!currentChapterId) {
							currentChapterId = savedChapterId;
							const chapter = doc.chapters.find((c) => c.id === savedChapterId);
							if (chapter && editor) {
								editor.innerHTML = chapter.content || '';
								updateCounts();
							}
						}
					}
					// Otherwise, if no chapter is selected, select the first chapter
					else if (!currentChapterId && doc.chapters.length > 0) {
						const firstChapter = doc.chapters[0];
						currentChapterId = firstChapter.id;
						saveCurrentChapter(firstChapter.id);
						if (editor) {
							editor.innerHTML = firstChapter.content || '';
							updateCounts();
						}
					} else if (currentChapterId) {
						const chapter = doc.chapters.find((c) => c.id === currentChapterId);
						if (chapter && editor) {
							// Only update content if we haven't made local changes
							if (!hasUnsavedChanges) {
								editor.innerHTML = chapter.content || '';
								updateCounts();
							}
						}
					}
				}
			});

			// Initial load from store
			const currentDocs = get(documents);
			const doc = currentDocs[storyId];
			if (doc && doc.chapters.length > 0) {
				if (savedChapterId && doc.chapters.find((c) => c.id === savedChapterId)) {
					currentChapterId = savedChapterId;
					const chapter = doc.chapters.find((c) => c.id === savedChapterId);
					if (chapter && editor) {
						editor.innerHTML = chapter.content || '';
						updateCounts();
					}
				} else if (!currentChapterId) {
					const firstChapter = doc.chapters[0];
					currentChapterId = firstChapter.id;
					saveCurrentChapter(firstChapter.id);
					if (editor) {
						editor.innerHTML = firstChapter.content || '';
						updateCounts();
					}
				}
			}
		} catch (err) {
			console.error('Error loading document:', err);
			error = 'Failed to load document';
		} finally {
			isLoading = false;
		}
	}

	// Update word and character counts
	function updateCounts() {
		if (!editor) return;

		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = editor.innerHTML || '';
		const text = tempDiv.textContent || '';

		wordCount = text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
		charCount = text.length;

		dispatchStateUpdate();
	}

	function dispatchStateUpdate() {
		dispatch('stateUpdate', {
			wordCount,
			charCount,
			saveStatus
		});
	}

	// Debounced save function
	const debouncedSave = debounce(async () => {
		if (!browser || !storyId || !currentChapterId) return;

		try {
			saveStatus = 'saving';
			dispatchStateUpdate();
			await documents.saveChapter(storyId, currentChapterId, editor?.innerHTML || '');
			lastSaveTime = new Date().toISOString();
			hasUnsavedChanges = false;
			setSaveStatus('saved');
		} catch (err) {
			console.error('Error saving document:', err);
			setSaveStatus('error');
		}
	}, 1000);

	// Immediate save function
	async function saveImmediately() {
		if (!browser || !storyId || !currentChapterId) return;

		try {
			await documents.saveChapter(storyId, currentChapterId, editor?.innerHTML || '');
			lastSaveTime = new Date().toISOString();
			hasUnsavedChanges = false;
		} catch (err) {
			console.error('Error saving document:', err);
		}
	}

	// Save editor settings
	function saveSettings() {
		if (!browser) return;

		try {
			const settings = {
				font: selectedFont,
				fontSize: selectedSize,
				lastModified: new Date().toISOString()
			};
			localStorage.setItem(`document_settings_${storyId}`, JSON.stringify(settings));
		} catch (err) {
			console.error('Error saving settings:', err);
		}
	}

	// Load editor settings
	function loadSettings() {
		if (!browser) return;

		try {
			const settings = localStorage.getItem(`document_settings_${storyId}`);
			if (settings) {
				const parsed = JSON.parse(settings);
				if (editor) {
					editor.style.fontFamily = parsed.font;
					editor.style.fontSize = parsed.fontSize;
				}
			}
		} catch (err) {
			console.error('Error loading settings:', err);
		}
	}

	// Handle editor input
	function handleInput() {
		updateCounts();
		hasUnsavedChanges = true;
		debouncedSave();
	}

	// Handle editor blur
	function handleBlur() {
		if (hasUnsavedChanges) {
			saveImmediately();
		}
	}

	// Handle before unload
	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (hasUnsavedChanges) {
			event.preventDefault();
			event.returnValue = '';
		}
	}

	function getCursorPosition(selection: Selection): { x: number; y: number; lineHeight: number } {
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

	// Handle keyboard events
	function handleKeydown(event: KeyboardEvent) {
		console.log('Keydown event:', event.key, event.metaKey, event.ctrlKey);

		if (event.key === 'Enter') {
			event.preventDefault();
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const br = document.createElement('br');
				range.insertNode(br);
				range.setStartAfter(br);
				range.setEndAfter(br);
				selection.removeAllRanges();
				selection.addRange(range);
				handleInput();
			}
		} else if (event.key.toLowerCase() === 'l' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				// Get cursor position and line height
				const pos = getCursorPosition(selection);
				promptPosition = {
					x: pos.x,
					y: pos.y,
					lineHeight: pos.lineHeight
				};

				// Create space for the prompt
				const range = selection.getRangeAt(0);
				const spacer = document.createElement('div');
				spacer.className = 'ai-prompt-spacer';
				spacer.style.height = `${pos.lineHeight * 2}px`; // Two lines height
				spacer.contentEditable = 'false';
				range.insertNode(spacer);

				showInlinePrompt = true;
			}
		}

		// Remove placeholder when typing begins
		const placeholders = editor?.querySelectorAll('.cmd-placeholder');
		if (placeholders && placeholders.length > 0) {
			console.log('Removing placeholders on keydown');
			placeholders.forEach((p) => p.remove());
		}
	}

	function handlePromptSubmit(event: CustomEvent<{ prompt: string }>) {
		showInlinePrompt = false;
		// Remove the spacer before inserting AI text
		const spacer = editor.querySelector('.ai-prompt-spacer');
		if (spacer) {
			spacer.remove();
		}
		insertAIText(`[AI response to: ${event.detail.prompt}]`);
	}

	function handlePromptCancel() {
		showInlinePrompt = false;
		// Remove the spacer
		const spacer = editor.querySelector('.ai-prompt-spacer');
		if (spacer) {
			spacer.remove();
		}
	}

	// Update save status display
	function setSaveStatus(status: typeof saveStatus) {
		saveStatus = status;
		dispatchStateUpdate();

		if (statusHideTimeout) {
			clearTimeout(statusHideTimeout);
		}

		if (status === 'saved' || status === 'error') {
			statusHideTimeout = setTimeout(() => {
				saveStatus = 'hidden';
				dispatchStateUpdate();
			}, 2000);
		}
	}

	// Check online status
	function updateOnlineStatus() {
		if (!browser) return;
		isOffline = !navigator.onLine;
		saveStatus = isOffline ? 'offline' : hasUnsavedChanges ? 'saving' : 'saved';
		dispatchStateUpdate();
	}

	// Watch for font/size changes
	$: if (editor && selectedFont) {
		editor.style.fontFamily = selectedFont;
		saveSettings();
	}

	$: if (editor && selectedSize) {
		editor.style.fontSize = selectedSize;
		saveSettings();
	}

	// Watch for AI text changes
	$: if (aiText) {
		console.log('AI text received via prop:', aiText);
		insertAIText(aiText);
		aiText = null; // Reset after insertion
	}

	// Function to insert AI-generated text
	function insertAIText(text: string) {
		if (!editor) {
			console.error('Editor element not found');
			return;
		}

		console.log('Attempting to insert AI text, length:', text.length);

		// Get selection to insert at cursor position
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			if (
				range.commonAncestorContainer === editor ||
				editor.contains(range.commonAncestorContainer)
			) {
				console.log('Inserting text at cursor position');
				// Create a text node with the AI content
				const textNode = document.createTextNode(text);

				// Delete any selected text and insert the new content
				range.deleteContents();
				range.insertNode(textNode);

				// Move cursor to end of inserted text
				range.setStartAfter(textNode);
				range.setEndAfter(textNode);
				selection.removeAllRanges();
				selection.addRange(range);

				// Trigger save and update counts
				handleInput();
			} else {
				console.log('Cursor not in editor, appending to end');
				// If cursor is not in editor, append to the end
				editor.innerHTML += text;
				handleInput();
			}
		} else {
			console.log('No selection found, appending to end');
			// If no selection, append to the end
			editor.innerHTML += text;
			handleInput();
		}
	}

	function handleClick() {
		if (!editor) return;

		// Remove any existing placeholders.
		const existingPlaceholders = editor.querySelectorAll('.cmd-placeholder');
		existingPlaceholders.forEach((p) => p.remove());

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		const node = range.startContainer;
		console.log('Click node type:', node.nodeType, 'node name:', node.nodeName);

		// Check if we're directly clicking on text
		if (node.nodeType === Node.TEXT_NODE && node.textContent) {
			console.log('Text node content:', JSON.stringify(node.textContent));

			// Check if we're at the beginning of a line (after a newline or at offset 0)
			const isAtLineStart =
				range.startOffset === 0 ||
				(range.startOffset > 0 && node.textContent.substring(0, range.startOffset).endsWith('\n'));

			// Check if there's text after the cursor position on this line
			// Remove leading newline characters before checking for non-whitespace text
			const textAfterCursor = node.textContent.substring(range.startOffset).replace(/^\n+/, '');
			const hasTextAfterCursor = textAfterCursor.trim() !== '';

			console.log(
				'Cursor position:',
				range.startOffset,
				'At line start:',
				isAtLineStart,
				'Has text after cursor:',
				hasTextAfterCursor
			);

			// If we're in the middle of text, don't insert placeholder
			if (node.textContent.trim() !== '' && !isAtLineStart) {
				console.log('Clicked in the middle of text content, not inserting placeholder');
				return;
			}

			// If we're at start of line but there's text after cursor, don't insert
			if (isAtLineStart && hasTextAfterCursor) {
				console.log('At start of line with text after cursor, not inserting placeholder');
				return;
			}

			console.log('Text node check passed, continuing with line check');
		}

		// Create a range for the current line.
		const lineRange = document.createRange();
		let startNode = node;
		let endNode = node;

		// Find the previous <br> or the start of the editor.
		while (startNode && startNode !== editor) {
			const prevSibling = startNode.previousSibling;
			if ((prevSibling && prevSibling.nodeName === 'BR') || startNode === editor.firstChild) {
				break;
			}
			startNode = prevSibling || startNode.parentNode || startNode;
		}

		// Find the next <br> or the end of the editor.
		while (endNode && endNode !== editor) {
			const nextSibling = endNode.nextSibling;
			if ((nextSibling && nextSibling.nodeName === 'BR') || endNode === editor.lastChild) {
				break;
			}
			endNode = nextSibling || endNode.parentNode || endNode;
		}

		// Determine the boundaries of the current line.
		const startPoint =
			startNode.previousSibling && startNode.previousSibling.nodeName === 'BR'
				? startNode.previousSibling
				: editor;
		const endPoint =
			endNode.nextSibling && endNode.nextSibling.nodeName === 'BR'
				? endNode.nextSibling
				: editor.lastChild || editor;

		// Set the range from just after the previous <br> (or start of editor)
		// to just before the next <br> (or end of editor) to get the current line text.
		let lineText = '';
		if (startPoint && endPoint) {
			lineRange.setStartAfter(startPoint);
			lineRange.setEndBefore(endPoint);
			lineText = lineRange.toString().trim();
			console.log('Current line text:', lineText);
		}

		// If the line contains any non-whitespace text, do not insert the placeholder.
		if (lineText !== '') {
			return;
		}

		// Otherwise, insert the placeholder span at the caret position.
		try {
			const placeholder = document.createElement('span');
			placeholder.className = 'cmd-placeholder';
			placeholder.textContent = '⌘K to generate';
			placeholder.style.color = '#999';
			placeholder.style.opacity = '0.5';
			placeholder.style.background = 'transparent';
			placeholder.style.textDecoration = 'none';
			placeholder.style.border = 'none';
			placeholder.style.outline = 'none';
			// Make the placeholder non-editable.
			placeholder.contentEditable = 'false';

			// Insert the placeholder.
			range.insertNode(placeholder);

			// Move the caret just after the inserted placeholder.
			range.setStartAfter(placeholder);
			range.setEndAfter(placeholder);
			selection.removeAllRanges();
			selection.addRange(range);

			editor.classList.add('hide-caret');
		} catch (err) {
			console.error('Error inserting placeholder:', err);
		}
	}

	onMount(() => {
		if (!browser) return;

		// Initialize online status and content
		updateOnlineStatus();
		initializeContent();

		// Set up event listeners
		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);
		window.addEventListener('beforeunload', handleBeforeUnload);

		// Listen for chapter selection
		window.addEventListener('chapter:selected', ((event: CustomEvent) => {
			const newChapterId = event.detail.chapterId;

			// Save current content before switching if there are unsaved changes
			if (hasUnsavedChanges && currentChapterId) {
				// Save synchronously to ensure content is saved before switching
				saveImmediately();
			}

			// Update current chapter and load its content
			currentChapterId = newChapterId;
			saveCurrentChapter(newChapterId);

			// Get fresh content from store
			const currentDocs = get(documents);
			const doc = currentDocs[storyId];
			const chapter = doc?.chapters.find((c) => c.id === newChapterId);

			if (editor && chapter) {
				editor.innerHTML = chapter.content || '';
				updateCounts();
				hasUnsavedChanges = false;
				setSaveStatus('saved');
			}
		}) as EventListener);

		// Load settings
		loadSettings();

		return () => {
			// Save any unsaved changes before unmounting
			if (hasUnsavedChanges && currentChapterId) {
				// Save synchronously on unmount
				saveImmediately();
			}
			if (unsubscribe) unsubscribe();
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
			window.removeEventListener('beforeunload', handleBeforeUnload);
			window.removeEventListener('chapter:selected', (() => {}) as EventListener);
			if (statusHideTimeout) clearTimeout(statusHideTimeout);
			debouncedSave.cancel();
		};
	});
</script>

<div class="editor-container">
	<div
		class="editor"
		bind:this={editor}
		contenteditable="true"
		on:input={handleInput}
		on:blur={handleBlur}
		on:keydown={handleKeydown}
		on:click={handleClick}
		on:mouseup={handleClick}
		style="font-family: {selectedFont}; font-size: {selectedSize};"
		role="textbox"
		tabindex="0"
		aria-multiline="true"
		aria-label="Document content"
		data-placeholder="⌘K to generate"
	></div>

	{#if showInlinePrompt}
		<div
			class="prompt-overlay"
			style="
				left: {promptPosition.x}px; 
				top: {promptPosition.y}px;
				font-family: {selectedFont};
				font-size: {selectedSize};
			"
		>
			<InlineAiPrompt on:submit={handlePromptSubmit} on:cancel={handlePromptCancel} />
		</div>
	{/if}
</div>

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--editor-background);
		width: 85%;
		position: relative;
	}

	.editor {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
		outline: none;
		line-height: 1.6;
		color: var(--text-color);
		background: var(--editor-background);
		width: 100%;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.editor:focus {
		background: var(--editor-focus-background);
	}

	.ai-prompt-spacer {
		display: block;
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		pointer-events: none;
	}

	.prompt-overlay {
		position: absolute;
		z-index: 1000;
		background: transparent;
		font-size: inherit;
		line-height: inherit;
		color: inherit;
		width: calc(100% - 4rem); /* Account for editor padding */
	}

	/* Target elements with the show-placeholder class */
	.editor .show-placeholder:empty::before,
	.editor .show-placeholder:has(br:only-child)::before {
		content: '⌘K to generate';
		color: var(--text-muted, #666);
		opacity: 0.5;
		font-style: italic;
		pointer-events: none;
	}

	.cmd-placeholder {
		color: var(--text-muted, #999);
		opacity: 0.6;
		font-style: italic;
		user-select: none;
		pointer-events: none;
	}

	.hide-caret {
		caret-color: transparent;
	}
</style>
