<script lang="ts">
	import { onMount } from 'svelte';
	import { toggleAIDialog } from '$lib/stores/ai';
	import { browser } from '$app/environment';

	// Show the welcome tooltip for Command+K
	let showCommandKTooltip = true;

	onMount(() => {
		// Hide the tooltip after 10 seconds
		if (browser) {
			const tooltipTimer = setTimeout(() => {
				showCommandKTooltip = false;
			}, 10000);

			return () => {
				clearTimeout(tooltipTimer);
			};
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		// Command/Ctrl + K to open AI dialog
		if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
			event.preventDefault();
			toggleAIDialog(true);
			showCommandKTooltip = false;
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if showCommandKTooltip}
	<div class="command-k-tooltip">
		<p>Press <kbd>⌘</kbd>+<kbd>K</kbd> to use AI writing assistant</p>
		<button class="close-tooltip" on:click={() => (showCommandKTooltip = false)}>×</button>
	</div>
{/if}

<style>
	.command-k-tooltip {
		position: fixed;
		bottom: 20px;
		right: 20px;
		background-color: #2d2d2d;
		color: #e0e0e0;
		padding: 10px 14px;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 900;
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
	}

	p {
		margin: 0;
	}

	kbd {
		background-color: #444;
		padding: 2px 5px;
		border-radius: 3px;
		font-family: monospace;
		font-size: 12px;
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.close-tooltip {
		background: none;
		border: none;
		color: #999;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		padding: 0;
		margin: 0;
	}

	.close-tooltip:hover {
		color: #fff;
	}
</style>
