<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		addChapter: void;
	}>();

	function handleAddChapter() {
		dispatch('addChapter');
	}
</script>

<div class="chapters-header">
	<h2>Chapters</h2>
	<button class="add-chapter-btn" on:click={handleAddChapter} aria-label="Add chapter">+</button>
</div>

<style>
	.chapters-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.chapters-header h2 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.add-chapter-btn {
		background: transparent;
		border: 1px solid var(--border-color);
		color: var(--text-color);
		width: 24px;
		height: 24px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0;
		transition: all 0.2s ease;
	}

	.add-chapter-btn:hover {
		background: var(--hover-color);
		border-color: var(--primary-color);
	}
</style>
