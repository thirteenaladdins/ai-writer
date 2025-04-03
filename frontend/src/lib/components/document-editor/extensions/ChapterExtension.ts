import { Extension } from '@tiptap/core'
import { writable, get } from 'svelte/store'
import type { Editor } from '@tiptap/core'
import { debounce } from 'lodash-es'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chapter: {
      setChapter: (chapterId: string) => ReturnType
      syncChapterContent: () => ReturnType
    }
  }
}

export interface Chapter {
  id: string
  title: string
  content: string
  order: number
}

export interface ChapterState {
  currentChapterId: string | null
  chapters: Chapter[]
  isUpdating: boolean
}

// Create a Svelte store for chapter state
export const chapterStore = writable<ChapterState>({
  currentChapterId: null,
  chapters: [],
  isUpdating: false
})

// Debounced function to update chapter content in the store after edits
const debouncedUpdate = debounce((editor: Editor, chapterId: string) => {
  const content = editor.getHTML()
  chapterStore.update(s => ({
    ...s,
    chapters: s.chapters.map(c => 
      c.id === chapterId 
        ? { ...c, content } 
        : c
    ),
    isUpdating: false
  }))
}, 1000)

export const ChapterExtension = Extension.create({
  name: 'chapter',

  addCommands() {
    return {
      setChapter: (chapterId: string) => ({ commands, editor }) => {
        const state = get(chapterStore)
        if (state.isUpdating) {
          console.warn('ChapterExtension: Already updating, skipping setChapter.')
          return false
        }
        
        const chapter = state.chapters.find((c: Chapter) => c.id === chapterId)
        
        if (chapter) {
          chapterStore.update(s => ({ ...s, isUpdating: true }))
          const success = commands.setContent(chapter.content || '')
          chapterStore.update(s => ({ ...s, isUpdating: false }))
          return success
        }
        return false
      },
      
      syncChapterContent: () => ({ editor }) => {
        const state = get(chapterStore)
        if (state.isUpdating) {
          return false
        }
        if (state.currentChapterId) {
          chapterStore.update(s => ({ ...s, isUpdating: true }))
          debouncedUpdate(editor, state.currentChapterId)
        }
        return true
      }
    }
  }
}) 