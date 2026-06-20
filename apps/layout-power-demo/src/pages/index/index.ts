import { setPageLayout } from 'weapp-vite/runtime'

type LayoutMode = 'command' | 'default' | 'none'

interface LayoutState {
  label: string
  state: string
  className: string
}

const capabilities = [
  {
    title: '默认布局',
    desc: 'src/layouts/default 存在时，页面可直接进入基础外壳。',
    tag: 'default',
  },
  {
    title: '命名布局',
    desc: 'Page 调用 setPageLayout("command", props) 切进命名外壳。',
    tag: 'named',
  },
  {
    title: '路由规则',
    desc: 'vite.config.ts 的 routeRules 可从项目层指定 appLayout。',
    tag: 'routeRules',
  },
  {
    title: '运行时切换',
    desc: 'setPageLayout 可切换 command/default/false，业务主体不动。',
    tag: 'runtime',
  },
]

function createLayoutStates(currentLayout: LayoutMode): LayoutState[] {
  return [
    {
      label: 'routeRules',
      state: 'command',
      className: currentLayout === 'command' ? 'preview__chip preview__chip--active' : 'preview__chip',
    },
    {
      label: 'native Page',
      state: 'props',
      className: currentLayout === 'command' ? 'preview__chip preview__chip--active' : 'preview__chip',
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
    layoutStates: createLayoutStates('command'),
  },
  onLoad() {
    setPageLayout('command', {
      mode: 'native Page',
      title: 'Layout Power Demo',
    })
  },
  applyCommandLayout() {
    const runtimeEvents = this.data.runtimeEvents + 1

    this.setData({
      currentLayout: 'command',
      runtimeEvents,
      layoutStates: createLayoutStates('command'),
    })
    setPageLayout('command', {
      mode: `runtime ${runtimeEvents}`,
      title: 'Runtime Command Shell',
    })
  },
  applyDefaultLayout() {
    this.setData({
      currentLayout: 'default',
      runtimeEvents: this.data.runtimeEvents + 1,
      layoutStates: createLayoutStates('default'),
    })
    setPageLayout('default')
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
})
