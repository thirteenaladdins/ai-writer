<script lang="ts">
	import TiptapEditor from '$lib/components/document-editor/components/new/tiptap-editor.svelte';
	import JsonTiptapEditor from '$lib/components/document-editor/components/new/json-tiptap-editor.svelte';
	import { documentStore } from '$lib/components/document-editor/extensions/new/DocumentExtension';
	import { jsonDocumentStore } from '$lib/components/document-editor/extensions/new/JsonDocumentExtension';
	import { onMount } from 'svelte';
	import { initializeDocument } from './documents-utils';

	let storyId = 'folders-test-story';
	let isLoading = true;
	let error: string | null = null;
	// Flag to toggle between regular HTML storage and JSON storage
	let useJsonStorage = true;

	// Initialize the document with folders
	onMount(async () => {
		try {
			isLoading = true;
			// Initialize the document with folders structure
			await initializeDocument(storyId);
			isLoading = false;
		} catch (err) {
			console.error('Error initializing document:', err);
			error = 'Failed to initialize document';
			isLoading = false;
		}
	});
</script>

<svelte:head>
	<title>Folders Document Structure Test</title>
</svelte:head>

<div class="header">
	<h1>Folders & Documents Test</h1>
	<p class="description">
		Testing the new folder/document structure for better content organization
	</p>
	<div class="storage-toggle">
		<label>
			<input type="checkbox" bind:checked={useJsonStorage} />
			Use JSON Storage
		</label>
	</div>
</div>

{#if isLoading}
	<div class="loading">Loading document...</div>
{:else if error}
	<div class="error">{error}</div>
{:else}
	<div class="editor-container">
		{#if useJsonStorage}
			<JsonTiptapEditor {storyId} />
		{:else}
			<TiptapEditor {storyId} />
		{/if}
	</div>
{/if}

<style>
	.header {
		padding: 1rem 2rem;
		background: var(--panel-background);
		border-bottom: 1px solid var(--border-color);
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
	}

	.description {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.storage-toggle {
		margin-top: 0.5rem;
		font-size: 0.9rem;
	}

	.storage-toggle label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.editor-container {
		height: calc(100vh - 5rem);
		width: 100%;
		background: var(--editor-background);
	}

	.loading,
	.error {
		display: flex;
		justify-content: center;
		align-items: center;
		height: calc(100vh - 5rem);
		font-size: 1.2rem;
		color: var(--text-muted);
	}

	.error {
		color: var(--error-color);
	}
</style>
