import { defineStore } from 'pinia'
import { db, type CellMark, type MarkStatus } from '../data/db'

interface MarksState {
  marks: CellMark[]
  loaded: boolean
  revision: number
  /** Last storage failure (read or write); the in-memory marks stay usable until reload. */
  error: string | null
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : String(err)
}

export const useMarksStore = defineStore('marks', {
  state: (): MarksState => ({
    marks: [],
    loaded: false,
    revision: 0,
    error: null
  }),

  getters: {
    markByToken(): Map<string, CellMark> {
      const m = new Map<string, CellMark>()
      for (const mark of this.marks) {
        m.set(mark.token17, mark)
      }
      return m
    }
  },

  actions: {
    /** Runs a DB operation; failures are recorded in `error` instead of rejecting. */
    async guarded(op: () => Promise<unknown>): Promise<void> {
      try {
        await op()
        this.error = null
      } catch (err) {
        console.error('Marks storage error:', err)
        this.error = errorMessage(err)
      }
    },

    async load(): Promise<void> {
      if (this.loaded) return
      try {
        this.marks = await db.marks.toArray()
        this.error = null
      } catch (err) {
        console.error('Could not read marks:', err)
        this.error = errorMessage(err)
      }
      this.loaded = true
      this.revision++
    },

    async setMark(token17: string, status: MarkStatus, note: string): Promise<void> {
      const now = Date.now()
      const mark: CellMark = { token17, status, note, updatedAt: now }
      const idx = this.marks.findIndex((m) => m.token17 === token17)
      if (idx >= 0) {
        this.marks[idx] = mark
      } else {
        this.marks.push(mark)
      }
      this.revision++
      await this.guarded(() => db.marks.put(mark))
    },

    async removeMark(token17: string): Promise<void> {
      this.marks = this.marks.filter((m) => m.token17 !== token17)
      this.revision++
      await this.guarded(() => db.marks.delete(token17))
    },

    async clearAll(): Promise<void> {
      this.marks = []
      this.revision++
      await this.guarded(() => db.marks.clear())
    },

    async bulkSet(marks: CellMark[]): Promise<void> {
      this.marks = marks
      this.revision++
      await this.guarded(() =>
        db.transaction('rw', db.marks, async () => {
          await db.marks.clear()
          await db.marks.bulkPut(marks)
        })
      )
    }
  }
})
