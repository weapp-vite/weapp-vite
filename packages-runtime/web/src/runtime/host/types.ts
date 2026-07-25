export interface WebRuntimeStorage {
  readonly length: number
  clear: () => void
  getItem: (key: string) => string | null
  key: (index: number) => string | null
  removeItem: (key: string) => void
  setItem: (key: string, value: string) => void
}

export interface WebRuntimeClipboard {
  readText: () => string | Promise<string>
  writeText: (value: string) => void | Promise<void>
}

export interface WebRuntimeDialogs {
  alert?: (message?: string) => void
  confirm?: (message?: string) => boolean
  prompt?: (message?: string, defaultValue?: string) => string | null
}

export interface WebRuntimeHost {
  clipboard?: WebRuntimeClipboard
  dialogs?: WebRuntimeDialogs
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  open?: (url?: string, target?: string, features?: string) => unknown
  storage?: WebRuntimeStorage
}
