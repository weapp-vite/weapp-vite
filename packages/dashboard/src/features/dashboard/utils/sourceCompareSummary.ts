import { formatBytes } from './format'

export interface SourceCompareStats {
  sourceLines: number
  artifactLines: number
  addedLines: number
  removedLines: number
  sourceBytes: number
  artifactBytes: number
  byteDelta: number
  unchangedLineRatio: number
}

export type SourceCompareInsightTone = 'success' | 'warning' | 'info'

export interface SourceCompareInsight {
  id: string
  label: string
  value: string
  detail: string
  tone: SourceCompareInsightTone
}

function splitComparableLines(content: string) {
  if (!content) {
    return []
  }
  return content.replace(/\r\n?/g, '\n').split('\n')
}

function countBytes(content: string) {
  return new TextEncoder().encode(content).byteLength
}

function createLineCountMap(lines: string[]) {
  const map = new Map<string, number>()
  for (const line of lines) {
    map.set(line, (map.get(line) ?? 0) + 1)
  }
  return map
}

export function createSourceCompareStats(sourceContent: string, artifactContent: string): SourceCompareStats {
  const sourceLines = splitComparableLines(sourceContent)
  const artifactLines = splitComparableLines(artifactContent)
  const artifactLineCounts = createLineCountMap(artifactLines)
  let unchangedLines = 0

  for (const line of sourceLines) {
    const count = artifactLineCounts.get(line) ?? 0
    if (count <= 0) {
      continue
    }
    unchangedLines += 1
    if (count === 1) {
      artifactLineCounts.delete(line)
    }
    else {
      artifactLineCounts.set(line, count - 1)
    }
  }

  const sourceBytes = countBytes(sourceContent)
  const artifactBytes = countBytes(artifactContent)
  return {
    sourceLines: sourceLines.length,
    artifactLines: artifactLines.length,
    addedLines: Math.max(artifactLines.length - unchangedLines, 0),
    removedLines: Math.max(sourceLines.length - unchangedLines, 0),
    sourceBytes,
    artifactBytes,
    byteDelta: artifactBytes - sourceBytes,
    unchangedLineRatio: sourceLines.length > 0 ? unchangedLines / sourceLines.length : 1,
  }
}

export function formatSignedBytes(bytes: number) {
  if (bytes === 0) {
    return '无变化'
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function createSourceCompareInsights(stats: SourceCompareStats): SourceCompareInsight[] {
  const retentionTone: SourceCompareInsightTone = stats.unchangedLineRatio >= 0.7
    ? 'success'
    : stats.unchangedLineRatio >= 0.35 ? 'info' : 'warning'
  const sizeTone: SourceCompareInsightTone = stats.byteDelta > 10 * 1024
    ? 'warning'
    : stats.byteDelta < -1024 ? 'success' : 'info'
  const churnTone: SourceCompareInsightTone = stats.addedLines > stats.removedLines * 2 && stats.addedLines > 20
    ? 'warning'
    : stats.removedLines > stats.addedLines * 2 && stats.removedLines > 20 ? 'success' : 'info'

  return [
    {
      id: 'retention',
      label: '源码保留',
      value: formatPercent(stats.unchangedLineRatio),
      detail: retentionTone === 'warning'
        ? '源码行在产物中保留较少，建议检查编译注入、运行时包装或转译膨胀。'
        : retentionTone === 'success' ? '源码结构在产物中较容易追踪，适合继续逐段定位差异。' : '产物保留了部分源码结构，可结合 diff 继续确认主要变化段。',
      tone: retentionTone,
    },
    {
      id: 'size',
      label: '字节影响',
      value: formatSignedBytes(stats.byteDelta),
      detail: sizeTone === 'warning'
        ? '产物明显大于源码，优先查看新增运行时代码、公共 helper 和重复片段。'
        : sizeTone === 'success' ? '产物比源码更紧凑，当前转换结果对体积较友好。' : '字节变化较小，体积影响暂时可控。',
      tone: sizeTone,
    },
    {
      id: 'churn',
      label: '行变动',
      value: `${stats.addedLines} / ${stats.removedLines}`,
      detail: churnTone === 'warning'
        ? '新增行明显多于删除行，建议优先检查模板展开、样式注入或 helper 合并策略。'
        : churnTone === 'success' ? '删除行明显多于新增行，说明转换后结构有所收敛。' : '新增和删除相对均衡，适合直接用 diff 定位关键段。',
      tone: churnTone,
    },
  ]
}

export function createSourceCompareReport(options: {
  sourcePath: string
  artifactPath: string
  stats: SourceCompareStats
  insights?: SourceCompareInsight[]
}) {
  const insights = options.insights ?? createSourceCompareInsights(options.stats)
  return [
    '# dashboard 源码对比摘要',
    '',
    `源码：${options.sourcePath}`,
    `产物：${options.artifactPath}`,
    '',
    `- 源码行数：${options.stats.sourceLines}`,
    `- 产物行数：${options.stats.artifactLines}`,
    `- 估算新增行：${options.stats.addedLines}`,
    `- 估算删除行：${options.stats.removedLines}`,
    `- 字节变化：${formatSignedBytes(options.stats.byteDelta)}`,
    `- 未变更行占比：${Math.round(options.stats.unchangedLineRatio * 100)}%`,
    '',
    '## 洞察',
    ...insights.map(item => `- ${item.label}（${item.value}）：${item.detail}`),
    '',
  ].join('\n')
}
