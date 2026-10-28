interface StreamingSession {
  closed: boolean
  lateCallbacks: number
  messages: string[]
  controller?: AbortController
  source?: EventSource
}

let current: StreamingSession | undefined

function saveSession(session: StreamingSession) {
  wx.setStorageSync('stream-sse-unload', {
    closed: session.closed,
    lateCallbacks: session.lateCallbacks,
    messages: session.messages.slice(),
    abortRequested: session.controller?.signal.aborted ?? false,
    sourceState: session.source?.readyState ?? null,
  })
}

export function stopSession() {
  if (!current) {
    return
  }
  current.closed = true
  current.controller?.abort()
  current.source?.close()
  saveSession(current)
}

export function startSession() {
  stopSession()
  current = { closed: false, lateCallbacks: 0, messages: [] }
  wx.removeStorageSync('stream-sse-unload')
  return current
}

export function appendMessage(session: StreamingSession, data: string) {
  if (session.closed) {
    session.lateCallbacks++
    saveSession(session)
    return false
  }
  session.messages.push(data)
  return true
}
