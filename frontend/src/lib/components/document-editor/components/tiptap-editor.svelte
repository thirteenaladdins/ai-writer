<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { editorState } from '../stores/editor-state';
	import { documents } from '$lib/stores/documents';
	import { get } from 'svelte/store';
	import { debounce } from 'lodash-es';
	import TiptapToolbar from './tiptap-toolbar.svelte';
	import TiptapChapters from './tiptap-chapters.svelte';
	import { WordCountExtension, wordCountStore } from '../extensions/WordCountExtension';
	import { ChapterExtension, chapterStore } from '../extensions/ChapterExtension';

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
	let previousChapterState: string = '';

	// Subscribe to word count changes
	wordCountStore.subscribe(({ words, characters }) => {
		wordCount = words;
		charCount = characters;
	});

	// Subscribe to chapter changes
	chapterStore.subscribe((state) => {
		if (state.currentChapterId && !state.isUpdating && editor) {
			const chapter = state.chapters.find((c) => c.id === state.currentChapterId);
			if (chapter) {
				if (editor.getHTML() !== (chapter.content || '')) {
					editor.commands.setContent(chapter.content || '');
				}
			}
		}
	});

	// Debounced save handler for chapter content updates
	const saveToBackend = debounce(async () => {
		if (!storyId || !editor) return;

		try {
			saveStatus = 'saving';
			const currentState = get(chapterStore);

			if (!currentState.currentChapterId) {
				console.warn('No chapter selected, cannot save');
				return;
			}

			const chapter = currentState.chapters.find((c) => c.id === currentState.currentChapterId);
			if (!chapter) {
				console.warn('Selected chapter not found in store');
				return;
			}

			await documents.saveChapter(storyId, currentState.currentChapterId, chapter.content);

			// Also save chapter list if needed (e.g., if titles changed)
			await documents.saveDocument(storyId, {
				chapters: currentState.chapters,
				updatedAt: new Date()
			});

			saveStatus = 'saved';
			setTimeout(() => {
				saveStatus = 'hidden';
			}, 2000);
		} catch (err) {
			console.error('Error saving chapter:', err);
			saveStatus = 'error';
		}
	}, 1000);

	// A special subscriber that watches for content changes in the chapter store and saves to backend
	$: {
		// Stringify chapters to detect actual changes
		const serializedState = JSON.stringify($chapterStore.chapters);

		// Only trigger save if there was a real change
		if (previousChapterState && serializedState !== previousChapterState) {
			saveToBackend();
		}

		// Update the previous state reference
		previousChapterState = serializedState;
	}

	onMount(async () => {
		// Initialize chapter store with documents data
		const currentDocs = get(documents);
		const doc = currentDocs[storyId];
		if (doc) {
			// Find the last edited chapter or use the first one
			const savedChapterId = localStorage.getItem(`current_chapter_${storyId}`);
			const lastChapter = doc.chapters.find((c) => c.id === savedChapterId) || doc.chapters[0];

			// Initialize the chapter store
			chapterStore.set({
				currentChapterId: lastChapter?.id || null,
				chapters: doc.chapters || [],
				isUpdating: false
			});

			// Set the initial state for comparison
			previousChapterState = JSON.stringify(doc.chapters || []);

			// Initialize the editor with the chapter content
			editor = new Editor({
				element,
				extensions: [StarterKit, WordCountExtension, ChapterExtension],
				content: lastChapter?.content || '',
				autofocus: true,
				editable: true,
				onUpdate: ({ editor }) => {
					editor.commands.syncChapterContent();
				}
			});

			// Update editor state
			editorState.setCurrentChapter(lastChapter?.id || null);
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
</script>

<div class="editor-layout">
	<aside class="left-panel">
		<TiptapChapters {storyId} {editor} />
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

	:global(.tiptap-editor .ProseMirror h1) {
		font-size: 1.75em;
		margin: 0.75em 0 0.25em;
	}

	:global(.tiptap-editor .ProseMirror h2) {
		font-size: 1.5em;
		margin: 0.75em 0 0.25em;
	}

	:global(.tiptap-editor .ProseMirror ul) {
		padding-left: 1.5em;
		margin: 0.5em 0;
	}

	:global(.tiptap-editor .ProseMirror ol) {
		padding-left: 1.5em;
		margin: 0.5em 0;
	}

	@media (max-width: 768px) {
		.left-panel {
			width: 200px;
		}
	}
</style>
