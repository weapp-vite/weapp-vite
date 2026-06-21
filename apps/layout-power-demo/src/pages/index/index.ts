import { setPageLayout } from 'weapp-vite/runtime'

type LayoutMode = 'command' | 'studio' | 'split' | 'poster' | 'default'

interface LayoutOption {
  label: string
  value: LayoutMode
  className: string
}

const layoutOptions: LayoutOption[] = [
  {
    label: '命令',
    value: 'command',
    className: 'switch switch--active',
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
  {
    label: '默认',
    value: 'default',
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

Page({
  data: {
    currentLayout: 'command' as LayoutMode,
    currentLayoutLabel: '命令',
    runtimeEvents: 1,
    layoutTitle: '命令外壳',
    layoutMode: '运行切换',
    demoClass: 'demo',
    e2eRuntimeVendorMarker,
    layoutOptions: createLayoutOptions('command'),
  },
  onLoad() {
    setPageLayout('command', {
      mode: '原生页面',
      title: '命令外壳',
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
      demoClass: 'demo demo--switching',
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
        demoClass: 'demo demo--settled',
      })
      transitionTimer = undefined
    }, 420)
  },
  runE2E() {
    const ok = this.data.currentLayout === 'command'
      && this.data.e2eRuntimeVendorMarker === e2eRuntimeVendorMarker
    return {
      currentLayout: this.data.currentLayout,
      marker: this.data.e2eRuntimeVendorMarker,
      ok,
    }
  },
})
