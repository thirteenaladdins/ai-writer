<script lang="ts">
	import { HomeIcon } from 'svelte-feather-icons';
	import { goto } from '$app/navigation';

	function navigateToHome() {
		goto('/home');
	}
</script>

<button class="home-button" on:click={navigateToHome} title="Go to Home">
	<HomeIcon size="16" />
</button>

<style>
	.home-button {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-muted, #cccccc);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: all 0.2s ease;
		width: 24px;
		height: 24px;
	}

	.home-button:hover {
		background: var(--hover-color);
		color: var(--text-color);
	}

	.home-button:active {
		background: var(--active-color);
	}
</style>
