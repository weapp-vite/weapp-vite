import type { Ref } from 'vue'
import type { AnalyzeSubpackagesResult, AnalyzeTreemapColorMode, ResolvedTheme, TreemapLegendItem, TreemapNode, TreemapNodeMeta } from '../types'
import type { TreemapFilterState } from '../utils/treemapDataNodes'
import { computed } from 'vue'
import { formatTreemapLabel, formatTreemapTooltip, TREEMAP_LEVELS } from '../utils/treemap'
import { colorTreemapNodes, createTreemapColorIndex, createTreemapComparisonSizes, describeTreemapColor } from '../utils/treemapColor'
import { createTreemapNodes } from '../utils/treemapDataNodes'

export function useTreemapData(
  resultRef: Ref<AnalyzeSubpackagesResult | null>,
  resolvedTheme: Ref<ResolvedTheme>,
  filterRef: Ref<TreemapFilterState>,
  color: {
    mode: Ref<AnalyzeTreemapColorMode>
    comparisonResult: Ref<AnalyzeSubpackagesResult | null>
  },
) {
  const packageLabelMap = computed(() =>
    new Map((resultRef.value?.packages ?? []).map(pkg => [pkg.id, pkg.label])),
  )

  const colorIndex = computed(() => createTreemapColorIndex(resultRef.value))
  const comparisonSizes = computed(() => color.comparisonResult.value
    ? createTreemapComparisonSizes(color.comparisonResult.value)
    : null)

  const filteredNodes = computed<TreemapNode[]>(() => {
    const result = resultRef.value
    if (!result) {
      return []
    }

    return createTreemapNodes({
      result,
      packageLabelMap: packageLabelMap.value,
      moduleUsageCount: colorIndex.value.moduleUsageCount,
      filter: filterRef.value,
    })
  })

  const colorProjection = computed(() => colorTreemapNodes({
    nodes: filteredNodes.value,
    mode: color.mode.value,
    current: colorIndex.value,
    comparison: color.mode.value === 'delta' ? comparisonSizes.value : null,
  }))
  const treemapNodes = computed(() => colorProjection.value.nodes)
  const treemapLegend = computed<TreemapLegendItem[]>(() => colorProjection.value.legend)
  const treemapColorDescription = computed(() => describeTreemapColor(color.mode.value, color.comparisonResult.value !== null))

  const treemapOption = computed(() => {
    const isDark = resolvedTheme.value === 'dark'
    const textColor = isDark ? '#f8fafc' : '#0f172a'
    const borderColor = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(71, 85, 105, 0.18)'
    const nodeBorderColor = '#475569'

    return {
      backgroundColor: 'transparent',
      animation: false,
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
          animation: false,
          top: 2,
          right: 2,
          bottom: 2,
          left: 2,
          sort: 'desc',
          squareRatio: (1 + Math.sqrt(5)) / 2,
          nodeClick: false,
          roam: false,
          breadcrumb: {
            show: false,
          },
          visibleMin: 14,
          label: {
            show: true,
            color: textColor,
            formatter: formatTreemapLabel,
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 15,
            minMargin: 5,
            overflow: 'truncate',
            textBorderWidth: 0,
          },
          labelLayout: ({ rect }: { rect: { width: number, height: number } }) => ({
            hideOverlap: true,
            fontSize: rect.width < 60 || rect.height < 34 || rect.width * rect.height < 2800 ? 0 : 11,
          }),
          upperLabel: {
            show: true,
            color: textColor,
            formatter: (params: { data?: TreemapNode }) => formatTreemapLabel(params).replace('\n', ' · '),
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
    treemapLegend,
    treemapColorDescription,
  }
}
