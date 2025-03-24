<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import HomeButton from '$lib/components/home-button.svelte';
	import { page } from '$app/stores';
	import { documents } from '$lib/stores/documents';
	import { debounce } from 'lodash-es';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';

	// Constants
	const DEFAULT_TITLE = 'Untitled Document';
	const SAVE_DEBOUNCE_MS = 300;

	// State
	let isLoading = true;
	let error: string | null = null;

	// Sanitize input to prevent XSS
	function sanitizeInput(value: string): string {
		return value.replace(/[<>]/g, '');
	}

	// Debounced title change handler
	const debouncedTitleChange = debounce(async (value: string) => {
		if (browser) {
			const urlParams = new URLSearchParams(window.location.search);
			const storyId = urlParams.get('id');
			if (storyId) {
				try {
					const docs = get(documents);
					const currentDoc = docs[storyId];
					if (currentDoc) {
						await documents.saveDocument(storyId, {
							...currentDoc,
							title: value,
							updatedAt: new Date()
						});
					}
				} catch (err) {
					console.error('Error saving document title:', err);
				}
			}
		}
	}, SAVE_DEBOUNCE_MS);

	function handleTitleChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const sanitizedValue = sanitizeInput(input.value);
		if (input.value !== sanitizedValue) {
			input.value = sanitizedValue;
		}
		debouncedTitleChange(sanitizedValue);
	}

	function handleKeyDown(event: KeyboardEvent) {
		const input = event.target as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			input.blur();
		}
	}

	async function handleBlur(event: FocusEvent) {
		const input = event.target as HTMLInputElement;
		const value = input.value.trim();
		if (!value) {
			const urlParams = new URLSearchParams(window.location.search);
			const storyId = urlParams.get('id');
			if (storyId) {
				try {
					const docs = get(documents);
					const currentDoc = docs[storyId];
					if (currentDoc) {
						await documents.saveDocument(storyId, {
							...currentDoc,
							title: DEFAULT_TITLE,
							updatedAt: new Date()
						});
						input.value = DEFAULT_TITLE;
					}
				} catch (err) {
					console.error('Error saving default document title:', err);
				}
			}
		}
	}

	function handleClick(event: MouseEvent) {
		const input = event.target as HTMLInputElement;
		if (input.value === DEFAULT_TITLE) {
			input.select();
		}
	}

	onMount(() => {
		if (!browser) return;

		const loadDocuments = async () => {
			try {
				await documents.loadFromStorage();
			} catch (err) {
				console.error('Failed to load documents:', err);
				error = 'Failed to load documents. Please try refreshing the page.';
			} finally {
				isLoading = false;
			}
		};

		loadDocuments();

		return () => {
			debouncedTitleChange.cancel();
		};
	});

	$: isHomePage = $page.route.id === '/home';
</script>

{#if isLoading}
	<div class="loading-container" role="status">
		<div class="loading-spinner"></div>
		<span class="sr-only">Loading...</span>
	</div>
{:else if error}
	<div class="error-container" role="alert">
		<p>{error}</p>
		<button on:click={() => window.location.reload()} class="error-retry-btn"> Retry </button>
	</div>
{:else}
	<div class="app-container">
		<header class="banner">
			<div class="banner-content">
				<HomeButton />
				{#if !isHomePage}
					<input
						type="text"
						value={(() => {
							const storyId = new URLSearchParams(window.location.search).get('id');
							if (storyId) {
								const docs = get(documents);
								const doc = docs[storyId];
								return doc?.title || DEFAULT_TITLE;
							}
							return DEFAULT_TITLE;
						})()}
						on:input={handleTitleChange}
						on:keydown={handleKeyDown}
						on:blur={handleBlur}
						on:click={handleClick}
						placeholder={DEFAULT_TITLE}
						class="document-title"
						aria-label="Document title"
					/>
				{/if}

				<h1 class="banner-title">ai-writer</h1>
			</div>
		</header>
		<main class="panels-container">
			<slot />
		</main>
	</div>
{/if}

<style>
	.app-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.banner {
		background-color: var(--banner-background);
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--border-color);
		padding: 0 1rem;
		position: relative;
		z-index: 10;
	}

	.banner-content {
		display: flex;
		align-items: center;
		width: 100%;
		position: relative;
		gap: 0.5rem;
	}

	.document-title {
		font-size: 0.9rem;
		color: var(--text-color);
		background: transparent;
		border: none;
		outline: none;
		width: min(180px, 25vw);
		transition: all 0.2s ease;
		opacity: 0.8;
		border-bottom: 1px solid transparent;
	}

	.document-title:hover {
		opacity: 0.9;
	}

	.document-title:focus {
		background: var(--input-focus-color);
		color: var(--text-color);
		opacity: 1;
		box-shadow: 0 0 0 2px var(--primary-color-light);
	}

	.banner-title {
		font-family: var(--font-system);
		font-weight: 400;
		font-size: 0.9rem;
		letter-spacing: 0.3px;
		text-transform: lowercase;
		color: var(--text-muted);
		margin: 0;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		user-select: none;
	}

	.panels-container {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 1rem;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--primary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 1rem;
		padding: 1rem;
		text-align: center;
	}

	.error-retry-btn {
		padding: 0.5rem 1rem;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.error-retry-btn:hover {
		background: var(--primary-color-dark);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 480px) {
		.document-title {
			width: 150px;
		}
	}
</style>
