export type UploadPlatform = 'weapp' | 'alipay' | 'tt' | 'xhs' | 'jd' | 'swan'
export type UploadAction = 'upload' | 'preview'

export interface PreviewResult {
  qrCodeUrl?: string
  qrCodeFile?: string
  previewUrl?: string
}

/** 仅保留官方工具实际返回的可展示字段，不推断远端任务或发布状态。 */
export interface UploadResult extends PreviewResult {
  sdkVersion?: string
  qrCodeBase64?: string
  fileSize?: number
  subPackages?: { name: string, size: number }[]
  plugins?: { appid: string, version: string, size: number }[]
  warnings?: string[]
}

export interface UploadProgress {
  type: 'progress' | 'log' | 'task-created' | 'version-created'
  message?: string
  percent?: number
}

export interface UploadExecutionOptions {
  timeoutMs?: number
  signal?: AbortSignal
  onProgress?: (event: UploadProgress) => void
}

export interface UploadContext {
  cwd: string
  projectPath: string
  appid?: string
  version: string
  desc: string
  qrCodePath?: string
  env: Record<string, string | undefined>
}

export interface PreparedUpload {
  secrets: string[]
  run: (onProgress?: (event: UploadProgress) => void) => Promise<unknown>
}
