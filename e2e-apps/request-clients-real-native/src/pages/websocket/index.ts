import {
  createErrorState,
  createRequestCaseState,
  createRunningState,
  createSuccessState,
  resolveBaseUrl,
} from '../../shared/runtime'

const HTTP_PROTOCOL_RE = /^http/u

interface NativeWebSocketPayload {
  body?: Record<string, unknown>
  client: string
  event?: string
  message?: string
  path: string
  requestCount: number
  sentAt?: string
  stage: string
  transport?: string
  url?: string
}

Page({
  data: {
    baseUrl: '',
    connectedReadyState: -1,
    finalReadyState: -1,
    latestRandomMessage: '',
    latestRandomSentAt: '',
    randomPushCount: 0,
    state: createRequestCaseState(),
    websocketUrl: '',
  },
  onLoad(query: Record<string, unknown>) {
    this.setData({
      baseUrl: resolveBaseUrl(query),
    })
    void this.runCase()
  },
  async runCase() {
    if (!this.data.baseUrl) {
      const snapshot = createErrorState(createRunningState(this.data.state), new Error('missing baseUrl'))
      this.setData({ state: snapshot })
      return snapshot
    }

    const nextState = createRunningState(this.data.state)
    const websocketUrl = `${this.data.baseUrl.replace(HTTP_PROTOCOL_RE, 'ws')}/ws`
    this.setData({
      connectedReadyState: -1,
      finalReadyState: -1,
      latestRandomMessage: '',
      latestRandomSentAt: '',
      randomPushCount: 0,
      state: nextState,
      websocketUrl,
    })

    try {
      const payload = await new Promise<{ echoPayload: NativeWebSocketPayload, tickPayload: NativeWebSocketPayload }>((resolve, reject) => {
        const socket = new WebSocket(websocketUrl)
        let echoPayload: NativeWebSocketPayload | null = null
        let settled = false
        let welcomeReceived = false

        const cleanup = () => {
          socket.onopen = null
          socket.onmessage = null
          socket.onerror = null
          socket.onclose = null
        }

        const finalize = (handler: () => void) => {
          if (settled) {
            return
          }
          settled = true
          cleanup()
          handler()
        }

        socket.onopen = () => {
          this.setData({
            connectedReadyState: socket.readyState,
          })
          socket.send(JSON.stringify({
            client: 'native-websocket',
            run: nextState.runCount,
          }))
        }

        socket.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : ''
          const parsed = JSON.parse(data) as NativeWebSocketPayload
          if (!welcomeReceived) {
            welcomeReceived = true
            return
          }

          if (parsed.stage === 'echo') {
            echoPayload = parsed
            return
          }

          if (parsed.stage !== 'tick') {
            return
          }

          this.setData({
            finalReadyState: socket.readyState,
            latestRandomMessage: parsed.message ?? '',
            latestRandomSentAt: parsed.sentAt ?? '',
            randomPushCount: parsed.requestCount,
          })
          finalize(() => {
            socket.close()
            resolve({
              echoPayload: echoPayload ?? parsed,
              tickPayload: parsed,
            })
          })
        }

        socket.onerror = (error) => {
          finalize(() => {
            socket.close()
            reject(error)
          })
        }

        socket.onclose = () => {
          this.setData({
            finalReadyState: socket.readyState,
          })
        }
      })

      if (payload.echoPayload.client !== 'native-websocket' || payload.echoPayload.transport !== 'websocket') {
        throw new Error(`unexpected websocket payload: ${JSON.stringify(payload)}`)
      }

      const snapshot = createSuccessState(nextState, 101, {
        ...payload.echoPayload,
        latestRandomMessage: payload.tickPayload.message ?? '',
        latestRandomSentAt: payload.tickPayload.sentAt ?? '',
        path: payload.tickPayload.path,
        requestCount: payload.tickPayload.requestCount,
        serverRandomEvent: payload.tickPayload.event ?? '',
        tickPayload: payload.tickPayload,
      })
      this.setData({ state: snapshot })
      return snapshot
    }
    catch (error) {
      const snapshot = createErrorState(nextState, error)
      this.setData({ state: snapshot })
      return snapshot
    }
  },
  async runE2E() {
    const snapshot = await this.runCase()
    return {
      connectedReadyState: this.data.connectedReadyState,
      finalReadyState: this.data.finalReadyState,
      latestRandomMessage: this.data.latestRandomMessage,
      ok: snapshot.pageStatus === '全部通过',
      randomPushCount: this.data.randomPushCount,
      snapshot,
      websocketUrl: this.data.websocketUrl,
    }
  },
})
