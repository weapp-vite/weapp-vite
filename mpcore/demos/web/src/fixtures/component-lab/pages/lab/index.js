Page({
  data: {
    title: 'Component Lab',
    cardTitle: 'Queue health',
    status: 'stable',
    count: 3,
    events: [],
    eventShape: '',
    componentSnapshot: '',
    traces: [],
  },
  push(message) {
    this.setData({
      traces: [...this.data.traces, message],
    })
  },
  onLoad(query) {
    this.push('lab:onLoad:' + JSON.stringify(query))
  },
  promote() {
    this.setData({
      count: this.data.count + 1,
      status: 'boosted',
    }, () => {
      this.push('lab:promote')
    })
  },
  handlePulse(event) {
    const detail = event?.detail ?? {}
    this.setData({
      eventShape: JSON.stringify({
        bubbles: event?.bubbles ?? false,
        composed: event?.composed ?? false,
        dataset: event?.target?.dataset ?? {},
        targetId: event?.target?.id ?? '',
      }),
      events: [...this.data.events, detail.phase || 'unknown'],
    })
    this.push('lab:handlePulse:' + JSON.stringify(detail))
  },
  inspectCard() {
    const card = this.selectComponent?.('#status-card')
    const cards = this.selectAllComponents?.('status-card') ?? []
    this.setData({
      componentSnapshot: JSON.stringify({
        count: card?.properties?.count,
        methods: typeof card?.pulse === 'function',
        size: cards.length,
      }),
    })
    this.push('lab:inspectCard')
  },
})
