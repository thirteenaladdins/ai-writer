import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface Chapter {
	id: string;
	title: string;
	content: string;
	order: number;
}

export interface Document {
	id: string;
	title: string;
	chapters: Chapter[];
	updatedAt: Date;
}

export interface DocumentsStore extends Writable<Record<string, Document>> {
	loadFromStorage: () => Promise<void>;
	saveDocument: (id: string, document: Partial<Document>) => Promise<void>;
	saveChapter: (documentId: string, chapterId: string, content: string) => Promise<void>;
	deleteDocument: (id: string) => Promise<void>;
}

function createDocumentsStore(): DocumentsStore {
	const { subscribe, set, update } = writable<Record<string, Document>>({});

	return {
		subscribe,
		set,
		update,
		loadFromStorage: async () => {
			const docs: Record<string, Document> = {};

			try {
				// Load all documents
				const documentKeys = Object.keys(localStorage).filter(
					(key) => key.startsWith('document_') && 
					!key.includes('settings_') && 
					!key.includes('current_chapter_')
				);

				for (const key of documentKeys) {
					try {
						const docData = localStorage.getItem(key);
						if (!docData) continue;

						const doc = JSON.parse(docData);
						const id = key.replace('document_', '');
						
						if (!doc || typeof doc !== 'object') {
							console.warn(`Invalid document data for ${id}, skipping`);
							continue;
						}

						docs[id] = {
							id,
							title: doc.title || 'Untitled Document',
							chapters: Array.isArray(doc.chapters) ? doc.chapters.map((chapter: Partial<Chapter>) => ({
								id: chapter.id || `chapter-${Date.now()}`,
								title: chapter.title || 'Untitled Chapter',
								content: chapter.content || '',
								order: typeof chapter.order === 'number' ? chapter.order : 0
							})) : [
								{
									id: 'chapter-1',
									title: 'Chapter 1',
									content: '',
									order: 0
								}
							],
							updatedAt: new Date(doc.updatedAt || Date.now())
						};
						
						// Save back to localStorage to ensure consistent format
						await saveToLocalStorage(id, docs[id]);
						console.log(`Loaded document: ${id} - ${doc.title}`);
					} catch (e) {
						console.error(`Failed to parse document: ${key}`, e);
					}
				}

				console.log(`Loaded ${Object.keys(docs).length} documents:`, docs);
				set(docs);
			} catch (error) {
				console.error('Error loading documents:', error);
				throw error;
			}
		},
		saveDocument: async (id: string, document: Partial<Document>) => {
			try {
				await update((docs) => {
					const updatedDocs = { ...docs };
					updatedDocs[id] = {
						...updatedDocs[id],
						...document,
						id,
						updatedAt: new Date()
					};
					saveToLocalStorage(id, updatedDocs[id]);
					return updatedDocs;
				});
			} catch (error) {
				console.error('Error saving document:', error);
				throw error;
			}
		},
		saveChapter: async (documentId: string, chapterId: string, content: string) => {
			try {
				await update((docs) => {
					const doc = docs[documentId];
					if (!doc) throw new Error(`Document ${documentId} not found`);

					const updatedChapters = doc.chapters.map((chapter) =>
						chapter.id === chapterId ? { ...chapter, content } : chapter
					);

					const updatedDoc = {
						...doc,
						chapters: updatedChapters,
						updatedAt: new Date()
					};

					saveToLocalStorage(documentId, updatedDoc);
					return {
						...docs,
						[documentId]: updatedDoc
					};
				});
			} catch (error) {
				console.error('Error saving chapter:', error);
				throw error;
			}
		},
		deleteDocument: async (id: string) => {
			try {
				await update((docs) => {
					const updatedDocs = { ...docs };
					delete updatedDocs[id];
					localStorage.removeItem(`document_${id}`);
					localStorage.removeItem(`document_settings_${id}`);
					return updatedDocs;
				});
			} catch (error) {
				console.error('Error deleting document:', error);
				throw error;
			}
		}
	};
}

async function saveToLocalStorage(id: string, doc: Partial<Document>): Promise<void> {
	try {
		localStorage.setItem(
			`document_${id}`,
			JSON.stringify({
				title: doc.title,
				chapters: doc.chapters,
				updatedAt: doc.updatedAt?.toISOString()
			})
		);
	} catch (error) {
		console.error(`Failed to save document ${id} to localStorage:`, error);
		throw error;
	}
}

export const documents = createDocumentsStore(); 