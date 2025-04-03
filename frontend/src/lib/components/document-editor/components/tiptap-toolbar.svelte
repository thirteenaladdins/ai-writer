<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Editor } from '@tiptap/core';

	export let editor: Editor | null;
	export let saveStatus: 'saved' | 'saving' | 'error' | 'offline' | 'hidden';
	export let wordCount: number;
	export let charCount: number;
</script>

<div class="toolbar" role="toolbar" aria-label="Text editor toolbar">
	<div class="formatting-tools">
		<!-- Text styling -->
		<button
			class:active={editor?.isActive('bold')}
			on:click={() => editor?.chain().focus().toggleBold().run()}
			disabled={!editor?.can().chain().focus().toggleBold().run()}
			aria-label="Bold"
		>
			B
		</button>

		<button
			class:active={editor?.isActive('italic')}
			on:click={() => editor?.chain().focus().toggleItalic().run()}
			disabled={!editor?.can().chain().focus().toggleItalic().run()}
			aria-label="Italic"
		>
			I
		</button>

		<!-- Headings -->
		<button
			class:active={editor?.isActive('heading', { level: 1 })}
			on:click={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
			disabled={!editor?.can().chain().focus().toggleHeading({ level: 1 }).run()}
			aria-label="Heading 1"
		>
			H1
		</button>

		<button
			class:active={editor?.isActive('heading', { level: 2 })}
			on:click={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
			disabled={!editor?.can().chain().focus().toggleHeading({ level: 2 }).run()}
			aria-label="Heading 2"
		>
			H2
		</button>

		<!-- Lists -->
		<button
			class:active={editor?.isActive('bulletList')}
			on:click={() => editor?.chain().focus().toggleBulletList().run()}
			disabled={!editor?.can().chain().focus().toggleBulletList().run()}
			aria-label="Bullet List"
		>
			•
		</button>

		<button
			class:active={editor?.isActive('orderedList')}
			on:click={() => editor?.chain().focus().toggleOrderedList().run()}
			disabled={!editor?.can().chain().focus().toggleOrderedList().run()}
			aria-label="Numbered List"
		>
			1.
		</button>
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
		padding: 0.4rem 0;
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

	.formatting-tools button {
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--border-color);
		border-radius: 3px;
		background: var(--input-background);
		color: var(--text-color);
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.formatting-tools button:hover:not(:disabled) {
		background: var(--hover-color);
	}

	.formatting-tools button.active {
		background: var(--active-color);
		border-color: var(--primary-color);
	}

	.formatting-tools button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
