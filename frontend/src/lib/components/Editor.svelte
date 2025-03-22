<script lang="ts">
	import { onMount } from 'svelte';

	let content = '';
	let documentId = 'default-document';
	let isLoading = true;
	let editor: HTMLDivElement;

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
				// Set the editor's content directly without binding in the markup
				if (editor) editor.textContent = content;
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
		// If content is empty, remove the textContent to trigger the :empty pseudo-element
		if (!content.trim()) {
			target.textContent = '';
		}
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveContent, 1000);
	}

	let saveTimeout: ReturnType<typeof setTimeout>;

	onMount(() => {
		loadContent();
	});
</script>

<div class="editor-container">
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

<style>
	.editor-container {
		height: 100%;
		width: 100%;
	}

	.editor-content {
		height: 100%;
		width: 100%;
		padding: 1rem;
		outline: none;
		white-space: pre-wrap;
		word-wrap: break-word;
		font-family: Arial, sans-serif;
		font-size: 11pt;
		line-height: inherit;
		position: relative;
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
