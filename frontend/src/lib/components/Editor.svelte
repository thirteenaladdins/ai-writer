<script lang="ts">
	import { onMount } from 'svelte';

	let content = '';
	let documentId = 'default-document';
	let isLoading = true;
	let editor: HTMLDivElement;
	let wordCount = 0;
	let charCount = 0;
	let lastSavedContent = ''; // Track last saved content for change detection
	let lastSaveTime = new Date().toISOString(); // Track when content was last saved

	// Save status indicators
	let saveStatus: 'saved' | 'saving' | 'error' | 'offline' = 'saved';
	let lastServerSync: Date | null = null;
	let isOffline = false; // Initialize without navigator check
	let hasUnsavedChanges = false;

	// Local storage keys
	const LOCAL_STORAGE_KEY = `document_${documentId}`;
	const LOCAL_STORAGE_VERSION_KEY = `document_${documentId}_version`;
	const LOCAL_STORAGE_SETTINGS_KEY = `document_${documentId}_settings`;

	const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];

	const fontSizes = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt'];

	let selectedFont = 'Arial';
	let selectedSize = '11pt';

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
		localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
	}

	function loadSettings() {
		if (typeof window === 'undefined') return;

		try {
			const settings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
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

		// Load initial content
		loadContent();

		return () => {
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
		};
	});

	// Save to local storage
	function saveToLocalStorage() {
		if (typeof window === 'undefined') return;

		try {
			const timestamp = new Date().toISOString();
			localStorage.setItem(LOCAL_STORAGE_KEY, editor?.innerHTML || '');
			localStorage.setItem(LOCAL_STORAGE_VERSION_KEY, timestamp);
			lastSavedContent = editor?.innerHTML || '';
			lastSaveTime = timestamp;
			hasUnsavedChanges = true;
		} catch (error) {
			console.error('Error saving to local storage:', error);
			saveStatus = 'error';
		}
	}

	// Load from local storage
	function loadFromLocalStorage(): { content: string; timestamp: string } | null {
		if (typeof window === 'undefined') return null;

		try {
			const content = localStorage.getItem(LOCAL_STORAGE_KEY);
			const timestamp = localStorage.getItem(LOCAL_STORAGE_VERSION_KEY) || new Date().toISOString();
			if (content !== null) {
				return { content, timestamp };
			}
			return null;
		} catch (error) {
			console.error('Error loading from local storage:', error);
			return null;
		}
	}

	async function loadContent() {
		try {
			// First try to load from local storage
			const localData = loadFromLocalStorage();
			let shouldUseLocalContent = false;

			if (localData) {
				shouldUseLocalContent = true;
				if (editor) {
					editor.innerHTML = localData.content;
					updateCounts();
				}
			}

			// Then try to load from server
			const response = await fetch(`http://localhost:8000/documents/${documentId}`);
			if (response.ok) {
				const document = await response.json();
				// Only use server content if it's newer than local content
				if (
					!shouldUseLocalContent ||
					new Date(document.updated_at) > new Date(localData?.timestamp || 0)
				) {
					if (editor) {
						editor.innerHTML = document.content;
						updateCounts();
						saveToLocalStorage(); // Sync local storage with server version
					}
				}
			}
			isLoading = false;

			// Load settings after content
			loadSettings();
		} catch (error) {
			console.error('Error loading document:', error);
			isLoading = false;
		}
	}

	function handleInput(event: Event) {
		updateCounts();

		// Save immediately to local storage
		saveToLocalStorage();

		// Debounced save to server
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveContent, 1000);
	}

	let saveTimeout: ReturnType<typeof setTimeout>;

	async function saveContent() {
		if (isOffline) {
			saveStatus = 'offline';
			return;
		}

		saveStatus = 'saving';

		try {
			// Check if document exists first
			const checkResponse = await fetch(`http://localhost:8000/documents/${documentId}`);
			const method = checkResponse.ok ? 'PUT' : 'POST';
			const url = checkResponse.ok
				? `http://localhost:8000/documents/${documentId}`
				: 'http://localhost:8000/documents';

			const response = await fetch(url, {
				method,
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					id: documentId,
					title: 'My Story',
					content: editor?.innerHTML || '',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				})
			});

			if (!response.ok) {
				throw new Error(`Failed to ${method.toLowerCase()} document`);
			}

			lastServerSync = new Date();
			saveStatus = 'saved';
			hasUnsavedChanges = false;
		} catch (error) {
			console.error('Error saving document to server:', error);
			saveStatus = 'error';
		}
	}

	function getSaveStatusText(): string {
		switch (saveStatus) {
			case 'saved':
				return lastServerSync
					? `All changes saved • Last synced ${formatTimeAgo(lastServerSync)}`
					: 'All changes saved locally';
			case 'saving':
				return 'Saving changes...';
			case 'error':
				return 'Error saving changes';
			case 'offline':
				return 'Working offline • Changes saved locally';
			default:
				return '';
		}
	}

	function formatTimeAgo(date: Date): string {
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return 'just now';
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
		return `${Math.floor(diffInSeconds / 86400)}d ago`;
	}
</script>

<div class="editor-wrapper">
	<div class="editor-container">
		<div class="toolbar">
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
			<div class="save-status {saveStatus}">
				{getSaveStatusText()}
			</div>
			<div class="counts">
				<span>{wordCount} words</span>
				<span>{charCount} characters</span>
			</div>
		</div>
		<div
			bind:this={editor}
			class="editor-content"
			contenteditable="true"
			on:input={handleInput}
			spellcheck="true"
		>
			<!-- No binding of {content} here -->
		</div>
	</div>
</div>

<style>
	.editor-wrapper {
		height: 100%;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		justify-content: center;
	}

	.editor-container {
		width: 95%;
		max-width: 800px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.toolbar {
		padding: 0.25rem 0.5rem;
		display: flex;
		align-items: center;
		background-color: var(--panel-background);
		height: 24px;
	}

	.toolbar select {
		padding: 0.15rem 0.25rem;
		background-color: var(--background-color);
		color: var(--text-color);
		border: 1px solid var(--border-color);
		border-radius: 3px;
		font-size: 10pt;
		height: 24px;
		max-width: 120px;
	}

	.save-status {
		margin-left: auto;
		font-size: 10pt;
		color: #666;
		display: flex;
		align-items: center;
		padding: 0 1rem;
	}

	.save-status.saving {
		color: #ffd700;
	}

	.save-status.saved {
		color: #4caf50;
	}

	.save-status.error {
		color: #f44336;
	}

	.save-status.offline {
		color: #ff9800;
	}

	.counts {
		margin-left: 1rem;
		border-left: 1px solid var(--border-color);
		padding-left: 1rem;
		color: #666;
	}

	.editor-content {
		flex: 1;
		width: 100%;
		padding: 0.5rem;
		outline: none;
		white-space: pre-wrap;
		word-wrap: break-word;
		font-family: Arial, sans-serif;
		font-size: 11pt;
		line-height: inherit;
		box-sizing: border-box;
	}

	/* Placeholder style using the :empty pseudo-element */
	.editor-content:empty:before {
		content: 'Start writing your story...';
		color: #666;
		opacity: 0.7;
		pointer-events: none;
		user-select: none;
	}
</style>
