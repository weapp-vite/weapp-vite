/* eslint-disable style/max-statements-per-line */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export const COMMENT_MARKER = '<!-- weapp-vite-performance-report -->'
const MAX_ERRORS = 20
const MAX_REGRESSIONS = 8

export async function collectPerformanceReports({ performanceRoot, runtimeRoot, runtimeExpected }) {
  const result = {
    platforms: [],
    autoImport: undefined,
    runtimeSize: undefined,
    errors: [],
  }

  for (const file of await findJsonFiles(performanceRoot)) {
    const value = await readJson(file, result.errors)
    if (!value) { continue }
    if (isAutoImportReport(value)) {
      result.autoImport = normalizeAutoImport(value)
      continue
    }
    if (isTemplatesReport(value)) {
      result.platforms.push(normalizeTemplates(value, platformFromPath(file)))
    }
  }

  for (const file of await findJsonFiles(runtimeRoot)) {
    const value = await readJson(file, result.errors)
    if (!value || value.kind !== 'wevu-runtime-size-pr-report') { continue }
    try {
      validateRuntimeArtifact(value, runtimeExpected)
      result.runtimeSize = normalizeRuntimeSize(value)
    }
    catch (error) {
      result.errors.push(`runtime-size: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  result.errors = result.errors.slice(0, MAX_ERRORS)
  return result
}

export function reportStatus(data, { performanceConclusion = 'success', runtimeConclusion = 'success' } = {}) {
  if (!['success', 'pending'].includes(performanceConclusion) || !['success', 'pending'].includes(runtimeConclusion)) { return 'failed' }
  const hasPerformance = data.platforms.length > 0 || data.autoImport
  const hasRuntime = !!data.runtimeSize
  if (data.errors.length > 0 && !hasPerformance && !hasRuntime) { return 'failed' }
  if (!hasPerformance && !hasRuntime) { return 'pending' }
  if (!hasPerformance || !hasRuntime || data.errors.length > 0) { return 'partial' }
  return 'passed'
}

export function renderPerformanceComment({ data, metadata, runs = [], artifacts = [], conclusions = {} }) {
  const status = reportStatus(data, conclusions)
  const lines = [
    COMMENT_MARKER,
    '## weapp-vite PR 性能基准报告',
    '',
    `**状态：${statusLabel(status)}**`,
    '',
    '| 项目 | 值 |',
    '| --- | --- |',
    `| PR | #${metadata.prNumber} |`,
    `| head | \`${shortSha(metadata.headSha)}\` |`,
    `| base | \`${shortSha(metadata.baseSha)}\` |`,
    `| 生成时间 | \`${metadata.generatedAt ?? new Date().toISOString()}\` |`,
  ]

  if (runs.length) {
    lines.push(`| Actions | ${runs.map(run => `[${escapeText(run.name)}](${run.url}) ${formatDuration(run.durationMs)}`).join('，')} |`)
  }

  if (data.platforms.length) {
    lines.push('', '### 构建与 HMR', '', '| 平台 | Build raw | Warm build | CLI build | 峰值 RSS | HMR core | HMR wall | HMR heap | HMR RSS |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
    for (const platform of data.platforms.sort((a, b) => a.platform.localeCompare(b.platform))) {
      const build = platform.optimized.build?.all ?? {}
      const baseBuild = platform.baseline.build?.all ?? {}
      const hmr = platform.optimized.hmr?.all ?? {}
      const baseHmr = platform.baseline.hmr?.all ?? {}
      lines.push(`| ${escapeText(platform.platform)} | ${formatPair(baseBuild.totalAverageBaselineMs, build.totalAverageOptimizedMs, 'ms', true)} | ${formatPair(platform.baselineWarmMs, platform.optimizedWarmMs, 'ms', true)} | ${formatPair(baseBuild.cliAverageBaselineMs, build.cliAverageOptimizedMs, 'ms', true)} | ${formatPair(baseBuild.rssPeakAverageBaselineBytes, build.rssPeakAverageOptimizedBytes, 'bytes', false)} | ${formatPair(baseHmr.coreAverageBaselineMs, hmr.coreAverageOptimizedMs, 'ms', true)} | ${formatPair(baseHmr.wallAverageBaselineMs, hmr.wallAverageOptimizedMs, 'ms', true)} | ${formatPair(baseHmr.heapUsedAverageBaselineBytes, hmr.heapUsedAverageOptimizedBytes, 'bytes', false)} | ${formatPair(baseHmr.rssAverageBaselineBytes, hmr.rssAverageOptimizedBytes, 'bytes', false)} |`)
    }
  }

  if (data.autoImport) {
    lines.push('', '### 自动导入', '', '| 类型 | 场景 | 基线 | 当前 | 变化 | 内存 |', '| --- | ---: | ---: | ---: | ---: | --- |')
    for (const result of data.autoImport.build?.results ?? []) {
      lines.push(`| Build | ${result.usedCount} 组件 | ${formatMs(result.baseline?.mean)} | ${formatMs(result.current?.mean)} | ${formatDelta(result.delta?.extraMs, result.delta?.extraPercent)} | ${formatPair(memoryMean(result.baselineMemory), memoryMean(result.currentMemory), 'bytes', false)} |`)
    }
    for (const result of data.autoImport.hmr?.results ?? []) {
      lines.push(`| HMR update | ${result.usedCount} 组件 | ${formatMs(result.update?.baseline?.mean)} | ${formatMs(result.update?.current?.mean)} | ${formatDelta(result.update?.delta?.extraMs, result.update?.delta?.extraPercent)} | heap ${formatPair(memoryMean(result.update?.baselineMemory, 'heapUsed'), memoryMean(result.update?.currentMemory, 'heapUsed'), 'bytes', false)} / RSS ${formatPair(memoryMean(result.update?.baselineMemory, 'rss'), memoryMean(result.update?.currentMemory, 'rss'), 'bytes', false)} |`)
    }
  }

  if (data.runtimeSize) {
    lines.push('', '### 运行时体积', '', '| 端 | Production | gzip |', '| --- | ---: | ---: |')
    for (const target of data.runtimeSize.current.targets) {
      const baseline = data.runtimeSize.baseline.targets.find(item => item.id === target.id)
      const currentTier = target.tiers.at(-1)
      const baselineTier = baseline?.tiers.at(-1)
      lines.push(`| ${escapeText(target.label ?? target.id)} | ${formatPair(baselineTier?.production?.bytes, currentTier?.production?.bytes, 'bytes', false)} | ${currentTier?.production?.gzipBytes == null ? '不适用' : formatPair(baselineTier?.production?.gzipBytes, currentTier.production.gzipBytes, 'bytes', false)} |`)
    }
  }

  const regressions = collectRegressions(data)
  lines.push('', '### 关键回归', '')
  if (regressions.length === 0) {
    lines.push('- 未发现可比较的正向回归项。')
  }
  else {
    for (const item of regressions) { lines.push(`- **${escapeText(item.area)} / ${escapeText(item.metric)}**：${formatDelta(item.delta, item.percent)}。`) }
  }

  if (data.errors.length) {
    lines.push('', '### 采集问题', '', ...data.errors.map(error => `- ${escapeText(error)}`))
  }

  if (artifacts.length || runs.length) {
    lines.push('', '<details>', '<summary>运行环境与完整报告</summary>', '')
    if (metadata.os) { lines.push(`- runner：${escapeText(metadata.os)}`) }
    if (metadata.node) { lines.push(`- Node：${escapeText(metadata.node)}`) }
    if (metadata.pnpm) { lines.push(`- pnpm：${escapeText(metadata.pnpm)}`) }
    for (const artifact of artifacts) { lines.push(`- [artifact: ${escapeText(artifact.name)}](${artifact.url})`) }
    for (const run of runs) { lines.push(`- [Actions 运行记录：${escapeText(run.name)}](${run.url})`) }
    lines.push('', '</details>')
  }

  lines.push('', '_本报告为信息性基准，runner 噪声可能影响单次结果；完整原始数据见 artifacts。_')
  return lines.join('\n')
}

function isAutoImportReport(value) {
  return isObject(value) && isObject(value.build) && isObject(value.hmr) && Array.isArray(value.build.results) && Array.isArray(value.hmr.results)
}

function isTemplatesReport(value) {
  return isObject(value) && isObject(value.baseline) && isObject(value.optimized) && isObject(value.build) && isObject(value.hmr) && isObject(value.build.all) && isObject(value.hmr.all)
}

function normalizeAutoImport(value) {
  return { build: value.build, hmr: value.hmr }
}

function normalizeTemplates(value, platform) {
  const baselineWarm = value.baseline.build.warm?.totalAverageMs ?? value.baseline.build.raw?.totalAverageMs
  const optimizedWarm = value.optimized.build.warm?.totalAverageMs ?? value.optimized.build.raw?.totalAverageMs
  return { platform, baseline: value.baseline, optimized: value.optimized, baselineWarmMs: baselineWarm, optimizedWarmMs: optimizedWarm }
}

function normalizeRuntimeSize(value) {
  return { baseline: value.baseline, current: value.current }
}

function validateRuntimeArtifact(value, expected = {}) {
  if (![2, 3].includes(value.version) || !isObject(value.current) || !isObject(value.baseline)) { throw new Error('unsupported runtime-size artifact') }
  if (expected.repository && value.repository !== expected.repository) { throw new Error('repository does not match') }
  if (expected.prNumber != null && value.prNumber !== expected.prNumber) { throw new Error('PR number does not match') }
  if (expected.headSha && value.headSha !== expected.headSha) { throw new Error('head SHA does not match') }
  for (const report of [value.current, value.baseline]) {
    if (report.version !== value.version || !Array.isArray(report.targets) || report.targets.length !== 2) { throw new Error('invalid runtime-size report') }
    for (const target of report.targets) {
      if (!Array.isArray(target.tiers) || target.tiers.length !== 5) { throw new Error('invalid runtime-size tiers') }
      for (const tier of target.tiers) {
        if (!Number.isSafeInteger(tier.dev?.bytes) || !Number.isSafeInteger(tier.production?.bytes)) { throw new TypeError('invalid runtime-size bytes') }
      }
    }
  }
}

async function findJsonFiles(root) {
  if (!root) { return [] }
  const files = []
  async function visit(dir) {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) }
    catch { return }
    for (const entry of entries) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) { await visit(target) }
      else if (entry.isFile() && entry.name === 'report.json') { files.push(target) }
    }
  }
  await visit(root)
  return files
}

async function readJson(file, errors) {
  try { return JSON.parse(await readFile(file, 'utf8')) }
  catch (error) {
    errors.push(`${path.basename(file)}: invalid JSON (${error instanceof Error ? error.message : String(error)})`)
    return undefined
  }
}

function platformFromPath(file) {
  const match = file.replaceAll('\\', '/').match(/templates-performance-report-([^/]+)/)
  return match?.[1] ?? 'unknown'
}

function collectRegressions(data) {
  const values = []
  for (const platform of data.platforms) {
    const build = platform.optimized.build?.all ?? {}
    const baseBuild = platform.baseline.build?.all ?? {}
    const hmr = platform.optimized.hmr?.all ?? {}
    const baseHmr = platform.baseline.hmr?.all ?? {}
    addRegression(values, platform.platform, 'build raw', build.totalAverageOptimizedMs, baseBuild.totalAverageBaselineMs)
    addRegression(values, platform.platform, 'warm build', platform.optimizedWarmMs, platform.baselineWarmMs)
    addRegression(values, platform.platform, 'build RSS', build.rssPeakAverageOptimizedBytes, baseBuild.rssPeakAverageBaselineBytes, true)
    addRegression(values, platform.platform, 'HMR core', hmr.coreAverageOptimizedMs, baseHmr.coreAverageBaselineMs)
    addRegression(values, platform.platform, 'HMR wall', hmr.wallAverageOptimizedMs ?? hmr.wallAverageMs, baseHmr.wallAverageBaselineMs ?? baseHmr.wallAverageMs)
    addRegression(values, platform.platform, 'HMR RSS', hmr.rssAverageOptimizedBytes, baseHmr.rssAverageBaselineBytes, true)
  }
  values.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return values.slice(0, MAX_REGRESSIONS)
}

function addRegression(values, area, metric, current, baseline, raw = false) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) { return }
  const delta = current - baseline
  if (delta <= 0) { return }
  values.push({ area, metric, delta: raw ? delta : delta, percent: baseline === 0 ? undefined : delta / baseline * 100 })
}

function formatPair(baseline, current, unit, lowerIsBetter) {
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) { return '-' }
  const delta = current - baseline
  const percent = baseline === 0 ? undefined : (lowerIsBetter ? (baseline - current) / baseline : (baseline - current) / baseline) * 100
  const sign = delta > 0 ? '+' : ''
  return `${formatValue(current, unit)} (${sign}${formatValue(delta, unit)}, ${percent == null ? 'n/a' : `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`})`
}

function formatDelta(delta, percent) {
  if (!Number.isFinite(delta)) { return '-' }
  const sign = delta > 0 ? '+' : ''
  return `${sign}${formatMs(delta)}${Number.isFinite(percent) ? ` (${sign}${percent.toFixed(1)}%)` : ''}`
}

function formatValue(value, unit) {
  if (!Number.isFinite(value)) { return '-' }
  return unit === 'bytes' ? formatBytes(value) : formatMs(value)
}

function formatMs(value) { return Number.isFinite(value) ? `${Number(value).toFixed(1)} ms` : '-' }
function formatBytes(value) {
  if (!Number.isFinite(value)) { return '-' }
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let index = 0
  let result = Math.abs(value)
  while (result >= 1024 && index < units.length - 1) { result /= 1024; index += 1 }
  return `${value < 0 ? '-' : ''}${index === 0 ? Math.round(result) : result.toFixed(1)} ${units[index]}`
}

function memoryMean(memory, field = 'mean') {
  if (Number.isFinite(memory?.[field])) { return memory[field] }
  if (Number.isFinite(memory?.[field]?.mean)) { return memory[field].mean }
  return Number.isFinite(memory?.mean) ? memory.mean : undefined
}

function formatDuration(value) { return Number.isFinite(value) ? `(${(value / 1000).toFixed(1)}s)` : '' }
function shortSha(value) { return typeof value === 'string' ? value.slice(0, 12) : 'unknown' }
function statusLabel(status) { return ({ passed: '通过', partial: '部分完成', pending: '等待基准', failed: '采集失败' })[status] ?? status }
function escapeText(value) { return String(value).replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\n', ' ') }
function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value) }
