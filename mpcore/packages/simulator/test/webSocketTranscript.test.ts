import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitForRequestClientsRealWebSocketProbe } from '../../../../e2e/utils/requestClientsRealWebSocketProbe'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { cleanupTempDirs } from './helpers'
import { connectedFrame, echoFrame, tickFrame, webSocketTranscriptFiles, webSocketTranscriptGlobals } from './helpers/webSocketTranscript'

function createSocket() {
  const socket = {
    readyState: 1,
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    onerror: null as ((error: unknown) => void) | null,
    onclose: null as (() => void) | null,
    send: vi.fn<(data: string) => void>(),
    close: vi.fn(() => {
      socket.readyState = 3
      socket.onclose?.()
    }),
  }
  return socket
}

describe('WebSocket transcript contract without a network provider', () => {
  const directories: string[] = []
  afterEach(() => {
    cleanupTempDirs(directories)
    vi.useRealTimers()
  })

  it.each(['echo-first', 'tick-first'])('requires both frames for %s and sends the current run', async (order) => {
    const socket = createSocket()
    const task = waitForRequestClientsRealWebSocketProbe(socket as unknown as WebSocket, 2)
    socket.onopen!()
    expect(JSON.parse(socket.send.mock.calls[0]![0])).toEqual({ client: 'native-websocket', run: 2 })
    socket.onmessage!({ data: JSON.stringify(connectedFrame) })
    const frames = order === 'echo-first' ? [echoFrame, tickFrame] : [tickFrame, echoFrame]
    socket.onmessage!({ data: JSON.stringify(frames[0]) })
    expect(socket.close).not.toHaveBeenCalled()
    socket.onmessage!({ data: JSON.stringify(frames[1]) })
    await expect(task).resolves.toMatchObject({ echoPayload: echoFrame, tickPayload: tickFrame, connectedReadyState: 1, finalReadyState: 3 })
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(socket.onmessage).toBeNull()
    expect(socket.onclose).toBeNull()
  })

  it('fails a tick-only connection instead of accepting the push as an echo', async () => {
    vi.useFakeTimers()
    const socket = createSocket()
    const task = waitForRequestClientsRealWebSocketProbe(socket as unknown as WebSocket, 2)
    const rejection = expect(task).rejects.toThrow('Timed out waiting for WebSocket echo')
    socket.onopen!()
    socket.onmessage!({ data: JSON.stringify(connectedFrame) })
    socket.onmessage!({ data: JSON.stringify(tickFrame) })
    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(socket.onmessage).toBeNull()
  })

  it.each(['closed', 'invalid-json', 'wrong-run', 'missing-welcome', 'socket-error', 'send-error'])('rejects and cleans a %s connection', async (reason) => {
    const socket = createSocket()
    const task = waitForRequestClientsRealWebSocketProbe(socket as unknown as WebSocket, 2)
    const rejection = expect(task).rejects.toThrow()
    if (reason === 'send-error') {
      socket.send.mockImplementation(() => {
        throw new Error('send failed')
      })
    }
    socket.onopen!()
    if (reason === 'missing-welcome') {
      socket.onmessage!({ data: JSON.stringify(echoFrame) })
    }
    else if (reason === 'socket-error') {
      socket.onerror!(new Error('socket failed'))
    }
    else if (reason === 'closed') {
      socket.readyState = 3
      socket.onclose!()
    }
    else if (reason !== 'send-error') {
      socket.onmessage!({ data: JSON.stringify(connectedFrame) })
      socket.onmessage!({ data: reason === 'invalid-json' ? '{' : JSON.stringify({ ...echoFrame, body: { client: 'native-websocket', run: 1 } }) })
    }
    await rejection
    expect(socket.onopen).toBeNull()
    expect(socket.onmessage).toBeNull()
    expect(socket.onerror).toBeNull()
    expect(socket.onclose).toBeNull()
  })

  it('preserves the original failure when closing also throws', async () => {
    const socket = createSocket()
    socket.close.mockImplementation(() => {
      throw new Error('close failed')
    })
    const task = waitForRequestClientsRealWebSocketProbe(socket as unknown as WebSocket, 2)
    const rejection = expect(task).rejects.toThrow('socket failed')
    expect(() => socket.onerror!(new Error('socket failed'))).not.toThrow()
    await rejection
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(socket.onmessage).toBeNull()
  })

  it('waits for the actual close event and times out when it never arrives', async () => {
    vi.useFakeTimers()
    const socket = createSocket()
    socket.close.mockImplementation(() => {
      socket.readyState = 2
    })
    const task = waitForRequestClientsRealWebSocketProbe(socket as unknown as WebSocket, 2)
    const rejection = expect(task).rejects.toThrow('Timed out waiting for WebSocket')
    socket.onopen!()
    for (const frame of [connectedFrame, echoFrame, tickFrame]) {
      socket.onmessage!({ data: JSON.stringify(frame) })
    }
    expect(socket.onclose).not.toBeNull()
    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(socket.onclose).toBeNull()
  })

  it('rejects a close failure after valid frames without retrying close', async () => {
    const socket = createSocket()
    socket.close.mockImplementation(() => {
      throw new Error('close failed')
    })
    const task = waitForRequestClientsRealWebSocketProbe(socket as unknown as WebSocket, 2)
    const rejection = expect(task).rejects.toThrow('close failed')
    socket.onopen!()
    for (const frame of [connectedFrame, echoFrame, tickFrame]) {
      socket.onmessage!({ data: JSON.stringify(frame) })
    }
    await rejection
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(socket.onmessage).toBeNull()
  })

  for (const provider of ['node', 'browser'] as const) {
    it(`renders only validated current-run echoes in the ${provider} session`, async () => {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-websocket-transcript-'))
      directories.push(projectPath)
      for (const [file, source] of webSocketTranscriptFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath, globals: webSocketTranscriptGlobals })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(webSocketTranscriptFiles), globals: webSocketTranscriptGlobals })
      const root = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
        callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
        createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
        createScopeHandle: () => null,
        ownerScopeId: () => null,
      })
      try {
        const page = session.reLaunch('/pages/index/index')
        page.receiveFrame(connectedFrame)
        page.receiveFrame(tickFrame)
        expect(await (await root().$('#status'))?.text()).toBe('waiting')
        expect(await (await root().$('#echo-run'))?.text()).toBe('0')
        page.receiveFrame(echoFrame)
        expect(await (await root().$('#status'))?.text()).toBe('success')
        expect(await (await root().$('#echo-stage'))?.text()).toBe('echo')
        expect(await (await root().$('#echo-run'))?.text()).toBe('2')
        const next = session.reLaunch('/pages/index/index')
        next.receiveFrame(connectedFrame)
        next.receiveFrame({ ...echoFrame, body: { client: 'native-websocket', run: 1 } })
        expect(await (await root().$('#status'))?.text()).toBe('failed')
        expect(await (await root().$('#echo-run'))?.text()).toBe('0')
      }
      finally {
        session.close()
      }
    })
  }
})
