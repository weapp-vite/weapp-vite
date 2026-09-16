import { probeCapabilities } from './capabilities'

let activeTask: WechatMiniprogram.RequestTask | undefined
Page({
  data: {
    scenario: '',
    status: 'idle',
    terminal: '',
    events: [] as string[],
    bytes: [] as number[],
    successBytes: [] as number[],
    removedCalls: 0,
    successDataType: '',
    successDataTag: '',
    successText: '',
    headerKeys: [] as string[],
    headerStatus: null as number | null,
    headerContentType: '',
    capabilitiesText: '',
    capabilities: {},
    taskMethods: {},
  },
  async probe() {
    const capabilities = await probeCapabilities()
    this.setData({ capabilities, capabilitiesText: JSON.stringify(capabilities) })
  },
  start(baseUrl: string, scenario: string, id: string) {
    const events: string[] = []
    const bytes: number[] = []
    const record = (event: string) => {
      events.push(event)
      this.setData({ events: events.slice() })
    }
    this.setData({ scenario, status: 'waiting', terminal: '', events: [], bytes: [], successBytes: [], removedCalls: 0 })
    const task = wx.request({
      url: `${baseUrl}/stream?id=${encodeURIComponent(id)}`,
      enableChunked: true,
      responseType: 'arraybuffer',
      success: (result) => {
        record('success')
        this.setData({ terminal: 'success', successDataType: typeof result.data, successDataTag: Object.prototype.toString.call(result.data), successText: typeof result.data === 'string' ? result.data : '', successBytes: Array.from(new Uint8Array(result.data as ArrayBuffer)) })
      },
      fail: (error) => {
        record('fail')
        this.setData({ terminal: 'fail', error: error.errMsg })
      },
      complete: () => {
        record('complete')
        this.setData({ status: 'completed' })
      },
    })
    activeTask = task
    const removed = () => this.setData({ removedCalls: this.data.removedCalls + 1 })
    const methods = ['onHeadersReceived', 'offHeadersReceived', 'onChunkReceived', 'offChunkReceived', 'abort'] as const
    const taskMethods: Record<string, string> = {}
    for (const name of methods) {
      taskMethods[name] = typeof task[name]
    }
    this.setData({ taskMethods })
    if (typeof task.onHeadersReceived === 'function') {
      task.onHeadersReceived(removed)
      task.offHeadersReceived?.(removed)
      task.onHeadersReceived((result) => {
        const headers = result.header as Record<string, string>
        const contentTypeKey = Object.keys(headers).find(key => key.toLowerCase() === 'content-type')
        this.setData({ headerKeys: Object.keys(result), headerStatus: (result as { statusCode?: number }).statusCode ?? null, headerContentType: contentTypeKey ? headers[contentTypeKey] : '' })
        record('headers')
      })
    }
    if (typeof task.onChunkReceived === 'function') {
      task.onChunkReceived(removed)
      task.offChunkReceived?.(removed)
      task.onChunkReceived((result) => {
        bytes.push(...new Uint8Array(result.data))
        record('chunk')
        this.setData({ bytes: bytes.slice(), status: 'streaming' })
        if (scenario === 'abort-after') {
          this.abort()
        }
        if (scenario === 'off-all') {
          task.offChunkReceived()
        }
      })
    }
  },
  abort() {
    this.setData({ abortRequested: true })
    activeTask?.abort()
  },
  onUnload() {
    activeTask?.abort()
    activeTask = undefined
  },
})
