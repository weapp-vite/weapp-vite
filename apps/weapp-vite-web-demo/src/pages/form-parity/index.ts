const INITIAL_STATE = {
  profileName: 'Ada',
  bio: 'Building mini-program tooling',
  runtimeChecked: true,
  compilerChecked: false,
  channel: 'stable',
  notify: true,
}

Page({
  data: {
    ...INITIAL_STATE,
    resultState: 'idle',
    resultSummary: '等待提交',
  },
  handleNameInput(event: WechatMiniprogram.Input) {
    this.setData({ profileName: event.detail.value })
  },
  handleBioInput(event: WechatMiniprogram.Input) {
    this.setData({ bio: event.detail.value })
  },
  handleSkillsChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({
      runtimeChecked: event.detail.value.includes('runtime'),
      compilerChecked: event.detail.value.includes('compiler'),
    })
  },
  handleChannelChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ channel: event.detail.value })
  },
  handleNotifyChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({ notify: event.detail.value })
  },
  handleSubmit(event: WechatMiniprogram.CustomEvent<{ value: Record<string, unknown> }>) {
    this.setData({
      resultState: 'submitted',
      resultSummary: JSON.stringify(event.detail.value),
    })
  },
  handleReset() {
    this.setData({
      ...INITIAL_STATE,
      resultState: 'reset',
      resultSummary: '已恢复初始值',
    })
  },
})
