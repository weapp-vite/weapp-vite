import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { open, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { sanitizeBenchmarkDevLog } from '../../scripts/benchmarkTemplatesHmr/diagnostics'
import { captureHmrStyleFailure } from './hmrStyleDiagnostics'
import { appendIdeReportEvent } from './ideWarningReport'

interface DiagnosticOptions {
  stylesheetPath: string
  projectPath: string
  captureOutput: (label: string) => Promise<unknown>
  captureRuntime: (label: string) => Promise<unknown>
  getDevOutput: () => string
}

type StyleSession = Parameters<typeof captureHmrStyleFailure>[0]
const PROJECT = 'e2e-apps/github-issues/fixtures/issue-1015'
const STYLESHEET = 'pages/issue-1015/index.wxss'
const PROFILE = '.tmp/hmr-profile.jsonl'
const PROFILE_MAX_BYTES = 64 * 1024
const PROFILE_MAX_LINES = 24
const ROOT = path.resolve(import.meta.dirname, '../..')

/** 只保留首更磁盘内容，原验收失败后再读取协议和输出证据。 */
export function createIssue1015HmrDiagnostics(options: DiagnosticOptions) {
  let firstStyleOnly: Awaited<ReturnType<typeof readStylesheet>> | undefined
  const sanitize = (value: string) => sanitizeBenchmarkDevLog(
    value.replaceAll(/\\+/g, '/').replaceAll(options.projectPath.replaceAll('\\', '/'), '<project>'),
    ROOT,
  )

  function sanitizeProfileLine(line: string) {
    try {
      const parsed: unknown = JSON.parse(line)
      return JSON.stringify(parsed, (key, value: unknown) => {
        if (value === null || typeof value === 'object') {
          return value
        }
        // 键名也参与现有凭据脱敏，避免单独处理字符串值时遗失 token 等上下文。
        const prefix = `${key}=`
        const text = String(value)
        const sanitized = sanitize(`${prefix}${text}`)
        const result = sanitized.startsWith(prefix) ? sanitized.slice(prefix.length) : sanitized
        return typeof value === 'string' || result !== text ? result : value
      })
    }
    catch {
      return sanitize(line)
    }
  }

  async function readProfile() {
    const capturedAt = new Date().toISOString()
    try {
      const file = await open(path.join(options.projectPath, PROFILE), 'r')
      try {
        const { size } = await file.stat()
        const offset = Math.max(0, size - PROFILE_MAX_BYTES)
        const buffer = Buffer.alloc(Math.min(size, PROFILE_MAX_BYTES))
        const { bytesRead } = await file.read(buffer, 0, buffer.length, offset)
        const source = buffer.subarray(0, bytesRead).toString('utf8')
        // 尾读从行中间开始时舍弃该行，不将失去字段上下文的残片写入报告。
        const newline = source.indexOf('\n')
        const complete = offset === 0 ? source : newline < 0 ? '' : source.slice(newline + 1)
        const lines = complete.split(/\r?\n/).filter(line => line.trim())
        return {
          capturedAt,
          fileName: PROFILE,
          bytes: size,
          capturedBytes: bytesRead,
          truncated: offset > 0 || lines.length > PROFILE_MAX_LINES,
          lines: lines.slice(-PROFILE_MAX_LINES).map(sanitizeProfileLine),
          error: null,
        }
      }
      finally {
        await file.close()
      }
    }
    catch (error) {
      return {
        capturedAt,
        fileName: PROFILE,
        bytes: null,
        capturedBytes: 0,
        truncated: false,
        lines: [],
        error: { name: error instanceof Error ? error.name : typeof error, code: (error as NodeJS.ErrnoException | null)?.code ?? null },
      }
    }
  }

  async function readStylesheet() {
    const capturedAt = new Date().toISOString()
    try {
      const bytes = await readFile(options.stylesheetPath)
      return {
        capturedAt,
        fileName: STYLESHEET,
        bytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        source: bytes.toString('utf8'),
        error: null,
      }
    }
    catch (error) {
      return { capturedAt, fileName: STYLESHEET, bytes: null, sha256: null, source: null, error: error instanceof Error ? error.name : typeof error }
    }
  }

  const diagnostics = {
    async captureFirstStyleOnly() {
      firstStyleOnly = await readStylesheet()
    },
    async captureFailure(label: string, session: object) {
      const errors: Array<{ phase: string, name: string }> = []
      async function observe<T>(phase: string, read: () => Promise<T> | T) {
        try {
          return await read()
        }
        catch (error) {
          errors.push({ phase, name: error instanceof Error ? error.name : typeof error })
          return null
        }
      }

      // 每个失败观察面独立收集，任一诊断异常都不能覆盖原 matcher 的错误。
      const profile = await observe('profile', readProfile)
      await observe('output', () => options.captureOutput(label))
      await observe('runtime', () => options.captureRuntime(label))
      const style = await observe('style', async () => {
        const send = Reflect.get(session, 'send') as StyleSession['send'] | undefined
        if (typeof send !== 'function') {
          return { unsupported: true }
        }
        return await captureHmrStyleFailure({ send: (...args) => send.call(session, ...args) }, {
          project: PROJECT,
          selector: '#issue-1015-page',
          stylesheets: [{ fileName: STYLESHEET, path: options.stylesheetPath }],
        })
      })
      const stylesheet = await readStylesheet()
      const devOutput = await observe('dev output', () => sanitize(options.getDevOutput().slice(-24_000)))
      const snapshot = { label, capturedAt: new Date().toISOString(), firstStyleOnly: firstStyleOnly ?? null, stylesheet, style, profile, devOutput, errors }
      await observe('report', () => appendIdeReportEvent({
        source: 'runtime',
        kind: 'message',
        level: 'info',
        channel: 'issue-1015-hmr-failure',
        project: PROJECT,
        label,
        text: JSON.stringify(snapshot),
      }))
      await observe('stdout', () => process.stdout.write(`[issue-1015-hmr-failure] ${JSON.stringify(snapshot)}\n`))
      return snapshot
    },
    async rethrowFailure(label: string, session: object, error: unknown): Promise<never> {
      try {
        await diagnostics.captureFailure(label, session)
      }
      catch {
        // 诊断自身的意外异常不能替换原验收失败。
      }
      throw error
    },
  }
  return diagnostics
}
