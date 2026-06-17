/* eslint-disable ts/no-use-before-define */
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { stripVTControlCharacters } from 'node:util'
/* eslint-disable-next-line e18e/ban-dependencies -- CI 性能对比需要调度两个 checkout 的命令并收集报告。 */
import { execa } from 'execa'
import path from 'pathe'

const baselineDirInput = process.env.TEMPLATES_PERF_BASELINE_DIR
const baselineDir = baselineDirInput ? path.resolve(baselineDirInput) : ''
const optimizedDir = path.resolve(process.env.TEMPLATES_PERF_OPTIMIZED_DIR ?? process.cwd())
const reportRootDir = path.resolve(process.env.TEMPLATES_PERF_REPORT_DIR ?? path.join(optimizedDir, '.tmp/templates-performance'))
const hmrIterations = readPositiveIntegerEnv('TEMPLATES_PERF_HMR_ITERATIONS', 1)
const buildIterations = readPositiveIntegerEnv('TEMPLATES_PERF_BUILD_ITERATIONS', 1)
const hmrFilter = process.env.TEMPLATES_PERF_HMR_FILTER?.trim() || null
const maxHmrScenariosPerTemplate = readOptionalPositiveIntegerEnv('TEMPLATES_PERF_HMR_MAX_SCENARIOS_PER_TEMPLATE')
const hmrStartupTimeoutMs = readPositiveIntegerEnv('TEMPLATES_PERF_HMR_STARTUP_TIMEOUT_MS', 45_000)
const hmrProfileTimeoutMs = readPositiveIntegerEnv('TEMPLATES_PERF_HMR_PROFILE_TIMEOUT_MS', 15_000)
const hmrSampleMode = process.env.TEMPLATES_PERF_HMR_SAMPLE_MODE === 'best-of-cycle' ? 'best-of-cycle' : 'edit-only'
const reportJsonPath = path.join(reportRootDir, 'report.json')
const reportMdPath = path.join(reportRootDir, 'report.md')

if (!baselineDir) {
  throw new Error('TEMPLATES_PERF_BASELINE_DIR is required.')
}

async function main() {
  await rm(reportRootDir, { recursive: true, force: true })
  await mkdir(reportRootDir, { recursive: true })

  await prepareBenchmarkRunner()
  const baseline = await benchmarkCheckout('baseline', baselineDir)
  const optimized = await benchmarkCheckout('optimized', optimizedDir)
  const report = createReport(baseline, optimized)
  const markdown = renderMarkdown(report)

  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(reportMdPath, markdown, 'utf8')
  process.stdout.write(`${markdown}\n`)

  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, {
      encoding: 'utf8',
      flag: 'a',
    })
  }
}

async function prepareBenchmarkRunner() {
  process.stdout.write('[templates-perf] runner: build benchmark helper dependency dist\n')
  await run('pnpm', ['--filter', '@weapp-core/shared', '--if-present', 'build'], optimizedDir)
}

async function benchmarkCheckout(id: CheckoutId, cwd: string): Promise<CheckoutResult> {
  const reportDir = path.join(reportRootDir, id)
  const hmrReportDir = path.join(reportDir, 'hmr')
  await mkdir(hmrReportDir, { recursive: true })

  const commit = (await execa('git', ['rev-parse', '--short=8', 'HEAD'], { cwd })).stdout.trim()
  process.stdout.write(`[templates-perf] ${id} ${commit}: build weapp-vite dependency dist\n`)
  await run('pnpm', ['--filter', 'weapp-vite...', '--if-present', 'build'], cwd)

  const templates = await discoverTemplates(cwd)
  await prepareTemplates(id, cwd, templates)
  const build = await benchmarkTemplateBuilds(id, cwd, templates)

  process.stdout.write(`[templates-perf] ${id} ${commit}: templates HMR benchmark (${hmrIterations}x)\n`)
  await run('pnpm', ['exec', 'tsx', 'scripts/benchmark-templates-hmr.ts'], optimizedDir, {
    TEMPLATES_HMR_CLI_PATH: path.join(cwd, 'packages/weapp-vite/bin/weapp-vite.js'),
    TEMPLATES_HMR_ITERATIONS: String(hmrIterations),
    TEMPLATES_HMR_REPORT_DIR: hmrReportDir,
    TEMPLATES_HMR_REPO_ROOT: cwd,
    TEMPLATES_HMR_FILTER: hmrFilter ?? '',
    TEMPLATES_HMR_MAX_SCENARIOS_PER_TEMPLATE: maxHmrScenariosPerTemplate?.toString() ?? '',
    TEMPLATES_HMR_PROFILE_TIMEOUT_MS: String(hmrProfileTimeoutMs),
    TEMPLATES_HMR_STARTUP_TIMEOUT_MS: String(hmrStartupTimeoutMs),
    TEMPLATES_HMR_SAMPLE_MODE: hmrSampleMode,
  })

  const hmr = JSON.parse(await readFile(path.join(hmrReportDir, 'report.json'), 'utf8')) as TemplatesHmrReport
  return {
    id,
    commit,
    templates: templates.map(template => toReportTemplate(cwd, template)),
    build,
    hmr,
  }
}

async function benchmarkTemplateBuilds(id: CheckoutId, cwd: string, templates: TemplateCase[]) {
  const samples: TemplateBuildSample[] = []

  for (const template of templates) {
    for (let index = 0; index < buildIterations; index += 1) {
      process.stdout.write(`[templates-perf] ${id}: build ${template.id} ${index + 1}/${buildIterations}\n`)
      await rm(path.join(template.root, 'dist'), { recursive: true, force: true }).catch(() => {})
      await rm(path.join(template.root, 'dist-lib'), { recursive: true, force: true }).catch(() => {})
      await rm(path.join(template.root, 'dist-plugin'), { recursive: true, force: true }).catch(() => {})

      const startedAt = performance.now()
      const result = await execa('pnpm', ['--filter', template.packageName, 'build'], {
        cwd,
        reject: false,
      })
      const output = `${result.stdout}\n${result.stderr}`
      const sanitizedOutput = sanitizeCheckoutOutput(cwd, output)
      process.stdout.write(sanitizedOutput)
      const sample = {
        iteration: index + 1,
        template: template.id,
        packageName: template.packageName,
        totalMs: performance.now() - startedAt,
        cliBuildMs: parseCliBuildMs(output),
        status: result.exitCode ?? 0,
        error: result.exitCode === 0 ? undefined : summarizeCommandOutput(sanitizedOutput),
      }
      samples.push(sample)
      if (result.exitCode !== 0) {
        process.stderr.write(`[templates-perf] ${id}: build ${template.id} failed, continue collecting report\n`)
        break
      }
    }
  }

  return {
    samples,
    raw: summarizeBuild(samples),
    warm: summarizeBuild(samples.filter(sample => sample.iteration > 1)),
    templates: templates.map((template) => {
      const templateSamples = samples.filter(sample => sample.template === template.id)
      return {
        id: template.id,
        packageName: template.packageName,
        raw: summarizeBuild(templateSamples),
        warm: summarizeBuild(templateSamples.filter(sample => sample.iteration > 1)),
      }
    }),
  }
}

async function discoverTemplates(cwd: string): Promise<TemplateCase[]> {
  const templatesRoot = path.join(cwd, 'templates')
  const names = await readdir(templatesRoot)
  const templates: TemplateCase[] = []
  for (const name of names.sort()) {
    const root = path.join(templatesRoot, name)
    const packageJsonPath = path.join(root, 'package.json')
    const configPath = path.join(root, 'weapp-vite.config.ts')
    if (!await pathExists(packageJsonPath) || !await pathExists(configPath)) {
      continue
    }
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Partial<PackageJson>
    if (typeof packageJson.name !== 'string' || !packageJson.scripts?.build) {
      continue
    }
    templates.push({
      id: name,
      packageName: packageJson.name,
      root,
    })
  }
  return templates
}

async function prepareTemplates(id: CheckoutId, cwd: string, templates: TemplateCase[]) {
  for (const template of templates) {
    process.stdout.write(`[templates-perf] ${id}: prepare ${template.id}\n`)
    await run('pnpm', ['--filter', template.packageName, 'exec', 'wv', 'prepare'], cwd)
  }
}

async function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  await execa(command, args, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
    },
  })
}

function toReportTemplate(cwd: string, template: TemplateCase): TemplateCase {
  return {
    ...template,
    root: normalizePath(path.relative(cwd, template.root)),
  }
}

function sanitizeCheckoutOutput(cwd: string, output: string) {
  return stripVTControlCharacters(output)
    .replaceAll(normalizePath(cwd), '<checkout>')
    .replaceAll(cwd, '<checkout>')
}

function summarizeCommandOutput(output: string) {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-20)
    .join('\n')
}

function createReport(baseline: CheckoutResult, optimized: CheckoutResult): PerformanceReport {
  const buildRows = createBuildRows(baseline, optimized)
  const hmrRows = createHmrRows(baseline.hmr, optimized.hmr)
  const comparableHmrRows = hmrRows.filter(row => row.comparable)
  const comparableBuildRows = buildRows.filter(row => row.comparable)

  return {
    generatedAt: new Date().toISOString(),
    benchmark: 'templates/*',
    hmrIterations,
    buildIterations,
    hmrFilter,
    maxHmrScenariosPerTemplate,
    hmrSampleMode,
    hmrStartupTimeoutMs,
    baseline,
    optimized,
    build: {
      all: aggregateBuildRows(comparableBuildRows),
      rows: buildRows,
      failed: buildRows.filter(row => !row.comparable),
    },
    hmr: {
      all: aggregateHmrRows(comparableHmrRows),
      groups: aggregateHmrRowsByGroup(comparableHmrRows),
      rows: hmrRows,
      failed: hmrRows.filter(row => !row.comparable),
    },
  }
}

function createBuildRows(baseline: CheckoutResult, optimized: CheckoutResult): BuildComparisonRow[] {
  const baselineTemplates = new Map(baseline.build.templates.map(template => [template.id, template]))
  const optimizedTemplates = new Map(optimized.build.templates.map(template => [template.id, template]))
  const ids = [...new Set([...baselineTemplates.keys(), ...optimizedTemplates.keys()])].sort()
  return ids.map((id) => {
    const base = baselineTemplates.get(id)
    const opt = optimizedTemplates.get(id)
    const baseStats = base?.raw ?? emptyBuildStats()
    const optStats = opt?.raw ?? emptyBuildStats()
    const comparable = !!base && !!opt && baseStats.count > 0 && optStats.count > 0 && baseStats.failedCount === 0 && optStats.failedCount === 0
    return {
      id,
      packageName: base?.packageName ?? opt?.packageName ?? id,
      comparable,
      baselineError: baseStats.errors[0],
      optimizedError: optStats.errors[0],
      baseline: baseStats,
      optimized: optStats,
      totalFasterPercent: comparable ? fasterPercent(baseStats.totalAverageMs, optStats.totalAverageMs) : null,
      cliFasterPercent: comparable ? fasterPercent(baseStats.cliAverageMs, optStats.cliAverageMs) : null,
    }
  })
}

function createHmrRows(baseline: TemplatesHmrReport, optimized: TemplatesHmrReport): HmrComparisonRow[] {
  const baselineScenarios = new Map(flattenHmrScenarios(baseline).map(scenario => [scenario.key, scenario]))
  const optimizedScenarios = new Map(flattenHmrScenarios(optimized).map(scenario => [scenario.key, scenario]))
  const keys = [...new Set([...baselineScenarios.keys(), ...optimizedScenarios.keys()])].sort()
  return keys.map((key) => {
    const base = baselineScenarios.get(key)
    const opt = optimizedScenarios.get(key)
    const comparable = !!base && !!opt && !base.templateError && !opt.templateError && !base.error && !opt.error && base.samples.length > 0 && opt.samples.length > 0
    const baseStats = summarizeHmrScenario(base)
    const optStats = summarizeHmrScenario(opt)
    return {
      key,
      template: base?.template ?? opt?.template ?? '',
      scenario: base?.id ?? opt?.id ?? key,
      group: base?.group ?? opt?.group ?? '',
      label: base?.label ?? opt?.label ?? key,
      comparable,
      baselineError: base?.templateError ?? base?.error,
      optimizedError: opt?.templateError ?? opt?.error,
      baseline: baseStats,
      optimized: optStats,
      averageFasterPercent: comparable ? fasterPercent(baseStats.averageMs, optStats.averageMs) : null,
      bestFasterPercent: comparable ? fasterPercent(baseStats.bestMs, optStats.bestMs) : null,
      wallFasterPercent: comparable ? fasterPercent(baseStats.averageWallMs, optStats.averageWallMs) : null,
      bestWallFasterPercent: comparable ? fasterPercent(baseStats.bestWallMs, optStats.bestWallMs) : null,
      transformFasterPercent: comparable ? fasterPercent(baseStats.transformAverageMs, optStats.transformAverageMs) : null,
    }
  })
}

function flattenHmrScenarios(report: TemplatesHmrReport): FlatHmrScenario[] {
  return report.templates.flatMap((template) => {
    if (template.scenarios.length === 0) {
      return [{
        key: `${template.id}:__template__`,
        template: template.id,
        id: '__template__',
        group: 'template',
        label: 'template startup',
        error: undefined,
        templateError: template.error,
        samples: [],
      }]
    }
    return template.scenarios.map(scenario => ({
      ...scenario,
      key: `${template.id}:${scenario.id}:${scenario.label}`,
      template: template.id,
      templateError: template.error,
    }))
  })
}

function renderMarkdown(report: PerformanceReport) {
  const buildAggregate = report.build.all
  const hmrAggregate = report.hmr.all
  const warmBuildBaseline = report.baseline.build.warm.count > 0 ? report.baseline.build.warm : report.baseline.build.raw
  const warmBuildOptimized = report.optimized.build.warm.count > 0 ? report.optimized.build.warm : report.optimized.build.raw
  const lines = [
    '# Templates HMR / Build 性能对比',
    '',
    `- benchmark: \`${report.benchmark}\``,
    `- baseline: \`${report.baseline.commit}\``,
    `- optimized: \`${report.optimized.commit}\``,
    `- templates: \`${report.baseline.templates.length}\` baseline / \`${report.optimized.templates.length}\` optimized`,
    `- HMR 迭代：\`${report.hmrIterations}\` 次/场景`,
    `- build 迭代：\`${report.buildIterations}\` 次/模板`,
    `- HMR filter：\`${report.hmrFilter ?? 'all'}\``,
    `- HMR max scenarios/template：\`${report.maxHmrScenariosPerTemplate ?? 'all'}\``,
    `- HMR sample mode：\`${report.hmrSampleMode}\``,
    `- HMR startup timeout：\`${report.hmrStartupTimeoutMs}ms\``,
    '',
    '## 结论',
    '',
    `- Build：${buildAggregate.templateCount} 个共同模板，平均 ${formatMs(buildAggregate.totalAverageBaselineMs)} -> ${formatMs(buildAggregate.totalAverageOptimizedMs)}（${formatPercent(buildAggregate.totalFasterPercent)}）。`,
    `- Warm build：${formatMs(warmBuildBaseline.totalAverageMs)} -> ${formatMs(warmBuildOptimized.totalAverageMs)}（${formatPercent(fasterPercent(warmBuildBaseline.totalAverageMs, warmBuildOptimized.totalAverageMs))}）。`,
    `- HMR：${hmrAggregate.scenarioCount} 个共同成功场景，profile best ${formatMs(hmrAggregate.bestBaselineMs)} -> ${formatMs(hmrAggregate.bestOptimizedMs)}（${formatPercent(hmrAggregate.bestFasterPercent)}），profile 平均 ${formatMs(hmrAggregate.averageBaselineMs)} -> ${formatMs(hmrAggregate.averageOptimizedMs)}（${formatPercent(hmrAggregate.averageFasterPercent)}）。`,
    `- HMR wall：best ${formatMs(hmrAggregate.wallBestBaselineMs)} -> ${formatMs(hmrAggregate.wallBestOptimizedMs)}（${formatPercent(hmrAggregate.wallBestFasterPercent)}），平均 ${formatMs(hmrAggregate.wallAverageBaselineMs)} -> ${formatMs(hmrAggregate.wallAverageOptimizedMs)}（${formatPercent(hmrAggregate.wallFasterPercent)}）。`,
    `- HMR transform/plugin：${formatSmallMs(hmrAggregate.transformAverageBaselineMs)} -> ${formatSmallMs(hmrAggregate.transformAverageOptimizedMs)}（${formatPercent(hmrAggregate.transformFasterPercent)}）。`,
    '',
    report.hmrSampleMode === 'edit-only'
      ? '正数代表 optimized 更快，负数代表更慢。HMR 指标只统计真实编辑阶段，用于观察开发态保存后的快路径；平均值用于观察稳定性。'
      : '正数代表 optimized 更快，负数代表更慢。HMR best 表示同一场景多次真实编辑/恢复循环中的最短 profile，用于观察开发态快路径；平均值用于观察稳定性。',
    '',
    '## Build 汇总',
    '',
    '| 指标 | baseline | optimized | 变化 |',
    '|---|---:|---:|---:|',
    `| raw total avg | ${formatMs(report.baseline.build.raw.totalAverageMs)} | ${formatMs(report.optimized.build.raw.totalAverageMs)} | ${formatPercent(fasterPercent(report.baseline.build.raw.totalAverageMs, report.optimized.build.raw.totalAverageMs))} |`,
    `| warm total avg | ${formatMs(warmBuildBaseline.totalAverageMs)} | ${formatMs(warmBuildOptimized.totalAverageMs)} | ${formatPercent(fasterPercent(warmBuildBaseline.totalAverageMs, warmBuildOptimized.totalAverageMs))} |`,
    `| raw CLI build avg | ${formatMs(report.baseline.build.raw.cliAverageMs)} | ${formatMs(report.optimized.build.raw.cliAverageMs)} | ${formatPercent(fasterPercent(report.baseline.build.raw.cliAverageMs, report.optimized.build.raw.cliAverageMs))} |`,
    '',
    '## Build 模板明细',
    '',
    '| template | total avg | 变化 | CLI build | CLI 变化 |',
    '|---|---:|---:|---:|---:|',
    ...report.build.rows
      .filter(row => row.comparable)
      .map(renderBuildRow),
    '',
    '## HMR 汇总',
    '',
    '| 范围 | 场景数 | profile best | best 变化 | profile 平均 | avg 变化 | wall best 变化 | transform 变化 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    renderHmrAggregateRow('全部共同成功场景', hmrAggregate),
    ...report.hmr.groups.map(group => renderHmrAggregateRow(`group:${group.group}`, group)),
    '',
    '## HMR 场景明细',
    '',
    '| template | scenario | profile best | best 变化 | profile avg | avg 变化 | wall best | wall best 变化 | transform | transform 变化 |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...report.hmr.rows
      .filter(row => row.comparable)
      .sort((a, b) => a.template.localeCompare(b.template) || a.scenario.localeCompare(b.scenario) || a.label.localeCompare(b.label))
      .map(renderHmrRow),
  ]

  if (report.build.failed.length > 0) {
    lines.push('', '## 未纳入 Build 成对对比的模板', '')
    for (const row of report.build.failed) {
      lines.push(`- ${row.id}: baseline=${formatBuildPairStatus(row.baseline, row.baselineError)}, optimized=${formatBuildPairStatus(row.optimized, row.optimizedError)}`)
    }
  }

  if (report.hmr.failed.length > 0) {
    lines.push('', '## 未纳入 HMR 成对对比的场景', '')
    for (const row of report.hmr.failed) {
      lines.push(`- ${row.template} ${row.scenario}: baseline=${row.baselineError ? 'failed' : row.baseline.samples.length > 0 ? 'passed' : 'missing'}, optimized=${row.optimizedError ? 'failed' : row.optimized.samples.length > 0 ? 'passed' : 'missing'}`)
    }
  }

  return lines.join('\n')
}

function renderBuildRow(row: BuildComparisonRow) {
  return `| ${row.id} | ${formatMs(row.baseline.totalAverageMs)} -> ${formatMs(row.optimized.totalAverageMs)} | ${formatPercent(row.totalFasterPercent)} | ${formatMs(row.baseline.cliAverageMs)} -> ${formatMs(row.optimized.cliAverageMs)} | ${formatPercent(row.cliFasterPercent)} |`
}

function renderHmrAggregateRow(label: string, stats: HmrAggregateStats) {
  return `| ${label} | ${stats.scenarioCount} | ${formatMs(stats.bestBaselineMs)} -> ${formatMs(stats.bestOptimizedMs)} | ${formatPercent(stats.bestFasterPercent)} | ${formatMs(stats.averageBaselineMs)} -> ${formatMs(stats.averageOptimizedMs)} | ${formatPercent(stats.averageFasterPercent)} | ${formatPercent(stats.wallBestFasterPercent)} | ${formatPercent(stats.transformFasterPercent)} |`
}

function renderHmrRow(row: HmrComparisonRow) {
  return `| ${row.template} | ${row.scenario} (${row.label}) | ${formatMs(row.baseline.bestMs)} -> ${formatMs(row.optimized.bestMs)} | ${formatPercent(row.bestFasterPercent)} | ${formatMs(row.baseline.averageMs)} -> ${formatMs(row.optimized.averageMs)} | ${formatPercent(row.averageFasterPercent)} | ${formatMs(row.baseline.bestWallMs)} -> ${formatMs(row.optimized.bestWallMs)} | ${formatPercent(row.bestWallFasterPercent)} | ${formatSmallMs(row.baseline.transformAverageMs)} -> ${formatSmallMs(row.optimized.transformAverageMs)} | ${formatPercent(row.transformFasterPercent)} |`
}

function aggregateBuildRows(rows: BuildComparisonRow[]): BuildAggregateStats {
  return {
    templateCount: rows.length,
    totalAverageBaselineMs: average(rows.map(row => row.baseline.totalAverageMs).filter(isFiniteNumber)),
    totalAverageOptimizedMs: average(rows.map(row => row.optimized.totalAverageMs).filter(isFiniteNumber)),
    totalFasterPercent: fasterPercent(
      average(rows.map(row => row.baseline.totalAverageMs).filter(isFiniteNumber)),
      average(rows.map(row => row.optimized.totalAverageMs).filter(isFiniteNumber)),
    ),
    cliAverageBaselineMs: average(rows.map(row => row.baseline.cliAverageMs).filter(isFiniteNumber)),
    cliAverageOptimizedMs: average(rows.map(row => row.optimized.cliAverageMs).filter(isFiniteNumber)),
    cliFasterPercent: fasterPercent(
      average(rows.map(row => row.baseline.cliAverageMs).filter(isFiniteNumber)),
      average(rows.map(row => row.optimized.cliAverageMs).filter(isFiniteNumber)),
    ),
  }
}

function aggregateHmrRows(rows: HmrComparisonRow[]): HmrAggregateStats {
  const baselineTotals = rows.flatMap(row => row.baseline.samples)
  const optimizedTotals = rows.flatMap(row => row.optimized.samples)
  const baselineBests = rows.map(row => row.baseline.bestMs).filter(isFiniteNumber)
  const optimizedBests = rows.map(row => row.optimized.bestMs).filter(isFiniteNumber)
  const baselineWalls = rows.flatMap(row => row.baseline.wallSamples)
  const optimizedWalls = rows.flatMap(row => row.optimized.wallSamples)
  const baselineBestWalls = rows.map(row => row.baseline.bestWallMs).filter(isFiniteNumber)
  const optimizedBestWalls = rows.map(row => row.optimized.bestWallMs).filter(isFiniteNumber)
  const baselineTransforms = rows.flatMap(row => row.baseline.transformSamples)
  const optimizedTransforms = rows.flatMap(row => row.optimized.transformSamples)
  return {
    scenarioCount: rows.length,
    averageBaselineMs: average(baselineTotals),
    averageOptimizedMs: average(optimizedTotals),
    averageFasterPercent: fasterPercent(average(baselineTotals), average(optimizedTotals)),
    bestBaselineMs: average(baselineBests),
    bestOptimizedMs: average(optimizedBests),
    bestFasterPercent: fasterPercent(average(baselineBests), average(optimizedBests)),
    wallAverageBaselineMs: average(baselineWalls),
    wallAverageOptimizedMs: average(optimizedWalls),
    wallFasterPercent: fasterPercent(average(baselineWalls), average(optimizedWalls)),
    wallBestBaselineMs: average(baselineBestWalls),
    wallBestOptimizedMs: average(optimizedBestWalls),
    wallBestFasterPercent: fasterPercent(average(baselineBestWalls), average(optimizedBestWalls)),
    transformAverageBaselineMs: average(baselineTransforms),
    transformAverageOptimizedMs: average(optimizedTransforms),
    transformFasterPercent: fasterPercent(average(baselineTransforms), average(optimizedTransforms)),
  }
}

function aggregateHmrRowsByGroup(rows: HmrComparisonRow[]): HmrGroupAggregateStats[] {
  const groups = new Map<string, HmrComparisonRow[]>()
  for (const row of rows) {
    const group = row.group || 'unknown'
    groups.set(group, [...(groups.get(group) ?? []), row])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, groupRows]) => ({
      ...aggregateHmrRows(groupRows),
      group,
    }))
}

function summarizeBuild(samples: TemplateBuildSample[]): BuildStats {
  const successfulSamples = samples.filter(sample => sample.status === 0)
  const totals = successfulSamples.map(sample => sample.totalMs)
  const cliBuilds = successfulSamples.map(sample => sample.cliBuildMs).filter(isFiniteNumber)
  return {
    totalAverageMs: average(totals),
    totalMedianMs: median(totals),
    cliAverageMs: average(cliBuilds),
    cliMedianMs: median(cliBuilds),
    count: successfulSamples.length,
    errors: samples.map(sample => sample.error).filter((error): error is string => typeof error === 'string'),
    failedCount: samples.filter(sample => sample.status !== 0).length,
  }
}

function summarizeHmrScenario(scenario?: FlatHmrScenario): HmrScenarioStats {
  const samples = scenario?.samples.map(sample => sample.totalMs).filter(isFiniteNumber) ?? []
  const wallSamples = scenario?.samples.map(sample => sample.wallMs).filter(isFiniteNumber) ?? []
  const transformSamples = scenario?.samples.map(sample => sample.transformMs).filter(isFiniteNumber) ?? []
  return {
    averageMs: average(samples),
    bestMs: min(samples),
    averageWallMs: average(wallSamples),
    bestWallMs: min(wallSamples),
    samples,
    wallSamples,
    transformAverageMs: average(transformSamples),
    transformSamples,
  }
}

function emptyBuildStats(): BuildStats {
  return {
    totalAverageMs: null,
    totalMedianMs: null,
    cliAverageMs: null,
    cliMedianMs: null,
    count: 0,
    errors: [],
    failedCount: 0,
  }
}

function average(values: number[]) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]) {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function min(values: number[]) {
  return values.length === 0 ? null : Math.min(...values)
}

function fasterPercent(baseline: number | null, optimized: number | null) {
  return baseline && optimized != null ? (baseline - optimized) / baseline * 100 : null
}

function parseCliBuildMs(output: string) {
  const match = output.match(/(?:built in\s*|耗时：)(?:(\d+(?:\.\d+)?)s|(\d+)ms)/)
  if (!match) {
    return null
  }
  return match[1] ? Number.parseFloat(match[1]) * 1000 : Number.parseInt(match[2]!, 10)
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function readOptionalPositiveIntegerEnv(name: string) {
  const raw = process.env[name]
  if (!raw) {
    return undefined
  }
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${raw}`)
  }
  return value
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

function formatMs(value: number | null) {
  return value == null ? '-' : `${value.toFixed(1)}ms`
}

function formatSmallMs(value: number | null) {
  return value == null ? '-' : `${value.toFixed(3)}ms`
}

function formatPercent(value: number | null) {
  return value == null ? '-' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatBuildPairStatus(stats: BuildStats, error: string | undefined) {
  if (error) {
    return 'failed'
  }
  return stats.count > 0 ? 'passed' : 'missing'
}

function normalizePath(value: string) {
  return value.replaceAll('\\', '/')
}

type CheckoutId = 'baseline' | 'optimized'

interface PackageJson {
  name: string
  scripts: Record<string, string>
}

interface TemplateCase {
  id: string
  packageName: string
  root: string
}

interface TemplateBuildSample {
  iteration: number
  template: string
  packageName: string
  totalMs: number
  cliBuildMs: number | null
  error?: string
  status: number
}

interface BuildStats {
  totalAverageMs: number | null
  totalMedianMs: number | null
  cliAverageMs: number | null
  cliMedianMs: number | null
  count: number
  errors: string[]
  failedCount: number
}

interface TemplateBuildStats {
  id: string
  packageName: string
  raw: BuildStats
  warm: BuildStats
}

interface CheckoutResult {
  id: CheckoutId
  commit: string
  templates: TemplateCase[]
  build: {
    samples: TemplateBuildSample[]
    raw: BuildStats
    warm: BuildStats
    templates: TemplateBuildStats[]
  }
  hmr: TemplatesHmrReport
}

interface TemplatesHmrReport {
  templates: TemplateHmrResult[]
}

interface TemplateHmrResult {
  error?: string
  id: string
  scenarios: TemplateHmrScenario[]
}

interface TemplateHmrScenario {
  error?: string
  group: string
  id: string
  label: string
  samples: Array<{
    totalMs?: number
    transformMs?: number
    wallMs?: number
  }>
}

interface FlatHmrScenario extends TemplateHmrScenario {
  key: string
  template: string
  templateError?: string
}

interface BuildComparisonRow {
  id: string
  packageName: string
  comparable: boolean
  baselineError?: string
  optimizedError?: string
  baseline: BuildStats
  optimized: BuildStats
  totalFasterPercent: number | null
  cliFasterPercent: number | null
}

interface HmrScenarioStats {
  averageMs: number | null
  bestMs: number | null
  averageWallMs: number | null
  bestWallMs: number | null
  samples: number[]
  wallSamples: number[]
  transformAverageMs: number | null
  transformSamples: number[]
}

interface HmrComparisonRow {
  key: string
  template: string
  scenario: string
  group: string
  label: string
  comparable: boolean
  baselineError?: string
  optimizedError?: string
  baseline: HmrScenarioStats
  optimized: HmrScenarioStats
  averageFasterPercent: number | null
  bestFasterPercent: number | null
  wallFasterPercent: number | null
  bestWallFasterPercent: number | null
  transformFasterPercent: number | null
}

interface BuildAggregateStats {
  templateCount: number
  totalAverageBaselineMs: number | null
  totalAverageOptimizedMs: number | null
  totalFasterPercent: number | null
  cliAverageBaselineMs: number | null
  cliAverageOptimizedMs: number | null
  cliFasterPercent: number | null
}

interface HmrAggregateStats {
  scenarioCount: number
  averageBaselineMs: number | null
  averageOptimizedMs: number | null
  averageFasterPercent: number | null
  bestBaselineMs: number | null
  bestOptimizedMs: number | null
  bestFasterPercent: number | null
  wallAverageBaselineMs: number | null
  wallAverageOptimizedMs: number | null
  wallFasterPercent: number | null
  wallBestBaselineMs: number | null
  wallBestOptimizedMs: number | null
  wallBestFasterPercent: number | null
  transformAverageBaselineMs: number | null
  transformAverageOptimizedMs: number | null
  transformFasterPercent: number | null
}

interface HmrGroupAggregateStats extends HmrAggregateStats {
  group: string
}

interface PerformanceReport {
  generatedAt: string
  benchmark: string
  hmrIterations: number
  buildIterations: number
  hmrFilter: string | null
  maxHmrScenariosPerTemplate: number | undefined
  hmrSampleMode: 'best-of-cycle' | 'edit-only'
  hmrStartupTimeoutMs: number
  baseline: CheckoutResult
  optimized: CheckoutResult
  build: {
    all: BuildAggregateStats
    rows: BuildComparisonRow[]
    failed: BuildComparisonRow[]
  }
  hmr: {
    all: HmrAggregateStats
    groups: HmrGroupAggregateStats[]
    rows: HmrComparisonRow[]
    failed: HmrComparisonRow[]
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
