<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { documents } from '$lib/stores/documents';
	import { get } from 'svelte/store';
	import { editorState } from './stores/editor-state';
	import { loadSavedChapter, saveCurrentChapter, updateOnlineStatus } from './utils/save-manager';
	import { loadSettings } from './utils/settings-manager';
	import EditorCore from './components/editor-core.svelte';
	import InlineAiPrompt from '../inline-ai-prompt.svelte';
	import type { CursorPosition } from './utils/cursor';

	export let storyId: string;
	export let selectedFont: string;
	export let selectedSize: string;
	export let aiText: string | null = null;

	let showInlinePrompt = false;
	let promptPosition = { x: 0, y: 0, lineHeight: 0 };

	const dispatch = createEventDispatcher<{
		stateUpdate: {
			wordCount: number;
			charCount: number;
			saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden';
		};
	}>();

	// Initialize content and subscribe to changes
	async function initializeContent() {
		if (!browser) return;

		try {
			editorState.setLoading(true);

			// Try to load saved chapter ID first
			const savedChapterId = loadSavedChapter(storyId);

			// Subscribe to document changes
			const unsubscribe = documents.subscribe((docs) => {
				const doc = docs[storyId];
				if (doc) {
					// If we have a saved chapter ID and it exists in the document, use it
					if (savedChapterId && doc.chapters.find((c) => c.id === savedChapterId)) {
						const currentState = get(editorState);
						if (!currentState.currentChapterId) {
							editorState.setCurrentChapter(savedChapterId);
						}
					}
					// Otherwise, if no chapter is selected, select the first chapter
					else if (!get(editorState).currentChapterId && doc.chapters.length > 0) {
						const firstChapter = doc.chapters[0];
						editorState.setCurrentChapter(firstChapter.id);
						saveCurrentChapter(storyId, firstChapter.id);
					}
				}
			});

			return unsubscribe;
		} catch (err) {
			console.error('Error loading document:', err);
			editorState.setError('Failed to load document');
		} finally {
			editorState.setLoading(false);
		}
	}

	function handlePromptSubmit(event: CustomEvent<{ prompt: string }>) {
		showInlinePrompt = false;
		insertAIText(`[AI response to: ${event.detail.prompt}]`);
	}

	function handlePromptCancel() {
		showInlinePrompt = false;
	}

	function handleShowPrompt(event: CustomEvent<CursorPosition>) {
		promptPosition = event.detail;
		showInlinePrompt = true;
	}

	// Subscribe to editor state changes and dispatch updates
	$: {
		const { wordCount, charCount, saveStatus } = $editorState;
		dispatch('stateUpdate', { wordCount, charCount, saveStatus });
	}

	onMount(async () => {
		if (!browser) return;

		// Initialize online status and content
		updateOnlineStatus();
		const unsubscribe = await initializeContent();

		// Set up event listeners
		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);
		window.addEventListener('beforeunload', (event) => {
			if ($editorState.hasUnsavedChanges) {
				event.preventDefault();
				event.returnValue = '';
			}
		});

		// Listen for chapter selection
		window.addEventListener('chapter:selected', ((event: CustomEvent) => {
			const newChapterId = event.detail.chapterId;
			editorState.setCurrentChapter(newChapterId);
			saveCurrentChapter(storyId, newChapterId);
		}) as EventListener);

		// Load settings
		loadSettings(storyId);

		return () => {
			if (unsubscribe) unsubscribe();
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
			window.removeEventListener('beforeunload', () => {});
			window.removeEventListener('chapter:selected', () => {});
		};
	});
</script>

<div class="editor-container">
	<EditorCore {storyId} {selectedFont} {selectedSize} {aiText} on:showPrompt={handleShowPrompt} />

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

	.prompt-overlay {
		position: absolute;
		z-index: 1000;
		background: transparent;
		font-size: inherit;
		line-height: inherit;
		color: inherit;
		width: calc(100% - 4rem); /* Account for editor padding */
	}
</style>
