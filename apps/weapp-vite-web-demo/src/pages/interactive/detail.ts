interface StepItem {
  id: string
  title: string
  desc: string
  done: boolean
}

const baseSteps: StepItem[] = [
  { id: 'load', title: 'onLoad 获取 query', desc: '读取路由参数并渲染', done: true },
  { id: 'show', title: 'onShow 计数', desc: '进入页面后更新计数', done: false },
  { id: 'tap', title: 'bindtap 事件', desc: '点击步骤卡片进行切换', done: false },
  { id: 'back', title: 'navigateBack', desc: '返回上一页', done: false },
]

Page({
  data: {
    id: '',
    from: '',
    viewCount: 0,
    highlight: false,
    steps: baseSteps,
    activeStepId: '',
  },
  onLoad(query: Record<string, string>) {
    const id = query?.id ?? ''
    const from = query?.from ?? ''
    const steps = (this.data.steps as StepItem[]).map(step => ({
      ...step,
      desc: id ? `${step.desc} · #${id}` : step.desc,
    }))
    this.setData({ id, from, steps })
  },
  onShow() {
    const viewCount = (this.data.viewCount as number) + 1
    this.setData({ viewCount })
  },
  toggleHighlight() {
    const highlight = !(this.data.highlight as boolean)
    this.setData({ highlight })
  },
  handleStepTap(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) {
      return
    }
    const steps = (this.data.steps as StepItem[]).map(step => {
      if (step.id !== id) {
        return step
      }
      return {
        ...step,
        done: !step.done,
      }
    })
    this.setData({
      steps,
      activeStepId: id,
    })
  },
  goBack() {
    if (typeof wx !== 'undefined' && typeof wx.navigateBack === 'function') {
      void wx.navigateBack()
    }
  },
})
