import type { ViteDevServer } from 'vite'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '@weapp-core/constants'
import { createLogger, createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { weapp } from './index'
import { WeappBuildSession } from './session'

it('announces stateful readiness only after the listening host publishes its final transport control', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'stateful-startup-control-')))
  const paused = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const messages: string[] = []
  const original = WeappBuildSession.prototype.refreshHostControl
  const refresh = vi.spyOn(WeappBuildSession.prototype, 'refreshHostControl').mockImplementation(async function (this: WeappBuildSession) {
    paused.resolve()
    await release.promise
    await original.call(this)
  })
  let server: ViteDevServer | undefined
  let listening: Promise<ViteDevServer> | undefined
  try {
    for (const [file, source] of Object.entries({
      'package.json': '{"name":"stateful-startup-control","type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'project.private.config.json': '{"setting":{"compileHotReLoad":true}}',
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.js': 'Page({data:{message:"ready"}})',
      'src/pages/home/index.json': '{}',
      'src/pages/home/index.wxml': '<view>{{message}}</view>',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), source)
    }
    server = await createServer({
      root,
      configFile: false,
      customLogger: { ...createLogger('silent'), info: message => messages.push(message) },
      plugins: [weapp()],
      server: { host: '127.0.0.1', port: 0 },
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
    })
    listening = server.listen()
    await Promise.race([paused.promise, listening.then(() => {
      throw new Error('Host listen skipped control refresh')
    })])
    expect(messages.filter(message => message.includes('小程序开发产物已就绪'))).toEqual([])
    release.resolve()
    await listening
    expect(messages.filter(message => message.includes('小程序开发产物已就绪'))).toEqual([
      '[weapp-vite] 小程序开发产物已就绪 (stateful-experimental)',
    ])
    const controlSource = await readFile(path.join(root, 'dist', WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')
    const realm = { globalThis: {}, wx: { request: () => ({ abort() {} }) }, setTimeout: () => 0 }
    vm.runInNewContext(controlSource, realm)
    const control = Reflect.get(realm.globalThis, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY) as { url: string }
    const address = server.httpServer!.address()
    expect(address && typeof address !== 'string' && new URL(control.url).port === String(address.port)).toBe(true)
    const response = await fetch(control.url.replace('localhost', '127.0.0.1'), { method: 'POST', body: '{}' })
    expect(response.status).toBe(403)
  }
  finally {
    release.resolve()
    await listening?.catch(() => {})
    await server?.close()
    refresh.mockRestore()
    await rm(root, { recursive: true, force: true })
  }
})
