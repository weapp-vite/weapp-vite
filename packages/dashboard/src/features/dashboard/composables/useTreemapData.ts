import type { Ref } from 'vue'
import type { AnalyzeSubpackagesResult, ResolvedTheme, TreemapNode, TreemapNodeMeta } from '../types'
import { computed } from 'vue'
import { formatTreemapTooltip, PACKAGE_STYLES, TREEMAP_LEVELS } from '../utils/treemap'

function createModuleTreemapNode(
  packageLabel: string,
  fileName: string,
  moduleUsageCount: Map<string, number>,
  module: NonNullable<AnalyzeSubpackagesResult['packages'][number]['files'][number]['modules']>[number],
): TreemapNode {
  return {
    name: module.source,
    value: Math.max(module.bytes ?? module.originalBytes ?? 1, 1),
    meta: {
      kind: 'module',
      packageLabel,
      fileName,
      source: module.source,
      sourceType: module.sourceType,
      bytes: module.bytes,
      originalBytes: module.originalBytes,
      packageCount: moduleUsageCount.get(module.id) ?? 1,
    },
  }
}

function createAssetTreemapNode(
  packageLabel: string,
  fileName: string,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
): TreemapNode {
  return {
    name: file.source ?? fileName,
    value: Math.max(file.size ?? 1, 1),
    meta: {
      kind: 'asset',
      packageLabel,
      fileName,
      source: file.source ?? fileName,
      bytes: file.size,
    },
  }
}

function createFileTreemapNode(
  packageLabel: string,
  packageId: string,
  packageLabelMap: Map<string, string>,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  children: TreemapNode[],
): TreemapNode {
  return {
    name: file.file,
    value: Math.max(file.size ?? 1, 1),
    meta: {
      kind: 'file',
      packageLabel: packageLabelMap.get(packageId) ?? packageLabel,
      fileName: file.file,
      from: file.from,
      childCount: children.length,
      type: file.type,
      bytes: file.size,
    },
    children: children.length > 0 ? children : undefined,
  }
}

function createPackageTreemapNode(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  totalBytes: number,
  fileNodes: TreemapNode[],
): TreemapNode {
  const style = PACKAGE_STYLES[pkg.type]

  return {
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
  }
}

export function useTreemapData(resultRef: Ref<AnalyzeSubpackagesResult | null>, resolvedTheme: Ref<ResolvedTheme>) {
  const packageLabelMap = computed(() =>
    new Map((resultRef.value?.packages ?? []).map(pkg => [pkg.id, pkg.label])),
  )

  const moduleUsageCount = computed(() =>
    new Map((resultRef.value?.modules ?? []).map(mod => [mod.id, mod.packages.length])),
  )

  const treemapNodes = computed<TreemapNode[]>(() => {
    const result = resultRef.value
    if (!result) {
      return []
    }

    return result.packages.map((pkg) => {
      const totalBytes = pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0)
      const fileNodes = pkg.files.map((file) => {
        const moduleNodes = file.type === 'chunk'
          ? (file.modules ?? []).map(module => createModuleTreemapNode(pkg.label, file.file, moduleUsageCount.value, module))
          : file.source
            ? [createAssetTreemapNode(pkg.label, file.file, file)]
            : []

        return createFileTreemapNode(pkg.label, pkg.id, packageLabelMap.value, file, moduleNodes)
      })

      return createPackageTreemapNode(pkg, totalBytes, fileNodes)
    })
  })

  const treemapOption = computed(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params: { data?: { meta?: TreemapNodeMeta } }) => formatTreemapTooltip(params.data?.meta),
      borderColor: resolvedTheme.value === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(71, 85, 105, 0.14)',
      backgroundColor: resolvedTheme.value === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)',
      textStyle: {
        color: resolvedTheme.value === 'dark' ? '#e2e8f0' : '#0f172a',
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
          color: resolvedTheme.value === 'dark' ? '#f8fafc' : '#0f172a',
          formatter: '{b}',
        },
        upperLabel: {
          show: true,
        },
        itemStyle: {
          borderColor: resolvedTheme.value === 'dark' ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)',
          borderWidth: 2,
          gapWidth: 2,
        },
        emphasis: {
          itemStyle: {
            borderColor: resolvedTheme.value === 'dark' ? '#f8fafc' : '#0f172a',
          },
        },
        colorAlpha: [0.94, 0.72],
        colorSaturation: [0.4, 0.9],
        levels: TREEMAP_LEVELS,
        data: treemapNodes.value,
      },
    ],
  }))

  return {
    treemapOption,
  }
}
