Page({
  data: {
    title: 'Component Lab',
    cardTitle: 'Queue health',
    status: 'stable',
    count: 3,
    events: [],
    eventShape: '',
    componentSnapshot: '',
    downloadSnapshot: '',
    requestSnapshot: '',
    savedFilePath: '',
    uploadedSnapshot: '',
    storageSnapshot: '',
    toastState: '',
    tapTrail: [],
    traces: [],
    flags: {
      showMeta: true,
    },
    quickActions: [
      { label: '切到 stable', status: 'stable' },
      { label: '切到 boosted', status: 'boosted' },
      { label: '切到 muted', status: 'muted' },
    ],
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
  applyStatus(event) {
    const status = event?.currentTarget?.dataset?.status || 'stable'
    this.setData({
      status,
    }, () => {
      this.push('lab:applyStatus:' + status)
    })
  },
  toggleMeta() {
    this.setData({
      'flags.showMeta': !this.data.flags.showMeta,
    }, () => {
      this.push('lab:toggleMeta:' + this.data.flags.showMeta)
    })
  },
  recordTap(event) {
    const phase = event?.currentTarget?.dataset?.phase || 'unknown'
    this.setData({
      tapTrail: [...this.data.tapTrail, phase],
    }, () => {
      this.push('lab:recordTap:' + phase)
    })
  },
  loadMockQueue() {
    wx.request({
      url: 'https://mock.mpcore.dev/api/queue-health',
      success: (result) => {
        this.setData({
          requestSnapshot: JSON.stringify(result?.data ?? null),
        })
      },
      complete: () => {
        this.push('lab:loadMockQueue')
      }
    })
  },
  runFileTransferLab() {
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/component-lab-report.txt',
      success: (downloadResult) => {
        this.setData({
          downloadSnapshot: JSON.stringify(downloadResult),
        })
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          success: (saveResult) => {
            this.setData({
              savedFilePath: saveResult.savedFilePath,
            })
            wx.uploadFile({
              url: 'https://mock.mpcore.dev/upload/component-lab-report',
              filePath: saveResult.savedFilePath,
              name: 'report',
              success: (uploadResult) => {
                this.setData({
                  uploadedSnapshot: uploadResult.data,
                })
              },
              complete: () => {
                this.push('lab:runFileTransferLab:upload')
              }
            })
          },
          complete: () => {
            this.push('lab:runFileTransferLab:save')
          }
        })
      },
      complete: () => {
        this.push('lab:runFileTransferLab:download')
      }
    })
  },
  storeSnapshot() {
    const payload = {
      count: this.data.count,
      status: this.data.status,
    }
    wx.setStorageSync('component-lab', payload)
    this.setData({
      storageSnapshot: JSON.stringify(wx.getStorageSync('component-lab')),
    }, () => {
      this.push('lab:storeSnapshot')
    })
  },
  toastSnapshot() {
    wx.showToast({
      title: `status:${this.data.status}`,
      success: (result) => {
        this.setData({
          toastState: result?.errMsg ?? 'showToast:unknown',
        })
      },
      complete: () => {
        this.push('lab:toastSnapshot')
      }
    })
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
