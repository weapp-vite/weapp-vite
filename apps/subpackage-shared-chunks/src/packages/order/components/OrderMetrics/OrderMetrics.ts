interface OrderMetric {
  label: string
  value: string
  trend: number
}

Component({
  properties: {
    title: {
      type: String,
      value: '今日指标',
    },
    subtitle: {
      type: String,
      value: '实时同步 ERP 指标',
    },
    metrics: {
      type: Array,
      value: [] as OrderMetric[],
    },
  },
  methods: {
    refresh() {
      this.triggerEvent('refresh')
    },
  },
})
