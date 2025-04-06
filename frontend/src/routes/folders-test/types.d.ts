import type { Document as BaseDocument } from '$lib/stores/documents';
import type { Folder } from '$lib/components/document-editor/extensions/new/DocumentExtension';

// Extend the Document interface to include folders
declare module '$lib/stores/documents' {
  interface Document extends BaseDocument {
    folders?: Folder[];
  }
} 