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

export function createSourceCompareReport(options: {
  sourcePath: string
  artifactPath: string
  stats: SourceCompareStats
}) {
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
  ].join('\n')
}
