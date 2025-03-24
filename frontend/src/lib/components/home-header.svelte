<script lang="ts">
	import NewDocumentButton from './new-document-button.svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		createDocument: void;
	}>();

	function handleCreateDocument() {
		dispatch('createDocument');
	}
</script>

<header class="home-header">
	<h1>My Documents</h1>
	<NewDocumentButton on:click={handleCreateDocument} />
</header>

<style>
	.home-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: var(--editor-background);
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.home-header h1 {
		font-size: 2rem;
		color: var(--text-color);
		margin: 0;
	}
</style>
