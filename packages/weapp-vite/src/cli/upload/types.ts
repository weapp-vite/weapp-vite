export type UploadPlatform = 'weapp' | 'alipay' | 'tt' | 'xhs' | 'jd' | 'swan'

export interface UploadContext {
  cwd: string
  projectPath: string
  appid?: string
  version: string
  desc: string
  env: Record<string, string | undefined>
}

export interface PreparedUpload {
  secrets: string[]
  run: () => Promise<unknown>
}
