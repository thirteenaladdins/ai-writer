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
	import JsonTiptapFolders from './json-tiptap-folders.svelte';
	import { writable } from 'svelte/store';
	import {
		JsonDocumentExtension,
		jsonDocumentStore,
		findDocumentById
	} from '../../extensions/new/JsonDocumentExtension';

	// Create a Svelte store for word and character counts (same as original)
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
	jsonDocumentStore.subscribe((state) => {
		if (state.currentDocumentId && !state.isUpdating && editor) {
			console.log('jsonDocumentStore changed - trying to update editor content', {
				currentDocumentId: state.currentDocumentId,
				isUpdating: state.isUpdating,
				hasEditor: !!editor
			});

			const document = findDocumentById(state, state.currentDocumentId);
			if (document) {
				console.log('Found document to update editor with:', {
					id: document.id,
					title: document.title,
					hasJsonContent: !!document.jsonContent,
					hasContent: !!document.content
				});

				if (document.jsonContent) {
					const currentJson = JSON.stringify(editor.getJSON());
					const storedJson = JSON.stringify(document.jsonContent);

					if (currentJson !== storedJson) {
						console.log('Setting editor content from JSON');
						editor.commands.setContent(document.jsonContent);
					} else {
						console.log('Editor already has the same JSON content, skipping update');
					}
				} else if (document.content && typeof document.content === 'string') {
					const currentHtml = editor.getHTML();
					if (currentHtml !== document.content) {
						console.log('Setting editor content from HTML');
						editor.commands.setContent(document.content);
					} else {
						console.log('Editor already has the same HTML content, skipping update');
					}
				} else {
					console.log('Document has no content to set in editor');
				}
			} else {
				console.log('Document not found in store:', state.currentDocumentId);
			}
		}
	});

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
			const currentState = get(jsonDocumentStore);

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

			// Get latest content from editor
			const currentHtmlContent = editor.getHTML();
			const currentJsonContent = editor.getJSON();

			// Create updated folders with the changed document
			const updatedFolders = currentState.folders.map((folder) =>
				folder.id === folderToUpdate!.id
					? {
							...folder,
							documents: folder.documents.map((doc) =>
								doc.id === documentToUpdate!.id
									? {
											...doc,
											content: currentHtmlContent, // Update with current HTML content
											jsonContent: currentJsonContent, // Update with current JSON content
											updatedAt: new Date().toISOString()
										}
									: doc
							)
						}
					: folder
			);

			// Log for debugging
			console.log('Saving document with content:', {
				html: currentHtmlContent,
				json: currentJsonContent
			});

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
		const serializedState = JSON.stringify($jsonDocumentStore.folders);

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

		console.log('json-tiptap-editor onMount - document loaded from store:', {
			storyId,
			hasDocument: !!doc,
			hasFolders: doc && !!doc.folders,
			folderCount: doc && doc.folders ? doc.folders.length : 0,
			documentCounts:
				doc && doc.folders
					? doc.folders.map((f) => ({
							folderId: f.id,
							folderTitle: f.title,
							documentCount: f.documents.length,
							documents: f.documents.map((d) => ({
								id: d.id,
								title: d.title,
								hasJsonContent: !!d.jsonContent,
								hasContent: !!d.content
							}))
						}))
					: []
		});

		// If document exists and has folders, initialize our jsonDocumentStore
		if (doc && doc.folders) {
			jsonDocumentStore.update((state) => ({
				...state,
				folders: doc.folders || []
			}));
			previousDocumentState = JSON.stringify(doc.folders);
		}

		try {
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
					JsonDocumentExtension
				],
				content: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Loading content...' }]
						}
					]
				},
				autofocus: true,
				editable: true,
				onUpdate: ({ editor }) => {
					// Ensure JsonDocumentExtension is available
					if (editor && (editor.commands as any).jsonDocument) {
						(editor.commands as any).jsonDocument.syncDocumentContent();
					}
					updateCount();
				}
			});

			// Initial count update
			updateCount();

			// Verify JsonDocumentExtension is properly loaded
			if (!(editor.commands as any).jsonDocument) {
				console.error('Failed to initialize JsonDocumentExtension');
			}

			// Load the saved document if we have a document ID in local storage
			const savedDocId = localStorage.getItem(`current_document_${storyId}`);
			if (savedDocId && editor && (editor.commands as any).jsonDocument) {
				console.log('Loading saved document:', savedDocId);
				(editor.commands as any).jsonDocument.setDocument(savedDocId);
			}
		} catch (error) {
			console.error('Failed to initialize editor:', error);
		}

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

	// Debug function to force reload content
	function debugReloadContent() {
		if (!editor) {
			console.log('No editor instance available');
			return;
		}

		const currentState = get(jsonDocumentStore);
		if (!currentState.currentDocumentId) {
			console.log('No document selected');
			return;
		}

		const doc = findDocumentById(currentState, currentState.currentDocumentId);
		if (!doc) {
			console.log('Document not found:', currentState.currentDocumentId);
			return;
		}

		console.log('DEBUG - Forcing content reload for document:', {
			id: doc.id,
			title: doc.title,
			hasJsonContent: !!doc.jsonContent,
			jsonContentType: doc.jsonContent ? typeof doc.jsonContent : 'none',
			hasContent: !!doc.content
		});

		// Force set content directly
		if (doc.jsonContent) {
			console.log('Setting JSON content:', doc.jsonContent);
			editor.commands.setContent(doc.jsonContent);
		} else if (doc.content) {
			console.log('Setting HTML content:', doc.content);
			editor.commands.setContent(doc.content);
		} else {
			console.log('No content to set');
		}
	}
</script>

<div class="editor-layout">
	<aside class="left-panel">
		<JsonTiptapFolders {storyId} {editor} />
		<button class="debug-btn" on:click={debugReloadContent}>DEBUG: Force Reload Content</button>
	</aside>
	<div class="main-content">
		<TiptapToolbar {editor} {saveStatus} {wordCount} {charCount} />
		<div bind:this={element} class="tiptap-editor"></div>
	</div>
</div>

<style>
	.editor-layout {
		display: grid;
		grid-template-columns: 250px 1fr;
		height: 100%;
		background-color: var(--document-background);
	}

	.left-panel {
		border-right: 1px solid var(--border-color);
		background-color: var(--panel-background);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.debug-btn {
		margin: 1rem;
		padding: 0.5rem;
		background-color: #ff5722;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.main-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.tiptap-editor {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
		outline: none;
		font-family: var(--editor-font-family, 'Arial');
		font-size: var(--editor-font-size, '11pt');
		line-height: 1.5;
	}

	:global(.dark) .tiptap-editor {
		color: var(--text-color-dark);
	}

	:global(.ProseMirror) {
		outline: none;
	}

	:global(.ProseMirror p) {
		margin-bottom: 1em;
	}

	:global(.ProseMirror ul, .ProseMirror ol) {
		padding-left: 1.5em;
		margin-bottom: 1em;
	}

	:global(
		.ProseMirror h1,
		.ProseMirror h2,
		.ProseMirror h3,
		.ProseMirror h4,
		.ProseMirror h5,
		.ProseMirror h6
	) {
		font-weight: 600;
		line-height: 1.1;
		margin-top: 1.5em;
		margin-bottom: 0.5em;
	}

	:global(.ProseMirror h1) {
		font-size: 2em;
	}

	:global(.ProseMirror h2) {
		font-size: 1.5em;
	}

	:global(.ProseMirror h3) {
		font-size: 1.3em;
	}

	:global(.ProseMirror a) {
		color: var(--primary-color);
		text-decoration: underline;
	}

	:global(.ProseMirror blockquote) {
		border-left: 3px solid var(--border-color);
		padding-left: 1em;
		margin-left: 0;
		margin-right: 0;
		font-style: italic;
	}

	:global(.ProseMirror pre) {
		background: var(--code-background);
		color: var(--code-color);
		padding: 0.75em 1em;
		border-radius: 4px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.9em;
		overflow-x: auto;
	}

	:global(.ProseMirror code) {
		background: var(--code-background);
		color: var(--code-color);
		padding: 0.2em 0.4em;
		border-radius: 4px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.9em;
	}
</style>
