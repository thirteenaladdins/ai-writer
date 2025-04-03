<script lang="ts">
	import TiptapEditor from '$lib/components/document-editor/components/tiptap-editor.svelte';

	let storyId = 'test-story';
	let content = '<p>Hello, this is a test paragraph!</p>';
</script>

<div class="editor-container">
	<TiptapEditor {storyId} {content} />
</div>

<style>
	.editor-container {
		height: 100vh;
		width: 100%;
		background: var(--editor-background);
	}
</style>
