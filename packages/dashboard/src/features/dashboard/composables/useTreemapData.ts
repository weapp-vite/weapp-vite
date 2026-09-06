import type { Ref } from 'vue'
import type { AnalyzeSubpackagesResult, ResolvedTheme, TreemapNode, TreemapNodeMeta } from '../types'
import type { TreemapFilterState } from '../utils/treemapDataNodes'
import { computed } from 'vue'
import { formatTreemapTooltip, TREEMAP_LEVELS } from '../utils/treemap'
import { createDefaultTreemapFilterState, createTreemapNodes } from '../utils/treemapDataNodes'

export function useTreemapData(
  resultRef: Ref<AnalyzeSubpackagesResult | null>,
  resolvedTheme: Ref<ResolvedTheme>,
  filterRef?: Ref<TreemapFilterState>,
) {
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

    return createTreemapNodes({
      result,
      packageLabelMap: packageLabelMap.value,
      moduleUsageCount: moduleUsageCount.value,
      filter: filterRef?.value ?? createDefaultTreemapFilterState(),
    })
  })

  const treemapOption = computed(() => {
    const isDark = resolvedTheme.value === 'dark'
    const textColor = isDark ? '#f8fafc' : '#0f172a'
    const mutedTextColor = isDark ? '#94a3b8' : '#64748b'
    const panelColor = isDark ? '#141820' : '#ffffff'
    const borderColor = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(71, 85, 105, 0.18)'
    const nodeBorderColor = '#475569'

    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (params: { data?: { meta?: TreemapNodeMeta } }) => formatTreemapTooltip(params.data?.meta),
        confine: true,
        borderColor,
        borderWidth: 1,
        backgroundColor: isDark ? 'rgba(15, 18, 24, 0.96)' : 'rgba(255, 255, 255, 0.98)',
        extraCssText: 'max-width: 26rem; white-space: normal; overflow-wrap: anywhere; border-radius: 8px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);',
        padding: [10, 12],
        textStyle: {
          color: textColor,
          fontSize: 12,
          lineHeight: 19,
        },
      },
      series: [
        {
          type: 'treemap',
          top: 8,
          right: 8,
          bottom: 38,
          left: 8,
          sort: 'desc',
          squareRatio: (1 + Math.sqrt(5)) / 2,
          nodeClick: 'zoomToNode',
          roam: true,
          roamTrigger: 'global',
          zoomToNodeRatio: 0.82,
          breadcrumb: {
            show: true,
            left: 8,
            right: 8,
            bottom: 6,
            height: 24,
            emptyItemWidth: 24,
            itemStyle: {
              color: panelColor,
              borderColor,
              borderWidth: 1,
              textStyle: {
                color: mutedTextColor,
                fontSize: 11,
              },
            },
            emphasis: {
              itemStyle: {
                color: isDark ? '#1d2530' : '#f1f5f9',
              },
            },
          },
          visibleMin: 14,
          label: {
            show: true,
            color: textColor,
            formatter: '{b}',
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 15,
            minMargin: 5,
            overflow: 'truncate',
            textBorderWidth: 0,
          },
          upperLabel: {
            show: true,
            color: textColor,
            fontSize: 12,
            fontWeight: 650,
            lineHeight: 17,
            overflow: 'truncate',
            textBorderWidth: 0,
          },
          itemStyle: {
            borderColor: nodeBorderColor,
            borderWidth: 1,
            gapWidth: 1,
          },
          emphasis: {
            itemStyle: {
              borderWidth: 2,
            },
          },
          levels: TREEMAP_LEVELS,
          data: treemapNodes.value,
        },
      ],
    }
  })

  return {
    treemapOption,
    treemapNodes,
  }
}
