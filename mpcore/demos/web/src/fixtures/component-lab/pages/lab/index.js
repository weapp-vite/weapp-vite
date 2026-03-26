Page({
  data: {
    title: 'Component Lab',
    cardTitle: 'Queue health',
    status: 'stable',
    count: 3,
    events: [],
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
      events: [...this.data.events, detail.phase || 'unknown'],
    })
    this.push('lab:handlePulse:' + JSON.stringify(detail))
  },
})
