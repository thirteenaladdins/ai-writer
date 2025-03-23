<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { documents } from '$lib/stores/documents';

	let stories: Array<{ id: string; title: string; updatedAt: Date }> = [];
	let debugMessage = '';
	let hasDefaultDocument = false;
	let defaultDocumentTitle = 'Default Document';

	onMount(() => {
		// Debug existing documents in localStorage
		const localStorage_keys = Object.keys(localStorage);
		console.log('All localStorage keys:', localStorage_keys);

		// Check for the default document specifically
		const defaultDoc = localStorage.getItem('document_content');
		const defaultDocTitle = localStorage.getItem('document_title');
		console.log('Default doc content exists:', !!defaultDoc);
		console.log('Default doc title exists:', !!defaultDocTitle);

		if (defaultDoc) {
			hasDefaultDocument = true;
			defaultDocumentTitle = defaultDocTitle || 'Untitled Document';
		}

		// If the default document exists but not in the expected format, migrate it
		if (defaultDoc && !localStorage.getItem('document_default-document')) {
			console.log('Migrating default document to new format');
			localStorage.setItem(
				'document_default-document',
				JSON.stringify({
					title: defaultDocumentTitle,
					content: defaultDoc,
					updatedAt: new Date().toISOString()
				})
			);
			debugMessage = 'Migrated default document';
		}

		documents.loadFromStorage();
		const unsubscribe = documents.subscribe((docs) => {
			console.log('Documents in store:', Object.keys(docs));
			stories = Object.values(docs)
				.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
				.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
		});

		return unsubscribe;
	});

	function createNewStory() {
		const id = crypto.randomUUID();
		goto(`/?id=${id}`);
	}

	function formatDate(date: Date) {
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	}
</script>

<div class="container">
	<header>
		<h1>My Stories</h1>
		<button class="new-story-btn" on:click={createNewStory}>
			<svg
				width="20"
				height="20"
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
			New Story
		</button>
	</header>

	{#if debugMessage}
		<div class="debug-message">{debugMessage}</div>
	{/if}

	{#if hasDefaultDocument && !stories.some((story) => story.id === 'default-document')}
		<div class="default-document-notice">
			<p>You have a document from a previous version.</p>
			<a href="/?id=default-document" class="story-card default-card">
				<h3>{defaultDocumentTitle}</h3>
				<p>Click to open your existing document</p>
			</a>
		</div>
	{/if}

	<div class="stories-grid">
		{#each stories as story}
			<a href="/?id={story.id}" class="story-card">
				<h3>{story.title}</h3>
				<p class="date">Last updated: {formatDate(story.updatedAt)}</p>
			</a>
		{:else}
			<div class="empty-state">
				<p>You haven't created any stories yet.</p>
				<button class="new-story-btn" on:click={createNewStory}>Create your first story</button>
			</div>
		{/each}
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		color: var(--text-color);
		margin: 0;
	}

	.new-story-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--primary-color);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.new-story-btn:hover {
		background: var(--primary-color-dark);
	}

	.stories-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.story-card {
		background: var(--card-background);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 1.5rem;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease;
	}

	.story-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		border-color: var(--primary-color);
	}

	.story-card h3 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--text-color);
		margin-bottom: 0.5rem;
	}

	.date {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.empty-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 4rem 2rem;
		background: var(--card-background);
		border: 2px dashed var(--border-color);
		border-radius: 8px;
	}

	.empty-state p {
		margin: 0 0 1.5rem 0;
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.debug-message {
		background: var(--info-background);
		color: var(--info-text);
		padding: 0.5rem 1rem;
		margin-bottom: 1rem;
		border-radius: 4px;
	}

	.default-document-notice {
		margin-bottom: 2rem;
		padding: 1rem;
		background: var(--accent-background);
		border-radius: 8px;
	}

	.default-document-notice p {
		margin: 0 0 1rem 0;
	}

	.default-card {
		border: 2px solid var(--primary-color);
		background: var(--card-background);
		display: block;
	}
</style>
