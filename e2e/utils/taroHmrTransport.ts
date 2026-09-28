import type { HeadlessSession } from '../../mpcore/packages/simulator/src'

/** 将真实 Taro WebSocket 协议接入 headless；执行和 applied 回报仍由 Taro 客户端产生。 */
export function installTaroHmrTransport(session: HeadlessSession) {
  const wx = session.getWx()
  const previous = Reflect.get(wx, 'connectSocket')
  const sockets = new Set<WebSocket>()
  let closed = false
  Reflect.set(wx, 'connectSocket', (options: { url: string, protocols?: string[] }) => {
    const url = new URL(options.url)
    if (url.protocol !== 'ws:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || Number(url.port) <= 0 || url.pathname !== '/__vpt_hmr__') {
      throw new Error('Taro integration only accepts a real loopback WebSocket endpoint')
    }
    const socket = new WebSocket(url, options.protocols)
    sockets.add(socket)
    const listeners = new Map<string, Map<(...args: any[]) => void, EventListener>>()
    const on = (name: string, callback: (...args: any[]) => void) => {
      const listener: EventListener = (event) => {
        if (!closed) {
          callback(event instanceof MessageEvent ? { data: event.data } : event)
        }
      }
      const entries = listeners.get(name) ?? new Map()
      entries.set(callback, listener)
      listeners.set(name, entries)
      socket.addEventListener(name, listener)
    }
    const off = (name: string, callback: (...args: any[]) => void) => {
      const listener = listeners.get(name)?.get(callback)
      if (listener) {
        socket.removeEventListener(name, listener)
      }
    }
    return {
      onOpen: (callback: () => void) => on('open', callback),
      offOpen: (callback: () => void) => off('open', callback),
      onMessage: (callback: (...args: any[]) => void) => on('message', callback),
      offMessage: (callback: (...args: any[]) => void) => off('message', callback),
      onError: (callback: (...args: any[]) => void) => on('error', callback),
      offError: (callback: (...args: any[]) => void) => off('error', callback),
      onClose: (callback: (...args: any[]) => void) => on('close', callback),
      offClose: (callback: (...args: any[]) => void) => off('close', callback),
      send: (option: { data: string }) => socket.send(option.data),
      close: () => socket.close(),
    }
  })
  return () => {
    closed = true
    for (const socket of sockets) {
      socket.close()
    }
    sockets.clear()
    Reflect.set(wx, 'connectSocket', previous)
  }
}
