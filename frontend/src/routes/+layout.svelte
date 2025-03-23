<script lang="ts">
	import '../app.css';
	import { documentTitle } from '$lib/stores/document';
	import { onMount } from 'svelte';
	import HomeButton from '$lib/components/HomeButton.svelte';
	import { page } from '$app/stores';
	import { documents } from '$lib/stores/documents';

	// import { browser } from '$app/environment';
	let isLoading = true;

	onMount(() => {
		// Load documents store
		documents.loadFromStorage();
		// Set loading to false after the component mounts
		isLoading = false;
	});

	$: isHomePage = $page.route.id === '/home';

	function handleTitleChange(event: Event) {
		const input = event.target as HTMLInputElement;
		documentTitle.set(input.value);
		// Dispatch a custom event that the Editor component can listen for
		window.dispatchEvent(new CustomEvent('document:title-change'));
	}

	function handleKeyDown(event: KeyboardEvent) {
		const input = event.target as HTMLInputElement;

		// Handle Enter key
		if (event.key === 'Enter') {
			input.blur();
			return;
		}
	}

	// Handle blur event to set a default if empty
	function handleBlur(event: FocusEvent) {
		const input = event.target as HTMLInputElement;
		// Only set to Untitled Document when blurring with empty value
		if (!input.value) {
			documentTitle.set('Untitled Document');
		}
	}

	// Handle click to select all text
	function handleClick(event: MouseEvent) {
		const input = event.target as HTMLInputElement;
		if (input.value === 'Untitled Document') {
			input.select();
		}
	}
</script>

{#if !isLoading}
	<div class="app-container">
		<header class="banner">
			<div class="banner-content">
				<HomeButton />
				{#if !isHomePage}
					<input
						type="text"
						bind:value={$documentTitle}
						on:input={handleTitleChange}
						on:keydown={handleKeyDown}
						on:blur={handleBlur}
						on:click={handleClick}
						placeholder="Untitled Document"
						class="document-title"
					/>
				{/if}

				<h1 class="banner-title">ai-writer</h1>
			</div>
		</header>
		<div class="panels-container">
			<slot />
		</div>
	</div>
{/if}

<style>
	.banner {
		background-color: var(--banner-background);
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--border-color);
		padding: 0 1rem;
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
		color: #cccccc;
		background: transparent;
		border: none;
		outline: none;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		width: 200px;
		transition: background-color 0.2s ease;
	}

	.document-title:focus {
		background: var(--input-focus-color);
		color: var(--text-color);
	}

	.banner-title {
		font-family:
			'SF Pro Display',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		font-weight: 400;
		font-size: 0.9rem;
		letter-spacing: 0.3px;
		text-transform: lowercase;
		color: #cccccc;
		margin: 0;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
	}

	.panels-container {
		flex: 1;
		overflow: hidden;
	}
</style>
