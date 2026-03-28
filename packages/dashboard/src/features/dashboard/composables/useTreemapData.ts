import type { Ref } from 'vue'
import type { AnalyzeSubpackagesResult, ResolvedTheme } from '../types'
import type { TreemapNode } from '../utils/treemap'
import { computed } from 'vue'
import { formatTreemapTooltip, PACKAGE_STYLES, TREEMAP_LEVELS } from '../utils/treemap'

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
          ? (file.modules ?? []).map(module => ({
              name: module.source,
              value: Math.max(module.bytes ?? module.originalBytes ?? 1, 1),
              meta: {
                kind: 'module' as const,
                packageLabel: pkg.label,
                fileName: file.file,
                source: module.source,
                sourceType: module.sourceType,
                bytes: module.bytes,
                originalBytes: module.originalBytes,
                packageCount: moduleUsageCount.value.get(module.id) ?? 1,
              },
            }))
          : file.source
            ? [{
                name: file.source,
                value: Math.max(file.size ?? 1, 1),
                meta: {
                  kind: 'asset' as const,
                  packageLabel: pkg.label,
                  fileName: file.file,
                  source: file.source,
                  bytes: file.size,
                },
              }]
            : []

        return {
          name: file.file,
          value: Math.max(file.size ?? 1, 1),
          meta: {
            kind: 'file' as const,
            packageLabel: packageLabelMap.value.get(pkg.id) ?? pkg.label,
            fileName: file.file,
            from: file.from,
            childCount: moduleNodes.length,
            type: file.type,
            bytes: file.size,
          },
          children: moduleNodes.length > 0 ? moduleNodes : undefined,
        }
      })

      const style = PACKAGE_STYLES[pkg.type]
      return {
        name: pkg.label,
        value: Math.max(totalBytes, 1),
        meta: {
          kind: 'package' as const,
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
    })
  })

  const treemapOption = computed(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params: { data?: { meta?: any } }) => formatTreemapTooltip(params.data?.meta),
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
