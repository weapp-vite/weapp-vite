import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { sanitizeBenchmarkDevLog } from '../../scripts/benchmarkTemplatesHmr/diagnostics'
import { ACCEPTANCE_REPORT_DIR_ENV, ACCEPTANCE_ROOT, sanitizeAcceptanceValue } from '../scripts/domAcceptanceReport/helpers'

interface TopologyDiagnosticOptions {
  project: string
  profilePath: string
  routes: string[]
  getDevOutput: () => string
}

/** 成功路径只记录阶段和既有输出长度；失败后才读取现场，不触发构建或导航。 */
export function createAutoRoutesTopologyDiagnostics(options: TopologyDiagnosticOptions) {
  const stages: Array<{ stage: string, phase: string, atEpochMs: number, devOutputLength: number }> = []
  const sanitize = (value: string) => sanitizeBenchmarkDevLog(value.replaceAll('\\', '/')
    .replaceAll(options.project.replaceAll('\\', '/'), '<project>'), ACCEPTANCE_ROOT)
  const sanitizeJson = (value: string) => {
    const parsed: unknown = JSON.parse(value)
    const normalized: unknown = JSON.parse(JSON.stringify(parsed, (_key, entry: unknown) => typeof entry === 'string' ? sanitize(entry) : entry))
    return JSON.stringify(sanitizeAcceptanceValue(normalized))
  }
  const sanitizeFile = (file: string, content: string) => {
    if (file.endsWith('.jsonl')) {
      return content.split('\n').map((line) => {
        try {
          return line.trim() ? sanitizeJson(line) : line
        }
        catch {
          return sanitize(line)
        }
      }).join('\n')
    }
    if (file.endsWith('.json')) {
      try {
        return sanitizeJson(content)
      }
      catch {
        return sanitize(content)
      }
    }
    return sanitize(content)
  }
  const message = (error: unknown) => {
    try {
      return sanitize(error instanceof Error ? error.message : String(error))
    }
    catch {
      return 'unprintable diagnostic error'
    }
  }
  const emit = (value: unknown) => {
    try {
      process.stdout.write(`[auto-routes-topology] ${JSON.stringify(value)}\n`)
    }
    catch {
      // 诊断输出失败不能改变原场景结果。
    }
  }
  const record = (stage: string, phase: string) => {
    const observation = { stage, phase, atEpochMs: performance.timeOrigin + performance.now(), devOutputLength: options.getDevOutput().length }
    stages.push(observation)
    emit(observation)
  }

  return {
    record,
    async captureFailure(stage: string, error: unknown) {
      const capturedAt = new Date().toISOString()
      const controller = new AbortController()
      const signal = controller.signal
      let timer: ReturnType<typeof setTimeout> | undefined
      const capture = async () => {
        const reportRoot = process.env[ACCEPTANCE_REPORT_DIR_ENV] || path.join(ACCEPTANCE_ROOT, 'docs/reports/dom-acceptance')
        const parent = path.join(reportRoot, 'diagnostics')
        await mkdir(parent, { recursive: true })
        signal.throwIfAborted()
        const directory = await mkdtemp(path.join(parent, 'auto-routes-topology-'))
        const files = [
          { file: 'hmr-profile.jsonl', source: options.profilePath },
          ...['app.json', 'app.js', ...options.routes.flatMap(route => ['js', 'json', 'wxml'].map(extension => `${route}.${extension}`))]
            .map(file => ({ file: `dist/${file}`, source: path.join(options.project, 'dist', file) })),
        ]
        const observations = await Promise.all(files.map(async ({ file, source }) => {
          try {
            const content = await readFile(source, { encoding: 'utf8', signal })
            return {
              file,
              exists: true,
              readAt: new Date().toISOString(),
              bytes: Buffer.byteLength(content),
              originalSha256: createHash('sha256').update(content).digest('hex'),
              content: sanitizeFile(file, content),
            }
          }
          catch (readError) {
            return { file, exists: (readError as NodeJS.ErrnoException).code === 'ENOENT' ? false : null, readError: message(readError) }
          }
        }))
        signal.throwIfAborted()
        const report = {
          schemaVersion: 1,
          kind: 'auto-routes-topology-failure',
          capturedAt,
          stage,
          failure: message(error),
          stages,
          files: observations.map(({ content: _content, ...observation }) => observation),
          note: '完整文本经已有诊断脱敏器规范化路径和敏感信息，JSON 重新序列化；原始内容哈希用于核对。文件按各自 readAt 读取，并非原子快照。',
        }
        await Promise.all([
          writeFile(path.join(directory, 'failure.json'), `${JSON.stringify(report, null, 2)}\n`, { signal }),
          writeFile(path.join(directory, 'dev.log'), sanitize(options.getDevOutput()), { signal }),
          ...observations.flatMap((observation) => {
            const content = observation.content
            return content === undefined
              ? []
              : [(async () => {
                  const destination = path.join(directory, observation.file)
                  await mkdir(path.dirname(destination), { recursive: true })
                  signal.throwIfAborted()
                  await writeFile(destination, content, { signal })
                })()]
          }),
        ])
        emit({ stage, phase: 'failure-evidence', directory: sanitize(path.relative(ACCEPTANCE_ROOT, directory)) })
      }
      try {
        await Promise.race([
          capture(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
              controller.abort()
              reject(new Error('diagnostic budget exhausted'))
            }, 2_500)
          }),
        ])
      }
      catch (diagnosticError) {
        emit({ stage, phase: 'diagnostic-error', error: message(diagnosticError) })
      }
      finally {
        clearTimeout(timer)
        controller.abort()
      }
    },
  }
}
