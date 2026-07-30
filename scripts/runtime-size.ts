import type { BuildOptions } from 'esbuild'
import type { RuntimeSizeEntryKind, RuntimeSizeTarget, RuntimeSizeTier } from './runtime-size-config'

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { RUNTIME_SIZE_REPORT_VERSION, runtimeSizeTargets, runtimeSizeTiers } from './runtime-size-config'

export type { RuntimeSizeEntryKind, RuntimeSizeTarget, RuntimeSizeTier } from './runtime-size-config'
export { RUNTIME_SIZE_REPORT_VERSION, runtimeSizeTargets, runtimeSizeTiers } from './runtime-size-config'

export interface RuntimeSizeMeasurement {
  bytes: number
  gzipBytes?: number
}

export interface RuntimeSizeTargetReport {
  id: RuntimeSizeTarget['id']
  label: string
  tiers: RuntimeSizeTierReport[]
}

export interface RuntimeSizeTierReport {
  id: RuntimeSizeTier['id']
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
  tier: RuntimeSizeTier
  mode: 'development' | 'production'
}

function createProviderEntry(target: RuntimeSizeTarget, tier: RuntimeSizeTier) {
  if (!tier.imports) {
    const entries = Object.values(target.entries)
    return entries
      .map((entry, index) => `import * as provider${index} from ${JSON.stringify(entry)}`)
      .concat(`export { ${entries.map((_, index) => `provider${index}`).join(', ')} }`)
      .join('\n')
  }

  const targetImports = tier.targetImports?.[target.id]
  const imports = (Object.keys(target.entries) as RuntimeSizeEntryKind[]).flatMap((kind) => {
    const names = [...new Set([...(tier.imports[kind] ?? []), ...(targetImports?.[kind] ?? [])])]
    return names.length > 0 ? [{ kind, names }] : []
  }).map(({ kind, names }, entryIndex) => {
    const aliases = names.map(name => `${name} as tier${entryIndex}_${name}`)
    return {
      statement: `import { ${aliases.join(', ')} } from ${JSON.stringify(target.entries[kind as RuntimeSizeEntryKind])}`,
      exports: names.map(name => `tier${entryIndex}_${name}`),
    }
  })
  return imports
    .map(entry => entry.statement)
    .concat(`export { ${imports.flatMap(entry => entry.exports).join(', ')} }`)
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
      contents: createProviderEntry(options.target, options.tier),
      loader: 'js',
      resolveDir: options.root,
      sourcefile: `wevu-runtime-size-${options.target.id}-${options.tier.id}-${options.mode}.mjs`,
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
    const tiers: RuntimeSizeTierReport[] = []
    for (const tier of runtimeSizeTiers) {
      const devOutput = await bundle({ root: options.root, target, tier, mode: 'development' })
      const productionOutput = await bundle({ root: options.root, target, tier, mode: 'production' })
      tiers.push({
        id: tier.id,
        label: tier.label,
        dev: { bytes: devOutput.byteLength },
        production: {
          bytes: productionOutput.byteLength,
          ...(target.gzip ? { gzipBytes: gzipSync(productionOutput, { level: 9 }).byteLength } : {}),
        },
      })
    }
    targets.push({
      id: target.id,
      label: target.label,
      tiers,
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
  const fullProviderId: RuntimeSizeTier['id'] = 'full-provider'
  const lines = [
    '## wevu 运行时体积',
    '',
    '### 完整 Provider 能力上限',
    '',
    '| 端 | Dev 未压缩 | Production 压缩 | Production gzip |',
    '| --- | ---: | ---: | ---: |',
  ]

  for (const target of current.targets) {
    const baselineTarget = baselineById.get(target.id)
    const tier = target.tiers.find(candidate => candidate.id === fullProviderId)!
    const baselineTier = baselineTarget?.tiers.find(candidate => candidate.id === fullProviderId)
    const gzip = tier.production.gzipBytes === undefined
      ? '不适用'
      : renderMeasurement(tier.production.gzipBytes, baselineTier?.production.gzipBytes)
    lines.push(`| ${target.label} | ${renderMeasurement(tier.dev.bytes, baselineTier?.dev.bytes)} | ${renderMeasurement(tier.production.bytes, baselineTier?.production.bytes)} | ${gzip} |`)
  }

  lines.push('', '### 正常 Tree-shaking 阶梯')
  for (const target of current.targets) {
    const baselineTarget = baselineById.get(target.id)
    lines.push(
      '',
      `#### ${target.label}`,
      '',
      '| 阶梯 | Dev 未压缩 | Production 压缩 | Production gzip |',
      '| --- | ---: | ---: | ---: |',
    )
    for (const tier of target.tiers) {
      const baselineTier = baselineTarget?.tiers.find(candidate => candidate.id === tier.id)
      const gzip = tier.production.gzipBytes === undefined
        ? '不适用'
        : renderMeasurement(tier.production.gzipBytes, baselineTier?.production.gzipBytes)
      lines.push(`| ${tier.label} | ${renderMeasurement(tier.dev.bytes, baselineTier?.dev.bytes)} | ${renderMeasurement(tier.production.bytes, baselineTier?.production.bytes)} | ${gzip} |`)
    }
  }

  lines.push(
    '',
    ...runtimeSizeTiers.map(tier => `- **${tier.label}**：${tier.description}`),
    '',
    `- 当前 commit：\`${current.commit}\``,
    ...(baseline ? [`- 对比基线：\`${baseline.commit}\``] : []),
    '- 阶梯使用具名导入模拟正常 tree-shaking；完整 Provider 行表示全部能力上限。',
    '- Web 最小应用包含 app 注册桥；典型页面及以上同时包含组件/页面注册桥。',
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
