import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from './base'

export interface SetKeepScreenOnOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  keepScreenOn: boolean
}

export interface SetEnableDebugOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  enableDebug: boolean
}

export type KeyboardHeightChangeCallback = (event: { height: number }) => void
export type MemoryWarningCallback = (event: { level: 5 | 10 | 15 }) => void

export interface MiniProgramPerformanceEntry {
  name: string
  entryType: string
  startTime: number
  duration: number
}

export interface MiniProgramPerformanceObserver {
  supportedEntryTypes: string[]
  observe: (options: { type?: 'navigation' | 'render' | 'script' | 'loadPackage', entryTypes?: string[] }) => void
  disconnect: () => void
}

export interface MiniProgramPerformance {
  getEntries: () => MiniProgramPerformanceEntry[]
  getEntriesByName: (name: string, entryType?: string) => MiniProgramPerformanceEntry[]
  getEntriesByType: (entryType: string) => MiniProgramPerformanceEntry[]
  setBufferSize: (size: number) => void
  createObserver: (callback: (...args: any[]) => any) => MiniProgramPerformanceObserver
}

export interface RealtimeTagLogManager {
  info: (key: string, value: unknown) => void
  warn: (key: string, value: unknown) => void
  error: (key: string, value: unknown) => void
  setFilterMsg: (message: string) => void
  addFilterMsg: (message: string) => void
}

export interface RealtimeLogManager {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  setFilterMsg: (message: string) => void
  addFilterMsg: (message: string) => void
  in: (pageInstance: object) => void
  tag: (name: string) => RealtimeTagLogManager
  getCurrentState: () => { logCount: number, maxLogCount: number, maxSize: number, size: number }
}
