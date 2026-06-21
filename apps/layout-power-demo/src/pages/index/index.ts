import { setPageLayout } from 'weapp-vite/runtime'

type LayoutMode = 'command' | 'studio' | 'split' | 'poster' | 'default'

interface LayoutOption {
  label: string
  value: LayoutMode
  className: string
}

const layoutOptions: LayoutOption[] = [
  {
    label: 'Command',
    value: 'command',
    className: 'switch switch--active',
  },
  {
    label: 'Studio',
    value: 'studio',
    className: 'switch',
  },
  {
    label: 'Split',
    value: 'split',
    className: 'switch',
  },
  {
    label: 'Poster',
    value: 'poster',
    className: 'switch',
  },
  {
    label: 'Default',
    value: 'default',
    className: 'switch',
  },
]

const layoutCopy: Record<LayoutMode, { title: string, mode: string }> = {
  command: {
    title: 'Neon Command',
    mode: 'cyber host',
  },
  studio: {
    title: 'Ink Studio',
    mode: 'paper host',
  },
  split: {
    title: 'Mint Ops',
    mode: 'ops host',
  },
  poster: {
    title: 'Solar Poster',
    mode: 'poster host',
  },
  default: {
    title: 'Cloud Default',
    mode: 'clean host',
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
    runtimeEvents: 1,
    layoutTitle: 'Neon Command',
    layoutMode: 'cyber host',
    demoClass: 'demo',
    e2eRuntimeVendorMarker,
    layoutOptions: createLayoutOptions('command'),
  },
  onLoad() {
    setPageLayout('command', {
      mode: 'native Page',
      title: 'Neon Command',
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
