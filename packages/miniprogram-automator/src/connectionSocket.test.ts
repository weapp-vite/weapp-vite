import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'
import Connection from './Connection'
import MiniProgram from './MiniProgram'

interface SocketFixture {
  connection: Connection
  peer: WebSocket
  program: MiniProgram
}

/** 只释放当前测试创建的服务端和连接；端口由操作系统临时分配。 */
async function withSocketFixture(run: (fixture: SocketFixture) => Promise<void>) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  let connection: Connection | undefined
  try {
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('The test WebSocket server did not acquire a TCP port.')
    }
    const accepted = once(server, 'connection')
    connection = await Connection.create(`ws://127.0.0.1:${address.port}`, 1_000)
    const [peer] = await accepted as [WebSocket]
    await run({ connection, peer, program: new MiniProgram(connection) })
  }
  finally {
    const disposing = Promise.resolve().then(() => connection?.dispose())
    for (const peer of server.clients) {
      peer.terminate()
    }
    const closing = new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })
    await Promise.all([disposing, closing])
  }
}

describe('real WebSocket connection lifecycle', () => {
  it('rejects an in-flight protocol request before awaited disconnect confirms actual client closure', async () => {
    // 此 spy 透传真实 terminate，仅取回 Connection.create 拥有的客户端以观察 close 事件。
    const terminate = vi.spyOn(WebSocket.prototype, 'terminate')
    try {
      await withSocketFixture(async ({ connection, peer, program }) => {
        const order: string[] = []
        const received = once(peer, 'message')
        const request = program.send('App.pendingSocketProbe')
        const rejected = expect(request.catch((error: unknown) => {
          order.push('request-rejected')
          throw error
        })).rejects.toThrow('Connection closed')
        const [message] = await received
        expect(JSON.parse(String(message))).toMatchObject({ method: 'App.pendingSocketProbe', params: {} })

        const closing = program.disconnect()
        expect(program.disconnect()).toBe(closing)
        expect(terminate).toHaveBeenCalledOnce()
        const client = terminate.mock.contexts[0] as WebSocket
        expect(client).not.toBe(peer)
        expect(client.readyState).not.toBe(WebSocket.CLOSED)
        let closed = false
        client.once('close', () => {
          closed = true
          order.push('client-closed')
        })
        let disconnected = false
        const completed = closing.then(() => {
          disconnected = true
          order.push('disconnect-resolved')
          expect(closed).toBe(true)
        })
        expect(disconnected).toBe(false)
        await rejected
        await completed
        expect(client.readyState).toBe(WebSocket.CLOSED)
        expect(order).toEqual(['request-rejected', 'client-closed', 'disconnect-resolved'])
        expect(program.disconnect()).toBe(closing)
        const disposed = connection.dispose()
        expect(connection.dispose()).toBe(disposed)
        await disposed
        expect(terminate).toHaveBeenCalledOnce()
      })
    }
    finally {
      terminate.mockRestore()
    }
  })

  it('rejects pending work after remote closure and disposes an already closed socket without terminating it again', async () => {
    const terminate = vi.spyOn(WebSocket.prototype, 'terminate')
    try {
      await withSocketFixture(async ({ connection, peer, program }) => {
        const received = once(peer, 'message')
        const request = program.send('App.pendingRemoteCloseProbe')
        const rejected = expect(request).rejects.toThrow('Connection closed')
        await received
        const closed = once(connection, 'close')
        peer.close()
        await closed
        await rejected
        await expect(program.send('App.afterRemoteCloseProbe')).rejects.toThrow('Connection closed')
        const closing = program.disconnect()
        expect(program.disconnect()).toBe(closing)
        await closing
        const disposed = connection.dispose()
        expect(connection.dispose()).toBe(disposed)
        await disposed
        expect(terminate).not.toHaveBeenCalled()
      })
    }
    finally {
      terminate.mockRestore()
    }
  })
})
