import type { BuildOptions } from 'esbuild'
import type { RuntimeSizeEntryKind, RuntimeSizeTarget, RuntimeSizeTier } from './runtime-size-config'

import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import {
  RUNTIME_SIZE_REPORT_VERSION,
  runtimeSizeTargets,
  runtimeSizeTiers,
} from './runtime-size-config'
import { createRuntimeSizeRetainedModules } from './runtime-size/modules'

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
export { assertRuntimeSizeReport, collectRuntimeSizeGuardViolations, formatRuntimeSizeGuardError } from './runtime-size/guards'

export { createRuntimeSizeRetainedModules, normalizeRuntimeModulePath, resolveRuntimeImportChain } from './runtime-size/modules'
export { createRuntimeSizeLegacyArtifact, createRuntimeSizePrArtifact, formatBytes, readRuntimeSizeReport, renderRuntimeSizeMarkdown, writeJson } from './runtime-size/report'

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

function createProviderEntry(target: RuntimeSizeTarget, tier: RuntimeSizeTier) {
  if (!tier.imports) {
    const entries = Object.values(target.entries)
    return entries
      .map((entry, index) => `import * as provider${index} from ${JSON.stringify(entry)}`)
      .concat(`export { ${entries.map((_, index) => `provider${index}`).join(', ')} }`)
      .join('\n')
  }

  if (tier.publicEntry) {
    const names = [...new Set(Object.values(tier.imports).flat())]
    const bridges = tier.targetImports?.[target.id]?.runtime ?? []
    return [
      `import { ${names.map(name => `${name} as public_${name}`).join(', ')} } from "wevu"`,
      ...(bridges.length ? [`import { ${bridges.join(', ')} } from ${JSON.stringify(target.entries.runtime)}`] : []),
      `export { ${[...names.map(name => `public_${name}`), ...bridges].join(', ')} }`,
    ].join('\n')
  }

  const requestedImports = tier.imports
  const targetImports = tier.targetImports?.[target.id]
  const imports = (Object.keys(target.entries) as RuntimeSizeEntryKind[]).flatMap((kind) => {
    const names = [...new Set([...(requestedImports[kind] ?? []), ...(targetImports?.[kind] ?? [])])]
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
