import { documents } from '$lib/stores/documents';
import type { Document as OldDocument } from '$lib/stores/documents';
import type { Document, Folder } from '$lib/components/document-editor/extensions/new/DocumentExtension';
import { v4 as uuidv4 } from 'uuid';
import { get } from 'svelte/store';

// Define a common interface that includes jsonContent
interface JsonDocument extends Document {
  jsonContent?: any;
}

// This file contains utility functions to handle the documents store for the folder structure
// without modifying the original Document interface

// Extend the document store with folders support
export function extendDocumentWithFolders(storyId: string, existingDoc: any) {
  if (!existingDoc) {
    // Create a new document with folders structure
    return {
      id: storyId,
      title: 'Folders Test Document',
      // Keep the chapters property for compatibility with the original store
      chapters: [], 
      // Add the folders property
      folders: createDefaultFolders(),
      updatedAt: new Date()
    };
  }
  
  // If document already exists but doesn't have folders
  if (!existingDoc.folders) {
    // Convert existing chapters to documents in a folder
    const updatedDoc = {
      ...existingDoc,
      folders: convertChaptersToFolders(existingDoc.chapters || [])
    };
    return updatedDoc;
  }
  
  // Document already has folders
  return existingDoc;
}

// Create default folders structure with a sample document
export function createDefaultFolders(): Folder[] {
  const mainFolder: Folder = {
    id: uuidv4(),
    title: 'Main Folder',
    documents: [
      {
        id: uuidv4(),
        title: 'Welcome Document',
        content: '<p>Welcome to the folder structure test!</p><p>This is a sample document to get you started.</p>',
        jsonContent: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Welcome to the folder structure test!' }
              ]
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'This is a sample document to get you started.' }
              ]
            }
          ]
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any  // Use type assertion to avoid type errors
    ]
  };
  
  const notesFolder: Folder = {
    id: uuidv4(),
    title: 'Notes',
    documents: [
      {
        id: uuidv4(),
        title: 'Project Notes',
        content: '<p>Use this folder to store your notes and ideas.</p>',
        jsonContent: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Use this folder to store your notes and ideas.' }
              ]
            }
          ]
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any  // Use type assertion to avoid type errors
    ]
  };
  
  return [mainFolder, notesFolder];
}

// Convert existing chapters to documents in a folder
export function convertChaptersToFolders(chapters: any[]): Folder[] {
  if (!chapters || chapters.length === 0) {
    return createDefaultFolders();
  }
  
  const mainFolder: Folder = {
    id: uuidv4(),
    title: 'Converted Content',
    documents: chapters.map(chapter => {
      // Basic HTML content
      const content = chapter.content || '';
      
      // Create a simple JSON representation for TipTap
      // This is a basic conversion - a more sophisticated parser might be needed for complex content
      const jsonContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: content.replace(/<[^>]*>/g, '') } // Simple HTML tag removal
            ]
          }
        ]
      };
      
      return {
        id: chapter.id || uuidv4(),
        title: chapter.title || 'Untitled Document',
        content: content,
        jsonContent: jsonContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any;  // Use type assertion to avoid type errors
    })
  };
  
  return [mainFolder];
}

// Initialize or load document for the folder test
export async function initializeDocument(storyId: string) {
  const docs = get(documents);
  const existingDoc = docs[storyId];
  
  const updatedDoc = extendDocumentWithFolders(storyId, existingDoc);
  
  // Save the document with folders to the store
  await documents.saveDocument(storyId, updatedDoc);
  
  return updatedDoc;
}

// Helper to save folders structure
export async function saveFolders(storyId: string, folders: Folder[]) {
  const docs = get(documents);
  const existingDoc = docs[storyId];
  
  if (!existingDoc) return;
  
  await documents.saveDocument(storyId, {
    ...existingDoc,
    folders
  });
} 