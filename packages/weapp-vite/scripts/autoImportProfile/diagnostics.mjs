import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { sanitizeDiagnosticError } from '../../../../scripts/workspaceHmrProfile/sanitize.mjs'

/** 保留正式 benchmark 的 slice 语义，同时记录实际组件数。 */
export function selectProfilingComponents(tags, requestedCount) {
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error('Invalid profiling component count; expected a positive integer.')
  }
  return { requestedCount, actualCount: Math.min(requestedCount, tags.length), tags: tags.slice(0, requestedCount) }
}

/** 将启动异常写入独立脱敏目录，不覆盖已有采样，也不丢失唯一错误。 */
export async function recordStartupError(error, options = {}) {
  const errorRoot = path.resolve(options.errorRoot ?? '.tmp/auto-import-profile-startup-errors-sanitized')
  const sanitized = sanitizeDiagnosticError(error, options.roots)
  const report = { diagnosticOnly: true, sanitized: true, status: 'startup-failed', sha: options.sha ?? 'unresolved', error: sanitized }
  process.stderr.write(`[auto-import-profile] ${sanitized.name} (${sanitized.code}): ${sanitized.message}\n`)
  await mkdir(errorRoot, { recursive: true })
  const directory = await mkdtemp(path.join(errorRoot, 'failure-'))
  await writeFile(path.join(directory, 'error.json'), `${JSON.stringify(report, null, 2)}\n`)
  return report
}
