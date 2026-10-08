import type { Evidence, Input, Options, Run } from './contract'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { runCollector } from '../performanceGate/process'
import { isArtifactEvidence, sha256, warningEvidence } from './artifacts'
import { assertCollectionActive } from './contract'
import { collectorEnvironment } from './native'

/** 保留 native 环境，隔离其他任务的 HMR 参数；所有样本固定同一源码标记。 */
export function hmrEnvironment(options: Options, input: Input, run: Run, project: string, directory: string, workspace: string): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(Object.entries(process.env).map(([key, value]) => [key, key.startsWith('TEMPLATES_HMR_') ? undefined : value]))
  return {
    ...collectorEnvironment(run.side, options.nativePath, inherited),
    TEMPLATES_HMR_REPO_ROOT: options.root,
    TEMPLATES_HMR_CLI_PATH: path.join(options.root, 'packages/weapp-vite/bin/weapp-vite.js'),
    TEMPLATES_HMR_PROJECT_ROOT: project,
    TEMPLATES_HMR_REPORT_DIR: directory,
    TEMPLATES_HMR_WORKSPACE_ROOT: workspace,
    TEMPLATES_HMR_ITERATIONS: '2',
    TEMPLATES_HMR_RUNTIME: options.runtime,
    TEMPLATES_HMR_SCENARIO_FILTER: input.scenarios.join(','),
    TEMPLATES_HMR_SAMPLE_MODE: 'edit-only',
    TEMPLATES_HMR_MARKER_SEED: run.marker,
    TEMPLATES_HMR_PROFILE: '0',
    TEMPLATES_HMR_OUTPUT_SCOPE: '1',
    TEMPLATES_HMR_ARTIFACT_EVIDENCE: '1',
    TEMPLATES_HMR_KEEP_WORKSPACE: '1',
    TEMPLATES_HMR_FAIL_ON_ERROR: '0',
    TEMPLATES_HMR_STOP_ON_ERROR: '1',
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid HMR evidence object')
  }
  return value as Record<string, unknown>
}

/** 每个首次/重复编辑与恢复都需要真实产物、内存及输入摘要，不接受 best-of-cycle。 */
export function parseHmrEvidence(value: unknown, input: Input, run: Run, inputDigest: string, warnings: string[]) {
  const report = object(value)
  if (report.iterations !== 2 || report.sampleMode !== 'edit-only' || report.markerSeed !== run.marker || !Array.isArray(report.templates) || report.templates.length !== 1) {
    throw new Error('HMR sampling contract changed')
  }
  const template = object(report.templates[0])
  if (template.id !== input.id || template.error || !Array.isArray(template.scenarios)) {
    throw new Error(`HMR template failed: ${template.error ?? input.id}`)
  }
  const scenarios = template.scenarios.map(object)
  if (scenarios.length !== input.scenarios.length || new Set(scenarios.map(row => row.id)).size !== scenarios.length || scenarios.some(row => !input.scenarios.includes(row.id as never))) {
    throw new Error('Missing or duplicate HMR scenarios')
  }
  for (const scenario of scenarios) {
    if (scenario.error || !Array.isArray(scenario.cycles) || scenario.cycles.length !== 2) {
      throw new Error(`Incomplete HMR cycles: ${scenario.id}`)
    }
    for (const [index, cycleValue] of scenario.cycles.entries()) {
      const cycle = object(cycleValue)
      for (const phase of ['edit', 'restore'] as const) {
        const sample = object(cycle[phase])
        const artifact = object(sample.artifactEvidence)
        if (sample.phase !== phase || typeof sample.wallMs !== 'number' || !Number.isFinite(sample.wallMs) || sample.wallMs <= 0
          || typeof sample.rssBytes !== 'number' || !Number.isFinite(sample.rssBytes) || sample.rssBytes <= 0 || typeof sample.inputSha256 !== 'string' || !/^[a-f\d]{64}$/.test(sample.inputSha256)
          || !isArtifactEvidence(artifact)) {
          throw new Error(`Missing HMR timing, memory, source or artifact evidence: ${scenario.id}/${phase}`)
        }
        run.samples.push({
          id: `hmr:${input.id}:${scenario.id}:${index ? 'repeat' : 'first'}:${phase}`,
          wallMs: sample.wallMs,
          rssBytes: sample.rssBytes,
          heapBytes: typeof sample.heapUsedBytes === 'number' ? sample.heapUsedBytes : null,
          inputDigest: sha256(`${inputDigest}:${sample.inputSha256}`),
          output: artifact as unknown as Evidence,
          warnings,
        })
      }
    }
  }
}

export async function collectHmr(options: Options, input: Input, run: Run, project: string, directory: string, inputDigest: string) {
  assertCollectionActive(options)
  const workspace = path.join(options.output, '.workspace/hmr')
  await runCollector(process.execPath, ['--import', 'tsx', 'scripts/benchmark-templates-hmr.ts'], {
    cwd: options.root,
    logFile: path.join(directory, 'collector.log'),
    timeoutMs: 15 * 60_000,
    env: hmrEnvironment(options, input, run, project, directory, workspace),
    redact: [project, options.root, options.output],
  })
  const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8')) as unknown
  const log = await readFile(path.join(directory, 'logs', `${input.id}.dev.log`), 'utf8')
  parseHmrEvidence(report, input, run, inputDigest, warningEvidence(log, [workspace, project, options.root]))
}
