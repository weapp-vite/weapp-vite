Page({
  data: {
    visible: true,
    rows: ['alpha', 'beta'],
    mode: 'append',
    received: [],
    summary: '',
    handlerReplaced: false,
  },
  onFoo(event) {
    this.record(event, 'original')
  },
  record(event, handler) {
    const received = this.data.received.concat({ row: event.detail, handler })
    this.setData({
      received,
      summary: received.map(item => `${item.handler}:${item.row}`).join(','),
    })
    if (this.data.mode === 'reorder') {
      this.setData({ rows: this.data.rows.slice().reverse() })
    }
    if (this.data.mode === 'unmount') {
      this.setData({ visible: false })
    }
  },
  replaceHandler() {
    const previous = this.onFoo
    this.onFoo = function (event) {
      this.record(event, 'replacement')
    }
    this.setData({ handlerReplaced: this.onFoo !== previous })
  },
  setMode(mode) {
    this.setData({ mode })
  },
  restoreChildren() {
    this.setData({ mode: 'append', visible: true })
  },
  emitRow(row) {
    const child = this.selectComponent(`#child-${row}`)
    if (!child) {
      throw new Error(`Missing reentry child ${row}`)
    }
    child.emit()
  },
  readState() {
    return this.data
  },
})
