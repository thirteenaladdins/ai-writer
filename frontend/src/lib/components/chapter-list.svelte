<script lang="ts">
	import { onMount } from 'svelte';
	import { documents } from '$lib/stores/documents';
	import { browser } from '$app/environment';
	import type { Chapter } from '$lib/stores/documents';
	import ChapterHeader from './chapter-header.svelte';
	import ChapterItem from './chapter-item.svelte';
	import { v4 as uuidv4 } from 'uuid';

	export let storyId: string;

	let chapters: Chapter[] = [];
	let selectedChapterId: string | null = null;
	let isLoading = true;
	let error: string | null = null;
	let unsubscribe: () => void;
	let draggedChapter: Chapter | null = null;

	// Load saved chapter ID
	function loadSavedChapter(): string | null {
		if (!browser) return null;
		return localStorage.getItem(`current_chapter_${storyId}`);
	}

	async function loadChapters() {
		if (!browser) return;

		try {
			// Try to load saved chapter ID first
			const savedChapterId = loadSavedChapter();

			unsubscribe = documents.subscribe((docs) => {
				const doc = docs[storyId];
				if (doc) {
					chapters = doc.chapters || [];

					// If we have a saved chapter and it exists in the document, use it
					if (savedChapterId && chapters.find((c) => c.id === savedChapterId)) {
						if (!selectedChapterId) {
							selectChapter(savedChapterId);
						}
					}
					// Otherwise, if no chapter is selected, select the first chapter
					else if (!selectedChapterId && chapters.length > 0) {
						selectChapter(chapters[0].id);
					}
				}
			});
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
			title: `Chapter ${chapters.length + 1}`,
			content: '',
			order: chapters.length
		};

		const updatedChapters = [...chapters, newChapter];
		await documents.saveDocument(storyId, {
			chapters: updatedChapters,
			updatedAt: new Date()
		});

		// Select the new chapter after a small delay
		setTimeout(() => {
			selectChapter(newChapter.id);
		}, 0);
	}

	async function deleteChapter(id: string) {
		if (chapters.length <= 1) {
			error = 'Cannot delete the last chapter';
			return;
		}

		const confirmed = window.confirm('Are you sure you want to delete this chapter?');
		if (!confirmed) return;

		chapters = chapters.filter((chapter) => chapter.id !== id);
		if (selectedChapterId === id) {
			selectedChapterId = chapters[0]?.id || null;
		}
		await documents.saveDocument(storyId, {
			chapters,
			updatedAt: new Date()
		});
	}

	function selectChapter(id: string) {
		const chapter = chapters.find((c) => c.id === id);
		if (chapter) {
			selectedChapterId = id;
			window.dispatchEvent(
				new CustomEvent('chapter:selected', {
					detail: {
						chapterId: id,
						content: chapter.content || ''
					}
				})
			);
		}
	}

	async function handleTitleChange({
		detail
	}: CustomEvent<{ chapter: Chapter; newTitle: string }>) {
		const { chapter, newTitle } = detail;
		chapter.title = newTitle;
		await documents.saveDocument(storyId, {
			chapters,
			updatedAt: new Date()
		});
	}

	function handleDragStart(event: CustomEvent<Chapter>) {
		draggedChapter = event.detail;
	}

	async function handleDragOver(event: CustomEvent<Chapter>) {
		if (!draggedChapter || draggedChapter.id === event.detail.id) return;

		const draggedOrder = draggedChapter.order;
		const targetOrder = event.detail.order;

		chapters = chapters.map((chapter) => {
			if (chapter.id === draggedChapter?.id) {
				return { ...chapter, order: targetOrder };
			}
			if (draggedOrder < targetOrder) {
				if (chapter.order <= targetOrder && chapter.order > draggedOrder) {
					return { ...chapter, order: chapter.order - 1 };
				}
			} else {
				if (chapter.order >= targetOrder && chapter.order < draggedOrder) {
					return { ...chapter, order: chapter.order + 1 };
				}
			}
			return chapter;
		});

		chapters.sort((a, b) => a.order - b.order);
	}

	async function handleDragEnd() {
		if (draggedChapter) {
			await documents.saveDocument(storyId, {
				chapters,
				updatedAt: new Date()
			});
			draggedChapter = null;
		}
	}

	onMount(() => {
		loadChapters();
		return () => {
			if (unsubscribe) unsubscribe();
		};
	});
</script>

<div class="chapters-container">
	<ChapterHeader on:addChapter={addChapter} />

	{#if isLoading}
		<div class="loading">Loading chapters...</div>
	{:else if error}
		<div class="error" role="alert">{error}</div>
	{:else}
		<ul class="chapters-list">
			{#each chapters as chapter (chapter.id)}
				<ChapterItem
					{chapter}
					isSelected={selectedChapterId === chapter.id}
					isOnlyChapter={chapters.length === 1}
					on:titleChange={handleTitleChange}
					on:select={(event) => selectChapter(event.detail)}
					on:delete={(event) => deleteChapter(event.detail)}
					on:dragStart={handleDragStart}
					on:dragOver={handleDragOver}
					on:dragEnd={handleDragEnd}
				/>
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

	.chapters-list {
		list-style: none;
		margin: 0;
		padding: 0.5rem;
		overflow-y: auto;
		flex: 1;
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
</style>
