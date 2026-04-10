import type { WeappMcpConfig } from '../../types'

export interface StartDevHotkeysOptions {
  cwd: string
  mcpConfig?: boolean | WeappMcpConfig
  platform?: string
  projectPath: string
  silentStartupHint?: boolean
}

export interface DevHotkeysSession {
  close: () => void
  restore: () => void
}

export interface DevHotkeyState {
  currentAction?: string
  lastAction?: string
  mcpEnabled: boolean
  mcpRunning: boolean
  projectLabel?: string
}

export type HotkeyInputSource = 'data' | 'keypress'
