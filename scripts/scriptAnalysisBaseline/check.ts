import type { ScriptCheck, ScriptWorkerReport } from './types'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 使用当前 Node 可执行文件和参数数组，保持 Windows 与 Unix 的串行进程行为一致。
import { execa } from 'execa'
import { scriptScenarios } from './scenarios'
import { SCRIPT_VARIANTS } from './types'

const root = fileURLToPath(new URL('../../', import.meta.url))
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

async function sourceIdentity() {
  const files: string[] = ['pnpm-lock.yaml', 'scripts/nativeBindingAnalysis/compileScenarios.ts', 'scripts/astMigrationProfile/fixtures.ts']
  const collect = async (directory: string) => {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        await collect(relative)
      }
      else if (entry.name.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(entry.name)) {
        files.push(relative)
      }
    }
  }
  await collect('scripts/scriptAnalysisBaseline')
  await collect('packages-runtime/wevu-compiler/src')
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, digest(await readFile(path.join(root, file), 'utf8'))])))
}

function readReport(source: string): ScriptWorkerReport {
  const value = JSON.parse(source) as unknown
  if (!value || typeof value !== 'object' || !('checks' in value) || !Array.isArray(value.checks)
    || !('variant' in value) || !('sourceHashes' in value)) {
    throw new Error('Invalid script worker report')
  }
  return value as ScriptWorkerReport
}

function verifyCoverage(report: ScriptWorkerReport) {
  const total = (key: string) => report.checks.reduce((sum, check) => sum + Number(check.metrics[key] ?? 0), 0)
  if (total('astAlreadyConsumed')) {
    throw new Error(`${report.variant}: AST ownership was consumed more than once`)
  }
  if (report.variant === 'control' && report.checks.some(check => Object.values(check.metrics).some(value => value !== 0))) {
    throw new Error('The loader control must not perform optimized analysis')
  }
  const required: Record<string, string[]> = {
    'ast-reuse': ['astReuse', 'astSourceMismatch', 'astUnavailable'],
    'props-no-scope': ['propsNoScopeVisits'],
    'page-meta-gate': ['pageMetaSkipped', 'pageMetaAnalyzed'],
    'reserved-props-gate': ['reservedSkipped', 'reservedAnalyzed'],
  }
  const keys = report.variant === 'optimized' ? Object.values(required).flat() : required[report.variant] ?? []
  for (const key of keys) {
    if (!(total(key) > 0)) {
      throw new Error(`${report.variant}: scenario coverage did not exercise ${key}`)
    }
  }
}

/** 七种实现分别用新进程，逐项对照两次完整输出；只作强 JS 基线的语义实验。 */
async function main() {
  const outputArgument = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
  if (!outputArgument) {
    throw new Error('Expected --output=<new directory>')
  }
  const output = path.resolve(outputArgument)
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const identity = await sourceIdentity()
  const scenarios = await scriptScenarios()
  const runs: Array<Record<string, unknown>> = []
  const expected = new Map<string, ScriptCheck>()
  let controlHashes: Record<string, string> | undefined
  let failure: string | undefined
  const scrub = (value: string) => value.replaceAll(root, '<repo>/').replaceAll(root.replaceAll('/', '\\'), '<repo>\\')
  try {
    for (const variant of SCRIPT_VARIANTS) {
      const reportFile = path.join(output, `${variant}.json`)
      const child = await execa(process.execPath, ['--import', 'tsx', 'scripts/scriptAnalysisBaseline/worker.ts', variant, reportFile], {
        cwd: root,
        env: { WEAPP_VITE_NATIVE: '0' },
        timeout: 120_000,
        reject: false,
      })
      await writeFile(path.join(output, `${variant}.log`), scrub(`${child.stdout}\n${child.stderr}`), { flag: 'wx' })
      if (child.exitCode !== 0) {
        throw new Error(`${variant}: worker failed; see the preserved log`)
      }
      const raw = await readFile(reportFile, 'utf8')
      const report = readReport(raw)
      if (report.variant !== variant || report.checks.length !== scenarios.length * 2) {
        throw new Error(`${variant}: incomplete or unexpected report`)
      }
      if (variant === 'control') {
        controlHashes = report.sourceHashes
      }
      else if (variant !== 'baseline' && !isDeepStrictEqual(report.sourceHashes, controlHashes)) {
        throw new Error(`${variant}: source loader identity differs from the control`)
      }
      for (const [index, check] of report.checks.entries()) {
        const scenario = scenarios[Math.floor(index / 2)]!
        if (check.scenario !== scenario.id || check.inputSha256 !== digest(JSON.stringify(scenario)) || check.iteration !== index % 2
          || check.failed !== Boolean(scenario.expectError)
          || (scenario.expectWarning !== undefined && Boolean(check.warnings.length) !== scenario.expectWarning)) {
          throw new Error(`${variant}/${scenario.id}: unexpected compiler behavior or missing scenario`)
        }
        if (check.metrics.activeCompiles || check.metrics.pendingTransfers) {
          throw new Error(`${variant}/${scenario.id}: unfinished AST ownership`)
        }
        const reference = expected.get(scenario.id)
        if (!reference) {
          if (variant !== 'baseline') {
            throw new Error('Expected the unmodified compiler first')
          }
          expected.set(scenario.id, check)
        }
        else if (reference.output !== check.output) {
          throw new Error(`${variant}/${scenario.id}: complete value, map, warning or error mismatch`)
        }
      }
      verifyCoverage(report)
      runs.push({ variant, reportSha256: digest(raw), sourceHashes: report.sourceHashes, checks: report.checks.map(({ output, ...check }) => ({ ...check, outputSha256: digest(output) })) })
      console.log(`[script-baseline] ${variant}: ${scenarios.length} scenarios, two complete comparisons`)
    }
  }
  catch (error) {
    failure = scrub(error instanceof Error ? error.message : String(error))
  }
  const sourcesUnchanged = isDeepStrictEqual(identity, await sourceIdentity())
  if (!sourcesUnchanged) {
    failure = `${failure ?? ''} Source identity changed during comparison`.trim()
  }
  const result = {
    schemaVersion: 1,
    scope: 'Correctness-only diagnostic loader experiment; no production source changes or timing samples.',
    passed: !failure && runs.length === SCRIPT_VARIANTS.length,
    failure,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    sourceHashes: identity,
    sourcesUnchanged,
    scenarios: scenarios.map((scenario) => {
      const { source, ...metadata } = scenario
      return { ...metadata, sourceSha256: digest(source), inputSha256: digest(JSON.stringify(scenario)) }
    }),
    runs,
    limitations: [
      'Each implementation runs in an isolated fresh process; both calls per scenario compare the complete result with the original compiler.',
      'Controls use the same TypeScript loader, source URLs and line-ending normalization as optimized variants.',
      'This does not measure performance, Vite/HMR, memory or mini-program runtime behavior.',
      'The compiler source and diagnostic files are hashed before and after; installed dependency files are not rehashed.',
    ],
  }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ passed: result.passed, scenarios: scenarios.length, variants: runs.length, failure }))
  if (!result.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
