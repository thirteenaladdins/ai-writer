<script lang="ts">
	import { onMount } from 'svelte';

	let content = '';
	let documentId = 'default-document';
	let isLoading = true;
	let editor: HTMLDivElement;
	let wordCount = 0;
	let charCount = 0;

	const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];

	const fontSizes = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt'];

	let selectedFont = 'Arial';
	let selectedSize = '11pt';

	function updateCounts() {
		const text = editor?.textContent || '';
		wordCount = text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
		charCount = text.length;
	}

	function handleFontChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedFont = select.value;
		if (editor) {
			editor.style.fontFamily = selectedFont;
		}
	}

	function handleSizeChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedSize = select.value;
		if (editor) {
			editor.style.fontSize = selectedSize;
		}
	}

	async function saveContent() {
		try {
			const response = await fetch('http://localhost:8000/documents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					id: documentId,
					title: 'My Story',
					content: content,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				})
			});
			if (!response.ok) {
				throw new Error('Failed to save document');
			}
		} catch (error) {
			console.error('Error saving document:', error);
		}
	}

	async function loadContent() {
		try {
			const response = await fetch(`http://localhost:8000/documents/${documentId}`);
			if (response.ok) {
				const document = await response.json();
				content = document.content;
				if (editor) {
					editor.textContent = content;
					updateCounts();
				}
			}
			isLoading = false;
		} catch (error) {
			console.error('Error loading document:', error);
			isLoading = false;
		}
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLDivElement;
		content = target.textContent || '';
		if (!content.trim()) {
			target.textContent = '';
		}
		updateCounts();
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveContent, 1000);
	}

	let saveTimeout: ReturnType<typeof setTimeout>;

	onMount(() => {
		loadContent();
	});
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

	.counts {
		margin-left: auto;
		font-size: 10pt;
		color: #666;
		display: flex;
		gap: 0.75rem;
		white-space: nowrap;
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
