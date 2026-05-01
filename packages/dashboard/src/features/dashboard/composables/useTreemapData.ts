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
      theme: resolvedTheme.value,
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
        nodeClick: 'zoomToNode',
        roam: 'move',
        roamTrigger: 'global',
        zoomToNodeRatio: 0.72,
        breadcrumb: {
          show: false,
        },
        visibleMin: 1,
        label: {
          show: true,
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          borderRadius: 3,
          color: '#17231d',
          formatter: '{b}',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 16,
          minMargin: 4,
          overflow: 'truncate',
          padding: [1, 4],
          textBorderWidth: 0,
        },
        upperLabel: {
          show: true,
          color: '#17231d',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 16,
          overflow: 'truncate',
          textBorderWidth: 0,
          textShadowBlur: 1,
          textShadowColor: 'rgba(255, 255, 255, 0.32)',
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
        levels: TREEMAP_LEVELS,
        data: treemapNodes.value,
      },
    ],
  }))

  return {
    treemapOption,
    treemapNodes,
  }
}
