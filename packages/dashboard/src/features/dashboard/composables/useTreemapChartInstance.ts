import type { ECharts } from 'echarts/core'
import type { ComputedRef, Ref } from 'vue'
import type { DashboardTab, ResolvedTheme } from '../types'
import * as echarts from 'echarts/core'
import { nextTick, shallowRef, watch } from 'vue'

type TreemapChartOption = Parameters<ECharts['setOption']>[0]

export function useTreemapChartInstance(options: {
  activeTab: Ref<DashboardTab>
  resolvedTheme: Ref<ResolvedTheme>
  treemapOption: ComputedRef<TreemapChartOption>
  handleChartClick: (params: unknown) => void
}) {
  const chartRef = shallowRef<HTMLDivElement>()
  let chart: ECharts | undefined

  function handleResize() {
    chart?.resize()
  }

  function destroyChart() {
    chart?.dispose()
    chart = undefined
  }

  function bindChartRef(element: Element | null) {
    chartRef.value = element instanceof HTMLDivElement
      ? element
      : undefined
  }

  function focusTreemapNode(nodeId: string) {
    chart?.dispatchAction({
      type: 'treemapRootToNode',
      seriesIndex: 0,
      targetNodeId: nodeId,
    })
  }

  function resetTreemapFocus() {
    chart?.setOption(options.treemapOption.value, true)
    chart?.resize()
  }

  async function ensureChart() {
    if (options.activeTab.value !== 'treemap') {
      destroyChart()
      return
    }

    await nextTick()

    if (!chartRef.value) {
      return
    }

    if (chartRef.value.clientWidth === 0 || chartRef.value.clientHeight === 0) {
      window.requestAnimationFrame(() => {
        void ensureChart()
      })
      return
    }

    if (!chart) {
      chart = echarts.init(chartRef.value, options.resolvedTheme.value === 'dark' ? 'dark' : undefined, { renderer: 'canvas' })
      chart.on('click', options.handleChartClick)
    }

    chart.setOption(options.treemapOption.value, true)
    chart.resize()
  }

  watch(
    options.treemapOption,
    (newOption) => {
      if (chart) {
        chart.setOption(newOption, true)
      }
    },
    { deep: true },
  )

  watch(options.activeTab, () => {
    void ensureChart()
  })

  watch(options.resolvedTheme, async () => {
    if (chart && chartRef.value) {
      destroyChart()
    }
    await ensureChart()
  })

  return {
    bindChartRef,
    destroyChart,
    ensureChart,
    focusTreemapNode,
    handleResize,
    resetTreemapFocus,
  }
}
