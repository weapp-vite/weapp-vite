import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, mkdtemp, open, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { ACCEPTANCE_REPORT_DIR_ENV, sanitizeAcceptanceValue } from '../../scripts/domAcceptanceReport/helpers'
import { appendIdeReportEvent, resolveIdeWarningReportPathsFromEnv } from '../../utils/ideWarningReport'
import { NATIVE_PUBLICATION_PREFIX } from '../../utils/nativePublication/files'
import { captureCapabilityRuntime, observeCapabilityDiagnostic } from './capabilityFallbackRuntime'

const DIAGNOSTIC_RESERVE_MS = 15_000
const fixtureFiles = [
  'project.config.json',
  'project.private.config.json',
  'weapp-vite.config.ts',
  'vite.stateful.config.mts',
  '.tmp/hmr-profile.jsonl',
  ...['src', 'dist'].flatMap(directory => [
    ...['js', 'ts', 'json', 'wxss'].map(extension => `${directory}/app.${extension}`),
    ...['native', 'capability-added'].flatMap(page => ['ts', 'js', 'json', 'wxml', 'wxss'].map(extension => `${directory}/pages/${page}/index.${extension}`)),
  ]),
  'dist/__weapp_vite_hmr/control.js',
  'dist/__weapp_vite_hmr/update.js',
]

interface CapabilityFallbackDiagnosticOptions {
  projectRoot: string
  miniProgram: any
  provider: string
  scenario: Record<string, unknown>
  failure: unknown
  lastObservation: unknown
  getDevOutput: () => string
  caseDeadlineAtMonotonicMs: number
}

function digest(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function readFixtureFile(root: string, relative: string, signal: AbortSignal) {
  signal.throwIfAborted()
  const parts = relative.split('/')
  let entry = await lstat(root)
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error('Owned fixture root is no longer a plain directory')
  }
  let file = root
  for (const [index, part] of parts.entries()) {
    file = path.join(file, part)
    entry = await lstat(file)
    if (entry.isSymbolicLink() || (index < parts.length - 1 ? !entry.isDirectory() : !entry.isFile())) {
      throw new Error(`Refusing non-owned or non-regular diagnostic path: ${relative}`)
    }
  }
  const descriptor = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const current = await descriptor.stat()
    if (current.dev !== entry.dev || current.ino !== entry.ino || !current.isFile()) {
      throw new Error(`Fixture file identity changed before diagnostic read: ${relative}`)
    }
    const bytes = await descriptor.readFile({ signal })
    return { bytes, mtimeMs: current.mtimeMs }
  }
  finally {
    await descriptor.close()
  }
}

function emitDiagnostic(text: string) {
  try {
    process.stdout.write(`[hmr-capability-failure] ${text}\n`)
  }
  catch {
    // 次要诊断输出不能覆盖原始验收错误。
  }
}

/** 在 fixture 正常清理前归档只读现场；不延长原断言预算、不保留进程或 IDE 会话。 */
export async function captureCapabilityFallbackFailure(options: CapabilityFallbackDiagnosticOptions) {
  const remainingMs = options.caseDeadlineAtMonotonicMs - performance.now()
  if (!Number.isFinite(remainingMs) || remainingMs <= DIAGNOSTIC_RESERVE_MS) {
    return { status: 'skipped', reason: 'insufficient-case-time', remainingMs }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DIAGNOSTIC_RESERVE_MS)
  const capturedAt = new Date().toISOString()
  try {
    const reportRoot = resolveIdeWarningReportPathsFromEnv()?.reportDir || process.env[ACCEPTANCE_REPORT_DIR_ENV]
    if (!reportRoot) {
      throw new Error('Capability fallback diagnostics require this run\'s existing report directory')
    }
    const parent = path.join(reportRoot, 'diagnostics')
    await mkdir(parent, { recursive: true })
    const directory = await mkdtemp(path.join(parent, 'capability-fallback-'))
    const fixtureRoot = await realpath(options.projectRoot)
    if ((await lstat(options.projectRoot)).isSymbolicLink()) {
      throw new Error('Refusing replaced fixture root symlink')
    }
    const writeArtifact = async (file: string, bytes: Uint8Array) => {
      const target = path.join(directory, file)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, bytes, { flag: 'wx', signal: controller.signal })
      return { artifact: file, bytes: bytes.length, sha256: digest(bytes) }
    }
    const [runtime, files, devOutput] = await Promise.all([
      captureCapabilityRuntime(options.miniProgram, options.provider),
      Promise.all(fixtureFiles.map(async file => ({
        file,
        observation: await observeCapabilityDiagnostic(async () => {
          const { bytes, mtimeMs } = await readFixtureFile(fixtureRoot, file, controller.signal)
          return { ...await writeArtifact(`files/${file}`, bytes), mtimeMs }
        }),
      }))),
      observeCapabilityDiagnostic(async () => {
        const output = options.getDevOutput()
        const receipts = output.split(/\r?\n/).filter(line => line.includes(NATIVE_PUBLICATION_PREFIX))
        const [combined, nativeReceipts] = await Promise.all([
          writeArtifact('dev.combined.log', Buffer.from(output)),
          writeArtifact('native-publication.log', Buffer.from(receipts.length ? `${receipts.join('\n')}\n` : '')),
        ])
        return { combined, nativeReceipts, receiptCount: receipts.length, source: 'complete captured stdout/stderr combined stream, UTF-8' }
      }),
    ])
    const failure = options.failure instanceof Error
      ? { name: options.failure.name, message: options.failure.message }
      : { name: typeof options.failure, message: String(options.failure) }
    const report = sanitizeAcceptanceValue({
      schemaVersion: 1,
      kind: 'hmr-capability-fallback-failure',
      capturedAt,
      finishedAt: new Date().toISOString(),
      provider: options.provider,
      scenario: options.scenario,
      failure,
      lastObservation: options.lastObservation,
      runtime,
      files,
      devOutput,
      privateConfigOnDisk: 'files/project.private.config.json',
      note: '各观察面并列发起、分别记录时间，不能视为原子快照；files 保留本 fixture 原始字节及 SHA256，不递归依赖或其他项目。',
    })
    await writeArtifact('failure.json', Buffer.from(`${JSON.stringify(report, null, 2)}\n`))
    const artifact = path.relative(reportRoot, path.join(directory, 'failure.json')).replaceAll('\\', '/')
    const event = { artifact, provider: options.provider, scenario: options.scenario }
    try {
      appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'info', channel: 'hmr-capability-failure', project: 'e2e-apps/stateful-hmr', text: JSON.stringify(event) })
    }
    catch (error) {
      emitDiagnostic(JSON.stringify(sanitizeAcceptanceValue({ artifact, reportEventError: error instanceof Error ? error.message : String(error) })))
    }
    emitDiagnostic(JSON.stringify(sanitizeAcceptanceValue(event)))
    return { status: 'captured', artifact }
  }
  catch (error) {
    const secondary = sanitizeAcceptanceValue({ name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error) })
    emitDiagnostic(JSON.stringify({ status: 'failed', error: secondary }))
    return { status: 'failed', error: secondary }
  }
  finally {
    clearTimeout(timer)
    controller.abort()
  }
}
