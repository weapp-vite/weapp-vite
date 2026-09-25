/* eslint-disable ts/no-use-before-define */
import type { PeakRssSamplingStats } from '../../../scripts/benchmarkTemplatesPerformance/peakRssSampler'
import type { OutputEvidence } from '../../../scripts/performanceGate/outputEvidence'
import { cp, lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import { runMeasuredBuild } from '../../../scripts/benchmarkTemplatesPerformance/measuredBuild'
import { captureOutputEvidence } from '../../../scripts/performanceGate/outputEvidence'
import vantComponents from '../src/auto-import-components/resolvers/json/vant.json'
import { writeBenchmarkResolverFile } from './utils/benchmark-tsconfig'
import { benchmarkModeSelected, benchmarkReportResults } from './utils/benchmarkSelection'
import { createBenchmarkPath, resolveBenchmarkTarget } from './utils/benchmarkTarget'
import { patchProjectConfigFile } from './utils/config-file'
import { formatMemoryMiB, summarizeOptionalMemory } from './utils/process-memory'

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? '3', 10)
const scenarioValues = parseScenarioValues(process.env.BENCH_SCENARIOS)
const fixtureSource = path.resolve(import.meta.dirname, '../../../test/fixture-projects/weapp-vite/auto-import')
const { workspaceRootDir, workspaceRootNodeModulesDir, workspaceWeappViteDir } = resolveBenchmarkTarget(import.meta.dirname)
const reportDir = resolveReportDir('auto-import-build')
const reportJsonPath = path.join(reportDir, 'report.json')
const reportMdPath = path.join(reportDir, 'report.md')
const resolverComponents = createVantResolverComponents()
const allResolverTags = Object.keys(resolverComponents).sort((a, b) => a.localeCompare(b))
const DEFINE_CONFIG_IMPORT = pathToFileURL(path.join(workspaceWeappViteDir, 'dist/config.mjs')).href
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
  console.log(`[auto-import-build-bench] iterations=${iterations}`)
  console.log(`[auto-import-build-bench] total resolver components=${allResolverTags.length}`)
  console.log(`[auto-import-build-bench] scenarios=${scenarioValues.join(',')}`)

  const results = []
  for (const usedCount of scenarioValues) {
    const result = await runScenario(usedCount)
    results.push(result)
    if (!process.env.BENCH_CONFIGURATIONS) {
      printScenario(result)
    }
    await mkdir(reportDir, { recursive: true })
    await writeFile(reportJsonPath, JSON.stringify({ iterations, results: benchmarkReportResults(results) }, null, 2))
  }

  await mkdir(reportDir, { recursive: true })
  await writeFile(reportJsonPath, JSON.stringify({
    iterations,
    generatedAt: new Date().toISOString(),
    results: benchmarkReportResults(results),
  }, null, 2))
  await writeFile(reportMdPath, process.env.BENCH_CONFIGURATIONS ? '配置确认原始样本；未执行的配置不生成比较摘要。\n' : renderMarkdown(results), 'utf8')

  console.log(`[auto-import-build-bench] report.json -> ${reportJsonPath}`)
  console.log(`[auto-import-build-bench] report.md -> ${reportMdPath}`)
}

async function runScenario(usedCount: number) {
  const requestedCount = usedCount
  const usedTags = allResolverTags.slice(0, usedCount)
  usedCount = usedTags.length
  const baselineSamples: BuildSample[] = []
  const currentSamples: BuildSample[] = []

  for (let i = 0; i < iterations; i += 1) {
    if (benchmarkModeSelected(usedCount, 'manual')) {
      console.log(`[auto-import-progress] ${usedCount}:manual ${i + 1}/${iterations}`)
      baselineSamples.push(await measureBuild({ usedTags, mode: 'baseline', iteration: i }))
    }
    if (benchmarkModeSelected(usedCount, 'automatic')) {
      console.log(`[auto-import-progress] ${usedCount}:automatic ${i + 1}/${iterations}`)
      currentSamples.push(await measureBuild({ usedTags, mode: 'current', iteration: i }))
    }
  }

  const baseline = summarizeNumbers(baselineSamples)
  const current = summarizeNumbers(currentSamples)
  const baselineMemory = summarizeOptionalMemory(baselineSamples.map(sample => sample.rssPeakBytes))
  const currentMemory = summarizeOptionalMemory(currentSamples.map(sample => sample.rssPeakBytes))

  return {
    usedCount,
    requestedCount,
    raw: { manual: baselineSamples, automatic: currentSamples },
    baseline,
    baselineMemory,
    current,
    currentMemory,
    delta: {
      extraMs: current.mean - baseline.mean,
      extraPercent: baseline.mean > 0 ? ((current.mean - baseline.mean) / baseline.mean) * 100 : 0,
      ratio: baseline.mean > 0 ? current.mean / baseline.mean : 0,
    },
  }
}

async function measureBuild(options: {
  usedTags: string[]
  mode: 'baseline' | 'current'
  iteration: number
}) {
  const { usedTags, mode, iteration } = options
  const project = await createTempFixtureProject(
    fixtureSource,
    `auto-import-build-${mode}-${usedTags.length}-${iteration}`,
  )

  try {
    await seedFixture(project.tempDir, usedTags, mode)
    await rm(path.join(project.tempDir, 'dist'), { recursive: true, force: true })
    await rm(path.join(project.tempDir, '.weapp-vite'), { recursive: true, force: true })

    const memory = await runBuild(project.tempDir)
    const output = await captureOutputEvidence(project.tempDir)
    let repeatDurationMs: number | undefined
    let repeatRssPeakBytes: number | null | undefined
    let repeatOutput: OutputEvidence | undefined
    let repeatCliBuildMs: number | null | undefined
    let repeatRssSampling: PeakRssSamplingStats | undefined
    if (process.env.AUTO_IMPORT_BENCH_PAIRED === '1') {
      const repeatMemory = await runBuild(project.tempDir)
      repeatDurationMs = repeatMemory.durationMs
      repeatRssPeakBytes = repeatMemory.rssPeakBytes
      repeatCliBuildMs = repeatMemory.cliBuildMs
      repeatRssSampling = repeatMemory.rssSampling
      repeatOutput = await captureOutputEvidence(project.tempDir)
    }
    return {
      durationMs: memory.durationMs,
      cliBuildMs: memory.cliBuildMs,
      rssSampling: memory.rssSampling,
      repeatDurationMs,
      repeatCliBuildMs,
      repeatRssSampling,
      repeatRssPeakBytes,
      output,
      repeatOutput,
      rssPeakBytes: memory.rssPeakBytes,
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
    devDependencies?: Record<string, string>
  }
  packageJson.dependencies = {
    ...(packageJson.dependencies ?? {}),
    '@vant/weapp': '1.0.0-benchmark',
  }
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

async function patchViteConfig(projectRoot: string, mode: 'baseline' | 'current') {
  const replacement = mode === 'baseline'
    ? '      autoImportComponents: false,'
    : [
        '      autoImportComponents: {',
        '        resolvers: [',
        '          VantResolver()',
        '        ]',
        '      }',
      ].join('\n')
  await patchProjectConfigFile(
    projectRoot,
    content => content.replace(ORIGINAL_AUTO_IMPORT_BLOCK, replacement),
    {
      errorMessage: 'Failed to patch benchmark config for build benchmark',
    },
  )
}

async function patchBenchmarkConfigImports(projectRoot: string) {
  await patchProjectConfigFile(
    projectRoot,
    content => content
      .replace(`import { defineConfig } from 'weapp-vite'`, `import { defineConfig } from '${DEFINE_CONFIG_IMPORT}'`)
      .replace(`import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'`, `import { VantResolver } from '${BENCHMARK_RESOLVER_PATH}'`),
    {
      allowUnchanged: true,
      errorMessage: 'Failed to patch benchmark config imports for build benchmark',
    },
  )

  await writeBenchmarkResolverFile(projectRoot, renderBenchmarkVantResolver())
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
  const base = path.join(workspaceRootDir, '.tmp/auto-import-workspaces')
  await mkdir(base, { recursive: true })
  const tempRoot = await mkdtemp(path.join(base, `${prefix}-`))
  const tempDir = path.join(tempRoot, 'project')
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
      await rm(tempRoot, { recursive: true, force: true })
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

async function runBuild(cwd: string) {
  const cliPath = path.join(workspaceWeappViteDir, 'bin/weapp-vite.js')
  const workspaceBinDir = path.join(workspaceRootNodeModulesDir, '.bin')
  return await runMeasuredBuild(process.execPath, [cliPath, 'build', cwd, '--platform', 'weapp', '--skipNpm'], {
    cwd: workspaceRootDir,
    env: { ...process.env, PATH: createBenchmarkPath(workspaceBinDir) },
  })
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
  const parsed = (input ?? '1,5,20')
    .split(',')
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(value => Number.isFinite(value) && value > 0)
  if (parsed.length === 0) {
    throw new Error(`Invalid BENCH_SCENARIOS value: ${input ?? ''}`)
  }
  return parsed
}

function summarizeNumbers(values: Array<number | BuildSample>) {
  const numericValues = values.map(value => typeof value === 'number' ? value : value.durationMs)
  const sorted = [...numericValues].sort((a, b) => a - b)
  const total = numericValues.reduce((sum, value) => sum + value, 0)
  const mid = Math.floor(sorted.length / 2)
  return {
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
    mean: numericValues.length ? total / numericValues.length : 0,
    median: sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0),
  }
}

function printScenario(result: Awaited<ReturnType<typeof runScenario>>) {
  console.log(`\n[build-scenario] used resolver components=${result.usedCount}`)
  console.log(`baseline | avg ${result.baseline.mean.toFixed(2)}ms | median ${result.baseline.median.toFixed(2)}ms`)
  console.log(`current  | avg ${result.current.mean.toFixed(2)}ms | median ${result.current.median.toFixed(2)}ms`)
  console.log(`memory   | peak RSS avg ${formatMemoryMiB(result.baselineMemory.mean)} -> ${formatMemoryMiB(result.currentMemory.mean)}`)
  console.log(`delta    | extra ${result.delta.extraMs.toFixed(2)}ms | extra ${result.delta.extraPercent.toFixed(2)}% | ratio ${result.delta.ratio.toFixed(2)}x`)
}

function renderMarkdown(results: Array<Awaited<ReturnType<typeof runScenario>>>) {
  const lines = [
    '# autoImportComponents 完整构建基准报告',
    '',
    `- 迭代次数：\`${iterations}\``,
    '',
    '| 场景 | 基线平均耗时 | 当前平均耗时 | 额外成本 | peak RSS | 比例 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ]

  for (const result of results) {
    lines.push(
      `| 使用 ${result.usedCount} 个 Vant 组件 | ${result.baseline.mean.toFixed(2)} ms | ${result.current.mean.toFixed(2)} ms | ${result.delta.extraMs.toFixed(2)} ms (${result.delta.extraPercent.toFixed(2)}%) | ${formatMemoryMiB(result.baselineMemory.mean)} -> ${formatMemoryMiB(result.currentMemory.mean)} | ${result.delta.ratio.toFixed(2)}x |`,
    )
  }

  lines.push('')
  lines.push('## 说明')
  lines.push('')
  lines.push('- `baseline`：关闭 `autoImportComponents`，并手动声明同一批 `usingComponents` 后执行 `weapp-vite build`。')
  lines.push('- `current`：开启当前自动导入实现后直接执行 `weapp-vite build`。')
  lines.push('- 该结果包含支持文件同步、配置加载和完整构建流程。')
  lines.push('')

  return `${lines.join('\n')}\n`
}

interface BuildSample {
  cliBuildMs?: number | null
  repeatCliBuildMs?: number | null
  rssSampling?: PeakRssSamplingStats
  repeatRssSampling?: PeakRssSamplingStats
  output: OutputEvidence
  repeatOutput?: OutputEvidence
  repeatDurationMs?: number
  repeatRssPeakBytes?: number | null
  durationMs: number
  rssPeakBytes: number | null
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
  await mkdir(reportDir, { recursive: true })
  await writeFile(path.join(reportDir, 'error.txt'), String(error))
  process.exitCode = 1
})
