import type { AnalyzeSubpackagesResult, PackageFileEntry } from '../../analyze/subpackages'
import type { DashboardInvestigationTarget, DashboardObjectMeasurements } from './types'

/** 不把缺失测量计为零，也不混合原始、压缩与模块归因体积。 */
function sumMeasured(files: PackageFileEntry[], key: 'size' | 'gzipSize' | 'brotliSize'): number | null {
  let total = 0
  for (const file of files) {
    if (file[key] === undefined) {
      return null
    }
    total += file[key]
  }
  return total
}

/** 只解析报告中真实存在的包、产物及精确模块放置关系，不访问文件系统。 */
export function resolveInvestigationTarget(result: AnalyzeSubpackagesResult, target: DashboardInvestigationTarget): DashboardObjectMeasurements | null {
  const pkg = result.packages.find(pkg => pkg.id === target.packageId)
  if (!pkg) {
    return null
  }
  if (target.kind === 'package') {
    return {
      label: pkg.label,
      rawBytes: sumMeasured(pkg.files, 'size'),
      gzipBytes: sumMeasured(pkg.files, 'gzipSize'),
      brotliBytes: sumMeasured(pkg.files, 'brotliSize'),
      attributedBytes: null,
      sourceBytes: null,
    }
  }
  const file = pkg.files.find(file => file.file === target.file)
  if (!file) {
    return null
  }
  if (target.kind === 'artifact') {
    return {
      label: file.file,
      rawBytes: file.size ?? null,
      gzipBytes: file.gzipSize ?? null,
      brotliBytes: file.brotliSize ?? null,
      attributedBytes: null,
      sourceBytes: null,
    }
  }
  const occurrence = file.modules?.find(module => module.id === target.moduleId)
  const placement = occurrence
    ? undefined
    : result.modules.find(module => module.id === target.moduleId
      && module.packages.some(placement => placement.packageId === pkg.id && placement.files.includes(file.file)))
  if (!occurrence && !placement) {
    return null
  }
  return {
    label: occurrence?.source ?? placement!.source,
    rawBytes: null,
    gzipBytes: null,
    brotliBytes: null,
    attributedBytes: occurrence?.bytes ?? null,
    sourceBytes: occurrence?.originalBytes ?? null,
  }
}
