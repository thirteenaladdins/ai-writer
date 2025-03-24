<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label = 'New Document';

	const dispatch = createEventDispatcher<{
		click: void;
	}>();

	function handleClick() {
		dispatch('click');
	}
</script>

<button class="new-doc-btn" on:click={handleClick}>{label}</button>

<style>
	.new-doc-btn {
		background: var(--primary-color);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		transition: background-color 0.2s ease;
	}

	.new-doc-btn:hover {
		background: var(--primary-color-dark);
	}
</style>
