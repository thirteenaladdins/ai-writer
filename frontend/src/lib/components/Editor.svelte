<script lang="ts">
	import { onMount } from 'svelte';
	import { documents } from '$lib/stores/documents';
	import { documentTitle } from '$lib/stores/document';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';

	export let storyId: string;

	let content = '';
	let isLoading = true;
	let editor: HTMLDivElement;
	let wordCount = 0;
	let charCount = 0;
	let lastSavedContent = ''; // Track last saved content for change detection
	let lastSaveTime = new Date().toISOString(); // Track when content was last saved

	// Save status indicators
	let saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden' = 'saved';
	let lastServerSync: Date | null = null;
	let isOffline = false; // Initialize without navigator check
	let hasUnsavedChanges = false;
	let statusHideTimeout: ReturnType<typeof setTimeout>;

	const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
	const fontSizes = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt'];

	let selectedFont = 'Arial';
	let selectedSize = '11pt';

	// Subscribe to document changes to keep title in sync
	let unsubscribe: () => void;

	function navigateToHome() {
		goto('/home');
	}

	interface DocumentSettings {
		font: string;
		fontSize: string;
		lastModified: string;
	}

	function updateCounts() {
		// Use a temporary div to get plain text for counting
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = editor?.innerHTML || '';
		const text = tempDiv.textContent || '';
		wordCount = text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
		charCount = text.length;
	}

	function saveSettings() {
		if (typeof window === 'undefined') return;

		const settings: DocumentSettings = {
			font: selectedFont,
			fontSize: selectedSize,
			lastModified: new Date().toISOString()
		};
		localStorage.setItem(`document_settings_${storyId}`, JSON.stringify(settings));
	}

	function loadSettings() {
		if (typeof window === 'undefined') return;

		try {
			const settings = localStorage.getItem(`document_settings_${storyId}`);
			if (settings) {
				const parsed = JSON.parse(settings) as DocumentSettings;
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

	function handleFontChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedFont = select.value;
		if (editor) {
			editor.style.fontFamily = selectedFont;
		}
		saveSettings();
	}

	function handleSizeChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedSize = select.value;
		if (editor) {
			editor.style.fontSize = selectedSize;
		}
		saveSettings();
	}

	function handleTitleChange() {
		hasUnsavedChanges = true;
		saveToLocalStorage();
	}

	// Monitor online status
	function updateOnlineStatus() {
		if (typeof window !== 'undefined') {
			isOffline = !navigator.onLine;
			saveStatus = isOffline ? 'offline' : hasUnsavedChanges ? 'saving' : 'saved';
		}
	}

	onMount(() => {
		// Initialize online status
		updateOnlineStatus();

		// Add event listeners
		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);
		window.addEventListener('document:title-change', handleTitleChange);

		// Subscribe to documents store to keep title in sync
		unsubscribe = documents.subscribe((docs) => {
			if (docs[storyId]) {
				documentTitle.set(docs[storyId].title);
			}
		});

		// Load initial content
		loadContent();

		return () => {
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
			window.removeEventListener('document:title-change', handleTitleChange);
			if (unsubscribe) unsubscribe();
		};
	});

	// Save to local storage and documents store
	function saveToLocalStorage() {
		if (typeof window === 'undefined') return;

		try {
			const timestamp = new Date().toISOString();
			const content = editor?.innerHTML || '';
			const title = $documentTitle;

			// Save to documents store
			documents.update((docs) => {
				const updatedDocs = { ...docs };
				updatedDocs[storyId] = {
					id: storyId,
					title,
					content,
					updatedAt: new Date(timestamp)
				};
				return updatedDocs;
			});

			// Save to localStorage
			localStorage.setItem(
				`document_${storyId}`,
				JSON.stringify({
					title,
					content,
					updatedAt: timestamp
				})
			);

			lastSavedContent = content;
			lastSaveTime = timestamp;
			hasUnsavedChanges = false;
			setSaveStatus('saved');
		} catch (error) {
			console.error('Error saving to storage:', error);
			setSaveStatus('error');
		}
	}

	// Load content from documents store and localStorage
	function loadContent() {
		try {
			// Special handling for default-document (legacy format)
			if (storyId === 'default-document') {
				const legacyContent = localStorage.getItem('document_content');
				const legacyTitle = localStorage.getItem('document_title');

				if (legacyContent) {
					if (editor) {
						editor.innerHTML = legacyContent;
						documentTitle.set(legacyTitle || 'Untitled Document');
						updateCounts();

						// Save in new format
						saveToLocalStorage();
					}
					isLoading = false;
					loadSettings();
					return;
				}
			}

			// First try to get from documents store
			const docsData = get(documents);
			if (docsData[storyId]) {
				if (editor) {
					editor.innerHTML = docsData[storyId].content;
					documentTitle.set(docsData[storyId].title);
					updateCounts();
				}
			} else {
				// Try localStorage as fallback
				const doc = JSON.parse(localStorage.getItem(`document_${storyId}`) || '{}');

				if (doc.content) {
					if (editor) {
						editor.innerHTML = doc.content;
						documentTitle.set(doc.title || 'Untitled Document');
						updateCounts();
					}
				} else {
					// Initialize new document
					if (editor) {
						editor.innerHTML = '';
						documentTitle.set('Untitled Document');
						updateCounts();
						saveToLocalStorage(); // Save the initial state
					}
				}
			}

			isLoading = false;
			loadSettings();
		} catch (error) {
			console.error('Error loading document:', error);
			isLoading = false;
		}
	}

	function handleInput() {
		updateCounts();
		hasUnsavedChanges = true;

		// Save immediately to storage
		saveToLocalStorage();
	}

	function setSaveStatus(status: typeof saveStatus) {
		saveStatus = status;

		// Clear any existing timeout
		if (statusHideTimeout) {
			clearTimeout(statusHideTimeout);
		}

		// Set timeout to hide the message after a few seconds
		if (status === 'saved' || status === 'error') {
			statusHideTimeout = setTimeout(() => {
				saveStatus = 'hidden';
			}, 2000);
		}

		// Dispatch custom event to notify layout of status change
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('document:save-status', { detail: status }));
		}
	}
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
