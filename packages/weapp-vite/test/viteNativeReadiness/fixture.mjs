import fs from 'node:fs'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

async function main() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vite-ready-contract-')))
  const originalStat = fs.stat
  const originalWatch = fs.watch
  const rootStat = Promise.withResolvers()
  const missingStats = Promise.withResolvers()
  const ready = Promise.withResolvers()
  let releaseRootStat
  let missingCount = 0
  let rootRegistered = false
  let readyBeforeRelease = false
  let registeredAtReady = false
  let rootReleased = false
  let server

  // 只阻塞根目录扫描；缺失 env 文件仍走真实文件系统与原生回调。
  fs.stat = function (...args) {
    const file = path.resolve(String(args[0]))
    if (file === root && !rootReleased) {
      releaseRootStat = () => {
        releaseRootStat = undefined
        originalStat.apply(this, args)
      }
      rootStat.resolve()
      return
    }
    if (path.dirname(file) === root && path.basename(file).startsWith('.env')) {
      const callback = args.at(-1)
      args[args.length - 1] = function (error, ...values) {
        callback(error, ...values)
        if (error?.code === 'ENOENT' && ++missingCount === 4) {
          missingStats.resolve()
        }
      }
    }
    return originalStat.apply(this, args)
  }
  fs.watch = function (...args) {
    const watcher = originalWatch.apply(this, args)
    if (path.resolve(String(args[0])) === root) {
      rootRegistered = true
    }
    return watcher
  }

  try {
    // 在导入前拦截，确保 Vite 内置 watcher 使用当前子进程的受控 stat。
    const { createServer } = await import('vite')
    const pending = createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, hmr: false, watch: { usePolling: false, useFsEvents: false } },
      plugins: [{
        name: 'native-readiness-contract',
        configureServer(instance) {
          instance.watcher.once('ready', () => {
            readyBeforeRelease = !rootReleased
            registeredAtReady = rootRegistered
            ready.resolve()
          })
          instance.watcher.on('error', ready.reject)
        },
      }],
    })
    const timeout = setTimeout(() => {
      rootStat.reject(new Error('Root stat was not intercepted'))
      missingStats.reject(new Error('Missing env stats did not complete'))
      ready.reject(new Error('Watcher did not become ready'))
    }, 5000)
    try {
      await Promise.all([rootStat.promise, missingStats.promise])
      // 让已完成 stat 的 Promise/nextTick 回执排空；根目录仍被显式屏障阻塞。
      await new Promise(resolve => setImmediate(resolve))
      rootReleased = true
      releaseRootStat()
      server = await pending
      await ready.promise
      process.stdout.write(JSON.stringify({ missingCount, readyBeforeRelease, registeredAtReady }))
    }
    finally {
      clearTimeout(timeout)
      rootReleased = true
      releaseRootStat?.()
      server ??= await pending
      await server.close()
    }
  }
  finally {
    fs.stat = originalStat
    fs.watch = originalWatch
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
