<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let selectedFont: string;
	export let selectedSize: string;
	export let saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden';
	export let wordCount: number;
	export let charCount: number;
	export let fonts: string[];
	export let fontSizes: string[];

	const dispatch = createEventDispatcher<{
		fontChange: string;
		sizeChange: string;
	}>();

	function handleFontChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		dispatch('fontChange', select.value);
	}

	function handleSizeChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		dispatch('sizeChange', select.value);
	}
</script>

<div class="toolbar" role="toolbar" aria-label="Text editor toolbar">
	<div class="formatting-tools">
		<select value={selectedFont} on:change={handleFontChange} aria-label="Font family">
			{#each fonts as font}
				<option value={font}>{font}</option>
			{/each}
		</select>
		<select value={selectedSize} on:change={handleSizeChange} aria-label="Font size">
			{#each fontSizes as size}
				<option value={size}>{size}</option>
			{/each}
		</select>
	</div>

	<div class="toolbar-center">
		{#if saveStatus !== 'hidden'}
			<div class="save-status-container" role="status">
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
		<span class="word-count" role="status" aria-label="Word count">{wordCount} words</span>
		<span class="char-count" role="status" aria-label="Character count">{charCount} characters</span
		>
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;
		background: var(--toolbar-background);
		border-bottom: 1px solid var(--border-color);
		width: 100%;
		margin: 0;
	}

	.formatting-tools {
		display: flex;
		gap: 0.5rem;
		padding-left: 1rem;
	}

	.formatting-tools select {
		padding: 0.25rem;
		border: 1px solid var(--border-color);
		border-radius: 3px;
		background: var(--input-background);
		color: var(--text-color);
		font-size: 0.9rem;
	}

	.toolbar-center {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
	}

	.save-status-container {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.save-status {
		color: var(--saved-status-color);
	}

	.save-status.error {
		color: var(--error-color);
	}

	.status-bar {
		display: flex;
		gap: 1rem;
		font-size: 0.9rem;
		color: var(--text-muted);
		padding-right: 1rem;
		margin-left: auto;
	}

	@media (max-width: 480px) {
		.toolbar {
			flex-wrap: wrap;
			gap: 0.5rem;
			padding: 0.5rem;
		}

		.toolbar-center {
			position: static;
			transform: none;
			order: 3;
			width: 100%;
			text-align: center;
		}

		.status-bar {
			order: 2;
		}
	}
</style>
