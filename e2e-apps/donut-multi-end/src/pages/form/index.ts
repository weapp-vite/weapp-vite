import { showLayoutMessage, showLayoutToast } from '../../shared/layoutFeedback'

Page({
  data: {
    form: {
      name: '多端体验巡检',
      owner: 'E2E Runner',
      urgent: false,
      count: 3,
      score: 4,
      notes: '覆盖 TDesign 表单组件和多端配置字段。',
    },
    submitted: false,
  },
  onNameChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.name': event.detail.value })
  },
  onOwnerChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.owner': event.detail.value })
  },
  onUrgentChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({ 'form.urgent': event.detail.value })
  },
  onCountChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    this.setData({ 'form.count': event.detail.value })
  },
  onScoreChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    this.setData({ 'form.score': event.detail.value })
  },
  onNotesChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'form.notes': event.detail.value })
  },
  submitForm() {
    this.setData({ submitted: true })
    showLayoutToast(this, {
      message: '表单已提交',
      theme: 'success',
    })
  },
  showFormMessage() {
    showLayoutMessage(this, {
      message: `巡检样本 ${this.data.form.count} 页，评分 ${this.data.form.score}`,
      theme: this.data.form.urgent ? 'warning' : 'info',
    })
  },
})
