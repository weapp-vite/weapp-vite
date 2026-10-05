import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'

export interface ManagedWechatHostIdentity {
  pid: number
  executable: string
  started: string
}

export type ManagedWechatProjectState = 'starting' | 'unconfirmed' | 'owned' | 'borrowed' | 'closing' | 'failed' | 'released'

export interface ManagedWechatWindowLogCursor {
  name: string
  identity: string
  offset: number
  anchor: string
  skipPartialLine: boolean
}

export interface ManagedWechatWindowCloseCall {
  fileIdentity: string
  winId: string
  browserWindowId: number
  calledAt: string
  cancelled?: boolean
}

export interface ManagedWechatWindowCloseEvidence {
  protocol: 'wechat-devtools-window-close-trace-v1'
  profileDir: string
  productVersion: string
  capturedAt: string
  /** 活动日志按文件句柄捕获时，绑定实际持有日志的主进程身份。 */
  mainHost?: ManagedWechatHostIdentity
  /** 关闭意图先于 CLI 落盘；未知执行结果不能再次按路径关闭窗口。 */
  dispatchedAt?: string
  cursors: ManagedWechatWindowLogCursor[]
  calls: ManagedWechatWindowCloseCall[]
  window?: ManagedWechatWindowCloseCall & {
    runtimeId: string
    requestedAt: string
    nativeClosedAt?: string
    webContentsDestroyedAt?: string
  }
  failure?: string
  /** 旧整目录门禁恢复时保留原失败和游标，不重新捕获偏移或重复关窗。 */
  logInventoryRecovery?: { failure: string, cursors: ManagedWechatWindowLogCursor[] }
}

export interface ManagedWechatProjectRecord {
  schemaVersion: 1
  id: string
  generation: string
  journalPath: string
  ownerToken: string
  ownerPid: number
  target: ResolvedWechatDevtoolsTarget
  projectPath: string
  state: ManagedWechatProjectState
  openedProjectWindow?: boolean
  port?: number
  /** 自动化端口的监听进程身份，可能是 backend；不能当作主宿主或窗口身份。 */
  host?: ManagedWechatHostIdentity
  createdAt: string
  updatedAt: string
  closeAcknowledgedAt?: string
  /** 端口退出不是窗口退出；保存所选 profile 的增量销毁证据供父任务恢复。 */
  windowClose?: ManagedWechatWindowCloseEvidence
  releasedReason?: 'borrowed' | 'project-closed'
  error?: string
}

export interface BeginManagedWechatProjectOptions {
  target: ResolvedWechatDevtoolsTarget
  projectPath: string
  generation?: string
  port?: number
  journalPath?: string
}

export interface ManagedWechatProjectIntent {
  id: string
  journalPath: string
  confirm: (result: { openedProjectWindow: boolean, port: number }) => Promise<void>
  fail: (error: unknown) => Promise<void>
  close: () => Promise<void>
}

export interface CleanupManagedWechatProjectsOptions {
  journalPath?: string
  scope?: 'process' | 'journal'
}
