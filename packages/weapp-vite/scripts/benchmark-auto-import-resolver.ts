/* eslint-disable ts/no-use-before-define */
import type { ResolvedConfig } from 'vite'
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'
import { VantResolver } from '../src/auto-import-components/resolvers'
import { resetCompilerContext } from '../src/context/getInstance'
import { createCompilerContext } from '../src/createContext'
import { findAutoImportCandidates } from '../src/plugins/autoImport'
import { collectVueTemplateAutoImportTags } from '../src/plugins/hooks/useLoadEntry/loadEntry/template'
import { getAutoImportConfig } from '../src/runtime/autoImport/config'
import { syncManagedTsconfigFiles } from '../src/runtime/tsconfigSupport'
import { scanWxml } from '../src/wxml'

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? '5', 10)
const fixtureSource = path.resolve(import.meta.dirname, '../../../test/fixture-projects/weapp-vite/auto-import')
const workspaceWeappViteDir = path.resolve(import.meta.dirname, '..')
const reportDir = path.resolve(
  import.meta.dirname,
  '../benchmark/auto-import-resolver',
  formatTimestamp(new Date()),
)
const reportJsonPath = path.join(reportDir, 'report.json')
const reportMdPath = path.join(reportDir, 'report.md')
const scenarios = [1, 5, 20] as const
const allResolverEntries = Object.entries(VantResolver().components ?? {}).sort(([a], [b]) => a.localeCompare(b))

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error(`Invalid BENCH_ITERATIONS value: ${iterations}`)
}

async function main() {
  console.log(`[auto-import-bench] iterations=${iterations}`)
  console.log(`[auto-import-bench] total resolver components=${allResolverEntries.length}`)

  const results = []
  for (const usedCount of scenarios) {
    const scenarioResult = await runScenario(usedCount)
    results.push(scenarioResult)
    printScenarioResult(scenarioResult)
  }

  await mkdir(reportDir, { recursive: true })
  await writeFile(reportJsonPath, JSON.stringify({
    iterations,
    generatedAt: new Date().toISOString(),
    totalResolverComponents: allResolverEntries.length,
    results,
  }, null, 2))
  await writeFile(reportMdPath, renderMarkdown(results), 'utf8')

  console.log(`[auto-import-bench] report.json -> ${reportJsonPath}`)
  console.log(`[auto-import-bench] report.md -> ${reportMdPath}`)
}

async function runScenario(usedCount: number) {
  const tags = allResolverEntries.slice(0, usedCount).map(([tag]) => tag)
  const currentSamples = []
  const legacySamples = []

  for (let i = 0; i < iterations; i += 1) {
    currentSamples.push(await measureScenario({
      usedTags: tags,
      mode: 'current',
      iteration: i,
    }))
    legacySamples.push(await measureScenario({
      usedTags: tags,
      mode: 'legacy',
      iteration: i,
    }))
  }

  const current = summarizeSamples(currentSamples)
  const legacy = summarizeSamples(legacySamples)

  return {
    usedCount,
    current,
    legacy,
    speedup: {
      ratio: legacy.duration.mean > 0 ? legacy.duration.mean / current.duration.mean : 0,
      savedMs: legacy.duration.mean - current.duration.mean,
      savedPercent: legacy.duration.mean > 0
        ? ((legacy.duration.mean - current.duration.mean) / legacy.duration.mean) * 100
        : 0,
    },
  }
}

async function measureScenario(options: {
  usedTags: string[]
  mode: 'current' | 'legacy'
  iteration: number
}) {
  const { usedTags, mode, iteration } = options
  const project = await createTempFixtureProject(
    fixtureSource,
    `auto-import-bench-${mode}-${usedTags.length}-${iteration}`,
  )
  const key = `auto-import-bench-${mode}-${usedTags.length}-${iteration}-${Date.now()}`

  try {
    await seedFixture(project.tempDir, usedTags)
    const ctx = await createCompilerContext({
      cwd: project.tempDir,
      key,
      syncSupportFiles: false,
    })

    try {
      const start = performance.now()
      if (mode === 'current') {
        await syncSupportFilesCurrent(ctx)
      }
      else {
        await syncSupportFilesLegacy(ctx)
      }
      const durationMs = performance.now() - start
      const outputs = await readOutputs(project.tempDir)

      return {
        durationMs,
        manifestComponentCount: Object.keys(outputs.manifest).length,
        typedComponentCount: countTypedComponents(outputs.typedDefinition),
        vueComponentCount: countVueComponents(outputs.vueDefinition),
      }
    }
    finally {
      ctx.watcherService?.closeAll()
      resetCompilerContext(key)
    }
  }
  finally {
    await project.cleanup()
  }
}

async function seedFixture(projectRoot: string, usedTags: string[]) {
  const pageDir = path.join(projectRoot, 'src/pages/bench-auto-import')
  const pagePath = path.join(pageDir, 'index.vue')
  const viteConfigPath = path.join(projectRoot, 'vite.config.ts')
  const tags = usedTags
    .map(tag => `    <${tag} data-bench="${tag}" />`)
    .join('\n')

  const viteConfig = await readFile(viteConfigPath, 'utf8')
  const nextViteConfig = viteConfig.replace(
    'globs: [\'components/**/*\'],',
    [
      'globs: [\'components/**/*\'],',
      '        typedComponents: true,',
      '        vueComponents: true,',
      '        htmlCustomData: true,',
    ].join('\n'),
  )
  if (nextViteConfig === viteConfig) {
    throw new Error(`Failed to patch benchmark vite config: ${viteConfigPath}`)
  }

  await mkdir(pageDir, { recursive: true })
  await writeFile(viteConfigPath, nextViteConfig, 'utf8')
  await writeFile(
    pagePath,
    [
      '<template>',
      '  <view class="bench-auto-import">',
      tags,
      '  </view>',
      '</template>',
      '',
      '<json>',
      '{',
      '  "navigationBarTitleText": "Auto Import Bench"',
      '}',
      '</json>',
      '',
    ].join('\n'),
    'utf8',
  )
}

async function ensureWorkspacePackageLink(projectRoot: string) {
  const projectNodeModulesDir = path.join(projectRoot, 'node_modules')
  const packageRoot = path.join(projectNodeModulesDir, 'weapp-vite')
  const existingStat = await lstat(packageRoot).catch(() => null)

  if (existingStat?.isSymbolicLink()) {
    const currentTarget = await readlink(packageRoot).catch(() => '')
    if (path.resolve(projectNodeModulesDir, currentTarget) === workspaceWeappViteDir) {
      return
    }
  }

  if (existingStat) {
    await rm(packageRoot, { recursive: true, force: true })
  }

  await mkdir(projectNodeModulesDir, { recursive: true })
  await symlink(path.relative(projectNodeModulesDir, workspaceWeappViteDir), packageRoot, 'junction')
}

async function createTempFixtureProject(
  sourceRoot: string,
  prefix: string,
) {
  const tempRoot = path.resolve(sourceRoot, '..', '__temp__')
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, `${prefix}-`))
  const ignored = new Set(['.weapp-vite', 'dist', 'node_modules'])

  await cp(sourceRoot, tempDir, {
    dereference: true,
    force: true,
    recursive: true,
    filter: (src) => {
      const relative = path.relative(sourceRoot, src).replaceAll('\\', '/')
      if (!relative) {
        return true
      }
      return !Array.from(ignored).some(entry => relative === entry || relative.startsWith(`${entry}/`))
    },
  })

  await ensureWorkspacePackageLink(tempDir)

  return {
    tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
      const remaining = await readdir(tempRoot).catch(() => null)
      if (remaining && remaining.length === 0) {
        await rm(tempRoot, { recursive: true, force: true })
      }
    },
  }
}

async function syncSupportFilesCurrent(ctx: Awaited<ReturnType<typeof createCompilerContext>>) {
  await syncManagedTsconfigFiles(ctx)

  const autoImportConfig = getAutoImportConfig(ctx.configService)
  if (!autoImportConfig || !ctx.autoImportService || !ctx.configService) {
    return
  }

  ctx.autoImportService.reset()
  await registerPotentialComponents(ctx, autoImportConfig.globs)
  const templateTags = await collectTemplateAutoImportTags(ctx)
  for (const { tag, importerBaseName } of templateTags) {
    ctx.autoImportService.resolve(tag, importerBaseName)
  }
  await ctx.autoImportService.awaitManifestWrites()
}

async function syncSupportFilesLegacy(ctx: Awaited<ReturnType<typeof createCompilerContext>>) {
  await syncManagedTsconfigFiles(ctx)

  const autoImportConfig = getAutoImportConfig(ctx.configService)
  if (!autoImportConfig || !ctx.autoImportService || !ctx.configService) {
    return
  }

  ctx.autoImportService.reset()
  await registerPotentialComponents(ctx, autoImportConfig.globs)

  for (const resolver of autoImportConfig.resolvers ?? []) {
    for (const name of Object.keys(resolver.components ?? {})) {
      ctx.autoImportService.resolve(name)
    }
  }

  await ctx.autoImportService.awaitManifestWrites()
}

async function registerPotentialComponents(
  ctx: Awaited<ReturnType<typeof createCompilerContext>>,
  globs: string[] | undefined,
) {
  if (!Array.isArray(globs) || globs.length === 0) {
    return
  }

  const files = await findAutoImportCandidates({
    ctx,
    resolvedConfig: {
      build: {
        outDir: ctx.configService.outDir,
      },
    } as ResolvedConfig,
  }, globs)

  await Promise.all(files.map(file => ctx.autoImportService!.registerPotentialComponent(file)))
}

async function collectTemplateAutoImportTags(ctx: Awaited<ReturnType<typeof createCompilerContext>>) {
  const srcRoot = ctx.configService?.absoluteSrcRoot
  if (!srcRoot) {
    return [] as Array<{ tag: string, importerBaseName: string }>
  }

  const files = await new Fdir({
    includeDirs: false,
    pathSeparator: '/',
  })
    .withFullPaths()
    .filter(filePath => filePath.endsWith('.vue') || filePath.endsWith('.wxml'))
    .crawl(srcRoot)
    .withPromise()

  const tags = new Map<string, string>()
  const platform = ctx.configService.platform ?? 'weapp'

  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8').catch(() => undefined)
    if (!source) {
      continue
    }

    if (filePath.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename: filePath })
      if (errors.length > 0 || !descriptor.template?.content) {
        continue
      }
      for (const tag of collectVueTemplateAutoImportTags(descriptor.template.content, filePath)) {
        tags.set(tag, removeExtensionDeep(filePath))
      }
      continue
    }

    for (const tag of Object.keys(scanWxml(source, { platform }).components)) {
      tags.set(tag, removeExtensionDeep(filePath))
    }
  }

  return Array.from(tags.entries(), ([tag, importerBaseName]) => ({ tag, importerBaseName }))
}

async function readOutputs(projectRoot: string) {
  const baseDir = path.join(projectRoot, '.weapp-vite')
  const [manifestRaw, typedDefinition, vueDefinition] = await Promise.all([
    readFile(path.join(baseDir, 'auto-import-components.json'), 'utf8').catch(() => '{}'),
    readFile(path.join(baseDir, 'typed-components.d.ts'), 'utf8').catch(() => ''),
    readFile(path.join(baseDir, 'components.d.ts'), 'utf8').catch(() => ''),
  ])

  return {
    manifest: JSON.parse(manifestRaw) as Record<string, string>,
    typedDefinition,
    vueDefinition,
  }
}

function countTypedComponents(source: string) {
  return Array.from(source.matchAll(/^ {4}(?:'[^']+'|[\w-]+): /gm)).length
}

function countVueComponents(source: string) {
  return Array.from(source.matchAll(/^ {4}(?:'[^']+'|[\w-]+): /gm)).length
}

function summarizeSamples(samples: Array<{
  durationMs: number
  manifestComponentCount: number
  typedComponentCount: number
  vueComponentCount: number
}>) {
  return {
    duration: summarizeNumbers(samples.map(sample => sample.durationMs)),
    manifestComponentCount: summarizeNumbers(samples.map(sample => sample.manifestComponentCount)),
    typedComponentCount: summarizeNumbers(samples.map(sample => sample.typedComponentCount)),
    vueComponentCount: summarizeNumbers(samples.map(sample => sample.vueComponentCount)),
  }
}

function summarizeNumbers(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const total = values.reduce((sum, value) => sum + value, 0)
  const mid = Math.floor(sorted.length / 2)
  return {
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
    mean: values.length ? total / values.length : 0,
    median: sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0),
  }
}

function printScenarioResult(result: Awaited<ReturnType<typeof runScenario>>) {
  console.log(`\n[scenario] used resolver components=${result.usedCount}`)
  console.log(
    [
      'current',
      `avg ${result.current.duration.mean.toFixed(2)}ms`,
      `manifest ${result.current.manifestComponentCount.mean.toFixed(0)}`,
      `typed ${result.current.typedComponentCount.mean.toFixed(0)}`,
      `vue ${result.current.vueComponentCount.mean.toFixed(0)}`,
    ].join(' | '),
  )
  console.log(
    [
      'legacy',
      `avg ${result.legacy.duration.mean.toFixed(2)}ms`,
      `manifest ${result.legacy.manifestComponentCount.mean.toFixed(0)}`,
      `typed ${result.legacy.typedComponentCount.mean.toFixed(0)}`,
      `vue ${result.legacy.vueComponentCount.mean.toFixed(0)}`,
    ].join(' | '),
  )
  console.log(
    [
      'delta',
      `saved ${result.speedup.savedMs.toFixed(2)}ms`,
      `saved ${result.speedup.savedPercent.toFixed(2)}%`,
      `speedup ${result.speedup.ratio.toFixed(2)}x`,
    ].join(' | '),
  )
}

function renderMarkdown(results: Array<Awaited<ReturnType<typeof runScenario>>>) {
  const lines = [
    '# autoImportComponents + VantResolver benchmark',
    '',
    `- iterations: \`${iterations}\``,
    `- total resolver components: \`${allResolverEntries.length}\``,
    '',
    '| 场景 | current avg | legacy avg | 平均节省 | 平均提速 | current manifest | legacy manifest |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]

  for (const result of results) {
    lines.push(
      `| 使用 ${result.usedCount} 个 Vant 组件 | ${result.current.duration.mean.toFixed(2)} ms | ${result.legacy.duration.mean.toFixed(2)} ms | ${result.speedup.savedMs.toFixed(2)} ms (${result.speedup.savedPercent.toFixed(2)}%) | ${result.speedup.ratio.toFixed(2)}x | ${result.current.manifestComponentCount.mean.toFixed(0)} | ${result.legacy.manifestComponentCount.mean.toFixed(0)} |`,
    )
  }

  lines.push('')
  lines.push('## 说明')
  lines.push('')
  lines.push('- `current`：仅为模板中实际命中的 resolver 组件生成支持文件。')
  lines.push('- `legacy`：模拟旧行为，在支持文件同步阶段预热全部 resolver 组件。')
  lines.push('- 两种模式都基于同一份临时 fixture、同一组模板标签与相同的 autoImport 配置。')
  lines.push('')

  return `${lines.join('\n')}\n`
}

function formatTimestamp(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

void main().catch(async (error) => {
  console.error(error)
  await rm(reportDir, { recursive: true, force: true }).catch(() => undefined)
  process.exitCode = 1
})
