import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
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
const ROOT = path.resolve(import.meta.dirname, '../..')

/** 只保留首更磁盘内容，原验收失败后再读取协议和输出证据。 */
export function createIssue1015HmrDiagnostics(options: DiagnosticOptions) {
  let firstStyleOnly: Awaited<ReturnType<typeof readStylesheet>> | undefined

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

  return {
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
      const devOutput = await observe('dev output', () => sanitizeBenchmarkDevLog(
        options.getDevOutput().slice(-24_000).replaceAll('\\', '/').replaceAll(options.projectPath.replaceAll('\\', '/'), '<project>'),
        ROOT,
      ))
      const snapshot = { label, capturedAt: new Date().toISOString(), firstStyleOnly: firstStyleOnly ?? null, stylesheet, style, devOutput, errors }
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
  }
}
