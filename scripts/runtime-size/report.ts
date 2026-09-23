import type { RuntimeSizePrArtifact, RuntimeSizeReport } from '../runtime-size'
import type { RuntimeSizeTier } from '../runtime-size-config'

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateReport } from '../../.github/scripts/runtime-size-schema.mjs'
import { RUNTIME_SIZE_REPORT_VERSION, runtimeSizeTiers } from '../runtime-size-config'

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
  return validateReport(JSON.parse(await readFile(file, 'utf8')), 'report', RUNTIME_SIZE_REPORT_VERSION) as RuntimeSizeReport
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

export function createRuntimeSizeLegacyArtifact(artifact: RuntimeSizePrArtifact) {
  const legacyTiers = ['reactivity-core', 'minimal-app', 'typical-page', 'complex-component', 'full-provider']
  const projectReport = (report: RuntimeSizeReport) => ({
    ...report,
    version: 2 as const,
    targets: ['weapp', 'web'].map((id) => {
      const target = report.targets.find(target => target.id === id)!
      return { ...target, tiers: legacyTiers.map(id => target.tiers.find(tier => tier.id === id)!) }
    }),
  })
  return { ...artifact, version: 2 as const, current: projectReport(artifact.current), baseline: projectReport(artifact.baseline) }
}
