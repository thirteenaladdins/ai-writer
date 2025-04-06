import { Extension } from '@tiptap/core'
import { writable, get } from 'svelte/store'
import type { Editor } from '@tiptap/core'
import { debounce } from 'lodash-es'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    document: {
      setDocument: (documentId: string) => ReturnType
      syncDocumentContent: () => ReturnType
    }
  }
}

export interface Document {
  id: string
  title: string
  content: string
  summary?: string
  createdAt: string
  updatedAt: string
}

export interface Folder {
  id: string
  title: string
  documents: Document[]
}

export interface DocumentState {
  currentDocumentId: string | null
  folders: Folder[]
  isUpdating: boolean
}

// Create a Svelte store for document state
export const documentStore = writable<DocumentState>({
  currentDocumentId: null,
  folders: [],
  isUpdating: false
})

// Helper function to find a document by ID across all folders
export function findDocumentById(state: DocumentState, documentId: string): Document | undefined {
  for (const folder of state.folders) {
    const doc = folder.documents.find(d => d.id === documentId)
    if (doc) return doc
  }
  return undefined
}

// Debounced function to update document content in the store after edits
const debouncedUpdate = debounce((editor: Editor, documentId: string) => {
  const content = editor.getHTML()
  documentStore.update(s => {
    // Create a deep copy of folders to maintain immutability
    const updatedFolders = s.folders.map(folder => ({
      ...folder,
      documents: folder.documents.map(doc => 
        doc.id === documentId 
          ? { ...doc, content, updatedAt: new Date().toISOString() } 
          : doc
      )
    }))
    
    return {
      ...s,
      folders: updatedFolders,
      isUpdating: false
    }
  })
}, 1000)

export const DocumentExtension = Extension.create({
  name: 'document',

  addCommands() {
    return {
      setDocument: (documentId: string) => ({ commands, editor }) => {
        const state = get(documentStore)
        if (state.isUpdating) {
          console.warn('DocumentExtension: Already updating, skipping setDocument.')
          return false
        }
        
        const document = findDocumentById(state, documentId)
        
        if (document) {
          documentStore.update(s => ({ ...s, isUpdating: true }))
          const success = commands.setContent(document.content || '')
          documentStore.update(s => ({ 
            ...s, 
            currentDocumentId: documentId,
            isUpdating: false 
          }))
          return success
        }
        return false
      },
      
      syncDocumentContent: () => ({ editor }) => {
        const state = get(documentStore)
        if (state.isUpdating) {
          return false
        }
        if (state.currentDocumentId) {
          documentStore.update(s => ({ ...s, isUpdating: true }))
          debouncedUpdate(editor, state.currentDocumentId)
        }
        return true
      }
    }
  }
})
