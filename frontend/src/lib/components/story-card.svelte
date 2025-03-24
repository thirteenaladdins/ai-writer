<script lang="ts">
	import { TrashIcon } from 'svelte-feather-icons';

	export let id: string;
	export let doc: {
		title: string;
		chapters?: Array<any>;
		updatedAt: string | Date;
	};
	export let onOpen: (id: string) => void;
	export let onDelete: (id: string) => void;

	function handleCardClick(event: MouseEvent) {
		// Ensure we're not clicking the delete button
		if (!(event.target as HTMLElement).closest('.delete-btn')) {
			onOpen(id);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Open on Enter or Space
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onOpen(id);
		}
	}
</script>

<div
	class="document-card"
	on:click={handleCardClick}
	on:keydown={handleKeyDown}
	tabindex="0"
	role="button"
	aria-label="Open {doc.title}"
>
	<div class="document-info">
		<h2>{doc.title}</h2>
		<p class="chapters-count">
			{doc.chapters?.length || 1} chapter{doc.chapters?.length !== 1 ? 's' : ''}
		</p>
		<p class="last-modified">
			Last modified: {new Date(doc.updatedAt).toLocaleDateString()} at {new Date(
				doc.updatedAt
			).toLocaleTimeString()}
		</p>
	</div>
	<button class="delete-btn" on:click={() => onDelete(id)} aria-label="Delete document">
		<TrashIcon size="16" />
	</button>
</div>

<style>
	.document-card {
		background: var(--panel-background);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 1.5rem;
		transition: all 0.2s ease;
		cursor: pointer;
		position: relative;
	}

	.document-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.document-info h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		color: var(--text-color);
	}

	.chapters-count {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}

	.last-modified {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin: 0 0 0;
	}

	.delete-btn {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		background: transparent;
		border: none;
		color: var(--text-muted);
		padding: 0.25rem;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.delete-btn:hover {
		color: var(--error-color);
		background: rgba(255, 0, 0, 0.1);
	}
</style>
