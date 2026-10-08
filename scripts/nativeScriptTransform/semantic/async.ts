import type { SemanticAsyncState, SemanticTools, SemanticTrace } from './types'
import { setImmediate } from 'node:timers/promises'
import { snapshotSemanticValue } from './value'

export function createSemanticTools(): {
  tools: SemanticTools
  trace: SemanticTrace[]
  state: SemanticAsyncState[]
  checkpoint: () => Promise<void>
} {
  const trace: SemanticTrace[] = []
  const state: SemanticAsyncState[] = []
  function record(label: string, payload?: unknown) {
    trace.push({ label, payload: snapshotSemanticValue(payload) })
  }
  async function checkpoint() {
    await setImmediate()
    await setImmediate()
  }
  const tools: SemanticTools = {
    snapshot: snapshotSemanticValue,
    record,
    async step(label, action) {
      record(`step:${label}:start`)
      try {
        const result = await action()
        record(`step:${label}:end`)
        return result
      }
      catch (error) {
        record(`step:${label}:throw`, error)
        throw error
      }
    },
    track(label, promise) {
      const entry: SemanticAsyncState = { id: state.length, label, status: 'pending' }
      state.push(entry)
      record(`async:${label}:start`)
      return Promise.resolve(promise).then((value) => {
        entry.status = 'fulfilled'
        record(`async:${label}:fulfilled`)
        return value
      }, (error: unknown) => {
        entry.status = 'rejected'
        entry.error = snapshotSemanticValue(error)
        record(`async:${label}:rejected`, error)
        throw error
      })
    },
    async flush() {
      await checkpoint()
      const pending = state.filter(entry => entry.status === 'pending')
      if (pending.length > 0) {
        throw new Error(`Unfinished semantic async work: ${pending.map(entry => entry.label).join(', ')}`)
      }
    },
  }
  return { tools, trace, state, checkpoint }
}
