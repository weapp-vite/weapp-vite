import { createRequestClientsRealWebSocketTranscript } from '../../../../../e2e/utils/requestClientsRealWebSocketProbe'

export const webSocketTranscriptGlobals = { createRequestClientsRealWebSocketTranscript }

export const connectedFrame = { client: 'native-websocket', path: '/ws', requestCount: 1, stage: 'connected' }
export const echoFrame = { ...connectedFrame, requestCount: 2, stage: 'echo', transport: 'websocket', body: { client: 'native-websocket', run: 2 } }
export const tickFrame = { ...connectedFrame, requestCount: 3, stage: 'tick', transport: 'websocket', event: 'server-random', message: 'fixture push' }

// 此 fixture 只验证显式消息的校验与渲染，不提供 WebSocket 或真实网络能力。
export const webSocketTranscriptFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.js', [
    'Page({',
    '  data: { status: "waiting", echoStage: "", echoRun: 0, error: "" },',
    '  onLoad() { this.transcript = createRequestClientsRealWebSocketTranscript(2) },',
    '  receiveFrame(frame) {',
    '    if (this.data.status !== "waiting") return',
    '    try {',
    '      const result = this.transcript.accept(frame)',
    '      if (result) this.setData({ status: "success", echoStage: result.echoPayload.stage, echoRun: result.echoPayload.body.run })',
    '    } catch (error) { this.setData({ status: "failed", error: error.message }) }',
    '  },',
    '})',
  ].join('\n')],
  ['pages/index/index.wxml', '<view id="status">{{status}}</view><view id="echo-stage">{{echoStage}}</view><view id="echo-run">{{echoRun}}</view><view wx:if="{{error}}" id="error">{{error}}</view>'],
]
