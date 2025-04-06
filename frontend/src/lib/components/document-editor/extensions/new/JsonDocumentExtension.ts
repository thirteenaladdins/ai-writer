import { Extension } from '@tiptap/core'
import { writable, get } from 'svelte/store'
import type { Editor } from '@tiptap/core'
import { debounce } from 'lodash-es'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    jsonDocument: {
      setDocument: (documentId: string) => ReturnType
      syncDocumentContent: () => ReturnType
    }
  }
}

// Keeping the existing interfaces to maintain compatibility
export interface Document {
  id: string
  title: string
  content: any // Changed to 'any' to support JSON content
  jsonContent?: any // New field for JSON content
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
export const jsonDocumentStore = writable<DocumentState>({
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

// Convert HTML content to JSON if needed
function ensureJsonContent(document: Document, editor: Editor): any {
  console.log('ensureJsonContent called with document:', {
    hasJsonContent: !!document.jsonContent,
    jsonContentType: document.jsonContent ? typeof document.jsonContent : 'none',
    hasHtmlContent: !!document.content && typeof document.content === 'string',
    htmlContentLength: document.content && typeof document.content === 'string' ? document.content.length : 0
  });

  // If we have valid JSON content, use it
  if (document.jsonContent && typeof document.jsonContent === 'object') {
    console.log('Using existing jsonContent');
    
    // Validate and fix JSON content if needed
    try {
      // Make sure it has the required TipTap structure
      const validContent = validateTipTapJson(document.jsonContent);
      console.log('Validated JSON content:', validContent);
      return validContent;
    } catch (e) {
      console.error('Invalid JSON content:', e);
      // Fall back to HTML conversion or default document
    }
  }
  
  // If we only have HTML content, convert it to JSON using TipTap
  if (document.content && typeof document.content === 'string' && document.content.trim().length > 0) {
    console.log('Converting HTML content to JSON');
    try {
      // Temporarily set the HTML content to generate JSON
      editor.commands.setContent(document.content);
      // Get the JSON representation
      const json = editor.getJSON();
      console.log('Converted JSON:', json);
      return json;
    } catch (e) {
      console.error('Error converting HTML to JSON:', e);
      // Fall back to default document
    }
  }
  
  // Default empty document
  console.log('Using default empty document');
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This is a new document. Start typing here...' }]
      }
    ]
  };
}

// Helper function to validate and fix TipTap JSON
function validateTipTapJson(json: any): any {
  // Make sure we have a valid TipTap document structure
  if (!json) return createDefaultDocument();
  if (typeof json !== 'object') return createDefaultDocument();
  
  // Basic validation - must have type and content
  if (json.type !== 'doc' || !Array.isArray(json.content)) {
    return createDefaultDocument();
  }
  
  // If content array is empty, add a default paragraph
  if (json.content.length === 0) {
    json.content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: '' }]
    });
  }
  
  return json;
}

// Create a default TipTap document
function createDefaultDocument(): any {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This is a new document. Start typing here...' }]
      }
    ]
  };
}

// Debounced function to update document content in the store after edits
const debouncedUpdate = debounce((editor: Editor, documentId: string) => {
  // Get content as JSON
  const jsonContent = editor.getJSON()
  // Also get HTML for backward compatibility
  const htmlContent = editor.getHTML()
  
  jsonDocumentStore.update(s => {
    // Create a deep copy of folders to maintain immutability
    const updatedFolders = s.folders.map(folder => ({
      ...folder,
      documents: folder.documents.map(doc => 
        doc.id === documentId 
          ? { 
              ...doc, 
              content: htmlContent, // Keep HTML content for backward compatibility
              jsonContent: jsonContent, // Store JSON content
              updatedAt: new Date().toISOString() 
            } 
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

export const JsonDocumentExtension = Extension.create({
  name: 'jsonDocument',

  addCommands() {
    return {
      setDocument: (documentId: string) => ({ commands, editor }) => {
        const state = get(jsonDocumentStore)
        if (state.isUpdating) {
          console.warn('JsonDocumentExtension: Already updating, skipping setDocument.')
          return false
        }
        
        const document = findDocumentById(state, documentId)
        
        if (document) {
          console.log('Setting document content:', {
            id: documentId,
            hasJsonContent: !!document.jsonContent,
            hasHtmlContent: !!document.content,
            jsonContentType: document.jsonContent ? typeof document.jsonContent : 'none',
            htmlContentType: document.content ? typeof document.content : 'none'
          })
          
          jsonDocumentStore.update(s => ({ ...s, isUpdating: true }))
          
          // If document has JSON content, use it; otherwise convert HTML to JSON
          const content = ensureJsonContent(document, editor)
          
          console.log('Processed content to set in editor:', content)
          
          const success = commands.setContent(content)
          console.log('Content set in editor result:', success)
          
          jsonDocumentStore.update(s => ({ 
            ...s, 
            currentDocumentId: documentId,
            isUpdating: false 
          }))
          return success
        }
        return false
      },
      
      syncDocumentContent: () => ({ editor }) => {
        const state = get(jsonDocumentStore)
        if (state.isUpdating) {
          return false
        }
        if (state.currentDocumentId) {
          jsonDocumentStore.update(s => ({ ...s, isUpdating: true }))
          debouncedUpdate(editor, state.currentDocumentId)
        }
        return true
      }
    }
  }
}) 