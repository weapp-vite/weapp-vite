import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, open, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

/** 控制通道只连接本次启动的叶宿主，不依赖 Vite+ 是否转发父 IPC 或信号。 */
export async function createNativeHostControl(root, configFile) {
  const token = randomUUID()
  const ready = Promise.withResolvers()
  const completed = Promise.withResolvers()
  const sockets = new Set()
  let peer
  let stopping
  let disposing
  let received = false
  const server = createServer((socket) => {
    sockets.add(socket)
    const failChannel = (error) => {
      if (socket === peer) {
        completed.reject(error)
      }
    }
    socket.on('error', failChannel)
    socket.on('close', () => {
      sockets.delete(socket)
      if (socket === peer && !received) {
        completed.reject(new Error('Native host control disconnected before its cleanup receipt'))
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
  let controlledConfig
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
        if (controlledConfig) {
          await rm(controlledConfig, { force: true })
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
    const wrapper = path.join(path.dirname(originalConfig), `.weapp-vite-e2e-${token}.config.mjs`)
    const handle = await open(wrapper, 'wx')
    controlledConfig = wrapper
    try {
      // 配置必须与原文件同目录，保留宿主按 configFile 解析支持文件和相对路径的语义。
      await handle.writeFile(`import original from ${JSON.stringify(pathToFileURL(originalConfig).href)}
import { createNativeHostControlPlugin } from ${JSON.stringify(pathToFileURL(path.join(directory, 'plugin.mjs')).href)}
export default async env => {
  const config = await (typeof original === 'function' ? original(env) : original)
  return { ...config, plugins: [createNativeHostControlPlugin(${JSON.stringify(endpoint)}), ...(config.plugins ?? [])] }
}
`)
    }
    finally {
      await handle.close()
    }
    return {
      configFile: controlledConfig,
      requestClose() {
        return stopping ??= (async () => {
          const socket = await ready.promise
          socket.write(`${JSON.stringify({ type: 'close', token })}\n`)
          await completed.promise
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
