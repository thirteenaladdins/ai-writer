<!-- AI Dialog component for text generation -->
<script lang="ts">
	import { aiState, generateText, toggleAIDialog } from '$lib/stores/ai';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		textGenerated: { text: string };
	}>();

	let prompt = '';
	let aiText = '';
	let isSubmitting = false;

	// When the dialog is closed, reset the form
	$: if (!$aiState.aiDialogOpen) {
		prompt = '';
		aiText = '';
	}

	async function handleSubmit() {
		if (!prompt.trim() || isSubmitting) return;

		isSubmitting = true;
		console.log('Submitting prompt to AI:', prompt);
		const result = await generateText(prompt);
		console.log('AI generation result:', result);
		isSubmitting = false;

		if (result.success && result.text) {
			aiText = result.text;
			console.log('Dispatching textGenerated event with text length:', result.text.length);
			// Auto-insert when text is generated
			dispatch('textGenerated', { text: result.text });
			toggleAIDialog(false);
		} else {
			console.error('AI generation failed:', result.error);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// Close on escape
		if (event.key === 'Escape') {
			toggleAIDialog(false);
		}
		// Submit on enter (if not in textarea)
		if (
			event.key === 'Enter' &&
			!event.shiftKey &&
			document.activeElement !== document.querySelector('textarea')
		) {
			event.preventDefault();
			handleSubmit();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $aiState.aiDialogOpen}
	<div class="dialog-container">
		<div class="command-dialog">
			<div class="dialog-header">
				<span>AI Writing Assistant</span>
				<button class="close-button" on:click={() => toggleAIDialog(false)}>×</button>
			</div>

			<div class="dialog-input">
				<textarea
					placeholder="What would you like me to write?"
					bind:value={prompt}
					rows="2"
					autofocus
				></textarea>
			</div>

			{#if $aiState.lastError}
				<div class="error-message">
					<p>Error: {$aiState.lastError}</p>
				</div>
			{/if}

			{#if isSubmitting}
				<div class="generating-indicator">
					<span>Generating...</span>
				</div>
			{/if}

			<div class="dialog-footer">
				<span class="hint">Press Enter to generate</span>
				<button
					class="generate-button"
					on:click={handleSubmit}
					disabled={isSubmitting || !prompt.trim()}
				>
					{isSubmitting ? 'Generating...' : 'Generate'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(2px);
	}

	.command-dialog {
		width: 500px;
		max-width: 90vw;
		background: #2d2d2d;
		color: #e0e0e0;
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.dialog-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 15px;
		border-bottom: 1px solid #444;
		font-size: 14px;
	}

	.close-button {
		background: none;
		border: none;
		color: #999;
		font-size: 20px;
		cursor: pointer;
		padding: 0;
		margin: 0;
		line-height: 1;
	}

	.close-button:hover {
		color: #fff;
	}

	.dialog-input {
		padding: 10px 15px;
	}

	textarea {
		width: 100%;
		background: #3a3a3a;
		color: #fff;
		border: none;
		border-radius: 4px;
		padding: 10px;
		resize: none;
		font-family: inherit;
		font-size: 14px;
	}

	textarea:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(74, 103, 232, 0.5);
	}

	.error-message {
		margin: 0 15px 10px;
		padding: 8px 10px;
		background-color: rgba(255, 80, 80, 0.2);
		border-radius: 4px;
		font-size: 12px;
	}

	.error-message p {
		margin: 0;
		color: #ff9999;
	}

	.generating-indicator {
		margin: 5px 15px;
		font-size: 13px;
		color: #aaa;
	}

	.dialog-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 15px;
		border-top: 1px solid #444;
	}

	.hint {
		font-size: 12px;
		color: #999;
	}

	.generate-button {
		padding: 6px 12px;
		background-color: #4a67e8;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.generate-button:hover:not(:disabled) {
		background-color: #5a77f8;
	}

	.generate-button:disabled {
		background-color: #444;
		color: #777;
		cursor: not-allowed;
	}
</style>
