import type { OutputAsset, OutputChunk, RolldownOutput } from 'rolldown'
import type { SubPackageMetaValue } from '../types'
import { Buffer } from 'node:buffer'
import logger, { colors } from '../logger'
import { formatBytes } from '../plugins/core/helpers/bytes'

const DEFAULT_PACKAGE_SIZE_WARNING_BYTES = 2 * 1024 * 1024
const WINDOWS_SEPARATOR_RE = /\\/g

interface PackageSizeReportEntry {
  root: string
  label: string
  bytes: number
}

interface LogBuildPackageSizeReportOptions {
  output: RolldownOutput | RolldownOutput[]
  subPackageMap?: Map<string, SubPackageMetaValue>
  warningBytes?: number
}

function normalizeFileName(fileName: string) {
  return fileName.replace(WINDOWS_SEPARATOR_RE, '/')
}

function getOutputItemBytes(item: OutputAsset | OutputChunk) {
  if (item.type === 'chunk') {
    return typeof item.code === 'string' ? Buffer.byteLength(item.code, 'utf8') : 0
  }

  if (typeof item.source === 'string') {
    return Buffer.byteLength(item.source, 'utf8')
  }

  if (item.source instanceof Uint8Array) {
    return item.source.byteLength
  }

  return 0
}

function resolveSubPackageRoot(fileName: string, roots: string[]) {
  const normalized = normalizeFileName(fileName)
  return roots.find(root => normalized === root || normalized.startsWith(`${root}/`))
}

function collectPackageSizeReports(
  output: RolldownOutput | RolldownOutput[],
  subPackageMap?: Map<string, SubPackageMetaValue>,
) {
  const outputs = Array.isArray(output) ? output : [output]
  const roots = [...(subPackageMap?.keys() ?? [])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
  const packageBytes = new Map<string, number>([['__main__', 0]])

  for (const root of roots) {
    packageBytes.set(root, 0)
  }

  for (const current of outputs) {
    for (const item of current.output ?? []) {
      const root = resolveSubPackageRoot(item.fileName, roots) ?? '__main__'
      packageBytes.set(root, (packageBytes.get(root) ?? 0) + getOutputItemBytes(item))
    }
  }

  const reports: PackageSizeReportEntry[] = [
    {
      root: '__main__',
      label: '主包',
      bytes: packageBytes.get('__main__') ?? 0,
    },
  ]

  for (const root of roots) {
    const meta = subPackageMap?.get(root)
    const isIndependent = Boolean(meta?.subPackage.independent)
    reports.push({
      root,
      label: `${isIndependent ? '独立分包' : '分包'} ${root}`,
      bytes: packageBytes.get(root) ?? 0,
    })
  }

  return reports
}

export function logBuildPackageSizeReport(options: LogBuildPackageSizeReportOptions) {
  const warningBytes = Number(options.warningBytes ?? DEFAULT_PACKAGE_SIZE_WARNING_BYTES)
  const reports = collectPackageSizeReports(options.output, options.subPackageMap)

  logger.success('主包/分包体积报告：')
  for (const report of reports) {
    logger.info(`${report.label}：${formatBytes(report.bytes)}`)
  }

  const shouldWarn = Number.isFinite(warningBytes) && warningBytes > 0
  if (!shouldWarn) {
    return
  }

  for (const report of reports) {
    if (report.bytes <= warningBytes) {
      continue
    }

    logger.warn(
      `[包体积] ${colors.yellow(report.label)} 体积 ${colors.yellow(formatBytes(report.bytes))}，`
      + `已超过阈值 ${colors.yellow(formatBytes(warningBytes))}。`,
    )
  }
}

export {
  DEFAULT_PACKAGE_SIZE_WARNING_BYTES,
}
