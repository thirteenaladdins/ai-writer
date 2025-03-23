<script lang="ts">
	import { onMount } from 'svelte';
	import { documents } from '$lib/stores/documents';
	import { documentTitle } from '$lib/stores/document';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';

	export let storyId: string;

	let isLoading = true;
	let editor: HTMLDivElement;
	let wordCount = 0;
	let charCount = 0;
	let lastSaveTime = new Date().toISOString();

	// Save status indicators
	let saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden' = 'saved';
	let isOffline = false;
	let hasUnsavedChanges = false;
	let statusHideTimeout: ReturnType<typeof setTimeout>;

	// Font and formatting options
	const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
	const fontSizes = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt'];
	let selectedFont = 'Arial';
	let selectedSize = '11pt';

	// Current chapter tracking
	let currentChapterId: string | null = null;

	// Subscribe to document changes for title sync
	let unsubscribe: () => void;

	// Custom event interfaces
	interface ChapterContentEvent extends CustomEvent {
		detail: {
			content: string;
			chapterId: string;
		};
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
	}

	// Save editor font and size settings
	function saveSettings() {
		if (typeof window === 'undefined') return;

		const settings = {
			font: selectedFont,
			fontSize: selectedSize,
			lastModified: new Date().toISOString()
		};
		localStorage.setItem(`document_settings_${storyId}`, JSON.stringify(settings));
	}

	// Load editor settings
	function loadSettings() {
		if (typeof window === 'undefined') return;

		try {
			const settings = localStorage.getItem(`document_settings_${storyId}`);
			if (settings) {
				const parsed = JSON.parse(settings);
				selectedFont = parsed.font;
				selectedSize = parsed.fontSize;
				if (editor) {
					editor.style.fontFamily = selectedFont;
					editor.style.fontSize = selectedSize;
				}
			}
		} catch (error) {
			console.error('Error loading settings:', error);
		}
	}

	// Handle font change
	function handleFontChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedFont = select.value;
		if (editor) {
			editor.style.fontFamily = selectedFont;
		}
		saveSettings();
	}

	// Handle font size change
	function handleSizeChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedSize = select.value;
		if (editor) {
			editor.style.fontSize = selectedSize;
		}
		saveSettings();
	}

	// Handle document title change
	function handleTitleChange() {
		hasUnsavedChanges = true;
		saveDocumentMetadata();
	}

	// Check online status
	function updateOnlineStatus() {
		if (typeof window !== 'undefined') {
			isOffline = !navigator.onLine;
			saveStatus = isOffline ? 'offline' : hasUnsavedChanges ? 'saving' : 'saved';
		}
	}

	// Save document metadata (title, etc.)
	function saveDocumentMetadata() {
		if (typeof window === 'undefined') return;

		try {
			const timestamp = new Date().toISOString();
			const title = $documentTitle;

			// Update document store with metadata (no content)
			documents.update((docs) => {
				const updatedDocs = { ...docs };
				updatedDocs[storyId] = {
					...(updatedDocs[storyId] || {}),
					id: storyId,
					title,
					updatedAt: new Date(timestamp)
				};
				return updatedDocs;
			});

			lastSaveTime = timestamp;
			hasUnsavedChanges = false;
			setSaveStatus('saved');
		} catch (error) {
			console.error('Error saving document metadata:', error);
			setSaveStatus('error');
		}
	}

	// Initial content and metadata loading
	function loadContent() {
		// Only load document metadata (title)
		const docsData = get(documents);
		if (docsData[storyId]) {
			documentTitle.set(docsData[storyId].title || 'Untitled Document');
		} else {
			documentTitle.set('Untitled Document');
			saveDocumentMetadata(); // Initialize document
		}

		isLoading = false;
		loadSettings();
	}

	// Handle editor input
	function handleInput() {
		updateCounts();
		hasUnsavedChanges = true;

		// Notify chapters component of content change
		if (currentChapterId) {
			window.dispatchEvent(
				new CustomEvent('editor:content-change', {
					detail: {
						content: editor?.innerHTML || '',
						chapterId: currentChapterId
					}
				})
			);
		}
	}

	// Update save status display
	function setSaveStatus(status: typeof saveStatus) {
		saveStatus = status;

		if (statusHideTimeout) {
			clearTimeout(statusHideTimeout);
		}

		if (status === 'saved' || status === 'error') {
			statusHideTimeout = setTimeout(() => {
				saveStatus = 'hidden';
			}, 2000);
		}

		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('document:save-status', { detail: status }));
		}
	}

	onMount(() => {
		// Initialize online status
		updateOnlineStatus();

		// Set up event listeners
		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);
		window.addEventListener('document:title-change', handleTitleChange);

		// Subscribe to documents store for title sync
		unsubscribe = documents.subscribe((docs) => {
			if (docs[storyId]) {
				const title = docs[storyId].title;
				if (title !== undefined && title !== null) {
					documentTitle.set(title);
				}
			}
		});

		// Load document metadata
		loadContent();

		// Listen for chapter content changes
		window.addEventListener('chapter:content-change', ((event: ChapterContentEvent) => {
			if (editor) {
				currentChapterId = event.detail.chapterId;
				editor.innerHTML = event.detail.content || '';
				updateCounts();
				console.log(`Editor updated with content from chapter ID: ${currentChapterId}`);
			}
		}) as EventListener);

		return () => {
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
			window.removeEventListener('document:title-change', handleTitleChange);
			window.removeEventListener('chapter:content-change', (() => {}) as EventListener);
			if (unsubscribe) unsubscribe();
		};
	});
</script>

<div class="editor-container">
	<div class="toolbar">
		<div class="formatting-tools">
			<select value={selectedFont} on:change={handleFontChange}>
				{#each fonts as font}
					<option value={font}>{font}</option>
				{/each}
			</select>
			<select value={selectedSize} on:change={handleSizeChange}>
				{#each fontSizes as size}
					<option value={size}>{size}</option>
				{/each}
			</select>
		</div>

		<div class="toolbar-center">
			{#if saveStatus !== 'hidden'}
				<div class="save-status-container">
					<span class="save-status" class:error={saveStatus === 'error'}>
						{#if saveStatus === 'saved'}
							Saved
						{:else if saveStatus === 'saving'}
							Saving...
						{:else if saveStatus === 'error'}
							Error saving
						{:else if saveStatus === 'offline'}
							Offline - changes saved locally
						{/if}
					</span>
				</div>
			{/if}
		</div>

		<div class="status-bar">
			<span class="word-count">{wordCount} words</span>
			<span class="char-count">{charCount} characters</span>
		</div>
	</div>

	<div
		class="editor"
		bind:this={editor}
		contenteditable="true"
		on:input={handleInput}
		style="font-family: {selectedFont}; font-size: {selectedSize};"
	/>
</div>

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--editor-background);
	}

	.toolbar {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border-color);
		background: var(--toolbar-background);
	}

	.toolbar-center {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.formatting-tools {
		display: flex;
		gap: 0.5rem;
	}

	.formatting-tools select {
		padding: 0.3rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		background: var(--input-background);
		color: var(--text-color);
	}

	.save-status-container {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.save-status {
		font-size: 0.8rem;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		background: var(--success-background, rgba(0, 255, 0, 0.1));
		color: var(--success-text, #6ece6e);
	}

	.save-status.error {
		background: var(--error-background, rgba(255, 0, 0, 0.1));
		color: var(--error-text, #ff6b6b);
	}

	.status-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.9rem;
		color: var(--text-muted);
		justify-self: end;
	}

	.editor {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
		line-height: 1.6;
		color: var(--text-color);
	}

	.editor:focus {
		outline: none;
	}

	/* Hide scrollbar for Chrome, Safari and Opera */
	.editor::-webkit-scrollbar {
		display: none;
	}

	/* Hide scrollbar for IE, Edge and Firefox */
	.editor {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}
</style>
