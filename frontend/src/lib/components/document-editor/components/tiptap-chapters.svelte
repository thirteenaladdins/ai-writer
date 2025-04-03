<script lang="ts">
	import { onMount } from 'svelte';
	import { documents } from '$lib/stores/documents';
	import { browser } from '$app/environment';
	import type { Chapter } from '../extensions/ChapterExtension';
	import { v4 as uuidv4 } from 'uuid';
	import { editorState } from '../stores/editor-state';
	import type { Editor } from '@tiptap/core';
	import { chapterStore } from '../extensions/ChapterExtension';
	import { get } from 'svelte/store';

	export let storyId: string;
	export let editor: Editor | null = null;

	// Use Svelte's reactive store subscriptions
	// This ensures the component properly re-renders when the store changes
	$: chapters = $chapterStore.chapters;
	$: selectedChapterId = $chapterStore.currentChapterId;
	$: isUpdating = $chapterStore.isUpdating;

	let isLoading = true;
	let error: string | null = null;
	let draggedChapter: Chapter | null = null;

	async function loadChapters() {
		if (!browser) return;

		try {
			isLoading = true;
			const currentDocs = get(documents);
			const doc = currentDocs[storyId];
			if (doc) {
				// Initialize with chapters from document
				chapterStore.update((state) => ({
					...state,
					chapters: doc.chapters || []
				}));

				// If no chapter is selected, select the first one
				if (!$chapterStore.currentChapterId && doc.chapters && doc.chapters.length > 0) {
					const savedChapterId = localStorage.getItem(`current_chapter_${storyId}`);
					const chapterId =
						doc.chapters.find((c) => c.id === savedChapterId)?.id || doc.chapters[0]?.id;
					if (chapterId) {
						selectChapter(chapterId);
					}
				}
			} else {
				// Create initial chapter if none exists
				await addChapter();
			}
		} catch (err) {
			console.error('Error loading chapters:', err);
			error = 'Failed to load chapters';
		} finally {
			isLoading = false;
		}
	}

	async function addChapter() {
		const newChapter: Chapter = {
			id: uuidv4(),
			title: `Chapter ${($chapterStore.chapters.length || 0) + 1}`,
			content: '',
			order: $chapterStore.chapters.length || 0
		};

		let updatedChapters = [...$chapterStore.chapters, newChapter];
		updatedChapters = updatedChapters.map((c, i) => ({ ...c, order: i }));

		try {
			// Update store first for instant UI feedback
			chapterStore.update((state) => ({
				...state,
				chapters: updatedChapters
			}));

			// Then save to backend
			await documents.saveDocument(storyId, {
				chapters: updatedChapters,
				updatedAt: new Date()
			});

			// After saving, select the new chapter
			selectChapter(newChapter.id);
		} catch (err) {
			console.error('Error adding chapter:', err);
			error = 'Failed to add chapter';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	async function deleteChapter(id: string) {
		if ($chapterStore.chapters.length <= 1) {
			error = 'Cannot delete the last chapter';
			setTimeout(() => (error = null), 3000);
			return;
		}

		const confirmed = window.confirm('Are you sure you want to delete this chapter?');
		if (!confirmed) return;

		const currentSelectedId = $chapterStore.currentChapterId;
		let updatedChapters = $chapterStore.chapters.filter((chapter) => chapter.id !== id);
		updatedChapters = updatedChapters.map((c, i) => ({ ...c, order: i }));

		try {
			// Update UI first
			let nextChapterId: string | null = null;
			if (currentSelectedId === id) {
				nextChapterId = updatedChapters[0]?.id || null;
			} else {
				nextChapterId = currentSelectedId;
			}

			chapterStore.update((state) => ({
				...state,
				chapters: updatedChapters,
				currentChapterId: nextChapterId
			}));

			// Then save to backend
			await documents.saveDocument(storyId, {
				chapters: updatedChapters,
				updatedAt: new Date()
			});

			// If current chapter was deleted, select a new one
			if (nextChapterId && currentSelectedId === id) {
				selectChapter(nextChapterId);
			}
		} catch (err) {
			console.error('Error deleting chapter:', err);
			error = 'Failed to delete chapter';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	function selectChapter(id: string) {
		if (!editor) {
			console.warn('Cannot select chapter: editor not initialized');
			return;
		}

		if ($chapterStore.isUpdating) {
			console.warn('TiptapChapters: Store is updating, skipping chapter selection.');
			return;
		}

		console.log(`Selecting chapter: ${id}`);

		// Save to localStorage for persistence
		localStorage.setItem(`current_chapter_${storyId}`, id);

		// Update editor state
		editorState.setCurrentChapter(id);

		// Update chapter store
		chapterStore.update((state) => ({
			...state,
			currentChapterId: id
		}));

		// Call editor command to load content
		editor.commands.setChapter(id);
	}

	async function handleTitleChange(chapterId: string, newTitle: string) {
		const updatedChapters = $chapterStore.chapters.map((c) =>
			c.id === chapterId ? { ...c, title: newTitle } : c
		);

		// Optimistic UI update
		chapterStore.update((state) => ({ ...state, chapters: updatedChapters }));

		try {
			// Then save to backend
			await documents.saveDocument(storyId, {
				chapters: updatedChapters,
				updatedAt: new Date()
			});
		} catch (err) {
			console.error('Error saving title:', err);
			error = 'Failed to save chapter title';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	function handleDragStart(event: DragEvent, chapter: Chapter) {
		if (event.dataTransfer) {
			event.dataTransfer.setData('text/plain', chapter.id);
			event.dataTransfer.effectAllowed = 'move';
		}
		draggedChapter = chapter;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	async function handleDrop(event: DragEvent, targetChapter: Chapter) {
		event.preventDefault();
		if (!draggedChapter || draggedChapter.id === targetChapter.id) return;

		const draggedId = draggedChapter.id;
		const targetId = targetChapter.id;

		let updatedChapters = [...$chapterStore.chapters];
		const draggedIndex = updatedChapters.findIndex((c) => c.id === draggedId);
		const targetIndex = updatedChapters.findIndex((c) => c.id === targetId);

		if (draggedIndex === -1 || targetIndex === -1) return;

		const [draggedItem] = updatedChapters.splice(draggedIndex, 1);
		updatedChapters.splice(targetIndex, 0, draggedItem);
		updatedChapters = updatedChapters.map((c, i) => ({ ...c, order: i }));

		// Update UI first
		chapterStore.update((state) => ({ ...state, chapters: updatedChapters }));
		draggedChapter = null;

		try {
			// Then save to backend
			await documents.saveDocument(storyId, {
				chapters: updatedChapters,
				updatedAt: new Date()
			});
		} catch (err) {
			console.error('Error saving chapter order:', err);
			error = 'Failed to save chapter order';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	function handleDragEnd() {
		draggedChapter = null;
	}

	// In onMount, ensure we load chapters
	onMount(() => {
		console.log('TiptapChapters mounted, loading chapters');
		loadChapters();
	});
</script>

<div class="chapters-container">
	<div class="chapters-header">
		<h2>Chapters</h2>
		<button class="add-chapter-btn" on:click={addChapter} aria-label="Add chapter">+</button>
	</div>

	{#if isLoading}
		<div class="loading">Loading chapters...</div>
	{:else if error}
		<div class="error" role="alert">{error}</div>
	{:else if chapters.length === 0}
		<div class="empty-state">
			<p>No chapters yet</p>
			<button on:click={addChapter}>Create your first chapter</button>
		</div>
	{:else}
		<ul class="chapters-list">
			{#each chapters as chapter (chapter.id)}
				<li
					class="chapter-item"
					class:selected={selectedChapterId === chapter.id}
					draggable="true"
					on:dragstart={(e) => handleDragStart(e, chapter)}
					on:dragover={handleDragOver}
					on:drop={(e) => handleDrop(e, chapter)}
					on:dragend={handleDragEnd}
					data-chapter-id={chapter.id}
				>
					<input
						type="text"
						value={chapter.title}
						on:input={(e) => handleTitleChange(chapter.id, (e.target as HTMLInputElement).value)}
						on:click={() => selectChapter(chapter.id)}
						class="chapter-title-input"
						aria-label={`Chapter title: ${chapter.title}`}
					/>
					{#if chapters.length > 1}
						<button
							class="delete-chapter-btn"
							on:click|stopPropagation={() => deleteChapter(chapter.id)}
							aria-label={`Delete chapter ${chapter.title}`}
						>
							×
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.chapters-container {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--panel-background);
	}

	.chapters-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.chapters-header h2 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.add-chapter-btn {
		background: transparent;
		border: 1px solid var(--border-color);
		color: var(--text-color);
		width: 24px;
		height: 24px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0;
		transition: all 0.2s ease;
	}

	.add-chapter-btn:hover {
		background: var(--hover-color);
		border-color: var(--primary-color);
	}

	.chapters-list {
		list-style: none;
		margin: 0;
		padding: 0.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.chapter-item {
		display: flex;
		align-items: center;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		border-radius: 4px;
		background: var(--item-background);
		border: 1px solid transparent;
		transition: all 0.2s ease;
		cursor: grab;
	}

	.chapter-item:hover {
		background: var(--hover-color);
	}

	.chapter-item.selected {
		background: var(--selected-color);
		border-color: var(--primary-color);
	}

	.chapter-title-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-color);
		font-size: 0.9rem;
		padding: 0.2rem;
		outline: none;
		width: 100%;
	}

	.chapter-title-input:focus {
		background: var(--input-focus-color);
	}

	.delete-chapter-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.2rem;
		margin-left: 0.5rem;
		font-size: 1.2rem;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.chapter-item:hover .delete-chapter-btn {
		opacity: 0.8;
	}

	.delete-chapter-btn:hover {
		color: var(--error-color);
		opacity: 1;
	}

	.loading,
	.error {
		padding: 1rem;
		text-align: center;
		color: var(--text-muted);
	}

	.error {
		color: var(--error-color);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		color: var(--text-muted);
	}

	.empty-state button {
		margin-top: 1rem;
		background: var(--primary-color);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
	}
</style>
