import type { Ref } from 'vue'
import type { AnalyzeSubpackagesResult } from './types'
import { computed, ref, watch } from 'vue'

type PackageType = AnalyzeSubpackagesResult['packages'][number]['type']
type ModuleSourceType = AnalyzeSubpackagesResult['modules'][number]['sourceType']

interface NodeMetaBase {
  kind: 'package' | 'file' | 'module' | 'asset'
  bytes?: number
  totalBytes?: number
  packageLabel: string
}

interface PackageNodeMeta extends NodeMetaBase {
  kind: 'package'
  packageType: PackageType
  fileCount: number
}

interface FileNodeMeta extends NodeMetaBase {
  kind: 'file'
  fileName: string
  from: string
  childCount: number
  type: 'chunk' | 'asset'
}

interface ModuleNodeMeta extends NodeMetaBase {
  kind: 'module'
  fileName: string
  source: string
  sourceType: ModuleSourceType
  originalBytes?: number
  packageCount: number
}

interface AssetNodeMeta extends NodeMetaBase {
  kind: 'asset'
  fileName: string
  source: string
}

type NodeMeta = PackageNodeMeta | FileNodeMeta | ModuleNodeMeta | AssetNodeMeta

interface TreemapNode {
  name: string
  value: number
  meta: NodeMeta
  children?: TreemapNode[]
  itemStyle?: Record<string, any>
}

const PACKAGE_STYLES: Record<PackageType, { fill: string, border: string, highlight: string }> = {
  main: {
    fill: '#1e40af',
    border: '#60a5fa',
    highlight: 'rgba(96, 165, 250, 0.28)',
  },
  subPackage: {
    fill: '#065f46',
    border: '#34d399',
    highlight: 'rgba(52, 211, 153, 0.25)',
  },
  independent: {
    fill: '#92400e',
    border: '#f59e0b',
    highlight: 'rgba(245, 158, 11, 0.3)',
  },
  virtual: {
    fill: '#5b21b6',
    border: '#c084fc',
    highlight: 'rgba(192, 132, 252, 0.28)',
  },
}

const TREEMAP_LEVELS = [
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

export function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) {
    return '—'
  }

  const base = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= base && unitIndex < units.length - 1) {
    value /= base
    unitIndex++
  }

  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

function formatTooltip(meta: NodeMeta | undefined) {
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
    lines.push(`源码类型：${meta.sourceType}`)
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

export function useTreemapData(resultRef: Ref<AnalyzeSubpackagesResult | null>) {
  const packageLabelMap = ref(new Map<string, string>())
  const moduleUsageCount = ref(new Map<string, number>())

  function syncStructures(result: AnalyzeSubpackagesResult) {
    packageLabelMap.value = new Map(result.packages.map(pkg => [pkg.id, pkg.label]))
    moduleUsageCount.value = new Map(result.modules.map(mod => [mod.id, mod.packages.length]))
  }

  const summary = computed(() => {
    const analyzeResult = resultRef.value
    if (!analyzeResult) {
      return {
        packageCount: 0,
        moduleCount: 0,
        duplicateCount: 0,
        totalBytes: 0,
      }
    }

    const totalBytes = analyzeResult.packages
      .flatMap(pkg => pkg.files)
      .reduce((sum, file) => sum + (file.size ?? 0), 0)
    const duplicateCount = analyzeResult.modules.filter(mod => mod.packages.length > 1).length
    return {
      packageCount: analyzeResult.packages.length,
      moduleCount: analyzeResult.modules.length,
      duplicateCount,
      totalBytes,
    }
  })

  const duplicateModules = computed(() => {
    const analyzeResult = resultRef.value
    if (!analyzeResult) {
      return []
    }

    const entries = analyzeResult.modules
      .filter(mod => mod.packages.length > 1)
      .map(mod => ({
        source: mod.source,
        count: mod.packages.length,
        packages: mod.packages.map(pkg => packageLabelMap.value.get(pkg.packageId) ?? pkg.packageId),
      }))

    entries.sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
    return entries.slice(0, 10)
  })

  const treemapNodes = computed<TreemapNode[]>(() => {
    const analyzeResult = resultRef.value
    if (!analyzeResult) {
      return []
    }

    const nodes: TreemapNode[] = []

    for (const pkg of analyzeResult.packages) {
      const fileNodes: TreemapNode[] = []

      for (const file of pkg.files) {
        const moduleNodes: TreemapNode[] = []

        if (file.type === 'chunk' && Array.isArray(file.modules)) {
          for (const module of file.modules) {
            const usage = moduleUsageCount.value.get(module.id) ?? 1
            const value = Math.max(module.bytes ?? module.originalBytes ?? 1, 1)
            moduleNodes.push({
              name: module.source,
              value,
              meta: {
                kind: 'module',
                packageLabel: pkg.label,
                fileName: file.file,
                source: module.source,
                sourceType: module.sourceType,
                bytes: module.bytes,
                originalBytes: module.originalBytes,
                packageCount: usage,
              },
            })
          }
        }
        else if (file.source) {
          moduleNodes.push({
            name: file.source,
            value: Math.max(file.size ?? 1, 1),
            meta: {
              kind: 'asset',
              packageLabel: pkg.label,
              fileName: file.file,
              source: file.source,
              bytes: file.size,
            },
          })
        }

        fileNodes.push({
          name: file.file,
          value: Math.max(file.size ?? 1, 1),
          meta: {
            kind: 'file',
            packageLabel: pkg.label,
            fileName: file.file,
            from: file.from,
            childCount: moduleNodes.length,
            type: file.type,
            bytes: file.size,
          },
          children: moduleNodes.length > 0 ? moduleNodes : undefined,
        })
      }

      const totalBytes = pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0)
      const style = PACKAGE_STYLES[pkg.type]

      nodes.push({
        name: pkg.label,
        value: Math.max(totalBytes, 1),
        meta: {
          kind: 'package',
          packageLabel: pkg.label,
          packageType: pkg.type,
          fileCount: pkg.files.length,
          totalBytes,
        },
        itemStyle: {
          color: style.fill,
          borderColor: style.border,
        },
        children: fileNodes,
      })
    }

    return nodes
  })

  const treemapOption = computed(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params: { data?: { meta?: NodeMeta } }) => formatTooltip(params.data?.meta),
      borderColor: 'rgba(148, 163, 184, 0.16)',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      textStyle: {
        color: '#e2e8f0',
      },
    },
    series: [
      {
        type: 'treemap',
        nodeClick: false,
        roam: false,
        breadcrumb: {
          show: false,
        },
        visibleMin: 1,
        label: {
          show: true,
          color: '#f8fafc',
          formatter: '{b}',
        },
        upperLabel: {
          show: true,
        },
        itemStyle: {
          borderColor: 'rgba(15, 23, 42, 0.88)',
          borderWidth: 2,
          gapWidth: 2,
        },
        emphasis: {
          itemStyle: {
            borderColor: '#f8fafc',
          },
        },
        colorAlpha: [0.94, 0.72],
        colorSaturation: [0.4, 0.9],
        levels: TREEMAP_LEVELS,
        data: treemapNodes.value,
      },
    ],
  }))

  watch(
    resultRef,
    (result) => {
      if (result) {
        syncStructures(result)
      }
    },
    { immediate: true },
  )

  return {
    summary,
    duplicateModules,
    treemapOption,
  }
}
