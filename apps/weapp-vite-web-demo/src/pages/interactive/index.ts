interface ScenarioItem {
  id: string
  name: string
  desc: string
  tags: string[]
  type: 'core' | 'ui' | 'data'
}

interface TimelineItem {
  id: string
  title: string
  status: 'done' | 'active' | 'pending'
  hint: string
}

interface LogEntry {
  id: number
  title: string
  time: string
}

const scenarios: ScenarioItem[] = [
  {
    id: 'component-flow',
    name: '组件联动',
    desc: '属性 + observer + triggerEvent 的双向联动测试。',
    tags: ['props', 'observer', 'event'],
    type: 'core',
  },
  {
    id: 'conditional-view',
    name: '条件渲染',
    desc: 'wx:if / wx:for 组合场景，动态 class 切换。',
    tags: ['wx:if', 'wx:for', 'class'],
    type: 'ui',
  },
  {
    id: 'dataset-tap',
    name: 'dataset 传参',
    desc: 'bindtap + data-* 传参，驱动页面状态变更。',
    tags: ['dataset', 'bindtap'],
    type: 'ui',
  },
  {
    id: 'route-lifecycle',
    name: '路由与生命周期',
    desc: 'navigateTo / navigateBack + onLoad / onShow。',
    tags: ['route', 'lifecycle'],
    type: 'core',
  },
  {
    id: 'state-snapshot',
    name: '状态快照',
    desc: 'setData 批量更新与渲染刷新。',
    tags: ['setData', 'render'],
    type: 'data',
  },
]

const filters = [
  { id: 'all', label: '全部' },
  { id: 'core', label: '核心能力' },
  { id: 'ui', label: '交互体验' },
  { id: 'data', label: '数据联动' },
]

const actions = [
  { id: 'random', label: '随机选择' },
  { id: 'toggle', label: '显示/隐藏时间线' },
  { id: 'reset', label: '重置筛选' },
]

const timelineSeed: TimelineItem[] = [
  { id: 'load', title: 'onLoad 接收参数', status: 'done', hint: '从首页携带 query' },
  { id: 'show', title: 'onShow 计数', status: 'active', hint: '每次进入触发' },
  { id: 'route', title: 'navigateTo/Back', status: 'pending', hint: '前往详情页' },
  { id: 'event', title: '组件触发事件', status: 'pending', hint: 'ScenarioPanel 选择' },
]

let logSeed = 0

function formatTime() {
  const now = new Date()
  return now.toLocaleTimeString('zh-CN', { hour12: false })
}

function filterScenarios(list: ScenarioItem[], filterId: string) {
  if (filterId === 'all') {
    return list.slice()
  }
  return list.filter(item => item.type === filterId)
}

function resolveScenario(list: ScenarioItem[], id: string | undefined) {
  if (!id) {
    return list[0]
  }
  return list.find(item => item.id === id) ?? list[0]
}

Page({
  data: {
    from: 'index',
    viewCount: 0,
    lastVisit: '',
    filters,
    actions,
    activeFilter: 'all',
    scenarios,
    filteredScenarios: scenarios,
    selectedScenarioId: scenarios[0]?.id ?? '',
    selectedScenario: scenarios[0] ?? null,
    showTimeline: true,
    timeline: timelineSeed,
    log: [] as LogEntry[],
  },
  onLoad(query: Record<string, string>) {
    if (query?.from) {
      this.setData({ from: query.from })
    }
    this.applyFilter(this.data.activeFilter)
    this.appendLog('页面 onLoad')
  },
  onShow() {
    const viewCount = (this.data.viewCount as number) + 1
    this.setData({
      viewCount,
      lastVisit: formatTime(),
    })
    this.appendLog('页面 onShow')
  },
  applyFilter(filterId: string) {
    const filtered = filterScenarios(this.data.scenarios as ScenarioItem[], filterId)
    const nextSelected = resolveScenario(filtered, this.data.selectedScenarioId as string)
    this.setData({
      activeFilter: filterId,
      filteredScenarios: filtered,
      selectedScenarioId: nextSelected?.id ?? '',
      selectedScenario: nextSelected ?? null,
    })
  },
  handleFilterTap(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id || id === this.data.activeFilter) {
      return
    }
    this.applyFilter(id)
    this.appendLog(`切换筛选：${id}`)
  },
  handleScenarioSelect(event: WechatMiniprogram.CustomEvent) {
    const { id } = event.detail ?? {}
    const nextSelected = resolveScenario(this.data.scenarios as ScenarioItem[], id as string)
    if (!nextSelected) {
      return
    }
    this.setData({
      selectedScenarioId: nextSelected.id,
      selectedScenario: nextSelected,
    })
    this.updateTimeline('event', 'done')
    this.appendLog(`选择场景：${nextSelected.name}`)
  },
  handleAction(event: WechatMiniprogram.TouchEvent) {
    const { id, label } = event.currentTarget.dataset as { id?: string, label?: string }
    if (!id) {
      return
    }
    if (id === 'toggle') {
      const next = !(this.data.showTimeline as boolean)
      this.setData({ showTimeline: next })
      this.appendLog(`${label ?? '切换时间线'}：${next ? '显示' : '隐藏'}`)
      return
    }
    if (id === 'reset') {
      this.applyFilter('all')
      this.appendLog(label ?? '重置筛选')
      return
    }
    if (id === 'random') {
      const list = this.data.filteredScenarios as ScenarioItem[]
      if (!list.length) {
        return
      }
      const choice = list[Math.floor(Math.random() * list.length)]
      if (!choice) {
        return
      }
      this.setData({
        selectedScenarioId: choice.id,
        selectedScenario: choice,
      })
      this.appendLog(`随机选择：${choice.name}`)
    }
  },
  handleTimelineTap(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) {
      return
    }
    this.updateTimeline(id, 'active')
    this.appendLog(`时间线聚焦：${id}`)
  },
  gotoDetail() {
    const id = this.data.selectedScenarioId as string
    if (!id || typeof wx === 'undefined' || typeof wx.navigateTo !== 'function') {
      return
    }
    this.updateTimeline('route', 'done')
    void wx.navigateTo({
      url: `pages/interactive/detail?id=${id}&from=interactive`,
    })
  },
  goBack() {
    if (typeof wx !== 'undefined' && typeof wx.navigateBack === 'function') {
      void wx.navigateBack()
    }
  },
  updateTimeline(targetId: string, status: TimelineItem['status']) {
    const timeline = (this.data.timeline as TimelineItem[]).map((item) => {
      if (item.id !== targetId) {
        return item
      }
      return {
        ...item,
        status,
      }
    })
    this.setData({ timeline })
  },
  appendLog(title: string) {
    const next: LogEntry = {
      id: logSeed += 1,
      title,
      time: formatTime(),
    }
    const log = [next, ...(this.data.log as LogEntry[])].slice(0, 6)
    this.setData({ log })
  },
})
