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
	contenteditable="true"
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
	role="textbox"
	tabindex="0"
	aria-multiline="true"
	aria-label="Document content"
	data-placeholder="⌘K to generate"
></div>

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
	}

	.editor:focus {
		background: var(--editor-focus-background);
	}

	/* Target elements with the show-placeholder class */
	.editor .show-placeholder:empty::before,
	.editor .show-placeholder:has(br:only-child)::before {
		content: '⌘K to generate';
		color: var(--text-muted, #666);
		opacity: 0.5;
		font-style: italic;
		pointer-events: none;
	}

	.editor :global(.cmd-placeholder) {
		color: var(--text-muted, #999);
		opacity: 0.6;
		font-style: italic;
		user-select: none;
		pointer-events: none;
	}

	.editor.hide-caret {
		caret-color: transparent;
	}
</style>
