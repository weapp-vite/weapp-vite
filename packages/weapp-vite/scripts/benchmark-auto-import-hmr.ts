/* eslint-disable ts/no-use-before-define */
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import path from 'pathe'
import { startDevProcess } from '../../../e2e/utils/dev-process'
import { createDevProcessEnv } from '../../../e2e/utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../../../e2e/utils/hmr-helpers'
import { VantResolver } from '../src/auto-import-components/resolvers'

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? '3', 10)
const scenarioValues = parseScenarioValues(process.env.BENCH_SCENARIOS)
const fixtureSource = path.resolve(import.meta.dirname, '../../../test/fixture-projects/weapp-vite/auto-import')
const workspaceRootNodeModulesDir = await resolveWorkspaceNodeModulesDir()
const workspaceWeappViteDir = path.resolve(import.meta.dirname, '..')
const workspaceRootDir = path.dirname(path.dirname(workspaceRootNodeModulesDir))
const reportDir = resolveReportDir('auto-import-hmr')
const reportJsonPath = path.join(reportDir, 'report.json')
const reportMdPath = path.join(reportDir, 'report.md')
const allResolverTags = Object.keys(VantResolver().components ?? {}).sort((a, b) => a.localeCompare(b))
const resolverComponents = VantResolver().components ?? {}
const VANT_PACKAGE_PREFIX_RE = /^@vant\/weapp\/?/
const ORIGINAL_AUTO_IMPORT_BLOCK = [
  '      autoImportComponents: {',
  '        globs: [\'components/**/*\'],',
  '        resolvers: [',
  '          VantResolver()',
  '        ]',
  '      }',
].join('\n')
const CLI_PATH = path.resolve(import.meta.dirname, '../src/cli.ts')
const DEV_TIMEOUT_MS = Number.parseInt(process.env.AUTO_IMPORT_HMR_TIMEOUT_MS ?? '90000', 10)

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error(`Invalid BENCH_ITERATIONS value: ${iterations}`)
}

if (!Number.isFinite(DEV_TIMEOUT_MS) || DEV_TIMEOUT_MS <= 0) {
  throw new Error(`Invalid AUTO_IMPORT_HMR_TIMEOUT_MS value: ${DEV_TIMEOUT_MS}`)
}

async function main() {
  console.log(`[auto-import-hmr-bench] iterations=${iterations}`)
  console.log(`[auto-import-hmr-bench] total resolver components=${allResolverTags.length}`)
  console.log(`[auto-import-hmr-bench] scenarios=${scenarioValues.join(',')}`)

  const results = []
  for (const usedCount of scenarioValues) {
    const result = await runScenario(usedCount)
    results.push(result)
    printScenario(result)
  }

  await mkdir(reportDir, { recursive: true })
  await writeFile(reportJsonPath, JSON.stringify({
    iterations,
    generatedAt: new Date().toISOString(),
    results,
  }, null, 2))
  await writeFile(reportMdPath, renderMarkdown(results), 'utf8')

  console.log(`[auto-import-hmr-bench] report.json -> ${reportJsonPath}`)
  console.log(`[auto-import-hmr-bench] report.md -> ${reportMdPath}`)
}

async function runScenario(usedCount: number) {
  const usedTags = allResolverTags.slice(0, usedCount)
  const baselineStartupSamples: number[] = []
  const currentStartupSamples: number[] = []
  const baselineUpdateSamples: number[] = []
  const currentUpdateSamples: number[] = []

  for (let i = 0; i < iterations; i += 1) {
    const baseline = await measureHmr({ usedTags, mode: 'baseline', iteration: i })
    baselineStartupSamples.push(baseline.startupMs)
    baselineUpdateSamples.push(baseline.updateMs)

    const current = await measureHmr({ usedTags, mode: 'current', iteration: i })
    currentStartupSamples.push(current.startupMs)
    currentUpdateSamples.push(current.updateMs)
  }

  const baselineStartup = summarizeNumbers(baselineStartupSamples)
  const currentStartup = summarizeNumbers(currentStartupSamples)
  const baselineUpdate = summarizeNumbers(baselineUpdateSamples)
  const currentUpdate = summarizeNumbers(currentUpdateSamples)

  return {
    usedCount,
    startup: {
      baseline: baselineStartup,
      current: currentStartup,
      delta: {
        extraMs: currentStartup.mean - baselineStartup.mean,
        extraPercent: baselineStartup.mean > 0 ? ((currentStartup.mean - baselineStartup.mean) / baselineStartup.mean) * 100 : 0,
        ratio: baselineStartup.mean > 0 ? currentStartup.mean / baselineStartup.mean : 0,
      },
    },
    update: {
      baseline: baselineUpdate,
      current: currentUpdate,
      delta: {
        extraMs: currentUpdate.mean - baselineUpdate.mean,
        extraPercent: baselineUpdate.mean > 0 ? ((currentUpdate.mean - baselineUpdate.mean) / baselineUpdate.mean) * 100 : 0,
        ratio: baselineUpdate.mean > 0 ? currentUpdate.mean / baselineUpdate.mean : 0,
      },
    },
  }
}

async function measureHmr(options: {
  usedTags: string[]
  mode: 'baseline' | 'current'
  iteration: number
}) {
  const { usedTags, mode, iteration } = options
  const project = await createTempFixtureProject(
    fixtureSource,
    `auto-import-hmr-${mode}-${usedTags.length}-${iteration}`,
  )
  const pagePath = path.join(project.tempDir, 'src/pages/bench-hmr-auto-import/index.vue')
  const distTemplatePath = path.join(project.tempDir, 'dist/pages/bench-hmr-auto-import/index.wxml')

  try {
    const seededSource = await seedFixture(project.tempDir, usedTags, mode)
    await rm(path.join(project.tempDir, 'dist'), { recursive: true, force: true })
    await rm(path.join(project.tempDir, '.weapp-vite'), { recursive: true, force: true })

    const startupStart = performance.now()
    const dev = startDevProcess(process.execPath, ['--import', 'tsx', CLI_PATH, 'dev', project.tempDir, '--platform', 'weapp', '--skipNpm'], {
      cwd: workspaceRootDir,
      env: {
        ...createDevProcessEnv(),
        PATH: `${path.join(workspaceRootNodeModulesDir, '.bin')}:${process.env.PATH ?? ''}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
      all: true,
    })

    try {
      await dev.waitFor(waitForFileContains(distTemplatePath, 'bench-hmr-auto-import', DEV_TIMEOUT_MS), `${mode} initial bench output`)
      const startupMs = performance.now() - startupStart

      const marker = `auto-import-hmr-${mode}-${usedTags.length}-${iteration}`
      const updatedSource = insertMarkerBeforeClosingView(seededSource, marker)
      const updateStart = performance.now()
      await replaceFileByRename(pagePath, updatedSource)
      await dev.waitFor(waitForFileContains(distTemplatePath, marker, DEV_TIMEOUT_MS), `${mode} hmr marker`)
      const updateMs = performance.now() - updateStart

      return {
        startupMs,
        updateMs,
      }
    }
    finally {
      await dev.stop()
    }
  }
  finally {
    await project.cleanup()
  }
}

async function seedFixture(projectRoot: string, usedTags: string[], mode: 'baseline' | 'current') {
  const pageDir = path.join(projectRoot, 'src/pages/bench-hmr-auto-import')
  const pagePath = path.join(pageDir, 'index.vue')
  const appJsonPath = path.join(projectRoot, 'src/app.json')
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const tags = usedTags
    .map(tag => `    <${tag} data-bench="${tag}" />`)
    .join('\n')
  const source = [
    '<template>',
    '  <view class="bench-hmr-auto-import">',
    tags,
    '  </view>',
    '</template>',
    '',
    '<json>',
    JSON.stringify({
      navigationBarTitleText: 'Auto Import HMR Bench',
      ...(mode === 'baseline' ? { usingComponents: createUsingComponentsMap(usedTags) } : {}),
    }, null, 2),
    '</json>',
    '',
  ].join('\n')

  await patchViteConfig(projectRoot, mode)
  await ensureBenchmarkResolverPackage(projectRoot, usedTags)
  await mkdir(pageDir, { recursive: true })
  await writeFile(pagePath, source, 'utf8')

  const appJson = JSON.parse(await readFile(appJsonPath, 'utf8')) as { pages?: string[] }
  const pages = new Set(appJson.pages ?? [])
  pages.add('pages/bench-hmr-auto-import/index')
  appJson.pages = Array.from(pages)
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

  return source
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
    throw new Error(`Failed to patch vite config for hmr benchmark: ${viteConfigPath}`)
  }

  await writeFile(viteConfigPath, nextViteConfig, 'utf8')
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

async function resolveWorkspaceNodeModulesDir() {
  let currentDir = path.resolve(import.meta.dirname, '../../..')
  while (true) {
    const candidate = path.join(currentDir, 'node_modules')
    if (await lstat(candidate).catch(() => null)) {
      return candidate
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }
    currentDir = parentDir
  }
  throw new Error('Unable to locate workspace node_modules directory for auto-import hmr benchmark.')
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

function insertMarkerBeforeClosingView(source: string, marker: string) {
  const needle = '  </view>\n</template>'
  const markerLine = `    <view data-bench-marker="${marker}">${marker}</view>\n`
  if (!source.includes(needle)) {
    throw new Error('Unexpected benchmark page structure while inserting hmr marker.')
  }
  return source.replace(needle, `${markerLine}${needle}`)
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

function printScenario(result: Awaited<ReturnType<typeof runScenario>>) {
  console.log(`\n[hmr-scenario] used resolver components=${result.usedCount}`)
  console.log(`startup baseline | avg ${result.startup.baseline.mean.toFixed(2)}ms`)
  console.log(`startup current  | avg ${result.startup.current.mean.toFixed(2)}ms`)
  console.log(`startup delta    | extra ${result.startup.delta.extraMs.toFixed(2)}ms | extra ${result.startup.delta.extraPercent.toFixed(2)}%`)
  console.log(`update baseline  | avg ${result.update.baseline.mean.toFixed(2)}ms`)
  console.log(`update current   | avg ${result.update.current.mean.toFixed(2)}ms`)
  console.log(`update delta     | extra ${result.update.delta.extraMs.toFixed(2)}ms | extra ${result.update.delta.extraPercent.toFixed(2)}%`)
}

function renderMarkdown(results: Array<Awaited<ReturnType<typeof runScenario>>>) {
  const lines = [
    '# autoImportComponents HMR benchmark',
    '',
    `- iterations: \`${iterations}\``,
    '',
    '## Startup',
    '',
    '| 场景 | baseline avg | current avg | 额外成本 | 比例 |',
    '| --- | ---: | ---: | ---: | ---: |',
  ]

  for (const result of results) {
    lines.push(
      `| 使用 ${result.usedCount} 个 Vant 组件 | ${result.startup.baseline.mean.toFixed(2)} ms | ${result.startup.current.mean.toFixed(2)} ms | ${result.startup.delta.extraMs.toFixed(2)} ms (${result.startup.delta.extraPercent.toFixed(2)}%) | ${result.startup.delta.ratio.toFixed(2)}x |`,
    )
  }

  lines.push('')
  lines.push('## HMR Update')
  lines.push('')
  lines.push('| 场景 | baseline avg | current avg | 额外成本 | 比例 |')
  lines.push('| --- | ---: | ---: | ---: | ---: |')

  for (const result of results) {
    lines.push(
      `| 使用 ${result.usedCount} 个 Vant 组件 | ${result.update.baseline.mean.toFixed(2)} ms | ${result.update.current.mean.toFixed(2)} ms | ${result.update.delta.extraMs.toFixed(2)} ms (${result.update.delta.extraPercent.toFixed(2)}%) | ${result.update.delta.ratio.toFixed(2)}x |`,
    )
  }

  lines.push('')
  lines.push('## 说明')
  lines.push('')
  lines.push('- `baseline`：关闭 `autoImportComponents`，并手动声明同一批 `usingComponents` 后启动 dev 并执行相同模板改动。')
  lines.push('- `current`：开启当前自动导入实现后启动 dev 并执行相同模板改动。')
  lines.push('- `startup` 表示从启动 dev 到首个 benchmark 页面产物可见的耗时。')
  lines.push('- `update` 表示修改 benchmark 页面后，dist 模板产物出现新 marker 的耗时。')
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
