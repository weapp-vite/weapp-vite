import { waitForRequestClientsRealWebSocketProbe } from '../../../../../e2e/utils/requestClientsRealWebSocketProbe'
import {
  createErrorState,
  createRequestCaseState,
  createRunningState,
  createSuccessState,
  resolveBaseUrl,
} from '../../shared/runtime'

const HTTP_PROTOCOL_RE = /^http/u

Page({
  data: {
    baseUrl: '',
    connectedReadyState: -1,
    finalReadyState: -1,
    echoStage: '',
    echoRun: 0,
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
      echoStage: '',
      echoRun: 0,
      latestRandomMessage: '',
      latestRandomSentAt: '',
      randomPushCount: 0,
      state: nextState,
      websocketUrl,
    })

    try {
      // eslint-disable-next-line mini-program/no-implicit-runtime-polyfill -- fixture 已启用 appPrelude.webRuntime，此处验证注入后的 WebSocket。
      const socket = new WebSocket(websocketUrl)
      const payload = await waitForRequestClientsRealWebSocketProbe(socket, nextState.runCount)
      this.setData({
        connectedReadyState: payload.connectedReadyState,
        finalReadyState: payload.finalReadyState,
        echoStage: payload.echoPayload.stage,
        echoRun: Number(payload.echoPayload.body?.run),
        latestRandomMessage: payload.tickPayload.message ?? '',
        latestRandomSentAt: payload.tickPayload.sentAt ?? '',
        randomPushCount: payload.tickPayload.requestCount,
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
