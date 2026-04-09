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
  path: string
  requestCount: number
  stage: string
  transport?: string
  url?: string
}

Page({
  data: {
    baseUrl: '',
    connectedReadyState: -1,
    finalReadyState: -1,
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
      state: nextState,
      websocketUrl,
    })

    try {
      const payload = await new Promise<NativeWebSocketPayload>((resolve, reject) => {
        const socket = new WebSocket(websocketUrl)
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

          this.setData({
            finalReadyState: socket.readyState,
          })
          finalize(() => {
            socket.close()
            resolve(parsed)
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

      if (payload.client !== 'native-websocket' || payload.transport !== 'websocket') {
        throw new Error(`unexpected websocket payload: ${JSON.stringify(payload)}`)
      }

      const snapshot = createSuccessState(nextState, 101, payload)
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
      ok: snapshot.pageStatus === '全部通过',
      snapshot,
      websocketUrl: this.data.websocketUrl,
    }
  },
})
