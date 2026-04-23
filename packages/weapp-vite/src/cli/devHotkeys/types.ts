import type { WeappMcpConfig, WeappViteConfig } from '../../types'

export interface StartDevHotkeysOptions {
  cwd: string
  mcpConfig?: boolean | WeappMcpConfig
  openIde?: () => Promise<string | undefined>
  platform?: string
  projectPath: string
  rebuild?: () => Promise<string | undefined>
  silentStartupHint?: boolean
  weappViteConfig?: WeappViteConfig
}

export type DevHotkeyGroup = 'development' | 'devtools' | 'help' | 'process'

export interface DevHotkeyActionContext {
  options: StartDevHotkeysOptions
  toggleMcp: () => Promise<string | undefined>
}

export interface DevHotkeyDefinition {
  description: string
  group: DevHotkeyGroup
  key: string
  label?: string
  pendingLabel?: string
  run?: (context: DevHotkeyActionContext) => Promise<string | undefined>
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
