import { Buffer } from 'node:buffer'

export const MAX_DASHBOARD_FILE_CONTENT_BYTES = 2 * 1024 * 1024
export const MAX_DASHBOARD_ARTIFACT_CONTENT_BYTES = 32 * 1024 * 1024

export interface DashboardArtifactFile {
  readonly size: number
  readonly content?: string
  readonly error?: string
}

export type DashboardArtifactFiles = ReadonlyMap<string, DashboardArtifactFile>

/** 保留同一次分析的产物内容，不读取或改写开发构建目录。 */
export function createDashboardArtifactSnapshot() {
  const files = new Map<string, DashboardArtifactFile>()
  let retainedBytes = 0

  return {
    files: files as DashboardArtifactFiles,
    capture(fileName: string, source: string | Uint8Array) {
      const key = fileName.replaceAll('\\', '/')
      const previous = files.get(key)
      if (previous?.content !== undefined) {
        retainedBytes -= previous.size
      }
      const size = typeof source === 'string' ? Buffer.byteLength(source, 'utf8') : source.byteLength
      if (size > MAX_DASHBOARD_FILE_CONTENT_BYTES) {
        files.set(key, { size, error: `文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节，已拒绝读取。` })
        return
      }
      if (retainedBytes + size > MAX_DASHBOARD_ARTIFACT_CONTENT_BYTES) {
        files.set(key, { size, error: '分析产物内容超过快照容量上限，已拒绝读取。' })
        return
      }
      const content = typeof source === 'string' ? source : Buffer.from(source.buffer, source.byteOffset, source.byteLength).toString('utf8')
      files.set(key, { content, size })
      retainedBytes += size
    },
  }
}
