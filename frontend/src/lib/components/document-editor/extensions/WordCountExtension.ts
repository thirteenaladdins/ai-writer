import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { writable } from 'svelte/store'

export interface WordCount {
  words: number
  characters: number
}

// Create a Svelte store for the word count
export const wordCountStore = writable<WordCount>({
  words: 0,
  characters: 0
})

export const WordCountExtension = Extension.create({
  name: 'wordCount',

  addStorage() {
    return {
      words: 0,
      characters: 0
    }
  },

  addProseMirrorPlugins() {
    const updateWordCount = (text: string) => {
      const words = text.trim().split(/\s+/).filter(Boolean).length
      const characters = text.length

      // Update both the extension storage and the Svelte store
      this.storage.words = words
      this.storage.characters = characters
      wordCountStore.set({ words, characters })
    }

    return [
      new Plugin({
        key: new PluginKey('wordCount'),
        view: () => ({
          update: (view) => {
            const text = view.state.doc.textContent
            updateWordCount(text)
            return true
          }
        })
      })
    ]
  }
}) 