<script lang="ts">
	import { onMount } from 'svelte';
	import { documents } from '$lib/stores/documents';
	import { browser } from '$app/environment';
	import type { Document, Folder } from '../../extensions/new/DocumentExtension';
	import { v4 as uuidv4 } from 'uuid';
	import { editorState } from '../../stores/new/editor-state';
	import type { Editor } from '@tiptap/core';
	import { documentStore, findDocumentById } from '../../extensions/new/DocumentExtension';
	import { get } from 'svelte/store';

	export let storyId: string;
	export let editor: Editor | null = null;

	// Use Svelte's reactive store subscriptions
	$: folders = $documentStore.folders;
	$: selectedDocumentId = $documentStore.currentDocumentId;
	$: isUpdating = $documentStore.isUpdating;

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
					documentStore.update((state) => ({
						...state,
						folders: doc.folders || []
					}));

					// If no document is selected, select the first one
					if (!$documentStore.currentDocumentId) {
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
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString()
						}))
					};

					const folders = [mainFolder];

					// Update store
					documentStore.update((state) => ({
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
			title: `Folder ${($documentStore.folders.length || 0) + 1}`,
			documents: []
		};

		// Add initial document to the folder
		const newDocument: Document = {
			id: uuidv4(),
			title: 'New Document',
			content: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		newFolder.documents.push(newDocument);

		const updatedFolders = [...$documentStore.folders, newFolder];

		try {
			// Update store first for instant UI feedback
			documentStore.update((state) => ({
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
		const folder = $documentStore.folders.find((f) => f.id === folderId);
		if (!folder) return;

		const newDocument: Document = {
			id: uuidv4(),
			title: `Document ${(folder.documents.length || 0) + 1}`,
			content: '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		const updatedFolders = $documentStore.folders.map((f) =>
			f.id === folderId ? { ...f, documents: [...f.documents, newDocument] } : f
		);

		try {
			// Update store first for instant UI feedback
			documentStore.update((state) => ({
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

	async function deleteFolder(id: string) {
		if ($documentStore.folders.length <= 1) {
			error = 'Cannot delete the last folder';
			setTimeout(() => (error = null), 3000);
			return;
		}

		const confirmed = window.confirm(
			'Are you sure you want to delete this folder and all its documents?'
		);
		if (!confirmed) return;

		const folderToDelete = $documentStore.folders.find((f) => f.id === id);
		if (!folderToDelete) return;

		// Check if current document is in this folder
		const isCurrentDocInFolder = folderToDelete.documents.some(
			(d) => d.id === $documentStore.currentDocumentId
		);

		const updatedFolders = $documentStore.folders.filter((f) => f.id !== id);

		try {
			// If current document is in the folder being deleted, select another document
			let nextDocId: string | null = $documentStore.currentDocumentId;

			if (isCurrentDocInFolder && updatedFolders.length > 0) {
				const firstFolder = updatedFolders[0];
				if (firstFolder.documents.length > 0) {
					nextDocId = firstFolder.documents[0].id;
				} else {
					nextDocId = null;
				}
			}

			// Update store
			documentStore.update((state) => ({
				...state,
				folders: updatedFolders,
				currentDocumentId: nextDocId
			}));

			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});

			// If current document was in deleted folder, select a new one
			if (isCurrentDocInFolder && nextDocId) {
				selectDocument(nextDocId);
			}
		} catch (err) {
			console.error('Error deleting folder:', err);
			error = 'Failed to delete folder';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	async function deleteDocument(folderId: string, documentId: string) {
		const folder = $documentStore.folders.find((f) => f.id === folderId);
		if (!folder) return;

		if (folder.documents.length <= 1) {
			error = 'Cannot delete the last document in a folder';
			setTimeout(() => (error = null), 3000);
			return;
		}

		const confirmed = window.confirm('Are you sure you want to delete this document?');
		if (!confirmed) return;

		const isCurrentDoc = documentId === $documentStore.currentDocumentId;

		const updatedFolder = {
			...folder,
			documents: folder.documents.filter((d) => d.id !== documentId)
		};

		const updatedFolders = $documentStore.folders.map((f) =>
			f.id === folderId ? updatedFolder : f
		);

		try {
			// If current document is being deleted, select another one
			let nextDocId: string | null = $documentStore.currentDocumentId;

			if (isCurrentDoc) {
				// Pick first document in same folder
				nextDocId = updatedFolder.documents[0]?.id || null;

				// If no documents left in folder, try to find a document in another folder
				if (!nextDocId && updatedFolders.some((f) => f.documents.length > 0)) {
					for (const f of updatedFolders) {
						if (f.documents.length > 0) {
							nextDocId = f.documents[0].id;
							break;
						}
					}
				}
			}

			// Update store
			documentStore.update((state) => ({
				...state,
				folders: updatedFolders,
				currentDocumentId: nextDocId
			}));

			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});

			// If current document was deleted, select a new one
			if (isCurrentDoc && nextDocId) {
				selectDocument(nextDocId);
			}
		} catch (err) {
			console.error('Error deleting document:', err);
			error = 'Failed to delete document';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	function selectDocument(id: string) {
		if (!editor) {
			console.warn('Cannot select document: editor not initialized');
			return;
		}

		if ($documentStore.isUpdating) {
			console.warn('TiptapFolders: Store is updating, skipping document selection.');
			return;
		}

		console.log(`Selecting document: ${id}`);

		// Save to localStorage for persistence
		localStorage.setItem(`current_document_${storyId}`, id);

		// Update editor state
		editorState.setCurrentDocument(id);

		// Update document store
		documentStore.update((state) => ({
			...state,
			currentDocumentId: id
		}));

		// Call editor command to load content
		editor.commands.setDocument(id);
	}

	async function handleFolderTitleChange(folderId: string, newTitle: string) {
		const updatedFolders = $documentStore.folders.map((f) =>
			f.id === folderId ? { ...f, title: newTitle } : f
		);

		// Optimistic UI update
		documentStore.update((state) => ({ ...state, folders: updatedFolders }));

		try {
			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});
		} catch (err) {
			console.error('Error saving folder title:', err);
			error = 'Failed to save folder title';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	async function handleDocumentTitleChange(folderId: string, documentId: string, newTitle: string) {
		const updatedFolders = $documentStore.folders.map((folder) =>
			folder.id === folderId
				? {
						...folder,
						documents: folder.documents.map((doc) =>
							doc.id === documentId
								? { ...doc, title: newTitle, updatedAt: new Date().toISOString() }
								: doc
						)
					}
				: folder
		);

		// Optimistic UI update
		documentStore.update((state) => ({ ...state, folders: updatedFolders }));

		try {
			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});
		} catch (err) {
			console.error('Error saving document title:', err);
			error = 'Failed to save document title';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	function toggleFolder(folderId: string) {
		if (expandedFolders.has(folderId)) {
			expandedFolders.delete(folderId);
		} else {
			expandedFolders.add(folderId);
		}
		expandedFolders = expandedFolders; // Force reactivity
	}

	function handleDragStart(event: DragEvent, type: 'folder' | 'document', id: string) {
		if (event.dataTransfer) {
			event.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
			event.dataTransfer.effectAllowed = 'move';
		}
		draggedItem = { type, id };
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	async function handleDrop(event: DragEvent, targetType: 'folder' | 'document', targetId: string) {
		event.preventDefault();
		if (!draggedItem) return;

		// Prevent dropping on itself
		if (draggedItem.id === targetId && draggedItem.type === targetType) return;

		// Handle different drag and drop combinations
		if (draggedItem.type === 'folder' && targetType === 'folder') {
			await reorderFolders(draggedItem.id, targetId);
		} else if (draggedItem.type === 'document' && targetType === 'document') {
			await reorderDocuments(draggedItem.id, targetId);
		} else if (draggedItem.type === 'document' && targetType === 'folder') {
			await moveDocumentToFolder(draggedItem.id, targetId);
		}

		draggedItem = null;
	}

	async function reorderFolders(draggedId: string, targetId: string) {
		const folders = [...$documentStore.folders];
		const draggedIndex = folders.findIndex((f) => f.id === draggedId);
		const targetIndex = folders.findIndex((f) => f.id === targetId);

		if (draggedIndex === -1 || targetIndex === -1) return;

		const [draggedItem] = folders.splice(draggedIndex, 1);
		folders.splice(targetIndex, 0, draggedItem);

		// Update UI first
		documentStore.update((state) => ({ ...state, folders }));

		try {
			// Then save to backend
			await documents.saveDocument(storyId, {
				folders,
				updatedAt: new Date()
			});
		} catch (err) {
			console.error('Error saving folder order:', err);
			error = 'Failed to save folder order';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	async function reorderDocuments(draggedId: string, targetId: string) {
		// Find which folders contain these documents
		let draggedFolderId: string | null = null;
		let targetFolderId: string | null = null;
		let draggedDocument: Document | null = null;

		for (const folder of $documentStore.folders) {
			for (const doc of folder.documents) {
				if (doc.id === draggedId) {
					draggedFolderId = folder.id;
					draggedDocument = doc;
				}
				if (doc.id === targetId) {
					targetFolderId = folder.id;
				}
			}
			if (draggedFolderId && targetFolderId) break;
		}

		if (!draggedFolderId || !targetFolderId || !draggedDocument) return;

		const updatedFolders = [...$documentStore.folders];

		// If same folder, just reorder
		if (draggedFolderId === targetFolderId) {
			const folderIndex = updatedFolders.findIndex((f) => f.id === draggedFolderId);
			if (folderIndex === -1) return;

			const docs = [...updatedFolders[folderIndex].documents];
			const draggedIndex = docs.findIndex((d) => d.id === draggedId);
			const targetIndex = docs.findIndex((d) => d.id === targetId);

			if (draggedIndex === -1 || targetIndex === -1) return;

			const [draggedItem] = docs.splice(draggedIndex, 1);
			docs.splice(targetIndex, 0, draggedItem);

			updatedFolders[folderIndex] = {
				...updatedFolders[folderIndex],
				documents: docs
			};
		} else {
			// Move from one folder to another
			const sourceFolderIndex = updatedFolders.findIndex((f) => f.id === draggedFolderId);
			const targetFolderIndex = updatedFolders.findIndex((f) => f.id === targetFolderId);

			if (sourceFolderIndex === -1 || targetFolderIndex === -1) return;

			// Remove from source folder
			updatedFolders[sourceFolderIndex] = {
				...updatedFolders[sourceFolderIndex],
				documents: updatedFolders[sourceFolderIndex].documents.filter((d) => d.id !== draggedId)
			};

			// Add to target folder
			const targetDocs = [...updatedFolders[targetFolderIndex].documents];
			const targetIndex = targetDocs.findIndex((d) => d.id === targetId);
			targetDocs.splice(targetIndex, 0, draggedDocument);

			updatedFolders[targetFolderIndex] = {
				...updatedFolders[targetFolderIndex],
				documents: targetDocs
			};
		}

		// Update UI first
		documentStore.update((state) => ({ ...state, folders: updatedFolders }));

		try {
			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});
		} catch (err) {
			console.error('Error moving document:', err);
			error = 'Failed to move document';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	async function moveDocumentToFolder(documentId: string, targetFolderId: string) {
		// Find document and its current folder
		let sourceFolderId: string | null = null;
		let document: Document | null = null;

		for (const folder of $documentStore.folders) {
			const doc = folder.documents.find((d) => d.id === documentId);
			if (doc) {
				sourceFolderId = folder.id;
				document = doc;
				break;
			}
		}

		if (!sourceFolderId || !document || sourceFolderId === targetFolderId) return;

		const updatedFolders = $documentStore.folders.map((folder) => {
			if (folder.id === sourceFolderId) {
				return {
					...folder,
					documents: folder.documents.filter((d) => d.id !== documentId)
				};
			} else if (folder.id === targetFolderId) {
				return {
					...folder,
					documents: [...folder.documents, document!]
				};
			}
			return folder;
		});

		// Update UI first
		documentStore.update((state) => ({ ...state, folders: updatedFolders }));

		try {
			// Then save to backend
			await documents.saveDocument(storyId, {
				folders: updatedFolders,
				updatedAt: new Date()
			});
		} catch (err) {
			console.error('Error moving document to folder:', err);
			error = 'Failed to move document';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	function handleDragEnd() {
		draggedItem = null;
	}
</script>

<div class="sidebar">
	<div class="sidebar-header">
		<h2>Folders</h2>
		<button class="add-folder-btn" on:click={addFolder} aria-label="Add new folder">+</button>
	</div>

	{#if error}
		<div class="error-message">{error}</div>
	{/if}

	{#if isLoading}
		<div class="loading">Loading...</div>
	{:else}
		<ul class="folder-list">
			{#each folders as folder (folder.id)}
				<li
					class="folder-item"
					draggable={true}
					on:dragstart={(e) => handleDragStart(e, 'folder', folder.id)}
					on:dragover={handleDragOver}
					on:drop={(e) => handleDrop(e, 'folder', folder.id)}
					on:dragend={handleDragEnd}
				>
					<div class="folder-header">
						<button
							class="toggle-btn"
							on:click={() => toggleFolder(folder.id)}
							aria-label={expandedFolders.has(folder.id) ? 'Collapse folder' : 'Expand folder'}
						>
							{expandedFolders.has(folder.id) ? '▼' : '►'}
						</button>

						<div class="folder-title-container">
							<input
								type="text"
								class="folder-title"
								value={folder.title}
								on:change={(e) => handleFolderTitleChange(folder.id, e.currentTarget.value)}
							/>
						</div>

						<div class="folder-actions">
							<button
								class="add-doc-btn"
								on:click={() => addDocument(folder.id)}
								aria-label="Add new document to folder"
							>
								+
							</button>
							<button
								class="delete-btn"
								on:click={() => deleteFolder(folder.id)}
								aria-label="Delete folder"
							>
								×
							</button>
						</div>
					</div>

					{#if expandedFolders.has(folder.id)}
						<ul class="document-list">
							{#each folder.documents as document (document.id)}
								<li
									class="document-item {selectedDocumentId === document.id ? 'selected' : ''}"
									draggable={true}
									on:dragstart={(e) => handleDragStart(e, 'document', document.id)}
									on:dragover={handleDragOver}
									on:drop={(e) => handleDrop(e, 'document', document.id)}
									on:dragend={handleDragEnd}
									on:click={() => selectDocument(document.id)}
								>
									<div class="document-title-container">
										<input
											type="text"
											class="document-title"
											value={document.title}
											on:change={(e) =>
												handleDocumentTitleChange(folder.id, document.id, e.currentTarget.value)}
											on:click={(e) => e.stopPropagation()}
										/>
									</div>

									<button
										class="delete-btn"
										on:click={(e) => {
											e.stopPropagation();
											deleteDocument(folder.id, document.id);
										}}
										aria-label="Delete document"
									>
										×
									</button>
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
	.sidebar {
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		box-sizing: border-box;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.folder-list {
		list-style: none;
		padding: 0;
		margin: 0;
		overflow-y: auto;
	}

	.folder-item {
		margin-bottom: 0.5rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		overflow: hidden;
	}

	.folder-header {
		display: flex;
		align-items: center;
		padding: 0.5rem;
		background: var(--panel-background);
		cursor: pointer;
	}

	.folder-title-container {
		flex: 1;
		margin: 0 0.5rem;
	}

	.folder-title {
		width: 100%;
		background: transparent;
		border: none;
		padding: 0.2rem;
		font-weight: bold;
		color: var(--text-color);
	}

	.folder-title:focus {
		outline: 1px solid var(--primary-color);
		background: var(--input-background);
	}

	.folder-actions {
		display: flex;
		gap: 0.3rem;
	}

	.document-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.document-item {
		display: flex;
		align-items: center;
		padding: 0.4rem 0.4rem 0.4rem 2rem;
		cursor: pointer;
		border-bottom: 1px solid var(--border-color);
	}

	.document-item:hover {
		background: var(--hover-color);
	}

	.document-item.selected {
		background: var(--active-color);
	}

	.document-title-container {
		flex: 1;
	}

	.document-title {
		width: 100%;
		background: transparent;
		border: none;
		padding: 0.2rem;
		color: var(--text-color);
	}

	.document-title:focus {
		outline: 1px solid var(--primary-color);
		background: var(--input-background);
	}

	.toggle-btn,
	.add-folder-btn,
	.add-doc-btn,
	.delete-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.2rem;
		color: var(--text-muted);
	}

	.toggle-btn:hover,
	.add-folder-btn:hover,
	.add-doc-btn:hover {
		color: var(--text-color);
	}

	.delete-btn:hover {
		color: var(--error-color);
	}

	.add-folder-btn,
	.add-doc-btn {
		font-size: 1.2rem;
	}

	.error-message {
		color: var(--error-color);
		margin-bottom: 1rem;
		padding: 0.5rem;
		background: rgba(255, 0, 0, 0.1);
		border-radius: 4px;
	}

	.loading {
		display: flex;
		justify-content: center;
		padding: 1rem;
		color: var(--text-muted);
	}
</style>
