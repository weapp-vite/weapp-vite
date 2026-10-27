/** 小程序脚本错误信息，包含可用的浏览器堆栈。 */
export type MiniProgramErrorCallback = (error: string) => void

export interface UnhandledRejectionEvent {
  promise: Promise<unknown>
  reason: unknown
}

export type UnhandledRejectionCallback = (event: UnhandledRejectionEvent) => void

export interface ThemeChangeEvent {
  theme: 'dark' | 'light'
}

export type ThemeChangeCallback = (event: ThemeChangeEvent) => void
