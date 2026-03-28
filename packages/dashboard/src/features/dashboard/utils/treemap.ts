import type { PackageType, TreemapNodeMeta } from '../types'
import { formatBytes, formatSourceType } from './format'

export const PACKAGE_STYLES: Record<PackageType, { fill: string, border: string }> = {
  main: {
    fill: '#1d4ed8',
    border: '#93c5fd',
  },
  subPackage: {
    fill: '#047857',
    border: '#6ee7b7',
  },
  independent: {
    fill: '#b45309',
    border: '#fbbf24',
  },
  virtual: {
    fill: '#7c3aed',
    border: '#d8b4fe',
  },
}

export const TREEMAP_LEVELS = [
  {
    itemStyle: {
      borderWidth: 3,
      gapWidth: 4,
    },
    upperLabel: {
      show: true,
      height: 32,
      color: '#f8fafc',
      fontWeight: '600',
    },
  },
  {
    itemStyle: {
      borderWidth: 2,
      gapWidth: 2,
    },
  },
  {
    itemStyle: {
      borderWidth: 1,
      gapWidth: 1,
    },
  },
] as const

export function formatTreemapTooltip(meta: TreemapNodeMeta | undefined) {
  if (!meta) {
    return ''
  }

  const lines: string[] = []

  if (meta.kind === 'package') {
    lines.push(`<strong>${meta.packageLabel}</strong>`)
    lines.push(`类型：${meta.packageType}`)
    lines.push(`产物数量：${meta.fileCount}`)
    if (meta.totalBytes) {
      lines.push(`累计体积：${formatBytes(meta.totalBytes)}`)
    }
  }
  else if (meta.kind === 'file') {
    lines.push(`<strong>${meta.fileName}</strong>`)
    lines.push(`所属：${meta.packageLabel}`)
    lines.push(`类型：${meta.type === 'chunk' ? '代码 chunk' : '资源'} · 来源：${meta.from}`)
    lines.push(`体积：${formatBytes(meta.bytes)}`)
    if (meta.childCount > 0) {
      lines.push(`模块数量：${meta.childCount}`)
    }
  }
  else if (meta.kind === 'module') {
    lines.push(`<strong>${meta.source}</strong>`)
    lines.push(`所属：${meta.packageLabel} → ${meta.fileName}`)
    lines.push(`源码类型：${formatSourceType(meta.sourceType)}`)
    lines.push(`模块体积：${formatBytes(meta.bytes ?? meta.originalBytes)}`)
    if (meta.packageCount > 1) {
      lines.push(`跨包复用：${meta.packageCount} 次`)
    }
  }
  else if (meta.kind === 'asset') {
    lines.push(`<strong>${meta.source}</strong>`)
    lines.push(`所属：${meta.packageLabel} → ${meta.fileName}`)
    lines.push(`资源体积：${formatBytes(meta.bytes)}`)
  }

  return lines.join('<br/>')
}
