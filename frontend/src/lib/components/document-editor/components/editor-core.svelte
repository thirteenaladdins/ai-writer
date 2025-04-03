<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { editorState } from '../stores/editor-state';
	import { createEditorEventHandlers } from '../utils/event-handlers';
	import { applySettings } from '../utils/settings-manager';
	import type { CursorPosition } from '../utils/cursor';
	import { insertTextAtCursor } from '../utils/text-manipulation';

	export let storyId: string;
	export let selectedFont: string;
	export let selectedSize: string;
	export let aiText: string | null = null;

	let editor: HTMLDivElement;
	let eventHandlers = createEditorEventHandlers(storyId);

	const dispatch = createEventDispatcher<{
		showPrompt: CursorPosition;
	}>();

	function showInlinePrompt(position: CursorPosition) {
		dispatch('showPrompt', position);
	}

	// Watch for font/size changes
	$: if (editor && selectedFont) {
		applySettings(editor, selectedFont, selectedSize);
	}

	// Watch for AI text changes
	$: if (aiText && editor) {
		console.log('AI text received via prop:', aiText);
		insertTextAtCursor(editor, aiText);
		aiText = null; // Reset after insertion
	}

	onMount(() => {
		if (editor) {
			// Initialize the editor with the block structure
			eventHandlers.initializeEditor(editor);
			applySettings(editor, selectedFont, selectedSize);
		}

		return () => {
			// Save any unsaved changes before unmounting
			const state = editorState.subscribe((state) => {
				if (state.hasUnsavedChanges && state.currentChapterId) {
					eventHandlers.handleBlur(editor, storyId, state.currentChapterId);
				}
			});
			state(); // Unsubscribe
		};
	});
</script>

<div
	class="editor"
	bind:this={editor}
	on:input={() => eventHandlers.handleInput(editor)}
	on:blur={() => {
		const state = editorState.subscribe((state) => {
			eventHandlers.handleBlur(editor, storyId, state.currentChapterId);
		});
		state(); // Unsubscribe
	}}
	on:keydown={(e) => eventHandlers.handleKeydown(e, editor, showInlinePrompt)}
	on:click={(e) => eventHandlers.handleClick(e, editor)}
	on:mouseup={(e) => eventHandlers.handleClick(e, editor)}
	on:selectionchange={() => eventHandlers.handleSelectionChange(editor)}
	role="textbox"
	tabindex="0"
	aria-multiline="true"
	aria-label="Document content"
	data-placeholder="⌘K to generate"
>
	<!-- Initial block will be created by initializeEditor -->
</div>

<style>
	.editor {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
		outline: none;
		line-height: 1.6;
		color: var(--text-color);
		background: var(--editor-background);
		width: 100%;
		white-space: pre-wrap;
		word-wrap: break-word;
		position: relative;
		min-height: 100%;
	}

	.editor:focus {
		background: var(--editor-focus-background);
	}

	:global(.editor .block) {
		position: relative;
		min-height: 24px;
		padding: 3px 0;
		cursor: text;
		margin: 0;
		border-radius: 3px;
		transition: all 0.1s ease;
		display: block;
	}

	:global(.editor .block:empty::before) {
		content: '';
		display: inline-block;
		min-height: 1.2em;
	}

	:global(.editor .block.active) {
		background-color: var(--active-line-background, rgba(100, 100, 100, 0.1));
	}

	:global(.editor .block.selected) {
		background-color: var(--selected-line-background, rgba(100, 100, 100, 0.2));
	}

	:global(.editor .block::before) {
		content: '';
		position: absolute;
		left: -20px;
		top: 0;
		bottom: 0;
		width: 3px;
		background-color: transparent;
		transition: background-color 0.1s ease;
		pointer-events: none;
	}

	:global(.editor .block.active::before) {
		background-color: var(--active-line-indicator, #007acc);
	}

	/* Target empty blocks */
	:global(.editor .block:empty::after) {
		content: '⌘K to generate';
		color: var(--text-muted, #666);
		opacity: 0.5;
		font-style: italic;
		pointer-events: none;
		position: absolute;
		left: 0;
		top: 3px;
	}

	/* Hide placeholder when block is active or has content */
	:global(.editor .block.active:empty::after),
	:global(.editor .block:not(:empty)::after) {
		content: none;
	}

	.editor.hide-caret {
		caret-color: transparent;
	}
</style>
