import type { LayoutFeedbackResult } from '../../layouts/layoutFeedback'
import { setPageLayout } from 'weapp-vite/runtime'
import { callLayoutFeedback } from '../../layouts/layoutFeedback'

type LayoutMode = 'command' | 'studio' | 'split' | 'poster' | 'default'

interface LayoutOption {
  label: string
  value: LayoutMode
  className: string
}

const layoutOptions: LayoutOption[] = [
  {
    label: '默认',
    value: 'default',
    className: 'switch switch--active',
  },
  {
    label: '命令',
    value: 'command',
    className: 'switch',
  },
  {
    label: '画室',
    value: 'studio',
    className: 'switch',
  },
  {
    label: '分栏',
    value: 'split',
    className: 'switch',
  },
  {
    label: '海报',
    value: 'poster',
    className: 'switch',
  },
]

const layoutCopy: Record<LayoutMode, { label: string, title: string, mode: string }> = {
  command: {
    label: '命令',
    title: '命令外壳',
    mode: '运行切换',
  },
  studio: {
    label: '画室',
    title: '画室外壳',
    mode: '工具面板',
  },
  split: {
    label: '分栏',
    title: '分栏外壳',
    mode: '区域组合',
  },
  poster: {
    label: '海报',
    title: '海报外壳',
    mode: '票据样式',
  },
  default: {
    label: '默认',
    title: '默认外壳',
    mode: '基础样式',
  },
}

const e2eRuntimeVendorMarker = 'runtime-vendor-hmr-baseline'
let transitionTimer: ReturnType<typeof setTimeout> | undefined

function createLayoutOptions(currentLayout: LayoutMode): LayoutOption[] {
  return layoutOptions.map(option => ({
    ...option,
    className: option.value === currentLayout ? 'switch switch--active' : 'switch',
  }))
}

function createDemoClass(currentLayout: LayoutMode, state?: 'switching' | 'settled') {
  return ['demo', `demo--${currentLayout}`, state ? `demo--${state}` : ''].filter(Boolean).join(' ')
}

Page({
  data: {
    currentLayout: 'default' as LayoutMode,
    currentLayoutLabel: '默认',
    runtimeEvents: 1,
    layoutTitle: '默认外壳',
    layoutMode: '基础样式',
    demoClass: createDemoClass('default'),
    e2eRuntimeVendorMarker,
    layoutOptions: createLayoutOptions('default'),
    lastFeedbackLayout: '',
  },
  onLoad() {
    setPageLayout('default', {
      mode: '原生页面',
      title: '默认外壳',
    })
  },
  onUnload() {
    if (transitionTimer !== undefined) {
      clearTimeout(transitionTimer)
      transitionTimer = undefined
    }
  },
  applyCommandLayout() {
    this.applyNamedLayout('command')
  },
  applyStudioLayout() {
    this.applyNamedLayout('studio')
  },
  applySplitLayout() {
    this.applyNamedLayout('split')
  },
  applyPosterLayout() {
    this.applyNamedLayout('poster')
  },
  applyDefaultLayout() {
    this.applyNamedLayout('default')
  },
  switchLayout(event: WechatMiniprogram.TouchEvent<{ layout: LayoutMode }>) {
    const layout = event.currentTarget.dataset.layout
    this.applyNamedLayout(layout)
  },
  showLayoutFeedback() {
    const result = callLayoutFeedback()
    this.setData({
      lastFeedbackLayout: result.layout,
    })
    return result
  },
  applyNamedLayout(layout: LayoutMode) {
    if (layout === this.data.currentLayout) {
      return
    }
    if (transitionTimer !== undefined) {
      clearTimeout(transitionTimer)
    }

    const runtimeEvents = this.data.runtimeEvents + 1
    const copy = layoutCopy[layout]

    this.setData({
      demoClass: createDemoClass(layout, 'switching'),
      currentLayout: layout,
      currentLayoutLabel: copy.label,
      runtimeEvents,
      layoutTitle: copy.title,
      layoutMode: copy.mode,
      layoutOptions: createLayoutOptions(layout),
    })
    setPageLayout(layout, {
      mode: `${copy.mode} ${runtimeEvents}`,
      title: copy.title,
    })

    transitionTimer = setTimeout(() => {
      this.setData({
        demoClass: createDemoClass(layout, 'settled'),
      })
      transitionTimer = undefined
    }, 420)
  },
  runE2E() {
    const ok = this.data.currentLayout === 'default'
      && this.data.e2eRuntimeVendorMarker === e2eRuntimeVendorMarker
    return {
      currentLayout: this.data.currentLayout,
      marker: this.data.e2eRuntimeVendorMarker,
      ok,
    }
  },
  async runLayoutFeedbackE2E() {
    const layouts: LayoutMode[] = ['default', 'command', 'studio', 'split', 'poster']
    const results: LayoutFeedbackResult[] = []

    for (const layout of layouts) {
      this.applyNamedLayout(layout)
      await new Promise(resolve => setTimeout(resolve, 120))
      results.push(this.showLayoutFeedback())
    }

    return {
      ok: results.every((result, index) => result.ok && result.layout === layouts[index]),
      results,
    }
  },
})
