/* eslint-disable ts/no-use-before-define */
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import vantComponents from '../src/auto-import-components/resolvers/json/vant.json'
import { createCompilerContext } from '../src/createContext'
import { resolveWorkspaceNodeModulesDir } from '../src/utils/workspace'

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? '1', 10)
const scenarioValues = parseScenarioValues(process.env.BENCH_SCENARIOS)
const fixtureSource = path.resolve(import.meta.dirname, '../../../test/fixture-projects/weapp-vite/auto-import')
const workspaceRootNodeModulesDir = resolveWorkspaceNodeModulesDir(import.meta.dirname)
if (!workspaceRootNodeModulesDir) {
  throw new Error('Unable to locate workspace node_modules directory for auto-import build phase benchmark.')
}
const workspaceWeappViteDir = path.resolve(import.meta.dirname, '..')
const reportDir = resolveReportDir('auto-import-build-phases')
const reportJsonPath = path.join(reportDir, 'report.json')
const reportMdPath = path.join(reportDir, 'report.md')
const resolverComponents = createVantResolverComponents()
const allResolverTags = Object.keys(resolverComponents).sort((a, b) => a.localeCompare(b))
const DEFINE_CONFIG_IMPORT = pathToFileURL(path.join(workspaceWeappViteDir, 'src/config.ts')).href
const BENCHMARK_RESOLVER_PATH = './benchmark-vant-resolver'
const VANT_PACKAGE_PREFIX_RE = /^@vant\/weapp\/?/
const ORIGINAL_AUTO_IMPORT_BLOCK = [
  '      autoImportComponents: {',
  '        globs: [\'components/**/*\'],',
  '        resolvers: [',
  '          VantResolver()',
  '        ]',
  '      }',
].join('\n')

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error(`Invalid BENCH_ITERATIONS value: ${iterations}`)
}

async function main() {
  const results = []
  for (const usedCount of scenarioValues) {
    const usedTags = allResolverTags.slice(0, usedCount)
    const baselineSamples = []
    const currentSamples = []
    for (let i = 0; i < iterations; i += 1) {
      baselineSamples.push(await measureScenario({ usedTags, mode: 'baseline', iteration: i }))
      currentSamples.push(await measureScenario({ usedTags, mode: 'current', iteration: i }))
    }
    results.push({
      usedCount,
      baseline: summarizePhaseSamples(baselineSamples),
      current: summarizePhaseSamples(currentSamples),
    })
  }

  await mkdir(reportDir, { recursive: true })
  await writeFile(reportJsonPath, JSON.stringify({
    iterations,
    generatedAt: new Date().toISOString(),
    results,
  }, null, 2))
  await writeFile(reportMdPath, renderMarkdown(results), 'utf8')

  console.log(`[auto-import-build-phases] report.json -> ${reportJsonPath}`)
  console.log(`[auto-import-build-phases] report.md -> ${reportMdPath}`)
}

async function measureScenario(options: {
  usedTags: string[]
  mode: 'baseline' | 'current'
  iteration: number
}) {
  const { usedTags, mode, iteration } = options
  const project = await createTempFixtureProject(
    fixtureSource,
    `auto-import-build-phases-${mode}-${usedTags.length}-${iteration}`,
  )

  try {
    await seedFixture(project.tempDir, usedTags, mode)
    await rm(path.join(project.tempDir, 'dist'), { recursive: true, force: true })
    await rm(path.join(project.tempDir, '.weapp-vite'), { recursive: true, force: true })

    const contextStart = performance.now()
    const ctx = await createCompilerContext({
      cwd: project.tempDir,
      mode: 'production',
      isDev: false,
      cliPlatform: 'weapp',
      syncSupportFiles: false,
      preloadAppEntry: false,
      inlineConfig: {
        weapp: {
          npm: {
            cache: false,
          },
        },
      },
    })
    const createContextMs = performance.now() - contextStart

    const buildStart = performance.now()
    await ctx.buildService.build({ skipNpm: true })
    const buildMs = performance.now() - buildStart

    const npmStart = performance.now()
    await ctx.npmService?.build()
    const npmMs = performance.now() - npmStart

    ctx.watcherService?.closeAll()

    return {
      createContextMs,
      buildMs,
      npmMs,
      totalMs: createContextMs + buildMs + npmMs,
    }
  }
  finally {
    await project.cleanup()
  }
}

async function seedFixture(projectRoot: string, usedTags: string[], mode: 'baseline' | 'current') {
  const pageDir = path.join(projectRoot, 'src/pages/bench-build-auto-import')
  const pagePath = path.join(pageDir, 'index.vue')
  const appJsonPath = path.join(projectRoot, 'src/app.json')
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const tags = usedTags
    .map(tag => `    <${tag} data-bench="${tag}" />`)
    .join('\n')

  await ensureProjectConfigFiles(projectRoot)
  await patchBenchmarkConfigImports(projectRoot)
  await patchViteConfig(projectRoot, mode)
  await ensureBenchmarkResolverPackage(projectRoot, usedTags)
  await mkdir(pageDir, { recursive: true })
  await writeFile(
    pagePath,
    [
      '<template>',
      '  <view class="bench-build-auto-import">',
      tags,
      '  </view>',
      '</template>',
      '',
      '<json>',
      JSON.stringify({
        navigationBarTitleText: 'Auto Import Build Bench',
        ...(mode === 'baseline' ? { usingComponents: createUsingComponentsMap(usedTags) } : {}),
      }, null, 2),
      '</json>',
      '',
    ].join('\n'),
    'utf8',
  )

  const appJson = JSON.parse(await readFile(appJsonPath, 'utf8')) as { pages?: string[] }
  appJson.pages = ['pages/bench-build-auto-import/index']
  await writeFile(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, 'utf8')

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>
  }
  packageJson.dependencies = {
    ...(packageJson.dependencies ?? {}),
    '@vant/weapp': '1.0.0-benchmark',
  }
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

async function patchViteConfig(projectRoot: string, mode: 'baseline' | 'current') {
  const viteConfigPath = path.join(projectRoot, 'vite.config.ts')
  const viteConfig = await readFile(viteConfigPath, 'utf8')
  const replacement = mode === 'baseline'
    ? '      autoImportComponents: false,'
    : [
        '      autoImportComponents: {',
        '        resolvers: [',
        '          VantResolver()',
        '        ]',
        '      }',
      ].join('\n')
  const nextViteConfig = viteConfig.replace(ORIGINAL_AUTO_IMPORT_BLOCK, replacement)

  if (nextViteConfig === viteConfig) {
    if (mode === 'current' && viteConfig.includes(ORIGINAL_AUTO_IMPORT_BLOCK)) {
      return
    }
    throw new Error(`Failed to patch vite config for build phase benchmark: ${viteConfigPath}`)
  }

  await writeFile(viteConfigPath, nextViteConfig, 'utf8')
}

async function patchBenchmarkConfigImports(projectRoot: string) {
  const viteConfigPath = path.join(projectRoot, 'vite.config.ts')
  const viteConfig = await readFile(viteConfigPath, 'utf8')
  const nextViteConfig = viteConfig
    .replace(`import { defineConfig } from 'weapp-vite'`, `import { defineConfig } from '${DEFINE_CONFIG_IMPORT}'`)
    .replace(`import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'`, `import { VantResolver } from '${BENCHMARK_RESOLVER_PATH}'`)

  if (nextViteConfig !== viteConfig) {
    await writeFile(viteConfigPath, nextViteConfig, 'utf8')
  }

  await writeFile(path.join(projectRoot, 'benchmark-vant-resolver.ts'), renderBenchmarkVantResolver(), 'utf8')
}

async function ensureProjectConfigFiles(projectRoot: string) {
  for (const fileName of ['project.config.json', 'project.private.config.json']) {
    const sourcePath = path.join(fixtureSource, fileName)
    const targetPath = path.join(projectRoot, fileName)
    const content = await readFile(sourcePath, 'utf8')
    await writeFile(targetPath, content, 'utf8')
  }
}

function createUsingComponentsMap(usedTags: string[]) {
  return Object.fromEntries(
    usedTags.map((tag) => {
      const from = resolverComponents[tag]
      if (!from) {
        throw new Error(`Missing resolver mapping for benchmark tag: ${tag}`)
      }
      return [tag, from]
    }),
  )
}

async function ensureBenchmarkResolverPackage(projectRoot: string, usedTags: string[]) {
  const tempRoot = path.dirname(projectRoot)
  const packageRoot = path.join(tempRoot, 'node_modules/@vant/weapp')
  await mkdir(packageRoot, { recursive: true })
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: '@vant/weapp',
    version: '1.0.0-benchmark',
  }, null, 2))

  for (const tag of usedTags) {
    const from = resolverComponents[tag]
    if (!from) {
      throw new Error(`Missing resolver mapping for benchmark tag: ${tag}`)
    }
    const relativeEntry = from.replace(VANT_PACKAGE_PREFIX_RE, '')
    const componentDir = path.join(packageRoot, relativeEntry)
    await mkdir(componentDir, { recursive: true })
    await writeFile(path.join(componentDir, 'index.json'), `${JSON.stringify({ component: true }, null, 2)}\n`, 'utf8')
    await writeFile(path.join(componentDir, 'index.js'), 'Component({})\n', 'utf8')
    await writeFile(path.join(componentDir, 'index.wxml'), `<view data-bench="${tag}">${tag}</view>\n`, 'utf8')
    await writeFile(path.join(componentDir, 'index.wxss'), '', 'utf8')
  }
}

async function createTempFixtureProject(sourceRoot: string, prefix: string) {
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

  await linkWorkspaceNodeModules(tempDir)

  return {
    tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
      await rm(path.join(tempRoot, 'node_modules'), { recursive: true, force: true })
      const remaining = await readdir(tempRoot).catch(() => null)
      if (remaining && remaining.length === 0) {
        await rm(tempRoot, { recursive: true, force: true })
      }
    },
  }
}

async function linkWorkspaceNodeModules(projectRoot: string) {
  const projectNodeModulesDir = path.join(projectRoot, 'node_modules')
  const existingNodeModules = await lstat(projectNodeModulesDir).catch(() => null)
  if (existingNodeModules) {
    await rm(projectNodeModulesDir, { recursive: true, force: true })
  }
  await symlink(path.relative(projectRoot, workspaceRootNodeModulesDir), projectNodeModulesDir, 'junction')

  const packageRoot = path.join(projectNodeModulesDir, 'weapp-vite')
  const existingPackage = await lstat(packageRoot).catch(() => null)
  if (existingPackage?.isSymbolicLink()) {
    const currentTarget = await readlink(packageRoot).catch(() => '')
    if (path.resolve(projectNodeModulesDir, currentTarget) === workspaceWeappViteDir) {
      return
    }
  }
  if (existingPackage) {
    await rm(packageRoot, { recursive: true, force: true })
  }
  await symlink(path.relative(projectNodeModulesDir, workspaceWeappViteDir), packageRoot, 'junction')
}

function createVantResolverComponents() {
  return Object.fromEntries(vantComponents.map(component => [toVantTag(component), `@vant/weapp/${component}`]))
}

function toVantTag(component: string) {
  return `van-${component}`
}

function renderBenchmarkVantResolver() {
  return [
    `const components = Object.freeze(${JSON.stringify(resolverComponents, null, 2)} as const)`,
    '',
    'export function VantResolver() {',
    '  return {',
    '    components,',
    '    supportFilesStrategy: \'full\',',
    '    resolve(componentName: string) {',
    '      const from = components[componentName as keyof typeof components]',
    '      if (!from) {',
    '        return undefined',
    '      }',
    '      return { name: componentName, from }',
    '    },',
    '  }',
    '}',
    '',
  ].join('\n')
}

function resolveReportDir(reportName: string) {
  if (process.env.BENCH_REPORT_DIR) {
    return path.resolve(process.env.BENCH_REPORT_DIR)
  }
  return path.resolve(
    import.meta.dirname,
    `../benchmark/${reportName}`,
    formatTimestamp(new Date()),
  )
}

function parseScenarioValues(input: string | undefined) {
  const parsed = (input ?? '1,20')
    .split(',')
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(value => Number.isFinite(value) && value > 0)
  if (parsed.length === 0) {
    throw new Error(`Invalid BENCH_SCENARIOS value: ${input ?? ''}`)
  }
  return parsed
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

function summarizePhaseSamples(samples: Array<Awaited<ReturnType<typeof measureScenario>>>) {
  return {
    createContextMs: summarizeNumbers(samples.map(sample => sample.createContextMs)),
    buildMs: summarizeNumbers(samples.map(sample => sample.buildMs)),
    npmMs: summarizeNumbers(samples.map(sample => sample.npmMs)),
    totalMs: summarizeNumbers(samples.map(sample => sample.totalMs)),
  }
}

function renderMarkdown(results: Array<{
  usedCount: number
  baseline: ReturnType<typeof summarizePhaseSamples>
  current: ReturnType<typeof summarizePhaseSamples>
}>) {
  const lines = [
    '# autoImport 构建阶段剖析报告',
    '',
    `- 迭代次数：\`${iterations}\``,
    '',
  ]

  for (const result of results) {
    lines.push(`## ${result.usedCount} 个组件`)
    lines.push('')
    lines.push('| 阶段 | 基线平均耗时 | 当前平均耗时 | 差值 |')
    lines.push('| --- | ---: | ---: | ---: |')
    for (const phase of ['createContextMs', 'buildMs', 'npmMs', 'totalMs'] as const) {
      const baseline = result.baseline[phase].mean
      const current = result.current[phase].mean
      const phaseLabel = ({
        createContextMs: '创建上下文',
        buildMs: '构建阶段',
        npmMs: 'npm 依赖处理',
        totalMs: '总耗时',
      })[phase]
      lines.push(`| ${phaseLabel} | ${baseline.toFixed(2)} ms | ${current.toFixed(2)} ms | ${(current - baseline).toFixed(2)} ms |`)
    }
    lines.push('')
  }

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
