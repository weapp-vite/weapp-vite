import { setPageLayout } from 'weapp-vite/runtime'

type LayoutMode = 'command' | 'studio' | 'split' | 'poster' | 'default' | 'none'

interface LayoutState {
  label: string
  state: string
  className: string
}

const capabilities = [
  {
    title: 'Command',
    desc: '深色控制台外壳，展示 props、slot 与页面主体组合。',
    tag: 'dark',
  },
  {
    title: 'Studio',
    desc: '带侧向步骤栏和描边风格，适合强调工作台形态。',
    tag: 'editor',
  },
  {
    title: 'Split',
    desc: '固定左栏 + 右侧内容区，展示布局可重塑页面骨架。',
    tag: 'sidebar',
  },
  {
    title: 'Poster',
    desc: '海报式 masthead + 浮层内容，用同一页面换完整视觉语境。',
    tag: 'poster',
  },
]

const layoutCopy: Record<Exclude<LayoutMode, 'none'>, { title: string, mode: string }> = {
  command: {
    title: 'Runtime Command Shell',
    mode: 'command',
  },
  studio: {
    title: 'Studio Layout',
    mode: 'workbench',
  },
  split: {
    title: 'Split Layout',
    mode: 'sidebar',
  },
  poster: {
    title: 'Poster Layout',
    mode: 'campaign',
  },
  default: {
    title: 'Default Layout',
    mode: 'default',
  },
}

const e2eRuntimeVendorMarker = 'runtime-vendor-hmr-baseline'

function createLayoutStates(currentLayout: LayoutMode): LayoutState[] {
  return [
    {
      label: 'layout name',
      state: currentLayout,
      className: currentLayout === 'none' ? 'preview__chip' : 'preview__chip preview__chip--active',
    },
    {
      label: 'props',
      state: currentLayout === 'none' ? 'off' : 'on',
      className: currentLayout === 'none' ? 'preview__chip' : 'preview__chip preview__chip--active',
    },
    {
      label: 'setPageLayout',
      state: currentLayout,
      className: 'preview__chip preview__chip--active',
    },
    {
      label: 'layout=false',
      state: currentLayout === 'none' ? 'on' : 'ready',
      className: currentLayout === 'none' ? 'preview__chip preview__chip--active' : 'preview__chip',
    },
  ]
}

Page({
  data: {
    currentLayout: 'command' as LayoutMode,
    runtimeEvents: 1,
    capabilities,
    e2eRuntimeVendorMarker,
    layoutStates: createLayoutStates('command'),
  },
  onLoad() {
    setPageLayout('command', {
      mode: 'native Page',
      title: 'Layout Power Demo',
    })
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
  applyNamedLayout(layout: Exclude<LayoutMode, 'none'>) {
    const runtimeEvents = this.data.runtimeEvents + 1
    const copy = layoutCopy[layout]

    this.setData({
      currentLayout: layout,
      runtimeEvents,
      layoutStates: createLayoutStates(layout),
    })
    setPageLayout(layout, {
      mode: `${copy.mode} ${runtimeEvents}`,
      title: copy.title,
    })
  },
  disableLayout() {
    this.setData({
      currentLayout: 'none',
      runtimeEvents: this.data.runtimeEvents + 1,
      layoutStates: createLayoutStates('none'),
    })
    setPageLayout(false)
  },
  openRouteRulesDemo() {
    wx.navigateTo({
      url: '/pages/rules/index',
    })
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
