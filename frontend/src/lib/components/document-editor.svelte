<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { documents } from '$lib/stores/documents';
	import { documentTitle } from '$lib/stores/document';
	import { browser } from '$app/environment';
	import { debounce } from 'lodash-es';
	import type { Chapter } from '$lib/stores/documents';
	import { get } from 'svelte/store';

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

	// Handle keyboard events
	function handleKeydown(event: KeyboardEvent) {
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
		style="font-family: {selectedFont}; font-size: {selectedSize};"
		role="textbox"
		aria-multiline="true"
		aria-label="Document content"
	></div>
</div>

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--editor-background);
		width: 85%;
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
</style>
