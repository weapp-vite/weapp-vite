import { EventSourceParserStream } from 'eventsource-parser/stream'
import { appendMessage, startSession, stopSession } from './session'
/* eslint-disable mini-program/no-implicit-runtime-polyfill -- SSE 配置自动注入 Web API，验收与 Web 相同的调用方式。 */

Page({
  data: {
    status: 'idle',
    text: '',
    messages: [] as string[],
    lastEventIds: [] as string[],
    httpStatus: null as number | null,
    errorName: '',
    errorMessage: '',
    sourceState: null as number | null,
    fetchRuntime: {} as Record<string, unknown>,
  },
  startFetch(baseUrl: string, id: string, omitStatusCode = false) {
    const session = startSession()
    const controller = new AbortController()
    session.controller = controller
    this.setData({ status: 'waiting', text: '', messages: [], httpStatus: null, errorName: '', errorMessage: '' })
    void (async () => {
      try {
        this.setData({ fetchRuntime: {
          lexicalType: typeof fetch,
          globalType: typeof globalThis.fetch,
          sameBinding: typeof fetch === 'function' && fetch === globalThis.fetch,
          signalAborted: controller.signal.aborted,
          signalListener: typeof controller.signal.addEventListener,
        } })
        const response = await fetch(`${baseUrl}/sse/fetch?id=${encodeURIComponent(id)}${omitStatusCode ? '&omitStatusCode=1' : ''}`, {
          method: 'POST',
          headers: { 'Accept': 'text/event-stream', 'Content-Type': 'application/json', 'Authorization': 'Bearer fixture-auth' },
          body: JSON.stringify({ prompt: '中文流式回复' }),
          signal: controller.signal,
        })
        if (session.closed) {
          return
        }
        this.setData({ httpStatus: response.status })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        if (!response.body) {
          throw new Error('Expected a readable response body')
        }
        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new EventSourceParserStream())
          .getReader()
        try {
          while (true) {
            const chunk = await reader.read()
            if (chunk.done) {
              break
            }
            if (appendMessage(session, chunk.value.data)) {
              this.setData({ status: 'streaming', messages: session.messages.slice(), text: session.messages.join('') })
            }
          }
        }
        finally {
          reader.releaseLock()
        }
        if (!session.closed) {
          this.setData({ status: 'completed' })
        }
      }
      catch (error) {
        if (!session.closed) {
          this.setData({ status: 'error', errorName: error instanceof Error ? error.name : 'Error', errorMessage: String(error) })
        }
      }
    })()
  },
  startEventSource(baseUrl: string, id: string) {
    const session = startSession()
    const source = new EventSource(`${baseUrl}/sse/events?id=${encodeURIComponent(id)}`)
    session.source = source
    this.setData({ status: 'connecting', text: '', messages: [], lastEventIds: [], errorName: '', sourceState: source.readyState })
    source.onopen = () => {
      if (!session.closed) {
        this.setData({ status: 'open', sourceState: source.readyState })
      }
    }
    source.onmessage = (event) => {
      if (appendMessage(session, event.data)) {
        this.setData({ status: 'streaming', messages: session.messages.slice(), text: session.messages.join(''), lastEventIds: [...this.data.lastEventIds, event.lastEventId] })
      }
    }
    source.onerror = () => {
      if (!session.closed) {
        this.setData({ status: source.readyState === source.CLOSED ? 'closed' : 'reconnecting', sourceState: source.readyState })
      }
    }
  },
  stop() {
    stopSession()
    this.setData({ status: 'closed' })
  },
  onUnload() {
    stopSession()
  },
})
