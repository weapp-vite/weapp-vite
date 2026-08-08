const ENVIRONMENTS = [
  { value: 'devtools', label: '微信开发者工具' },
  { value: 'web', label: 'Web Runtime' },
  { value: 'device', label: '真机预览' },
]

const MULTI_RANGE = [
  ['稳定版', '预览版', '每日构建'],
  ['原生组件', '页面栈', '网络 API'],
]

Page({
  data: {
    environments: ENVIRONMENTS,
    environmentIndex: 1,
    environmentLabel: ENVIRONMENTS[1].label,
    multiRange: MULTI_RANGE,
    multiValue: [0, 1],
    multiLabel: '稳定版 / 页面栈',
    releaseDate: '2026-07-24',
    releaseTime: '18:30',
    pickerViewValue: [1, 2, 1],
    pickerViewLabel: 'Web / TypeScript / 生产',
    sliderValue: 64,
    eventSummary: '等待交互',
  },
  handleEnvironmentChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const environmentIndex = Number(event.detail.value)
    this.setData({
      environmentIndex,
      environmentLabel: ENVIRONMENTS[environmentIndex]?.label ?? '',
      eventSummary: `picker:environment=${environmentIndex}`,
    })
  },
  handleMultiChange(event: WechatMiniprogram.CustomEvent<{ value: number[] }>) {
    const multiValue = event.detail.value
    this.setData({
      multiValue,
      multiLabel: `${MULTI_RANGE[0][multiValue[0]]} / ${MULTI_RANGE[1][multiValue[1]]}`,
      eventSummary: `picker:multi=${multiValue.join(',')}`,
    })
  },
  handleDateChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      releaseDate: event.detail.value,
      eventSummary: `picker:date=${event.detail.value}`,
    })
  },
  handleTimeChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      releaseTime: event.detail.value,
      eventSummary: `picker:time=${event.detail.value}`,
    })
  },
  handlePickerCancel() {
    this.setData({ eventSummary: 'picker:cancel' })
  },
  handlePickerViewChange(event: WechatMiniprogram.CustomEvent<{ value: number[] }>) {
    const pickerViewValue = event.detail.value
    const platforms = ['小程序', 'Web', 'Node']
    const languages = ['JavaScript', 'Rust', 'TypeScript']
    const channels = ['开发', '生产', '灰度']
    this.setData({
      pickerViewValue,
      pickerViewLabel: `${platforms[pickerViewValue[0]]} / ${languages[pickerViewValue[1]]} / ${channels[pickerViewValue[2]]}`,
      eventSummary: `picker-view=${pickerViewValue.join(',')}`,
    })
  },
  handleSliderChanging(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    this.setData({ sliderValue: event.detail.value })
  },
  handleSliderChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    this.setData({
      sliderValue: event.detail.value,
      eventSummary: `slider=${event.detail.value}`,
    })
  },
})
