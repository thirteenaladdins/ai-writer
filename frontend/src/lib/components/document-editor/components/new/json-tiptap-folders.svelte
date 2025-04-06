<script lang="ts">
	import { onMount } from 'svelte';
	import { documents } from '$lib/stores/documents';
	import { browser } from '$app/environment';
	import type { Document, Folder } from '../../extensions/new/JsonDocumentExtension';
	import { v4 as uuidv4 } from 'uuid';
	import { editorState } from '../../stores/new/editor-state';
	import type { Editor } from '@tiptap/core';
	import { jsonDocumentStore, findDocumentById } from '../../extensions/new/JsonDocumentExtension';
	import { get } from 'svelte/store';

	export let storyId: string;
	export let editor: Editor | null = null;

	// Use Svelte's reactive store subscriptions
	$: folders = $jsonDocumentStore.folders;
	$: selectedDocumentId = $jsonDocumentStore.currentDocumentId;
	$: isUpdating = $jsonDocumentStore.isUpdating;

	let isLoading = true;
	let error: string | null = null;
	let draggedItem: { type: 'folder' | 'document'; id: string } | null = null;
	let expandedFolders: Set<string> = new Set();

	onMount(() => {
		loadFolders();
	});

	async function loadFolders() {
		if (!browser) return;

		try {
			isLoading = true;
			const currentDocs = get(documents);
			const doc = currentDocs[storyId];

			// Handle migration from old chapter structure to new folder/document structure
			if (doc) {
				// If we already have a folders structure, use it
				if (doc.folders) {
					jsonDocumentStore.update((state) => ({
						...state,
						folders: doc.folders || []
					}));

					// If no document is selected, select the first one
					if (!$jsonDocumentStore.currentDocumentId) {
						const savedDocId = localStorage.getItem(`current_document_${storyId}`);

						// Try to find document by saved ID
						let docToSelect: Document | undefined;

						if (savedDocId) {
							for (const folder of doc.folders) {
								docToSelect = folder.documents.find((d) => d.id === savedDocId);
								if (docToSelect) break;
							}
						}

						// If no saved doc found, use first document in first folder
						if (!docToSelect && doc.folders.length > 0 && doc.folders[0].documents.length > 0) {
							docToSelect = doc.folders[0].documents[0];
						}

						if (docToSelect) {
							selectDocument(docToSelect.id);
							// Expand the folder containing this document
							for (const folder of doc.folders) {
								if (folder.documents.some((d) => d.id === docToSelect?.id)) {
									expandedFolders.add(folder.id);
									break;
								}
							}
						}
					}
				}
				// If we have chapters but no folders, convert chapters to documents in a single folder
				else if (doc.chapters && doc.chapters.length > 0) {
					const mainFolder: Folder = {
						id: uuidv4(),
						title: 'Main Story',
						documents: doc.chapters.map((chapter) => ({
							id: chapter.id,
							title: chapter.title,
							content: chapter.content,
							jsonContent: null, // Initialize with no JSON content
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString()
						}))
					};

					const folders = [mainFolder];

					// Update store
					jsonDocumentStore.update((state) => ({
						...state,
						folders
					}));

					// Expand the main folder by default
					expandedFolders.add(mainFolder.id);

					// Save the new structure to backend
					await documents.saveDocument(storyId, {
						folders,
						updatedAt: new Date()
					});

					// Select the previously selected chapter as a document
					const savedChapterId = localStorage.getItem(`current_chapter_${storyId}`);
					if (savedChapterId) {
						selectDocument(savedChapterId);
					} else if (mainFolder.documents.length > 0) {
						selectDocument(mainFolder.documents[0].id);
					}
				}
				// Nothing exists yet, create initial structure
				else {
					await addFolder();
				}
			}
			// No document exists yet, create initial structure
			else {
				await addFolder();
			}
		} catch (err) {
			console.error('Error loading folders:', err);
			error = 'Failed to load documents';
		} finally {
			isLoading = false;
		}
	}

	async function addFolder() {
		const newFolder: Folder = {
			id: uuidv4(),
			title: `Folder ${($jsonDocumentStore.folders.length || 0) + 1}`,
			documents: []
		};

		// Add initial document to the folder
		const newDocument: Document = {
			id: uuidv4(),
			title: 'New Document',
			content: '',
			jsonContent: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: '' }]
					}
				]
			},
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		newFolder.documents.push(newDocument);

		const updatedFolders = [...$jsonDocumentStore.folders, newFolder];

		try {
			// Update store first for instant UI feedback
			jsonDocumentStore.update((state) => ({
				...state,
				folders: updatedFolders
			}));

			// Expand the new folder
			expandedFolders.add(newFolder.id);
			expandedFolders = expandedFolders; // Force reactivity

			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});

			// After saving, select the new document
			selectDocument(newDocument.id);
		} catch (err) {
			console.error('Error adding folder:', err);
			error = 'Failed to add folder';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	async function addDocument(folderId: string) {
		const folder = $jsonDocumentStore.folders.find((f) => f.id === folderId);
		if (!folder) return;

		const newDocument: Document = {
			id: uuidv4(),
			title: `Document ${(folder.documents.length || 0) + 1}`,
			content: '',
			jsonContent: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: '' }]
					}
				]
			},
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		const updatedFolders = $jsonDocumentStore.folders.map((f) =>
			f.id === folderId ? { ...f, documents: [...f.documents, newDocument] } : f
		);

		try {
			// Update store first for instant UI feedback
			jsonDocumentStore.update((state) => ({
				...state,
				folders: updatedFolders
			}));

			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});

			// After saving, select the new document
			selectDocument(newDocument.id);
		} catch (err) {
			console.error('Error adding document:', err);
			error = 'Failed to add document';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	function selectDocument(documentId: string) {
		if (!editor) {
			console.warn('No editor instance available');

			// Still update the store to track selection
			jsonDocumentStore.update((s) => ({
				...s,
				currentDocumentId: documentId
			}));

			// Save the selected document ID in local storage
			localStorage.setItem(`current_document_${storyId}`, documentId);
			return;
		}

		// Save the selected document ID in local storage
		localStorage.setItem(`current_document_${storyId}`, documentId);

		// Log document selection
		console.log('Selecting document:', documentId);

		// Find the document in store to verify it has content
		const state = get(jsonDocumentStore);
		const document = findDocumentById(state, documentId);

		if (document) {
			console.log('Found document to select:', {
				id: document.id,
				title: document.title,
				hasJsonContent: !!document.jsonContent,
				jsonContentType: document.jsonContent ? typeof document.jsonContent : 'none',
				hasContent: !!document.content,
				contentType: document.content ? typeof document.content : 'none'
			});
		} else {
			console.warn('Document not found in store:', documentId);
		}

		// Add additional checks to make sure jsonDocument extension exists
		if (
			!editor.commands ||
			!(editor.commands as any).jsonDocument ||
			!(editor.commands as any).jsonDocument.setDocument
		) {
			console.warn('JsonDocument extension not available on editor');

			// Still update the store to reflect selection in UI
			jsonDocumentStore.update((s) => ({
				...s,
				currentDocumentId: documentId
			}));

			// If we have the document but no extension, try to set it directly
			if (document) {
				try {
					// Set content directly as a fallback
					if (document.jsonContent && typeof document.jsonContent === 'object') {
						editor.commands.setContent(document.jsonContent);
					} else if (document.content && typeof document.content === 'string') {
						editor.commands.setContent(document.content);
					}
				} catch (e) {
					console.error('Error setting content directly:', e);
				}
			}
			return;
		}

		// Use the JsonDocumentExtension command to set the document content
		// Using the any type to work around the TypeScript checking
		(editor.commands as any).jsonDocument.setDocument(documentId);
	}

	function toggleFolder(folderId: string) {
		if (expandedFolders.has(folderId)) {
			expandedFolders.delete(folderId);
		} else {
			expandedFolders.add(folderId);
		}
		expandedFolders = expandedFolders; // Force reactivity
	}

	function handleFolderAction(event: CustomEvent, folderId: string) {
		event.stopPropagation();
		const action = event.detail;

		if (action === 'add') {
			addDocument(folderId);
		} else if (action === 'delete') {
			// deleteFolder(folderId);
		} else if (action === 'rename') {
			// startRenaming({ type: 'folder', id: folderId });
		}
	}

	function handleDocumentAction(event: CustomEvent, documentId: string) {
		event.stopPropagation();
		const action = event.detail;

		if (action === 'delete') {
			// deleteDocument(documentId);
		} else if (action === 'rename') {
			// startRenaming({ type: 'document', id: documentId });
		}
	}
</script>

<div class="folders-panel">
	<div class="header">
		<h3>Documents</h3>
		<button class="add-folder-btn" on:click={() => addFolder()}>
			<span class="icon">+</span>
			<span class="label">New Folder</span>
		</button>
	</div>

	{#if isLoading}
		<div class="loading">Loading folders...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if folders.length === 0}
		<div class="empty-state">No folders</div>
	{:else}
		<ul class="folders-list">
			{#each folders as folder (folder.id)}
				<li class="folder">
					<div
						class="folder-header"
						class:selected={false}
						on:click={() => toggleFolder(folder.id)}
					>
						<span class="icon">{expandedFolders.has(folder.id) ? '📂' : '📁'}</span>
						<span class="name">{folder.title}</span>
						<div class="actions">
							<button
								class="action-btn"
								on:click={(e) => {
									e.stopPropagation();
									addDocument(folder.id);
								}}
								title="Add Document"
							>
								+
							</button>
						</div>
					</div>
					{#if expandedFolders.has(folder.id)}
						<ul class="documents-list">
							{#each folder.documents as document (document.id)}
								<li
									class="document"
									class:selected={selectedDocumentId === document.id}
									on:click={() => selectDocument(document.id)}
								>
									<span class="icon">📄</span>
									<span class="name">{document.title}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.folders-panel {
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.add-folder-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background-color: var(--primary-color);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.loading,
	.error,
	.empty-state {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 2rem 1rem;
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.error {
		color: var(--error-color);
	}

	.folders-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.folder {
		margin: 0;
		padding: 0;
	}

	.folder-header {
		display: flex;
		align-items: center;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border-color);
		cursor: pointer;
	}

	.folder-header:hover {
		background-color: var(--hover-color);
	}

	.folder-header.selected {
		background-color: var(--selected-color);
	}

	.documents-list {
		list-style: none;
		padding: 0;
		margin: 0;
		background-color: var(--nested-background);
	}

	.document {
		display: flex;
		align-items: center;
		padding: 0.5rem 1rem 0.5rem 2rem;
		border-bottom: 1px solid var(--border-color);
		cursor: pointer;
	}

	.document:hover {
		background-color: var(--hover-color);
	}

	.document.selected {
		background-color: var(--selected-color);
	}

	.icon {
		margin-right: 0.5rem;
		font-size: 0.9rem;
	}

	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9rem;
	}

	.actions {
		display: flex;
		gap: 0.25rem;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		background: transparent;
		border: none;
		border-radius: 2px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.9rem;
	}

	.action-btn:hover {
		background-color: rgba(0, 0, 0, 0.1);
		color: var(--text-color);
	}
</style>
