/**
 * Marks store — manual cell marks (status + note) persisted in IndexedDB.
 */
import { defineStore } from 'pinia'
import { db, type CellMark, type MarkStatus } from '../data/db'

interface MarksState {
  marks: CellMark[]
  loaded: boolean
  revision: number
}

export const useMarksStore = defineStore('marks', {
  state: (): MarksState => ({
    marks: [],
    loaded: false,
    revision: 0
  }),

  getters: {
    /** Map of token17 → mark for quick lookup. */
    markByToken(): Map<string, CellMark> {
      const m = new Map<string, CellMark>()
      for (const mark of this.marks) {
        m.set(mark.token17, mark)
      }
      return m
    },
    /** Tokens marked as 'propus' or 'in-review' — not shown as free in stats. */
    pendingTokens(): Set<string> {
      const s = new Set<string>()
      for (const mark of this.marks) {
        if (mark.status === 'propus' || mark.status === 'in-review') {
          s.add(mark.token17)
        }
      }
      return s
    }
  },

  actions: {
    async load(): Promise<void> {
      if (this.loaded) return
      this.marks = await db.marks.toArray()
      this.loaded = true
      this.revision++
    },

    async setMark(token17: string, status: MarkStatus, note: string): Promise<void> {
      const now = Date.now()
      const mark: CellMark = { token17, status, note, updatedAt: now }
      await db.marks.put(mark)
      // Update in-memory state
      const idx = this.marks.findIndex((m) => m.token17 === token17)
      if (idx >= 0) {
        this.marks[idx] = mark
      } else {
        this.marks.push(mark)
      }
      this.revision++
    },

    async removeMark(token17: string): Promise<void> {
      await db.marks.delete(token17)
      this.marks = this.marks.filter((m) => m.token17 !== token17)
      this.revision++
    },

    async clearAll(): Promise<void> {
      await db.marks.clear()
      this.marks = []
      this.revision++
    },

    /** Bulk replace all marks (used by import). */
    async bulkSet(marks: CellMark[]): Promise<void> {
      await db.transaction('rw', db.marks, async () => {
        await db.marks.clear()
        await db.marks.bulkPut(marks)
      })
      this.marks = marks
      this.revision++
    }
  }
})
