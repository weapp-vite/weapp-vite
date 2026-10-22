import { connect } from 'node:net'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { createHostResources } from './resources.mjs'

const controlsKey = Symbol.for('weapp-vite:e2e-native-host-controls')

function createControl(endpoint) {
  const resources = createHostResources()
  let activated = false
  function activate() {
    if (activated) {
      return
    }
    activated = true
    const socket = connect({ host: '127.0.0.1', port: endpoint.port })
    let requested = false
    let receiptSent = false
    let channelFailed = false
    const failChannel = (error) => {
      if (channelFailed) {
        return
      }
      channelFailed = true
      process.exitCode = 1
      console.error('[native-host-control] Control connection failed:', error)
      void resources.close().catch(cleanupError => console.error('[native-host-control] Native host cleanup failed:', cleanupError))
    }
    socket.once('connect', () => socket.write(`${JSON.stringify({ type: 'ready', token: endpoint.token })}\n`))
    const input = createInterface({ input: socket })
    // 输入流和 readline 的错误共用一次资源收尾，保留原始连接失败。
    input.on('error', failChannel)
    input.on('line', (line) => {
      let request
      try {
        request = JSON.parse(line)
      }
      catch {
        return
      }
      if (!request || typeof request !== 'object' || request.token !== endpoint.token || request.type !== 'close' || requested) {
        return
      }
      requested = true
      console.log('[native-host-control] close requested')
      void resources.close().then(() => {
        receiptSent = true
        socket.end(`${JSON.stringify({ type: 'closed', token: endpoint.token })}\n`)
      }, (error) => {
        process.exitCode = 1
        console.error('[native-host-control] Native host cleanup failed:', error)
        receiptSent = true
        socket.end(`${JSON.stringify({ type: 'closed', token: endpoint.token, error: String(error?.message ?? error) })}\n`)
      })
    })
    socket.on('error', failChannel)
    socket.once('close', () => {
      if (!receiptSent) {
        failChannel(new Error('Control disconnected before native cleanup completed'))
      }
    })
  }
  return { ...resources, activate, hasServer: false }
}

function ownServer(control, server) {
  if (!control.hasServer) {
    control.hasServer = true
    if (typeof server.listen === 'function') {
      // 首代在 configureServer 同步登记；后续异步 hook 不能留下提前 close 的窗口。
      const startup = Promise.withResolvers()
      void control.acquire(() => startup.promise).catch(() => {})
      const listen = server.listen.bind(server)
      const onExit = code => startup.reject(new Error(`Native host exited before initial listen completed: code=${code}`))
      process.once('exit', onExit)
      server.listen = (...args) => Promise.resolve().then(() => listen(...args)).then((result) => {
        process.off('exit', onExit)
        startup.resolve()
        return result
      }, (error) => {
        process.off('exit', onExit)
        startup.reject(error)
        throw error
      })
    }
  }
  if (typeof server.restart === 'function') {
    const restart = server.restart.bind(server)
    // 保留原生完整重启，包括配置失败、Object.assign 和实际 listen 的全部结算。
    server.restart = (...args) => control.acquire(() => restart(...args))
  }
  // 读取当前原生 close，保留用户 wrapper 与产品的整条重启关闭门禁。
  return control.own(server, () => server.close())
}

/** 相同命令的配置重载共享关闭边界；不同启动 token 的资源互不干扰。 */
export function createNativeHostControlPlugin(endpoint) {
  const controls = globalThis[controlsKey] ??= new Map()
  const control = controls.get(endpoint.token) ?? createControl(endpoint)
  controls.set(endpoint.token, control)
  const builders = new WeakSet()
  return {
    name: 'weapp-vite:e2e-native-host-control',
    enforce: 'pre',
    configureServer: {
      order: 'pre',
      handler(server) {
        const acquisition = ownServer(control, server)
        control.activate()
        return acquisition
      },
    },
    buildApp: {
      order: 'pre',
      handler(builder) {
        if (builders.has(builder)) {
          return
        }
        builders.add(builder)
        const build = builder.build.bind(builder)
        builder.build = (environment) => {
          const acquisition = control.acquire(async () => {
            const result = await build(environment)
            if (environment.config.build.watch && result && typeof result.close === 'function') {
              await control.own(result, () => result.close())
            }
            return result
          })
          control.activate()
          return acquisition
        }
      },
    },
  }
}
