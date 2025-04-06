<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { documents } from '$lib/stores/documents';
	import { browser } from '$app/environment';
	import { v4 as uuidv4 } from 'uuid';
	import StoryCard from '$lib/components/story-card.svelte';
	import HomeHeader from '$lib/components/home-header.svelte';
	import NewDocumentButton from '$lib/components/new-document-button.svelte';

	let isLoading = true;
	let error: string | null = null;
	let docs: Record<string, any> = {};
	let unsubscribe: () => void;

	function createNewDocument() {
		const id = uuidv4();
		documents.saveDocument(id, {
			title: 'Untitled Document',
			chapters: [
				{
					id: 'chapter-1',
					title: 'Chapter 1',
					content: '',
					order: 0
				}
			],
			updatedAt: new Date()
		});
		goto(`/?id=${id}`);
	}

	function openDocument(id: string) {
		goto(`/?id=${id}`);
	}

	function goToFoldersTest() {
		goto('/folders-test');
	}

	async function deleteDocument(id: string) {
		const confirmed = window.confirm('Are you sure you want to delete this document?');
		if (!confirmed) return;

		try {
			await documents.deleteDocument(id);
		} catch (err) {
			console.error('Error deleting document:', err);
			error = 'Failed to delete document';
		}
	}

	onMount(() => {
		if (!browser) return;

		const loadDocuments = async () => {
			try {
				await documents.loadFromStorage();
				unsubscribe = documents.subscribe((value) => {
					// Create a new object reference to trigger reactivity
					docs = { ...value };
				});
			} catch (err) {
				console.error('Error loading documents:', err);
				error = 'Failed to load documents';
			} finally {
				isLoading = false;
			}
		};

		loadDocuments();

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	});
</script>

<div class="home-container">
	<HomeHeader on:createDocument={createNewDocument} />

	<div class="test-routes">
		<a href="/tiptap-test" class="test-link">TipTap Test</a>
		<a href="/folders-test" class="test-link">Folders Structure Test</a>
	</div>

	{#if isLoading}
		<div class="loading">Loading documents...</div>
	{:else if error}
		<div class="error" role="alert">{error}</div>
	{:else if Object.keys(docs).length === 0}
		<div class="empty-state">
			<p>No documents yet. Create your first document to get started!</p>
			<NewDocumentButton on:click={createNewDocument} label="Create Document" />
		</div>
	{:else}
		<div class="documents-grid">
			{#each Object.entries(docs).sort(([, a], [, b]) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) as [id, doc] (id)}
				<StoryCard {id} {doc} onOpen={openDocument} onDelete={deleteDocument} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.home-container {
		max-width: 1200px;
		margin: 0 auto;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.test-routes {
		display: flex;
		gap: 1rem;
		padding: 1rem 2rem;
		background: var(--panel-background);
		border-bottom: 1px solid var(--border-color);
	}

	.test-link {
		padding: 0.4rem 0.8rem;
		background: var(--primary-color);
		color: white;
		text-decoration: none;
		border-radius: 4px;
		font-size: 0.9rem;
		transition: background 0.2s;
	}

	.test-link:hover {
		background: var(--primary-color-dark);
	}

	.documents-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
		padding: 2rem;
		overflow-y: auto;
		flex: 1;
	}

	.loading,
	.error,
	.empty-state {
		text-align: center;
		padding: 2rem;
		color: var(--text-muted);
	}

	.error {
		color: var(--error-color);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.empty-state p {
		font-size: 1.1rem;
		margin: 0;
	}

	@media (max-width: 768px) {
		.home-container {
			padding: 1rem;
		}

		.documents-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
