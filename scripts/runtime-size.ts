import type { BuildOptions } from 'esbuild'

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

export const RUNTIME_SIZE_REPORT_VERSION = 1 as const

export interface RuntimeSizeTarget {
  id: 'weapp' | 'web'
  label: string
  platform: 'weapp' | 'web'
  entries: readonly string[]
  gzip: boolean
}

export interface RuntimeSizeMeasurement {
  bytes: number
  gzipBytes?: number
}

export interface RuntimeSizeTargetReport {
  id: RuntimeSizeTarget['id']
  label: string
  dev: RuntimeSizeMeasurement
  production: RuntimeSizeMeasurement
}

export interface RuntimeSizeReport {
  version: typeof RUNTIME_SIZE_REPORT_VERSION
  generatedAt: string
  commit: string
  targets: RuntimeSizeTargetReport[]
}

export interface RuntimeSizePrArtifact {
  version: typeof RUNTIME_SIZE_REPORT_VERSION
  kind: 'wevu-runtime-size-pr-report'
  repository: string
  prNumber: number
  headSha: string
  baseSha: string
  current: RuntimeSizeReport
  baseline: RuntimeSizeReport
}

interface CollectRuntimeSizeOptions {
  root: string
  commit: string
  generatedAt?: string
  bundle?: typeof bundleRuntimeTarget
}

interface BundleRuntimeTargetOptions {
  root: string
  target: RuntimeSizeTarget
  mode: 'development' | 'production'
}

export const runtimeSizeTargets: readonly RuntimeSizeTarget[] = [
  {
    id: 'weapp',
    label: '微信小程序',
    platform: 'weapp',
    entries: [
      'wevu/internal-runtime',
      'wevu/internal-reactivity',
      'wevu/internal-template',
    ],
    gzip: false,
  },
  {
    id: 'web',
    label: 'Web',
    platform: 'web',
    entries: [
      '@weapp-vite/web/runtime',
      'wevu/internal-reactivity',
      'wevu/internal-template',
    ],
    gzip: true,
  },
] as const

function createProviderEntry(entries: readonly string[]) {
  return entries
    .map((entry, index) => `import * as provider${index} from ${JSON.stringify(entry)}`)
    .concat(`export { ${entries.map((_, index) => `provider${index}`).join(', ')} }`)
    .join('\n')
}

export function createRuntimeSizeBuildOptions(options: BundleRuntimeTargetOptions): BuildOptions {
  const isDev = options.mode === 'development'
  const isWeb = options.target.platform === 'web'
  return {
    absWorkingDir: options.root,
    bundle: true,
    conditions: isDev ? ['development'] : [],
    define: {
      'import.meta.env.DEV': JSON.stringify(isDev),
      'import.meta.env.IS_MINIPROGRAM': JSON.stringify(!isWeb),
      'import.meta.env.IS_WEB': JSON.stringify(isWeb),
      'import.meta.env.MODE': JSON.stringify(options.mode),
      'import.meta.env.MP_PLATFORM': JSON.stringify(options.target.platform),
      'import.meta.env.PLATFORM': JSON.stringify(options.target.platform),
      'import.meta.env.PROD': JSON.stringify(!isDev),
      'process.env.NODE_ENV': JSON.stringify(options.mode),
    },
    format: 'esm',
    legalComments: 'none',
    logLevel: 'silent',
    minify: !isDev,
    platform: 'browser',
    sourcemap: false,
    stdin: {
      contents: createProviderEntry(options.target.entries),
      loader: 'js',
      resolveDir: options.root,
      sourcefile: `wevu-runtime-size-${options.target.id}-${options.mode}.mjs`,
    },
    target: 'es2018',
    treeShaking: true,
    write: false,
  }
}

export async function bundleRuntimeTarget(options: BundleRuntimeTargetOptions): Promise<Uint8Array> {
  const result = await build(createRuntimeSizeBuildOptions(options))
  const output = result.outputFiles?.[0]
  if (!output) {
    throw new Error(`Runtime size bundle did not emit output for ${options.target.id}/${options.mode}.`)
  }
  return output.contents
}

export async function collectRuntimeSizeReport(options: CollectRuntimeSizeOptions): Promise<RuntimeSizeReport> {
  const bundle = options.bundle ?? bundleRuntimeTarget
  const targets: RuntimeSizeTargetReport[] = []

  for (const target of runtimeSizeTargets) {
    const devOutput = await bundle({ root: options.root, target, mode: 'development' })
    const productionOutput = await bundle({ root: options.root, target, mode: 'production' })
    targets.push({
      id: target.id,
      label: target.label,
      dev: {
        bytes: devOutput.byteLength,
      },
      production: {
        bytes: productionOutput.byteLength,
        ...(target.gzip ? { gzipBytes: gzipSync(productionOutput, { level: 9 }).byteLength } : {}),
      },
    })
  }

  return {
    version: RUNTIME_SIZE_REPORT_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    commit: options.commit,
    targets,
  }
}

export function formatBytes(bytes: number) {
  const sign = bytes < 0 ? '-' : ''
  const absolute = Math.abs(bytes)
  if (absolute < 1024) {
    return `${sign}${absolute} B`
  }
  const units = ['KiB', 'MiB', 'GiB']
  let value = absolute
  let unitIndex = -1
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${sign}${value.toFixed(2)} ${units[unitIndex]}`
}

function formatDelta(current: number, baseline: number) {
  const delta = current - baseline
  const sign = delta > 0 ? '+' : ''
  const percent = baseline === 0 ? undefined : delta / baseline * 100
  const percentText = percent === undefined ? 'n/a' : `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`
  return `${formatBytes(current)} (${sign}${formatBytes(delta)}, ${percentText})`
}

function renderMeasurement(current: number, baseline: number | undefined) {
  return baseline === undefined ? formatBytes(current) : formatDelta(current, baseline)
}

export function renderRuntimeSizeMarkdown(current: RuntimeSizeReport, baseline?: RuntimeSizeReport) {
  const baselineById = new Map(baseline?.targets.map(target => [target.id, target]))
  const lines = [
    '## wevu 运行时体积',
    '',
    '| 端 | Dev 未压缩 | Production 压缩 | Production gzip |',
    '| --- | ---: | ---: | ---: |',
  ]

  for (const target of current.targets) {
    const baselineTarget = baselineById.get(target.id)
    const gzip = target.production.gzipBytes === undefined
      ? '不适用'
      : renderMeasurement(target.production.gzipBytes, baselineTarget?.production.gzipBytes)
    lines.push(`| ${target.label} | ${renderMeasurement(target.dev.bytes, baselineTarget?.dev.bytes)} | ${renderMeasurement(target.production.bytes, baselineTarget?.production.bytes)} | ${gzip} |`)
  }

  lines.push(
    '',
    `- 当前 commit：\`${current.commit}\``,
    ...(baseline ? [`- 对比基线：\`${baseline.commit}\``] : []),
    '- 统计完整 runtime provider 的能力上限，不等同于业务应用 tree-shaking 后的起步体积。',
    '- 小程序仅统计产物字节；Web gzip 使用 level 9。',
    '',
  )
  return lines.join('\n')
}

export async function readRuntimeSizeReport(file: string): Promise<RuntimeSizeReport> {
  return JSON.parse(await readFile(file, 'utf8')) as RuntimeSizeReport
}

export async function writeJson(file: string, value: unknown) {
  await writeFile(path.resolve(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function createRuntimeSizePrArtifact(options: {
  repository: string
  prNumber: number
  headSha: string
  baseSha: string
  current: RuntimeSizeReport
  baseline: RuntimeSizeReport
}): RuntimeSizePrArtifact {
  return {
    version: RUNTIME_SIZE_REPORT_VERSION,
    kind: 'wevu-runtime-size-pr-report',
    ...options,
  }
}
