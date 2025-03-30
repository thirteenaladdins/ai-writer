<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	const dispatch = createEventDispatcher<{
		submit: { prompt: string };
		cancel: void;
	}>();

	let inputElement: HTMLInputElement;
	let prompt = '';

	function handleKeydown(event: KeyboardEvent) {
		console.log('Prompt keydown:', event.key);
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			dispatch('cancel');
		} else if (event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			if (prompt.trim()) {
				dispatch('submit', { prompt: prompt.trim() });
			}
		}
	}

	onMount(() => {
		console.log('Inline prompt mounted');
		setTimeout(() => {
			if (inputElement) {
				console.log('Focusing input element');
				inputElement.focus();
			}
		}, 0);
	});
</script>

<div class="inline-prompt">
	<input
		bind:this={inputElement}
		bind:value={prompt}
		type="text"
		placeholder="Continue writing..."
		class="prompt-input"
		on:keydown={handleKeydown}
	/>
</div>

<style>
	.inline-prompt {
		display: block;
		padding: 4px;
		margin: 0;
		line-height: inherit;
		font-size: inherit;
		background: var(--editor-background, #fff);
		border: 2px solid var(--primary-color, #4a67e8);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		height: calc(var(--line-height, 1.6em) * 2);
		box-sizing: border-box;
	}

	.prompt-input {
		display: block;
		width: 100%;
		height: 100%;
		font-size: inherit;
		font-family: inherit;
		line-height: inherit;
		padding: 2px 6px;
		margin: 0;
		border: none;
		background: transparent;
		color: inherit;
		outline: none;
		box-shadow: none;
		resize: none;
	}

	.prompt-input::placeholder {
		color: var(--text-muted, #666);
		opacity: 0.5;
	}

	.prompt-input:focus {
		box-shadow: none;
		background: transparent;
	}
</style>
