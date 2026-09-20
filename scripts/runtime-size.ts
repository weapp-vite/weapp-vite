import type { BuildOptions, Metafile } from 'esbuild'
import type { RuntimeSizeEntryKind, RuntimeSizeTarget, RuntimeSizeTier } from './runtime-size-config'

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import {
  RUNTIME_SIZE_REPORT_VERSION,
  runtimeSizeBudgets,
  runtimeSizeDenyRules,
  runtimeSizeTargets,
  runtimeSizeTiers,
} from './runtime-size-config'

export type {
  RuntimeSizeBudget,
  RuntimeSizeDenyRule,
  RuntimeSizeEntryKind,
  RuntimeSizeTarget,
  RuntimeSizeTier,
} from './runtime-size-config'
export {
  RUNTIME_SIZE_REPORT_VERSION,
  runtimeSizeBudgets,
  runtimeSizeDenyRules,
  runtimeSizeTargets,
  runtimeSizeTiers,
} from './runtime-size-config'

export interface RuntimeSizeMeasurement {
  bytes: number
  gzipBytes?: number
}

export interface RuntimeSizeRetainedModule {
  path: string
  bytesInOutput: number
  imports: string[]
}

export interface RuntimeSizeRetainedModules {
  entry: string
  modules: RuntimeSizeRetainedModule[]
}

export interface RuntimeSizeBundleResult {
  contents: Uint8Array
  retainedModules: RuntimeSizeRetainedModules
}

export interface RuntimeSizeProductionMeasurement extends RuntimeSizeMeasurement {
  retainedModules: RuntimeSizeRetainedModules
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
  production: RuntimeSizeProductionMeasurement
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

export interface CollectRuntimeSizeOptions {
  root: string
  commit: string
  generatedAt?: string
  bundle?: typeof bundleRuntimeTarget
}

export interface BundleRuntimeTargetOptions {
  root: string
  target: RuntimeSizeTarget
  tier: RuntimeSizeTier
  mode: 'development' | 'production'
}

export interface RuntimeSizeBudgetViolation {
  kind: 'budget'
  target: RuntimeSizeTarget['id']
  tier: RuntimeSizeTier['id']
  mode: 'production'
  actualBytes: number
  ceilingBytes: number
}

export interface RuntimeSizeRetainedModuleViolation {
  kind: 'retained-module'
  target: RuntimeSizeTarget['id']
  tier: RuntimeSizeTier['id']
  mode: 'production'
  modulePath: string
  bytesInOutput: number
  importChain: string[]
}

export type RuntimeSizeGuardViolation = RuntimeSizeBudgetViolation | RuntimeSizeRetainedModuleViolation

function compareStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function isPortableAbsolutePath(value: string) {
  return value.startsWith('/') || /^[A-Za-z]:\//u.test(value)
}

function normalizePosixPath(value: string) {
  return path.posix.normalize(value.replaceAll('\\', '/'))
}

export function normalizeRuntimeModulePath(root: string, modulePath: string) {
  const normalizedRootInput = normalizePosixPath(root)
  const normalizedRoot = isPortableAbsolutePath(normalizedRootInput)
    ? normalizedRootInput
    : normalizePosixPath(path.resolve(root))
  const normalizedModule = normalizePosixPath(modulePath)
  if (!isPortableAbsolutePath(normalizedModule)) {
    return normalizedModule.replace(/^\.\//u, '')
  }

  const windowsPath = /^[A-Za-z]:\//u.test(normalizedRoot)
  const comparableRoot = windowsPath ? normalizedRoot.toLowerCase() : normalizedRoot
  const comparableModule = windowsPath ? normalizedModule.toLowerCase() : normalizedModule
  if (comparableModule === comparableRoot) {
    return '.'
  }
  if (comparableModule.startsWith(`${comparableRoot}/`)) {
    return normalizedModule.slice(normalizedRoot.length + 1)
  }
  return path.posix.relative(normalizedRoot, normalizedModule)
}

export function createRuntimeSizeRetainedModules(root: string, metafile: Metafile): RuntimeSizeRetainedModules {
  const output = Object.values(metafile.outputs).find(candidate => candidate.entryPoint)
    ?? Object.values(metafile.outputs)[0]
  if (!output?.entryPoint) {
    throw new Error('Runtime size metafile did not contain an entry output.')
  }

  const retainedInputs = {
    ...output.inputs,
    ...(!(output.entryPoint in output.inputs)
      ? { [output.entryPoint]: { bytesInOutput: 0 } }
      : {}),
  }

  const normalizedPaths = new Map(
    Object.keys(retainedInputs).map(input => [input, normalizeRuntimeModulePath(root, input)]),
  )
  const retainedPaths = new Set(normalizedPaths.values())
  const modules = Object.entries(retainedInputs)
    .map(([input, details]) => {
      const imports = [...new Set(
        (metafile.inputs[input]?.imports ?? [])
          .filter(dependency => !dependency.external)
          .map(dependency => normalizeRuntimeModulePath(root, dependency.path))
          .filter(dependency => retainedPaths.has(dependency)),
      )].sort(compareStrings)
      return {
        path: normalizedPaths.get(input)!,
        bytesInOutput: details.bytesInOutput,
        imports,
      }
    })
    .sort((left, right) => compareStrings(left.path, right.path))

  return {
    entry: normalizeRuntimeModulePath(root, output.entryPoint),
    modules,
  }
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
    metafile: true,
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

export async function bundleRuntimeTarget(options: BundleRuntimeTargetOptions): Promise<RuntimeSizeBundleResult> {
  const result = await build(createRuntimeSizeBuildOptions(options))
  const output = result.outputFiles?.[0]
  if (!output) {
    throw new Error(`Runtime size bundle did not emit output for ${options.target.id}/${options.mode}.`)
  }
  if (!result.metafile) {
    throw new Error(`Runtime size bundle did not emit a metafile for ${options.target.id}/${options.mode}.`)
  }
  return {
    contents: output.contents,
    retainedModules: createRuntimeSizeRetainedModules(options.root, result.metafile),
  }
}

export async function collectRuntimeSizeReport(options: CollectRuntimeSizeOptions): Promise<RuntimeSizeReport> {
  const bundle = options.bundle ?? bundleRuntimeTarget
  const targets: RuntimeSizeTargetReport[] = []

  for (const target of runtimeSizeTargets) {
    const tiers: RuntimeSizeTierReport[] = []
    for (const tier of runtimeSizeTiers) {
      const devBundle = await bundle({ root: options.root, target, tier, mode: 'development' })
      const productionBundle = await bundle({ root: options.root, target, tier, mode: 'production' })
      tiers.push({
        id: tier.id,
        label: tier.label,
        dev: { bytes: devBundle.contents.byteLength },
        production: {
          bytes: productionBundle.contents.byteLength,
          ...(target.gzip ? { gzipBytes: gzipSync(productionBundle.contents, { level: 9 }).byteLength } : {}),
          retainedModules: productionBundle.retainedModules,
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

function findShortestRuntimeImportChain(
  retainedModules: RuntimeSizeRetainedModules,
  modulePath: string,
  includeZeroByteImporters: boolean,
) {
  const modulesByPath = new Map(retainedModules.modules.map(module => [module.path, module]))
  const previous = new Map<string, string | undefined>([[retainedModules.entry, undefined]])
  const queue = [retainedModules.entry]

  for (let index = 0; index < queue.length; index += 1) {
    const importer = queue[index]!
    if (importer === modulePath) {
      const chain: string[] = []
      let current: string | undefined = modulePath
      while (current !== undefined) {
        chain.push(current)
        current = previous.get(current)
      }
      return chain.reverse()
    }

    const imports = [...(modulesByPath.get(importer)?.imports ?? [])].sort(compareStrings)
    for (const imported of imports) {
      const importedModule = modulesByPath.get(imported)
      const isDeadImporter = imported !== modulePath && importedModule?.bytesInOutput === 0
      if (
        !importedModule
        || previous.has(imported)
        || (!includeZeroByteImporters && isDeadImporter)
      ) {
        continue
      }
      previous.set(imported, importer)
      queue.push(imported)
    }
  }
}

export function resolveRuntimeImportChain(
  retainedModules: RuntimeSizeRetainedModules,
  modulePath: string,
): string[] {
  return findShortestRuntimeImportChain(retainedModules, modulePath, false)
    ?? findShortestRuntimeImportChain(retainedModules, modulePath, true)
    ?? [retainedModules.entry, '[no live import path]', modulePath]
}

function moduleMatchesSuffix(modulePath: string, suffix: string) {
  const normalizedSuffix = normalizePosixPath(suffix)
  return modulePath === normalizedSuffix.replace(/^\//u, '') || modulePath.endsWith(normalizedSuffix)
}

export function collectRuntimeSizeGuardViolations(report: RuntimeSizeReport): RuntimeSizeGuardViolation[] {
  const violations: RuntimeSizeGuardViolation[] = []

  for (const budget of runtimeSizeBudgets) {
    const target = report.targets.find(candidate => candidate.id === budget.target)
    const tier = target?.tiers.find(candidate => candidate.id === budget.tier)
    if (tier && tier.production.bytes > budget.ceilingBytes) {
      violations.push({
        kind: 'budget',
        target: budget.target,
        tier: budget.tier,
        mode: budget.mode,
        actualBytes: tier.production.bytes,
        ceilingBytes: budget.ceilingBytes,
      })
    }
  }

  for (const rule of runtimeSizeDenyRules) {
    const target = report.targets.find(candidate => candidate.id === rule.target)
    if (!target) {
      continue
    }
    for (const tier of target.tiers) {
      if (rule.allowedTiers.includes(tier.id)) {
        continue
      }
      for (const module of tier.production.retainedModules.modules) {
        if (module.bytesInOutput <= 0 || !moduleMatchesSuffix(module.path, rule.suffix)) {
          continue
        }
        violations.push({
          kind: 'retained-module',
          target: target.id,
          tier: tier.id,
          mode: rule.mode,
          modulePath: module.path,
          bytesInOutput: module.bytesInOutput,
          importChain: resolveRuntimeImportChain(tier.production.retainedModules, module.path),
        })
      }
    }
  }

  return violations.sort((left, right) => {
    const leftKey = `${left.target}\0${left.tier}\0${left.mode}\0${left.kind === 'budget' ? '0' : `1${left.modulePath}`}`
    const rightKey = `${right.target}\0${right.tier}\0${right.mode}\0${right.kind === 'budget' ? '0' : `1${right.modulePath}`}`
    return compareStrings(leftKey, rightKey)
  })
}

export function formatRuntimeSizeGuardError(violations: readonly RuntimeSizeGuardViolation[]) {
  return [
    `Runtime size guard failed with ${violations.length} violation(s):`,
    ...violations.map((violation) => {
      const scope = `target=${violation.target} tier=${violation.tier} mode=${violation.mode}`
      if (violation.kind === 'budget') {
        return `- ${scope}: actual=${violation.actualBytes} B ceiling=${violation.ceilingBytes} B.`
      }
      return `- ${scope}: retained denied module=${violation.modulePath} bytes=${violation.bytesInOutput} B chain=${violation.importChain.join(' -> ')}.`
    }),
  ].join('\n')
}

export function assertRuntimeSizeReport(report: RuntimeSizeReport) {
  const violations = collectRuntimeSizeGuardViolations(report)
  if (violations.length > 0) {
    throw new Error(formatRuntimeSizeGuardError(violations))
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
