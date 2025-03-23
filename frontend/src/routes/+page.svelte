<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Editor from '$lib/components/Editor.svelte';
	import { documents } from '$lib/stores/documents';

	let leftPanelVisible = true;
	let rightPanelVisible = true;
	let storyId: string | null = null;
	let isLoading = true;

	onMount(() => {
		// Check if we have the legacy document format
		const legacyContent = localStorage.getItem('document_content');

		if (legacyContent) {
			console.log('Legacy document format detected');
			// If we're at root with no ID, use default-document
			if (!storyId) {
				console.log('Setting default-document as current story');
				storyId = 'default-document';
				// Update URL without causing navigation
				const url = new URL(window.location.href);
				url.searchParams.set('id', storyId);
				window.history.replaceState({}, '', url.toString());
			}
		}

		documents.loadFromStorage();
		isLoading = false;
	});

	$: {
		// Get story ID from URL
		const urlParams = new URLSearchParams($page.url.search);
		const idFromUrl = urlParams.get('id');

		if (idFromUrl) {
			storyId = idFromUrl;
		} else if (!isLoading) {
			// Only redirect if we're not in loading state
			goto('/home');
		}
	}

	function toggleLeftPanel() {
		leftPanelVisible = !leftPanelVisible;
	}

	function toggleRightPanel() {
		rightPanelVisible = !rightPanelVisible;
	}
</script>

<div class="layout-container">
	<aside class="panel left-panel" class:collapsed={!leftPanelVisible}>
		<h2>Plot Lines</h2>
		<button class="toggle-button" on:click={toggleLeftPanel}>
			<span class:rotated={!leftPanelVisible}>
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
					<polyline points="11 17 6 12 11 7" />
					<polyline points="18 17 13 12 18 7" />
				</svg>
			</span>
		</button>
		<div class="panel-content" class:hidden={!leftPanelVisible}>
			<!-- Plot lines content will go here -->
		</div>
	</aside>

	<main class="panel main-panel">
		{#if storyId}
			<Editor {storyId} />
		{:else}
			<div class="loading">Loading...</div>
		{/if}
	</main>

	<aside class="panel right-panel" class:collapsed={!rightPanelVisible}>
		<h2>AI Assistant</h2>
		<button class="toggle-button" on:click={toggleRightPanel}>
			<span class:rotated={!rightPanelVisible}>
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
					<polyline points="13 17 18 12 13 7" />
					<polyline points="6 17 11 12 6 7" />
				</svg>
			</span>
		</button>
		<div class="panel-content" class:hidden={!rightPanelVisible}>
			<!-- AI chat interface will go here -->
		</div>
	</aside>
</div>

<style>
	.layout-container {
		display: flex;
		width: 100%;
		height: 100%;
		position: relative;
	}

	.panel {
		position: relative;
		transition: all 0.3s ease;
		display: flex;
		flex-direction: column;
	}

	.panel h2 {
		margin: 0;
		padding: 1rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: #cccccc;
		border-bottom: 1px solid var(--border-color);
		position: relative;
	}

	.left-panel {
		width: 250px;
		border-right: 1px solid var(--border-color);
		margin-right: -14px;
	}

	.right-panel {
		width: 300px;
		border-left: 1px solid var(--border-color);
		margin-left: -14px;
	}

	.main-panel {
		flex: 1;
		min-width: 0;
		z-index: 1;
		padding: 0;
		overflow: hidden;
	}

	.panel.collapsed {
		width: 32px;
	}

	.panel.collapsed h2 {
		display: none;
	}

	.toggle-button {
		position: absolute;
		top: calc(1rem + 0.9rem + 4px); /* Align with the bottom of h2 */
		width: 28px;
		height: 28px;
		background: var(--panel-background);
		border: 1px solid var(--border-color);
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		color: var(--text-color);
		opacity: 0.8;
		transition: all 0.2s ease;
		z-index: 20;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transform: translateY(-50%);
	}

	.toggle-button span {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
	}

	.toggle-button svg {
		width: 16px;
		height: 16px;
		display: block;
	}

	.left-panel .toggle-button {
		right: 0;
	}

	.right-panel .toggle-button {
		left: 0;
	}

	.toggle-button:hover {
		opacity: 1;
		background: var(--hover-color);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
		transform: translateY(-50%) scale(1.05);
	}

	.rotated {
		transform: rotate(180deg);
		display: flex;
	}

	.panel-content {
		opacity: 1;
		transition: opacity 0.2s ease;
		height: 100%;
		overflow-y: auto;
		padding: 1rem;
	}

	.panel-content.hidden {
		opacity: 0;
		pointer-events: none;
		padding: 0;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
		font-size: 1.2rem;
	}
</style>
