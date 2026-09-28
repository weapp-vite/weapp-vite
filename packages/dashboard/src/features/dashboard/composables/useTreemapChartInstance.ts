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
  focusNodeId: Ref<string | null>
  handleChartClick: (params: unknown) => void
}) {
  const chartRef = shallowRef<HTMLDivElement>()
  let chart: ECharts | undefined
  let resizeObserver: ResizeObserver | undefined
  let animationFrame: number | undefined

  function handleResize() {
    chart?.resize()
  }

  function destroyChart() {
    resizeObserver?.disconnect()
    resizeObserver = undefined
    if (animationFrame !== undefined) {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = undefined
    }
    chart?.dispose()
    chart = undefined
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
    const element = chartRef.value
    if (options.activeTab.value !== 'treemap' || !element?.isConnected) {
      return
    }
    if (!chart) {
      chart = echarts.init(element, options.resolvedTheme.value === 'dark' ? 'dark' : undefined, { renderer: 'canvas' })
      chart.on('click', options.handleChartClick)
      resizeObserver = new ResizeObserver(() => {
        if (animationFrame !== undefined) {
          window.cancelAnimationFrame(animationFrame)
        }
        animationFrame = window.requestAnimationFrame(() => {
          animationFrame = undefined
          handleResize()
        })
      })
      resizeObserver.observe(element)
    }
    chart.setOption(options.treemapOption.value, true)
    if (options.focusNodeId.value) {
      focusTreemapNode(options.focusNodeId.value)
    }
    chart.resize()
  }

  function bindChartRef(element: Element | null) {
    const next = element instanceof HTMLDivElement ? element : undefined
    if (next === chartRef.value) {
      return
    }
    destroyChart()
    chartRef.value = next
    if (next) {
      void ensureChart()
    }
  }

  watch(
    options.treemapOption,
    (newOption) => {
      if (chart) {
        chart.setOption(newOption, true)
        if (options.focusNodeId.value) {
          focusTreemapNode(options.focusNodeId.value)
        }
      }
    },
    { flush: 'post' },
  )

  watch(options.focusNodeId, (nodeId) => {
    if (nodeId) {
      focusTreemapNode(nodeId)
    }
    else {
      resetTreemapFocus()
    }
  }, { flush: 'post' })

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
    handleResize,
  }
}
