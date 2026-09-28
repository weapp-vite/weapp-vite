export type UploadPlatform = 'weapp' | 'alipay' | 'tt' | 'xhs' | 'jd' | 'swan'
export type UploadAction = 'upload' | 'preview'

export interface PreviewResult {
  qrCodeUrl?: string
  qrCodeFile?: string
  previewUrl?: string
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
  run: () => Promise<unknown>
}
