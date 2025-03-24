<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Chapter } from '$lib/stores/documents';

	export let chapter: Chapter;
	export let isSelected: boolean;
	export let isOnlyChapter: boolean;

	const dispatch = createEventDispatcher<{
		titleChange: { chapter: Chapter; newTitle: string };
		select: string;
		delete: string;
		dragStart: Chapter;
		dragOver: Chapter;
		dragEnd: void;
	}>();

	function handleTitleChange(event: Event) {
		const input = event.target as HTMLInputElement;
		dispatch('titleChange', { chapter, newTitle: input.value });
	}

	function handleSelect() {
		dispatch('select', chapter.id);
	}

	function handleDelete() {
		dispatch('delete', chapter.id);
	}

	function handleDragStart() {
		dispatch('dragStart', chapter);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dispatch('dragOver', chapter);
	}

	function handleDragEnd() {
		dispatch('dragEnd');
	}
</script>

<li
	class="chapter-item"
	class:selected={isSelected}
	draggable="true"
	on:dragstart={handleDragStart}
	on:dragover={handleDragOver}
	on:dragend={handleDragEnd}
>
	<input
		type="text"
		value={chapter.title}
		on:input={handleTitleChange}
		on:click={handleSelect}
		class="chapter-title-input"
	/>
	{#if !isOnlyChapter}
		<button class="delete-chapter-btn" on:click={handleDelete} aria-label="Delete chapter">
			×
		</button>
	{/if}
</li>

<style>
	.chapter-item {
		display: flex;
		align-items: center;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		border-radius: 4px;
		background: var(--item-background);
		border: 1px solid transparent;
		transition: all 0.2s ease;
		cursor: grab;
	}

	.chapter-item:hover {
		background: var(--hover-color);
	}

	.chapter-item.selected {
		background: var(--selected-color);
		border-color: var(--primary-color);
	}

	.chapter-title-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-color);
		font-size: 0.9rem;
		padding: 0.2rem;
		outline: none;
		width: 100%;
	}

	.chapter-title-input:focus {
		background: var(--input-focus-color);
	}

	.delete-chapter-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.2rem;
		margin-left: 0.5rem;
		font-size: 1.2rem;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.chapter-item:hover .delete-chapter-btn {
		opacity: 0.8;
	}

	.delete-chapter-btn:hover {
		color: var(--error-color);
		opacity: 1;
	}
</style>
