<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import CharacterCount from '@tiptap/extension-character-count';
	import { editorState } from '../../stores/new/editor-state';
	import { documents } from '$lib/stores/documents';
	import { get } from 'svelte/store';
	import { debounce } from 'lodash-es';
	import TiptapToolbar from '../tiptap-toolbar.svelte';
	import TiptapFolders from './tiptap-folders.svelte';
	import { writable } from 'svelte/store';
	import { DocumentExtension, documentStore } from '../../extensions/new/DocumentExtension';

	// Create a Svelte store for word and character counts
	export const countStore = writable<{ words: number; characters: number }>({
		words: 0,
		characters: 0
	});

	export let content = '';
	export let storyId: string;

	// Editor state
	let wordCount = 0;
	let charCount = 0;
	let saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden' = 'saved';
	const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
	const fontSizes = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt'];
	let selectedFont = 'Arial';
	let selectedSize = '11pt';

	let element: HTMLElement;
	let editor: Editor | null = null;
	let previousDocumentState: string = '';

	// Subscribe to count changes
	countStore.subscribe(({ words, characters }) => {
		wordCount = words;
		charCount = characters;
	});

	// Subscribe to document changes
	documentStore.subscribe((state) => {
		if (state.currentDocumentId && !state.isUpdating && editor) {
			const document = findDocumentById(state, state.currentDocumentId);
			if (document) {
				if (editor.getHTML() !== (document.content || '')) {
					editor.commands.setContent(document.content || '');
				}
			}
		}
	});

	// Function to find a document by ID across all folders
	function findDocumentById(state: any, documentId: string) {
		for (const folder of state.folders) {
			const doc = folder.documents.find((d: any) => d.id === documentId);
			if (doc) return doc;
		}
		return undefined;
	}

	// Function to update the word and character count
	function updateCount() {
		if (editor) {
			const characters = editor.storage.characterCount.characters();
			const words = editor.storage.characterCount.words();
			countStore.set({ words, characters });
		}
	}

	// Debounced save handler for document content updates
	const saveToBackend = debounce(async () => {
		if (!storyId || !editor) return;

		try {
			saveStatus = 'saving';
			const currentState = get(documentStore);

			if (!currentState.currentDocumentId) {
				console.warn('No document selected, cannot save');
				return;
			}

			let folderToUpdate = null;
			let documentToUpdate = null;

			// Find the current document and its folder
			for (const folder of currentState.folders) {
				const document = folder.documents.find((d) => d.id === currentState.currentDocumentId);
				if (document) {
					folderToUpdate = folder;
					documentToUpdate = document;
					break;
				}
			}

			if (!folderToUpdate || !documentToUpdate) {
				console.warn('Selected document not found in store');
				return;
			}

			// Create updated folders with the changed document
			const updatedFolders = currentState.folders.map((folder) =>
				folder.id === folderToUpdate!.id
					? {
							...folder,
							documents: folder.documents.map((doc) =>
								doc.id === documentToUpdate!.id
									? { ...doc, content: doc.content, updatedAt: new Date().toISOString() }
									: doc
							)
						}
					: folder
			);

			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});

			saveStatus = 'saved';
			setTimeout(() => {
				saveStatus = 'hidden';
			}, 2000);
		} catch (err) {
			console.error('Error saving document:', err);
			saveStatus = 'error';
		}
	}, 1000);

	// A special subscriber that watches for content changes in the document store and saves to backend
	$: {
		// Stringify folders to detect actual changes
		const serializedState = JSON.stringify($documentStore.folders);

		// Only trigger save if there was a real change
		if (previousDocumentState && serializedState !== previousDocumentState) {
			saveToBackend();
		}

		// Update the previous state reference
		previousDocumentState = serializedState;
	}

	onMount(async () => {
		// Initialize document store with documents data
		const currentDocs = get(documents);
		const doc = currentDocs[storyId];

		// If document exists but has no folders property, we'll handle that in tiptap-folders
		// which will create the folder structure and migrate any chapters

		// Set the initial state for comparison (will be updated after migration if needed)
		if (doc && doc.folders) {
			previousDocumentState = JSON.stringify(doc.folders);
		}

		// Initialize the editor with the content
		editor = new Editor({
			element,
			extensions: [
				StarterKit,
				CharacterCount.configure({
					// Use a more robust word counting algorithm
					wordCounter: (text) => {
						const wordRegex = /\S+/g;
						return (text.match(wordRegex) || []).length;
					}
				}),
				DocumentExtension
			],
			content: '',
			autofocus: true,
			editable: true,
			onUpdate: ({ editor }) => {
				editor.commands.syncDocumentContent();
				updateCount();
			}
		});

		// Initial count update
		updateCount();

		// Load saved settings
		if (typeof localStorage !== 'undefined') {
			const settings = localStorage.getItem(`document_settings_${storyId}`);
			if (settings) {
				const parsed = JSON.parse(settings);
				selectedFont = parsed.font;
				selectedSize = parsed.fontSize;
			}
		}
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
		// Cancel any pending save operations
		saveToBackend.cancel();
	});

	function handleFontChange(event: CustomEvent<string>) {
		selectedFont = event.detail;
		if (editor) {
			editor.view.dom.style.fontFamily = selectedFont;
		}
		// Save settings
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(
				`document_settings_${storyId}`,
				JSON.stringify({
					font: selectedFont,
					fontSize: selectedSize,
					lastModified: new Date().toISOString()
				})
			);
		}
	}

	function handleSizeChange(event: CustomEvent<string>) {
		selectedSize = event.detail;
		if (editor) {
			editor.view.dom.style.fontSize = selectedSize;
		}
		// Save settings
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(
				`document_settings_${storyId}`,
				JSON.stringify({
					font: selectedFont,
					fontSize: selectedSize,
					lastModified: new Date().toISOString()
				})
			);
		}
	}
</script>

<div class="editor-layout">
	<aside class="left-panel">
		<TiptapFolders {storyId} {editor} />
	</aside>
	<div class="main-content">
		<TiptapToolbar {editor} {saveStatus} {wordCount} {charCount} />
		<div bind:this={element} class="tiptap-editor"></div>
	</div>
</div>

<style>
	.editor-layout {
		display: flex;
		height: 100vh;
		width: 100%;
		background: var(--editor-background);
		margin: 0;
		padding: 0;
	}

	.left-panel {
		width: 250px;
		background: var(--panel-background);
		border-right: 1px solid var(--border-color);
		overflow-y: auto;
		flex-shrink: 0;
		margin: 0;
		padding: 0;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		margin: 0;
		padding: 0;
	}

	.tiptap-editor {
		flex: 1;
		padding: 0;
		margin: 0;
		overflow-y: auto;
		outline: none;
		line-height: 1.6;
		color: var(--text-color);
		background: var(--editor-background);
		width: 100%;
		position: relative;
		min-height: 100%;
	}

	:global(.tiptap-editor .ProseMirror) {
		outline: none;
		min-height: 100%;
		padding: 2rem;
	}

	:global(.tiptap-editor .ProseMirror p) {
		position: relative;
		min-height: 24px;
		padding: 3px 0;
		margin: 0;
		border-radius: 3px;
		transition: all 0.1s ease;
	}

	:global(.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before) {
		content: '⌘K to generate';
		color: var(--text-muted, #666);
		opacity: 0.5;
		font-style: italic;
		pointer-events: none;
		position: absolute;
		left: 0;
		top: 3px;
	}
</style>
