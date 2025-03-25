<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import DocumentEditor from '$lib/components/document-editor.svelte';
	import ChapterList from '$lib/components/chapter-list.svelte';
	import EditorToolbar from '$lib/components/editor-toolbar.svelte';
	import { documents } from '$lib/stores/documents';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';
	import KeyboardShortcuts from '$lib/components/keyboard-shortcuts.svelte';
	import AIDialog from '$lib/components/ai-dialog.svelte';

	let leftPanelVisible = true;
	let rightPanelVisible = true;
	let storyId: string | null = null;
	let isLoading = true;

	// Editor state that needs to be lifted up
	let wordCount = 0;
	let charCount = 0;
	let saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden' = 'saved';
	const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
	const fontSizes = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt'];
	let selectedFont = 'Arial';
	let selectedSize = '11pt';
	let aiText: string | null = null;

	// Load editor settings
	function loadSettings(id: string) {
		if (!browser) return;

		try {
			const settings = localStorage.getItem(`document_settings_${id}`);
			if (settings) {
				const parsed = JSON.parse(settings);
				selectedFont = parsed.font;
				selectedSize = parsed.fontSize;
			}
		} catch (err) {
			console.error('Error loading settings:', err);
		}
	}

	onMount(async () => {
		try {
			await documents.loadFromStorage();
		} catch (err) {
			console.error('Error loading documents:', err);
		} finally {
			isLoading = false;
		}
	});

	let documentLoaded = false;

	$: {
		// Get story ID from URL
		const urlParams = new URLSearchParams($page.url.search);
		const idFromUrl = urlParams.get('id');

		if (idFromUrl && !isLoading) {
			const docs = get(documents);
			if (docs[idFromUrl]) {
				storyId = idFromUrl;
				loadSettings(idFromUrl);
				documentLoaded = true;
			} else if (!documentLoaded) {
				// Only redirect if document doesn't exist and we haven't loaded a document yet
				goto('/home');
			}
		} else if (!isLoading && !documentLoaded) {
			// Only redirect if we're not in loading state and haven't loaded a document
			goto('/home');
		}
	}

	function toggleLeftPanel() {
		leftPanelVisible = !leftPanelVisible;
	}

	function toggleRightPanel() {
		rightPanelVisible = !rightPanelVisible;
	}

	// Event handlers for toolbar
	function handleFontChange(event: CustomEvent<string>) {
		selectedFont = event.detail;
	}

	function handleSizeChange(event: CustomEvent<string>) {
		selectedSize = event.detail;
	}

	// Event handlers for editor state updates
	function handleEditorStateUpdate(
		event: CustomEvent<{
			wordCount: number;
			charCount: number;
			saveStatus: typeof saveStatus;
		}>
	) {
		wordCount = event.detail.wordCount;
		charCount = event.detail.charCount;
		saveStatus = event.detail.saveStatus;
	}

	// Handle AI generated text
	function handleAITextGenerated(event: CustomEvent<{ text: string }>) {
		console.log('Page component received textGenerated event:', event.detail);
		aiText = event.detail.text;
	}
</script>

<!-- Add the keyboard shortcuts component -->
<KeyboardShortcuts />

<!-- Add the AI dialog component -->
<AIDialog on:textGenerated={handleAITextGenerated} />

{#if storyId}
	<div class="editor-layout">
		{#if leftPanelVisible}
			<aside class="left-panel">
				<ChapterList {storyId} />
			</aside>
		{/if}
		<div class="main-content">
			<EditorToolbar
				{selectedFont}
				{selectedSize}
				{saveStatus}
				{wordCount}
				{charCount}
				{fonts}
				{fontSizes}
				on:fontChange={handleFontChange}
				on:sizeChange={handleSizeChange}
			/>
			<DocumentEditor
				{storyId}
				{selectedFont}
				{selectedSize}
				{aiText}
				on:stateUpdate={handleEditorStateUpdate}
			/>
		</div>
		{#if rightPanelVisible}
			<aside class="right-panel">
				<!-- Future panel content -->
			</aside>
		{/if}
	</div>
{/if}

<style>
	.editor-layout {
		display: flex;
		height: 100%;
		overflow: hidden;
		width: 100%;
	}

	.left-panel,
	.right-panel {
		width: 250px;
		background: var(--panel-background);
		border-right: 1px solid var(--border-color);
		overflow-y: auto;
		flex-shrink: 0;
	}

	.right-panel {
		border-right: none;
		border-left: 1px solid var(--border-color);
	}

	.main-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		background: var(--editor-background);
		min-width: 0;
	}

	@media (max-width: 768px) {
		.left-panel,
		.right-panel {
			width: 200px;
		}
	}
</style>
