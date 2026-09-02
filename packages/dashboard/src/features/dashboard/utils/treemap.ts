import type { TreemapNodeMeta } from '../types'
import { formatBytes, formatModuleIdentifier, formatSourceType } from './format'

const nodeIdDelimiter = '\u0000'

export const TREEMAP_LEVELS = [
  {
    itemStyle: {
      borderWidth: 3,
      gapWidth: 3,
    },
    upperLabel: {
      show: true,
      height: 28,
      fontSize: 12,
      fontWeight: 650,
      lineHeight: 17,
      overflow: 'truncate',
      textBorderWidth: 0,
    },
  },
  {
    itemStyle: {
      borderWidth: 1.5,
      gapWidth: 1.5,
    },
    upperLabel: {
      show: true,
      height: 24,
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 15,
      overflow: 'truncate',
      textBorderWidth: 0,
    },
  },
  {
    itemStyle: {
      borderWidth: 0.75,
      gapWidth: 0.75,
    },
  },
] as const

export function createTreemapPackageNodeId(packageId: string) {
  return `package${nodeIdDelimiter}${packageId}`
}

export function createTreemapFileNodeId(packageId: string, fileName: string) {
  return `file${nodeIdDelimiter}${packageId}${nodeIdDelimiter}${fileName}`
}

export function createTreemapModuleNodeId(packageId: string, fileName: string, moduleId: string) {
  return `module${nodeIdDelimiter}${packageId}${nodeIdDelimiter}${fileName}${nodeIdDelimiter}${moduleId}`
}

export function createTreemapAssetNodeId(packageId: string, fileName: string) {
  return `asset${nodeIdDelimiter}${packageId}${nodeIdDelimiter}${fileName}`
}

export function formatTreemapNodeLabel(value: string) {
  const normalized = formatModuleIdentifier(value)
    .replace(/^(?:\.\.\/)+/, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) {
    return normalized
  }

  const nodeModulesIndex = segments.lastIndexOf('node_modules')
  if (nodeModulesIndex >= 0 && segments[nodeModulesIndex + 1]) {
    const firstPackageSegment = segments[nodeModulesIndex + 1]!
    const packageName = firstPackageSegment.startsWith('@') && segments[nodeModulesIndex + 2]
      ? `${firstPackageSegment}/${segments[nodeModulesIndex + 2]}`
      : firstPackageSegment
    return packageName
  }

  if (segments.length > 2) {
    return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`
  }
  return segments.join('/')
}

function escapeTreemapTooltipValue(value: string | number) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  })[character]!)
}

function createTooltipHeading(value: string) {
  const label = formatTreemapNodeLabel(value)
  const lines = [`<strong>${escapeTreemapTooltipValue(label)}</strong>`]
  if (label !== value) {
    lines.push('<span style="color:#94a3b8">完整路径</span>')
    lines.push(`<span style="font-family:monospace;word-break:break-all">${escapeTreemapTooltipValue(value)}</span>`)
  }
  return lines
}

export function formatTreemapTooltip(meta: TreemapNodeMeta | undefined) {
  if (!meta) {
    return ''
  }

  const lines: string[] = []

  if (meta.kind === 'package') {
    lines.push(`<strong>${escapeTreemapTooltipValue(meta.packageLabel)}</strong>`)
    lines.push(`类型：${escapeTreemapTooltipValue(meta.packageType)}`)
    lines.push(`产物数量：${escapeTreemapTooltipValue(meta.fileCount)}`)
    if (meta.totalBytes) {
      lines.push(`累计体积：${formatBytes(meta.totalBytes)}`)
    }
  }
  else if (meta.kind === 'file') {
    lines.push(...createTooltipHeading(meta.fileName))
    lines.push(`所属：${escapeTreemapTooltipValue(meta.packageLabel)}`)
    lines.push(`类型：${meta.type === 'chunk' ? '代码 chunk' : '资源'} · 来源：${escapeTreemapTooltipValue(meta.from)}`)
    lines.push(`体积：${formatBytes(meta.bytes)}`)
    if (meta.childCount > 0) {
      lines.push(`模块数量：${escapeTreemapTooltipValue(meta.childCount)}`)
    }
  }
  else if (meta.kind === 'module') {
    lines.push(...createTooltipHeading(meta.source))
    lines.push(`所属：${escapeTreemapTooltipValue(meta.packageLabel)} → ${escapeTreemapTooltipValue(meta.fileName)}`)
    lines.push(`源码类型：${formatSourceType(meta.sourceType)}`)
    lines.push(`模块体积：${formatBytes(meta.bytes ?? meta.originalBytes)}`)
    if (meta.packageCount > 1) {
      lines.push(`跨包复用：${escapeTreemapTooltipValue(meta.packageCount)} 次`)
    }
  }
  else if (meta.kind === 'asset') {
    lines.push(...createTooltipHeading(meta.source))
    lines.push(`所属：${escapeTreemapTooltipValue(meta.packageLabel)} → ${escapeTreemapTooltipValue(meta.fileName)}`)
    lines.push(`资源体积：${formatBytes(meta.bytes)}`)
  }

  return lines.join('<br/>')
}
