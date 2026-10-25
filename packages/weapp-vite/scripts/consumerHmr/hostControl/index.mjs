import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { createSiblingPluginConfig } from '../configWrapper.mjs'

/** 控制通道只连接本次启动的叶宿主，不依赖 Vite+ 是否转发父 IPC 或信号。 */
export async function createNativeHostControl(root, configFile) {
  const token = randomUUID()
  const ready = Promise.withResolvers()
  const completed = Promise.withResolvers()
  const peerClosed = Promise.withResolvers()
  const sockets = new Set()
  let peer
  let stopping
  let disposing
  let received = false
  let initialStarted = false
  let channelError
  const server = createServer((socket) => {
    sockets.add(socket)
    const failChannel = (error) => {
      if (socket === peer) {
        channelError ??= error
        completed.reject(channelError)
      }
    }
    socket.on('error', failChannel)
    socket.on('close', () => {
      sockets.delete(socket)
      if (socket === peer) {
        if (!received) {
          failChannel(new Error('Native host control disconnected before its cleanup receipt'))
        }
        peerClosed.resolve()
      }
    })
    const input = createInterface({ input: socket })
    // readline 会再次转发底层输入错误；已认证 peer 的错误仍拒绝关闭回执。
    input.on('error', failChannel)
    input.on('line', (line) => {
      let message
      try {
        message = JSON.parse(line)
      }
      catch {
        socket.destroy()
        return
      }
      if (!message || typeof message !== 'object' || message.token !== token || (peer && peer !== socket)) {
        socket.destroy()
        return
      }
      if (message.type === 'ready') {
        peer = socket
        ready.resolve(socket)
      }
      else if (message.type === 'initial-started' && peer === socket) {
        initialStarted = true
      }
      else if (message.type === 'closed' && peer === socket) {
        received = true
        if (message.error) {
          completed.reject(new Error(`Native host cleanup failed: ${message.error}`))
        }
        else {
          completed.resolve()
        }
      }
    })
  })
  // 启动失败或尚未 stop 时的断连仍保留为关闭失败，避免无人处理的拒绝。
  void ready.promise.catch(() => {})
  void completed.promise.catch(() => {})
  let directory
  let configuration
  const dispose = () => {
    if (!disposing) {
      disposing = (async () => {
        const interrupted = new Error('Native host control disposed before its cleanup receipt')
        ready.reject(interrupted)
        completed.reject(interrupted)
        for (const socket of sockets) {
          socket.destroy()
        }
        if (server.listening) {
          await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        }
        if (configuration) {
          await configuration.dispose()
        }
        if (directory) {
          await rm(directory, { recursive: true, force: true })
        }
      })().catch((error) => {
        // 端口关闭成功但配置删除失败时，后续清理仍可重试当前目录。
        disposing = undefined
        throw error
      })
    }
    return disposing
  }
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const endpoint = { port: server.address().port, token }
    const parent = path.join(root, '.weapp-vite')
    await mkdir(parent, { recursive: true })
    directory = await mkdtemp(path.join(parent, 'e2e-native-host-'))
    for (const file of ['plugin.mjs', 'resources.mjs']) {
      await copyFile(new URL(file, import.meta.url), path.join(directory, file))
    }
    const originalConfig = path.resolve(root, configFile)
    configuration = await createSiblingPluginConfig({
      directory: path.dirname(originalConfig),
      configFiles: [originalConfig],
      pluginUrl: pathToFileURL(path.join(directory, 'plugin.mjs')).href,
      pluginExport: 'createNativeHostControlPlugin',
      pluginOptions: endpoint,
    })
    return {
      configFile: configuration.configFile,
      requestClose(settledExit) {
        return stopping ??= (async () => {
          try {
            const socket = await ready.promise
            if (!socket.destroyed) {
              socket.write(`${JSON.stringify({ type: 'close', token })}\n`)
            }
            await completed.promise
            return { type: 'closed' }
          }
          catch (error) {
            if (error !== channelError || !settledExit) {
              throw error
            }
            // 同一连接的消息先于 EOF；等全部消息与输出排空后才能确认首构尚未完成。
            await peerClosed.promise
            if (initialStarted) {
              throw error
            }
            const exit = await settledExit
            if (typeof exit.exitCode === 'number' && exit.exitCode !== 0 && !exit.signal) {
              return { type: 'startup-exited' }
            }
            throw error
          }
        })()
      },
      dispose,
    }
  }
  catch (error) {
    try {
      await dispose()
    }
    catch (disposalError) {
      throw new AggregateError([error, disposalError], 'Native host control preparation and disposal failed', { cause: error })
    }
    throw error
  }
}
