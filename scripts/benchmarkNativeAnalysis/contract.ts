import type { PeakRssSamplingStats } from '../benchmarkTemplatesPerformance/peakRssSampler'
import type { NativeProcessObservation } from './diagnosticObservation'
import path from 'node:path'
import process from 'node:process'

export const CONTRACT = 'native-analysis-paired-v1'
export const TARGET = 'build:weapp-vite-tailwindcss-tdesign-template:repeat:wall'
export const INPUTS = [
  { id: 'weapp-vite-template', source: 'templates/weapp-vite-template', dependencies: 'templates/weapp-vite-template', build: true, scenarios: ['native-page-script', 'native-page-template', 'native-page-style'] },
  { id: 'weapp-vite-wevu-template', source: 'templates/weapp-vite-wevu-template', dependencies: 'templates/weapp-vite-wevu-template', build: true, scenarios: ['vue-page-script', 'vue-page-template', 'vue-page-style'] },
  { id: 'weapp-vite-tailwindcss-tdesign-template', source: 'templates/weapp-vite-tailwindcss-tdesign-template', dependencies: 'templates/weapp-vite-tailwindcss-tdesign-template', build: true, scenarios: ['native-page-script', 'native-page-template', 'native-page-style'] },
  { id: 'issue-1134-profile', source: 'e2e-apps/github-issues/fixtures/issue-1134-profile', dependencies: 'e2e-apps/github-issues', build: false, scenarios: ['component-topology-json', 'route-topology-json'] },
] as const
export type Input = typeof INPUTS[number]
export type Side = 'off' | 'on'
export interface Options {
  root: string
  output: string
  nativePath: string
  mode: 'smoke' | 'full'
  runtime: 'classic' | 'stateful-experimental'
  buildPairs: number
  hmrPairs: number
  signal?: AbortSignal
  inputIdentities?: Record<string, string>
}

export function assertCollectionActive(options: Options) {
  if (options.signal?.aborted) {
    throw new Error('Benchmark interrupted; no further collectors will be started')
  }
}
export interface Evidence { digest: string, files: Record<string, string>, maps: number }
export interface Sample {
  id: string
  wallMs: number
  rssBytes: number | null
  rssSampling?: PeakRssSamplingStats
  cliMs?: number | null
  heapBytes?: number | null
  inputDigest: string
  output: Evidence
  warnings: string[]
}
export interface Run {
  input: string
  kind: 'build' | 'hmr'
  side: Side
  pair: number
  batch: 'primary' | 'confirmation'
  marker: string
  inputDigest?: string
  sourceDigest?: string
  samples: Sample[]
  native: {
    calls: number
    failures: number
    processes: number
    inputs?: number
    inputBytes?: number
    expectedProcessIds?: number[]
    observation?: NativeProcessObservation
    coverage?: 'exercised' | 'not-exercised'
  }
  error?: string
}

/** 正式轮数与目标固定；冒烟不能借助缩短轮次获得正式性能结论。 */
export function parseOptions(args: string[]): Options {
  args = args.flatMap(arg => arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg])
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]!
    const value = args[index + 1]
    if (!['--repo', '--output', '--native-path', '--mode', '--runtime', '--smoke-pairs'].includes(key) || !value || value.startsWith('--') || values.has(key)) {
      throw new Error(`Invalid or duplicate benchmark option: ${key}`)
    }
    values.set(key, value)
  }
  const mode = values.get('--mode') ?? 'smoke'
  const runtime = values.get('--runtime') ?? 'classic'
  const smokePairs = Number(values.get('--smoke-pairs') ?? '2')
  if (!['smoke', 'full'].includes(mode) || !['classic', 'stateful-experimental'].includes(runtime)
    || !Number.isInteger(smokePairs) || smokePairs < 2 || (mode === 'full' && values.has('--smoke-pairs'))
    || !values.get('--output') || !values.get('--native-path')) {
    throw new Error('Require output/native-path, a valid mode/runtime, and at least two smoke pairs')
  }
  return {
    root: path.resolve(values.get('--repo') ?? process.cwd()),
    output: path.resolve(values.get('--output')!),
    nativePath: path.resolve(values.get('--native-path')!),
    mode: mode as Options['mode'],
    runtime: runtime as Options['runtime'],
    buildPairs: mode === 'full' ? 7 : smokePairs,
    hmrPairs: mode === 'full' ? 20 : smokePairs,
  }
}

/** 每对反转先后顺序，两侧共用相同输入标记和工作目录。 */
export function sideOrder(pair: number): Side[] {
  return pair % 2 ? ['on', 'off'] : ['off', 'on']
}

export function expectedSamples(input: Input, kind: Run['kind']) {
  return kind === 'build'
    ? ['first', 'repeat'].map(phase => `build:${input.id}:${phase}`)
    : input.scenarios.flatMap(scenario => ['first', 'repeat'].flatMap(cycle => ['edit', 'restore'].map(phase => `hmr:${input.id}:${scenario}:${cycle}:${phase}`)))
}
