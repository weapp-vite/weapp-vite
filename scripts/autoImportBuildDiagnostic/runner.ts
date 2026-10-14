import type { BuildDiagnosticEvidence, BuildSample, DiagnosticCollection } from './collection'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 两个不可变 checkout 的诊断构建在同一 runner 串行派发。
import { execa } from 'execa'
import { runCollector } from '../performanceGate/process'
import { collectAutoImportBuildDiagnostics, diagnosticCollectionStatus } from './collection'
import { autoImportBuildDiagnosticPlan, validateAutoImportBuildDiagnosticIdentity } from './plan'

const driver = process.cwd()
const output = path.resolve(process.env.REPORT_ROOT!)
const roots = { baseline: path.resolve(process.env.BASELINE_ROOT!), candidate: path.resolve(process.env.CANDIDATE_ROOT!) }
await mkdir(output, { recursive: true })
const state: DiagnosticCollection = { finished: false, samples: [], errors: [] }
const fatalErrors: string[] = []
const redact = (message: string) => Object.values(roots).reduce((text, root) => text.replaceAll(root, '<checkout>'), message)
const save = () => writeFile(path.join(output, 'report.json'), `${redact(JSON.stringify({ ...autoImportBuildDiagnosticPlan, purpose: 'diagnostic', candidateSha: process.env.CANDIDATE_SHA, ...state, fatalErrors, status: diagnosticCollectionStatus(state, fatalErrors) }, null, 2))}\n`)
try {
  validateAutoImportBuildDiagnosticIdentity(process.env)
  if (process.platform !== 'darwin' || driver !== roots.candidate) {
    throw new Error('The diagnostic requires the candidate driver on macOS')
  }
  const identities: Record<string, { revision: string, clean: boolean, lockfileSha256: string }> = {}
  for (const side of ['baseline', 'candidate'] as const) {
    const cwd = roots[side]
    const revision = (await execa('git', ['rev-parse', 'HEAD'], { cwd })).stdout.trim()
    const clean = !(await execa('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd })).stdout.trim()
    identities[side] = { revision, clean, lockfileSha256: createHash('sha256').update(await readFile(path.join(cwd, 'pnpm-lock.yaml'))).digest('hex') }
    if (!clean || revision !== (side === 'baseline' ? autoImportBuildDiagnosticPlan.baselineSha : process.env.CANDIDATE_SHA)) {
      throw new Error('Diagnostic checkout identity or cleanliness differs')
    }
  }
  await writeFile(path.join(output, 'dispatch.json'), `${JSON.stringify({ ...autoImportBuildDiagnosticPlan, identities, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, cpuCount: os.availableParallelism(), runnerImage: process.env.ImageOS, runnerImageVersion: process.env.ImageVersion }, null, 2)}\n`)
  await collectAutoImportBuildDiagnostics(state, {
    async collectSample(round, side) {
      const directory = path.join(output, String(round), side)
      await runCollector(process.execPath, ['--import', 'tsx', 'packages/weapp-vite/scripts/benchmark-auto-import-build.ts'], {
        cwd: driver,
        logFile: path.join(directory, 'collector.log'),
        timeoutMs: 15 * 60_000,
        env: {
          AUTO_IMPORT_BENCH_TARGET_ROOT: roots[side],
          AUTO_IMPORT_BENCH_PAIRED: '1',
          AUTO_IMPORT_BUILD_DIAGNOSTIC: '1',
          BENCH_ITERATIONS: '1',
          BENCH_SCENARIOS: '69',
          BENCH_CONFIGURATIONS: JSON.stringify(autoImportBuildDiagnosticPlan.configurations),
          BENCH_REPORT_DIR: directory,
          BENCH_DISABLE_CURRENT_SUPPORT_OUTPUTS: '0',
        },
        redact: Object.values(roots),
      })
      const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8')) as { results: Array<{ usedCount: number, raw: { manual: BuildSample[], automatic: BuildSample[] } }> }
      if (report.results.length !== 1 || report.results[0]!.usedCount !== 69 || report.results[0]!.raw.manual.length !== 1 || report.results[0]!.raw.automatic.length) {
        throw new Error('Diagnostic sample configuration differs from 69 manual first/repeat')
      }
      return report.results[0]!.raw.manual[0]!
    },
    async readDiagnostic(round, side, phase) {
      const directory = path.join(output, String(round), side, 'build-diagnostics', '69-baseline-0', phase)
      return JSON.parse(await readFile(path.join(directory, 'diagnostic.json'), 'utf8')) as BuildDiagnosticEvidence
    },
    checkpoint: save,
  })
}
catch (error) {
  fatalErrors.push(redact(String(error)))
}
if (diagnosticCollectionStatus(state, fatalErrors) === 'incomplete') {
  process.exitCode = 1
}
await save()
