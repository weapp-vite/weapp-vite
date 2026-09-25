/* eslint-disable style/max-statements-per-line */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { collectRegressions, performanceVerdict, renderTemplateRows } from './performanceReport/metrics.mjs'
import { validateArtifact } from './runtime-size-schema.mjs'

export const COMMENT_MARKER = '<!-- weapp-vite-performance-report -->'
const MAX_ERRORS = 20

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
      try {
        result.platforms.push(normalizeTemplates(value, platformFromPath(file)))
      }
      catch (error) {
        result.errors.push(`templates: ${error.message}`)
      }
    }
  }

  for (const file of await findJsonFiles(runtimeRoot)) {
    const value = await readJson(file, result.errors)
    if (!value || value.kind !== 'wevu-runtime-size-pr-report') { continue }
    try {
      validateArtifact(value, runtimeExpected)
      if (!result.runtimeSize || value.version >= result.runtimeSize.current.version) {
        result.runtimeSize = normalizeRuntimeSize(value)
      }
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
    `**采集状态：${statusLabel(status)}**`,
    `**性能结论：${performanceVerdict(data)}**`,
    '',
    '| 项目 | 值 |',
    '| --- | --- |',
    `| PR | #${metadata.prNumber} |`,
    `| head | \`${metadata.headSha ?? 'unknown'}\` |`,
    `| base | \`${metadata.baseSha ?? 'unknown'}\` |`,
    `| 生成时间 | \`${metadata.generatedAt ?? new Date().toISOString()}\` |`,
  ]

  if (runs.length) {
    lines.push(`| Actions | ${runs.map(run => `[${escapeText(run.name)}](${run.url}) ${formatDuration(run.durationMs)}`).join('，')} |`)
  }

  if (data.platforms.length) {
    lines.push('', '### 构建与 HMR', '', '| 平台 | 首次构建 | 重复构建 | CLI build | 峰值 RSS | HMR core | HMR wall | HMR heap | HMR RSS |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
    lines.push(...renderTemplateRows(data.platforms, formatPair))
  }

  if (data.autoImport) {
    lines.push('', '### 自动导入启用成本（同一提交）', '', '关闭自动导入并手动注册，与开启自动导入比较；不是 main 与 PR 的跨提交回退。', '', '| 类型 | 场景 | 手动注册 | 自动导入 | 启用成本 | 内存 |', '| --- | ---: | ---: | ---: | ---: | --- |')
    for (const result of data.autoImport.build?.results ?? []) {
      lines.push(`| Build | ${result.usedCount} 组件 | ${formatMs(result.baseline?.mean)} | ${formatMs(result.current?.mean)} | ${formatDelta(result.delta?.extraMs, result.delta?.extraPercent)} | ${formatPair(memoryMean(result.baselineMemory), memoryMean(result.currentMemory), 'bytes')} |`)
    }
    for (const result of data.autoImport.hmr?.results ?? []) {
      lines.push(`| HMR update | ${result.usedCount} 组件 | ${formatMs(result.update?.baseline?.mean)} | ${formatMs(result.update?.current?.mean)} | ${formatDelta(result.update?.delta?.extraMs, result.update?.delta?.extraPercent)} | heap ${formatPair(memoryMean(result.update?.baselineMemory, 'heapUsed'), memoryMean(result.update?.currentMemory, 'heapUsed'), 'bytes')} / RSS ${formatPair(memoryMean(result.update?.baselineMemory, 'rss'), memoryMean(result.update?.currentMemory, 'rss'), 'bytes')} |`)
    }
  }

  if (data.runtimeSize) {
    lines.push('', '### 运行时体积', '', '| 端 | Production | gzip |', '| --- | ---: | ---: |')
    for (const target of data.runtimeSize.current.targets) {
      const baseline = data.runtimeSize.baseline.targets.find(item => item.id === target.id)
      const currentTier = target.tiers.at(-1)
      const baselineTier = baseline?.tiers.at(-1)
      lines.push(`| ${escapeText(target.label ?? target.id)} | ${formatPair(baselineTier?.production?.bytes, currentTier?.production?.bytes, 'bytes')} | ${currentTier?.production?.gzipBytes == null ? '不适用' : formatPair(baselineTier?.production?.gzipBytes, currentTier.production.gzipBytes, 'bytes')} |`)
    }
  }

  const regressions = collectRegressions(data)
  lines.push('', '### 关键回归', '')
  if (regressions.length === 0) {
    lines.push('- 已采集指标中没有成本增加项；缺失或不足的样本不代表性能通过。')
  }
  else {
    for (const item of regressions) { lines.push(`- **${escapeText(item.area)} / ${escapeText(item.metric)}**：${formatDelta(item.delta, item.percent, item.unit)}。`) }
  }

  if (data.errors.length) {
    lines.push('', '### 采集问题', '', ...data.errors.map(error => `- ${escapeText(error)}`))
  }

  if (artifacts.length || runs.length) {
    lines.push('', '<details>', '<summary>运行环境与完整报告</summary>', '')
    if (metadata.os) { lines.push(`- 评论生成 runner（非采样环境）：${escapeText(metadata.os)}`) }
    if (metadata.node) { lines.push(`- 评论生成 Node（非采样版本）：${escapeText(metadata.node)}`) }
    if (metadata.pnpm) { lines.push(`- pnpm：${escapeText(metadata.pnpm)}`) }
    for (const artifact of artifacts) { lines.push(`- [artifact: ${escapeText(artifact.name)}](${artifact.url})`) }
    for (const run of runs) { lines.push(`- [Actions 运行记录：${escapeText(run.name)}](${run.url})`) }
    lines.push('', '</details>')
  }

  lines.push('', '_变化统一为当前减基线，正数表示耗时、内存或体积增加。单轮样本只作异常线索；性能门禁与采集完成分别判定，完整原始数据见 artifacts。_')
  return lines.join('\n')
}

function isAutoImportReport(value) {
  return isObject(value) && isObject(value.build) && isObject(value.hmr) && Array.isArray(value.build.results) && Array.isArray(value.hmr.results)
}

function isTemplatesReport(value) {
  return isObject(value) && isObject(value.baseline) && isObject(value.optimized) && isObject(value.build) && isObject(value.hmr) && isObject(value.build.all) && isObject(value.hmr.all)
}

function normalizeAutoImport(value) {
  return { ...value }
}

function normalizeTemplates(value, platform) {
  if (!isObject(value.baseline.build) || !isObject(value.optimized.build) || !isObject(value.baseline.hmr) || !isObject(value.optimized.hmr) || !Array.isArray(value.build.rows) || !Array.isArray(value.hmr.rows)) {
    throw new Error('invalid build/HMR sample structure')
  }
  return { platform, ...value }
}

function normalizeRuntimeSize(value) {
  return { baseline: value.baseline, current: value.current }
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
      else if (entry.isFile() && ['report.json', 'report-full.json'].includes(entry.name)) { files.push(target) }
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

function formatPair(baseline, current, unit) {
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) { return '不可用' }
  const delta = current - baseline
  const percent = baseline === 0 ? undefined : (current - baseline) / baseline * 100
  const sign = delta > 0 ? '+' : ''
  return `${formatValue(current, unit)} (${sign}${formatValue(delta, unit)}, ${percent == null ? 'n/a' : `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`})`
}

function formatDelta(delta, percent, unit = 'ms') {
  if (!Number.isFinite(delta)) { return '-' }
  const sign = delta > 0 ? '+' : ''
  return `${sign}${formatValue(delta, unit)}${Number.isFinite(percent) ? ` (${sign}${percent.toFixed(1)}%)` : ''}`
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
function statusLabel(status) { return ({ passed: '已完成', partial: '部分完成', pending: '等待基准', failed: '采集失败' })[status] ?? status }
function escapeText(value) { return String(value).replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\n', ' ') }
function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value) }
