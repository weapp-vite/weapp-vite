import { createStore } from 'zustand/vanilla'

interface ZustandCounterState {
  count: number
  step: number
  history: string[]
  dec: () => void
  inc: () => void
  reset: () => void
  setStep: (step: number) => void
}

function appendHistory(history: string[], message: string) {
  return [message, ...history].slice(0, 6)
}

export const zustandCounterStore = createStore<ZustandCounterState>()((set, get) => ({
  count: 2,
  step: 1,
  history: ['zustand store 已初始化'],
  dec: () =>
    set((state) => {
      const nextCount = Math.max(0, state.count - state.step)
      return {
        count: nextCount,
        history: appendHistory(state.history, `count ${state.count} -> ${nextCount}`),
      }
    }),
  inc: () =>
    set((state) => {
      const nextCount = state.count + state.step
      return {
        count: nextCount,
        history: appendHistory(state.history, `count ${state.count} -> ${nextCount}`),
      }
    }),
  reset: () =>
    set(state => ({
      count: 0,
      history: appendHistory(state.history, 'count 已重置为 0'),
    })),
  setStep: step =>
    set((state) => {
      const normalized = step > 0 ? step : 1
      if (normalized === get().step) {
        return state
      }
      return {
        step: normalized,
        history: appendHistory(state.history, `step 切换为 ${normalized}`),
      }
    }),
}))
