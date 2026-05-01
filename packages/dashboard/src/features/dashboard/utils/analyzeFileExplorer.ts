import type { DashboardDetailItem, LargestFileEntry, TreemapNodeMeta } from '../types'
import { formatBytes, formatPackageType } from './format'

export function formatFileDelta(bytes?: number) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes === 0) {
    return ''
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

export function createLargestFileItem(file: LargestFileEntry): DashboardDetailItem {
  const delta = formatFileDelta(file.sizeDeltaBytes)
  return {
    title: file.file,
    meta: `${file.packageLabel} · ${formatPackageType(file.packageType)} · ${file.type}${delta ? ` · ${delta}` : ''}`,
    value: `${formatBytes(file.size)} / ${formatBytes(file.compressedSize)}`,
  }
}

export function formatSelectedFileMeta(meta: TreemapNodeMeta): DashboardDetailItem {
  if (meta.kind === 'package') {
    return {
      title: meta.packageLabel,
      meta: `${formatPackageType(meta.packageType)} · ${meta.fileCount} 个产物`,
      value: formatBytes(meta.totalBytes),
    }
  }
  if (meta.kind === 'file') {
    return {
      title: meta.fileName,
      meta: `${meta.packageLabel} · ${meta.type} · ${meta.childCount} 项`,
      value: formatBytes(meta.bytes),
    }
  }
  if (meta.kind === 'module') {
    return {
      title: meta.source,
      meta: `${meta.packageLabel} · ${meta.packageCount} 个包复用`,
      value: formatBytes(meta.bytes ?? meta.originalBytes),
    }
  }
  return {
    title: meta.source,
    meta: `${meta.packageLabel} · ${meta.fileName}`,
    value: formatBytes(meta.bytes),
  }
}

function escapeMarkdownCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function createFileExplorerReport(options: {
  files: LargestFileEntry[]
  totalCount: number
}) {
  return [
    '# dashboard 文件详情',
    '',
    `文件数量：${options.files.length} / ${options.totalCount}`,
    '',
    '| 文件 | 包 | 类型 | 总体积 | 压缩后 | 较上次 | 模块 | 来源 |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...options.files.map(file => [
      file.file,
      file.packageLabel,
      file.type,
      formatBytes(file.size),
      formatBytes(file.compressedSize),
      formatFileDelta(file.sizeDeltaBytes) || '-',
      String(file.moduleCount),
      file.source ?? '-',
    ].map(escapeMarkdownCell).join(' | ')).map(row => `| ${row} |`),
    '',
  ].join('\n')
}
