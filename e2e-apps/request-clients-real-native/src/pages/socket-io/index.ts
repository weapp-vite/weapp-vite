import { io } from 'socket.io-client'
import {
  createErrorState,
  createRequestCaseState,
  createRunningState,
  createSuccessState,
  resolveBaseUrl,
} from '../../shared/runtime'

interface SocketProbePayload {
  client: string
  namespace: string
  path: string
  requestCount: number
  transport: string
}

Page({
  data: {
    baseUrl: '',
    defaultTransportName: '',
    state: createRequestCaseState(),
    websocketOnlyTransportName: '',
  },
  onLoad(query: Record<string, unknown>) {
    this.setData({
      baseUrl: resolveBaseUrl(query),
    })
    void this.runCase()
  },
  async connectProbe(options?: { forceWebsocket?: boolean }) {
    return await new Promise<SocketProbePayload>((resolve, reject) => {
      const socket = io(this.data.baseUrl, {
        autoConnect: false,
        forceNew: true,
        path: '/socket.io',
        reconnection: false,
        timeout: 10_000,
        transports: options?.forceWebsocket ? ['websocket'] : undefined,
      })

      let settled = false
      let upgradeTimer: ReturnType<typeof setTimeout> | undefined

      const cleanup = () => {
        if (upgradeTimer) {
          clearTimeout(upgradeTimer)
        }
        socket.off('connect')
        socket.off('connect_error')
        socket.off('error')
        socket.io.engine?.off('upgrade')
      }

      const finalize = () => {
        if (settled) {
          return
        }
        settled = true
        const currentTransportName = socket.io.engine?.transport.name ?? ''
        if (options?.forceWebsocket) {
          this.setData({
            websocketOnlyTransportName: currentTransportName,
          })
        }
        else {
          this.setData({
            defaultTransportName: currentTransportName,
          })
        }
        socket.emit('probe', {
          client: 'socket.io-client',
          forceWebsocket: options?.forceWebsocket === true,
          run: this.data.state.runCount,
        }, (ack: SocketProbePayload) => {
          cleanup()
          socket.disconnect()
          resolve(ack)
        })
      }

      socket.on('connect', () => {
        if (options?.forceWebsocket || socket.io.engine?.transport.name === 'websocket') {
          finalize()
          return
        }
        socket.io.engine?.on('upgrade', finalize)
        upgradeTimer = setTimeout(() => {
          finalize()
        }, 3_000)
      })

      socket.on('connect_error', (error) => {
        cleanup()
        socket.disconnect()
        reject(error)
      })

      socket.on('error', (error) => {
        cleanup()
        socket.disconnect()
        reject(error)
      })

      socket.connect()
    })
  },
  async runCase() {
    if (!this.data.baseUrl) {
      const snapshot = createErrorState(createRunningState(this.data.state), new Error('missing baseUrl'))
      this.setData({ state: snapshot })
      return snapshot
    }

    const nextState = createRunningState(this.data.state)
    this.setData({
      defaultTransportName: '',
      state: nextState,
      websocketOnlyTransportName: '',
    })

    try {
      const defaultProbe = await this.connectProbe()
      const websocketOnlyProbe = await this.connectProbe({
        forceWebsocket: true,
      })

      if (defaultProbe.client !== 'socket.io-client') {
        throw new Error(`unexpected default socket.io payload: ${JSON.stringify(defaultProbe)}`)
      }
      if (websocketOnlyProbe.client !== 'socket.io-client' || websocketOnlyProbe.transport !== 'websocket') {
        throw new Error(`unexpected websocket-only payload: ${JSON.stringify(websocketOnlyProbe)}`)
      }

      const snapshot = createSuccessState(nextState, 101, {
        checks: {
          defaultTransportSupported: defaultProbe.transport === 'polling' || defaultProbe.transport === 'websocket',
          websocketOnlyConnected: websocketOnlyProbe.transport === 'websocket',
        },
        client: defaultProbe.client,
        defaultProbe,
        path: websocketOnlyProbe.path,
        requestCount: websocketOnlyProbe.requestCount,
        transport: websocketOnlyProbe.transport,
        websocketOnlyProbe,
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
      baseUrl: this.data.baseUrl,
      defaultTransportName: this.data.defaultTransportName,
      ok: snapshot.pageStatus === '全部通过',
      snapshot,
      websocketOnlyTransportName: this.data.websocketOnlyTransportName,
    }
  },
})
