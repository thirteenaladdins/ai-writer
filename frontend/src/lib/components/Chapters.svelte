<script lang="ts">
	import { onMount } from 'svelte';
	import { documents } from '$lib/stores/documents';

	export let storyId: string;

	interface Chapter {
		id: string;
		title: string;
		content: string;
		order: number;
	}

	let chapters: Chapter[] = [];
	let draggedChapter: Chapter | null = null;
	let editingChapterId: string | null = null;
	let activeChapterId: string | null = null;
	let editorInitialized = false;

	// Load chapters from localStorage
	function loadChapters() {
		const storedChapters = localStorage.getItem(`chapters_${storyId}`);

		if (storedChapters) {
			try {
				chapters = JSON.parse(storedChapters);
				chapters.sort((a, b) => a.order - b.order);
				console.log(`Loaded ${chapters.length} chapters for story ${storyId}`);
			} catch (error) {
				console.error('Error parsing chapters:', error);
				chapters = [];
			}
		}

		// If no chapters exist, create a default one
		if (chapters.length === 0) {
			const defaultChapter = createDefaultChapter();
			chapters = [defaultChapter];
			saveChapters();
		}
	}

	// Create a default chapter
	function createDefaultChapter(): Chapter {
		return {
			id: crypto.randomUUID(),
			title: 'Chapter 1',
			content: '',
			order: 0
		};
	}

	// Save chapters to localStorage
	function saveChapters() {
		localStorage.setItem(`chapters_${storyId}`, JSON.stringify(chapters));
		console.log(`Saved ${chapters.length} chapters for story ${storyId}`);
	}

	// Select first chapter or specified chapter
	function selectInitialChapter() {
		if (chapters.length > 0) {
			// Use first chapter as default
			const chapterToSelect = chapters[0];
			activeChapterId = chapterToSelect.id;
			loadChapterContent(chapterToSelect);
			console.log(`Selected initial chapter: ${chapterToSelect.title}`);
		}
	}

	// Load chapter content into editor
	function loadChapterContent(chapter: Chapter) {
		if (!chapter) return;

		console.log(`Loading content for chapter: ${chapter.title}`);
		const editor = document.querySelector('.editor');
		if (editor) {
			editorInitialized = true;
			editor.innerHTML = chapter.content || '';

			// Notify editor component about the content change
			window.dispatchEvent(
				new CustomEvent('chapter:content-change', {
					detail: {
						content: chapter.content || '',
						chapterId: chapter.id
					}
				})
			);
		} else {
			console.error('Editor element not found');
		}
	}

	// Add new chapter
	function addChapter() {
		// Save current chapter content first
		saveCurrentChapterContent();

		const newChapter: Chapter = {
			id: crypto.randomUUID(),
			title: `Chapter ${chapters.length + 1}`,
			content: '',
			order: chapters.length
		};

		chapters = [...chapters, newChapter];
		saveChapters();

		// Set as active and edit its title
		activeChapterId = newChapter.id;
		editingChapterId = newChapter.id;
		loadChapterContent(newChapter);
	}

	// Save current editor content to active chapter
	function saveCurrentChapterContent() {
		if (!activeChapterId || !editorInitialized) return;

		const editor = document.querySelector('.editor');
		if (!editor) return;

		const currentContent = editor.innerHTML || '';
		const currentChapter = chapters.find((c) => c.id === activeChapterId);

		if (currentChapter) {
			currentChapter.content = currentContent;
			saveChapters();
		}
	}

	// Handle chapter selection
	function selectChapter(chapter: Chapter) {
		if (editingChapterId === chapter.id) return;

		// Save current chapter content first
		saveCurrentChapterContent();

		// Set new active chapter and load its content
		activeChapterId = chapter.id;
		loadChapterContent(chapter);
	}

	// Handle chapter title editing
	function startEditing(chapter: Chapter) {
		editingChapterId = chapter.id;
	}

	function finishEditing(event: KeyboardEvent, chapter: Chapter) {
		if (event.key === 'Enter') {
			editingChapterId = null;
			saveChapters();
		}
	}

	// Drag and drop handlers
	function handleDragStart(chapter: Chapter) {
		draggedChapter = chapter;
	}

	function handleDragOver(event: DragEvent, targetChapter: Chapter) {
		event.preventDefault();
		if (!draggedChapter || draggedChapter.id === targetChapter.id) return;

		const draggedIndex = chapters.findIndex((c) => c.id === draggedChapter?.id);
		const targetIndex = chapters.findIndex((c) => c.id === targetChapter.id);

		if (draggedIndex !== -1 && targetIndex !== -1) {
			// Swap chapters visually
			chapters = chapters.map((chapter, index) => {
				if (index === draggedIndex) return targetChapter;
				if (index === targetIndex) return draggedChapter!;
				return chapter;
			});
		}
	}

	function handleDragEnd() {
		if (draggedChapter) {
			// Update order numbers
			chapters = chapters.map((chapter, index) => ({
				...chapter,
				order: index
			}));
			saveChapters();
			draggedChapter = null;
		}
	}

	onMount(() => {
		// Load chapters data
		loadChapters();

		// Wait for editor to be ready
		const checkEditorReady = setInterval(() => {
			const editor = document.querySelector('.editor');
			if (editor) {
				clearInterval(checkEditorReady);
				editorInitialized = true;
				selectInitialChapter();
			}
		}, 100);

		// Listen for editor content changes
		window.addEventListener('editor:content-change', ((event: CustomEvent) => {
			if (activeChapterId && event.detail.chapterId === activeChapterId) {
				const chapter = chapters.find((c) => c.id === activeChapterId);
				if (chapter) {
					chapter.content = event.detail.content;
					saveChapters();
				}
			}
		}) as EventListener);

		// Save content when navigating away
		window.addEventListener('beforeunload', () => {
			saveCurrentChapterContent();
		});

		return () => {
			clearInterval(checkEditorReady);
			window.removeEventListener('editor:content-change', (() => {}) as EventListener);
			window.removeEventListener('beforeunload', () => {});
			saveCurrentChapterContent();
		};
	});
</script>

<div class="chapters-container">
	<div class="chapters-header">
		<button class="add-chapter-btn" on:click={addChapter}>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Add Chapter
		</button>
	</div>

	<div class="chapters-list">
		{#each chapters as chapter (chapter.id)}
			<div
				class="chapter-item"
				class:active={chapter.id === activeChapterId}
				draggable="true"
				on:dragstart={() => handleDragStart(chapter)}
				on:dragover={(e) => handleDragOver(e, chapter)}
				on:dragend={handleDragEnd}
				on:click={() => selectChapter(chapter)}
			>
				{#if editingChapterId === chapter.id}
					<input
						type="text"
						bind:value={chapter.title}
						on:keydown={(e) => finishEditing(e, chapter)}
						on:blur={() => {
							editingChapterId = null;
							saveChapters();
						}}
						autofocus
					/>
				{:else}
					<span on:dblclick={() => startEditing(chapter)}>
						{chapter.title}
					</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.chapters-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: 1rem;
	}

	.chapters-header {
		display: flex;
		justify-content: flex-start;
		padding: 0.5rem;
	}

	.add-chapter-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--border-color);
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
	}

	.add-chapter-btn:hover {
		background: var(--hover-color);
	}

	.chapters-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
		padding: 0 0.5rem;
	}

	.chapter-item {
		padding: 0.75rem 1rem;
		background: var(--panel-background);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
		user-select: none;
	}

	.chapter-item:hover {
		background: var(--hover-color);
	}

	.chapter-item.active {
		background: var(--active-color, #2c324a);
		border-color: var(--primary-color, #4f6eff);
	}

	.chapter-item input {
		width: 100%;
		background: var(--input-background);
		color: var(--text-color);
		border: none;
		padding: 0.25rem;
		border-radius: 2px;
		font-size: inherit;
	}

	.chapter-item input:focus {
		outline: none;
		background: var(--input-focus-color);
	}
</style>
