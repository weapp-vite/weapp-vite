import type { UploadPlatform, UploadProgress, UploadResult } from './types'
import process from 'node:process'

export interface UploadReportItem {
  platform: UploadPlatform | null
  requestedVersion?: string
  stage: 'prepare' | 'build' | 'validate' | 'upload'
  status: 'success' | 'failed' | 'not-run' | 'dry-run' | 'unknown'
  remoteOutcome?: 'not-started' | 'unknown'
  result?: UploadResult
  error?: string
}

export interface UploadReport {
  schemaVersion: 1
  action: 'upload'
  status: 'success' | 'failed'
  results: UploadReportItem[]
  error?: string
}

export class UploadCommandError extends Error {
  constructor(readonly report: UploadReport) {
    super(report.error)
    this.name = 'UploadCommandError'
  }
}

export function createFailedUploadReport(error: unknown): UploadReport {
  return {
    schemaVersion: 1,
    action: 'upload',
    status: 'failed',
    results: [],
    error: error instanceof Error ? error.message : String(error),
  }
}

export function printUploadProgress(platform: string, event: UploadProgress) {
  const percent = event.percent === undefined ? '' : ` ${event.percent}%`
  process.stderr.write(`[upload:${platform}] ${event.type}${percent}${event.message ? ` ${event.message}` : ''}\n`)
}

export function printUploadSummary(report: UploadReport) {
  const labels = { 'success': '上传成功', 'failed': '失败', 'not-run': '未执行', 'dry-run': '仅构建', 'unknown': '远端结果未确认' }
  for (const item of report.results) {
    process.stderr.write(`[upload:${item.platform ?? '配置平台'}] ${labels[item.status]}${item.requestedVersion ? ` ${item.requestedVersion}` : ''} (${item.stage})\n`)
  }
}

/** JSON 模式独占 stdout，构建配置及第三方工具的普通日志只进入 stderr。 */
export async function outputUploadReport(json: boolean, run: () => Promise<UploadReport>): Promise<void> {
  const stdoutWrite = process.stdout.write
  if (json) {
    process.stdout.write = process.stderr.write.bind(process.stderr)
  }
  try {
    let report: UploadReport
    try {
      report = await run()
    }
    catch (error) {
      report = error instanceof UploadCommandError ? error.report : createFailedUploadReport(error)
    }
    if (json) {
      await new Promise<void>((resolve, reject) => {
        stdoutWrite.call(process.stdout, `${JSON.stringify(report)}\n`, 'utf8', (error?: Error | null) => error ? reject(error) : resolve())
      })
      if (report.status === 'failed') {
        process.exitCode = 1
      }
    }
    else {
      printUploadSummary(report)
      if (report.status === 'failed') {
        throw new UploadCommandError(report)
      }
    }
  }
  finally {
    process.stdout.write = stdoutWrite
  }
}
