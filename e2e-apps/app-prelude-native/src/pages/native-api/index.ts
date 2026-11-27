/* eslint-disable mini-program/no-implicit-runtime-polyfill -- native 模式验收直接使用 Rolldown 注入的 Web API 自由标识符与 globalThis 点号访问。 */
import { installNativeNetworkTrace } from '../../shared/networkTrace'

installNativeNetworkTrace()

Page({
  data: {
    route: 'native-api',
    status: 'pending',
    fetchTransport: '',
    axiosTransport: '',
    websocketStage: '',
    apiSummary: '',
    error: '',
  },
  onLoad(query) {
    const baseUrl = query.baseUrl ?? ''
    if (!baseUrl) {
      this.setData({ status: 'error', error: 'missing baseUrl' })
      return
    }

    const apiSummary = [
      new TextDecoder().decode(new TextEncoder().encode('native')),
      atob(btoa('native')),
      new globalThis.URL('/a/../b', baseUrl).pathname,
      String(new AbortController().signal.aborted),
      new CustomEvent('native', { detail: 'ok' }).detail,
      String(new ReadableStream() instanceof ReadableStream),
    ].join('|')
    this.setData({ apiSummary })

    const request = new Request(`${baseUrl}/fetch`, {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ source: 'native' }),
    })

    Promise.all([
      globalThis.fetch(request).then(async (response) => {
        const payload = await response.json() as { transport?: string }
        this.setData({ fetchTransport: payload.transport ?? '' })
      }),
      import('axios').then(({ default: axios }) => axios.post(`${baseUrl}/axios`, { source: 'native' })).then((response) => {
        this.setData({ axiosTransport: response.data?.transport ?? '' })
      }),
    ]).then(() => {
      this.setData({ status: 'ready' })
    }).catch((error: unknown) => {
      this.setData({ status: 'error', error: error instanceof Error ? error.message : String(error) })
    })

    const socket = new WebSocket(`${baseUrl.replace(/^http/u, 'ws')}/ws`)
    socket.onopen = () => {
      socket.send(JSON.stringify({ source: 'native' }))
    }
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { stage?: string }
        this.setData({ websocketStage: payload.stage ?? '' })
        socket.close()
      }
      catch {
        this.setData({ websocketStage: 'invalid' })
        socket.close()
      }
    }
    socket.onerror = () => {
      this.setData({ websocketStage: 'error' })
    }
  },
})
