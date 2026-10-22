import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { connect } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it, vi } from 'vitest'
import { consumerProcessEnvironment } from '../../packages/weapp-vite/scripts/consumerHmr/shutdown.mjs'
import { createDevProcessEnv } from './dev-process-env'
import { startRuntimeDevProcess } from './runtimeDevProcess'

const require = createRequire(import.meta.url)
const nativeCli = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')

it.each([
  ['direct', 'dev'],
  ['direct', 'build-watch'],
  ['child', 'dev'],
  ['child', 'build-watch'],
  ['orphan-parent', 'dev'],
  ['orphan-parent', 'build-watch'],
  ['orphan-parent-failed', 'dev'],
] as const)('normally closes a real native Vite %s CLI %s and drains its final output without IPC', async (launch, operation) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-runtime-close-'))
  const original = `
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
process.once('exit', code => console.log('native fixture exit=' + code))
const complete = async () => {
  await delay(20)
  console.log('native fixture cleanup completed')
  console.error('native fixture final diagnostic')
}
export default {
  build: { lib: { entry: 'entry.js', formats: ['es'] } },
  plugins: [{ name: 'native-close-observer', closeServer: complete, closeWatcher: complete }],
}
`
  await writeFile(path.join(root, 'package.json'), '{"name":"native-close-probe","private":true,"type":"module"}')
  await writeFile(path.join(root, 'entry.js'), 'export const marker = "native-watch-probe"\n')
  await writeFile(path.join(root, 'original.config.mjs'), original)
  const bridge = path.join(root, 'bridge.mjs')
  // 模拟 Vite+ 的叶 CLI 边界：启动参数和 stdio 继承，父 IPC 不传播。
  await writeFile(bridge, `
import { spawn } from 'node:child_process'
import process from 'node:process'
const child = spawn(process.execPath, [${JSON.stringify(nativeCli)}, ...process.argv.slice(2)], { stdio: 'inherit' })
child.once('error', error => { console.error(error); process.exitCode = 1 })
child.once('exit', (code, signal) => { process.exitCode = signal ? 1 : code })
${launch.startsWith('orphan-parent')
  ? `child.unref()
process.exitCode = ${launch === 'orphan-parent-failed' ? 7 : 0}
process.once('exit', code => console.log('native bridge exited before leaf=' + code))`
  : ''}
`)
  const args = [launch === 'direct' ? nativeCli : bridge, ...operation === 'dev' ? ['dev', '--host', '127.0.0.1', '--port', '0'] : ['build', '--watch'], '--config', 'original.config.mjs']
  const env = consumerProcessEnvironment(operation, createDevProcessEnv(), { explicitControl: true })
  const dev = await startRuntimeDevProcess('vite', args, { cwd: root, env, all: true })
  let released = false
  try {
    await dev.waitForOutput(operation === 'dev' ? 'ready in' : 'built in', 'native CLI startup', 20_000)
    const stopping = dev.stop(3_000, { gracefulTimeoutMs: 15_000 })
    expect(dev.stop(3_000)).toBe(stopping)
    if (launch === 'orphan-parent-failed') {
      await expect(stopping).rejects.toThrow('exitCode=7')
    }
    else {
      await stopping
    }
    released = true
    expect(dev.getOutput()).toContain('native fixture cleanup completed')
    expect(dev.getOutput()).toContain('native fixture final diagnostic')
    expect(dev.getOutput()).toContain('native fixture exit=0')
    if (launch.startsWith('orphan-parent')) {
      expect(dev.getOutput()).toContain(`native bridge exited before leaf=${launch === 'orphan-parent-failed' ? 7 : 0}`)
    }
    expect(await readFile(path.join(root, 'original.config.mjs'), 'utf8')).toBe(original)
  }
  finally {
    await dev.stop(3_000, { gracefulTimeoutMs: 500 }).then(() => released = true, () => {})
    if (released) {
      await rm(root, { recursive: true, force: true })
    }
  }
}, 60_000)

it('preserves a later configureServer startup failure without an unending initial-listen acquisition', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-runtime-startup-failure-'))
  await writeFile(path.join(root, 'package.json'), '{"name":"native-startup-failure-probe","private":true,"type":"module"}')
  await writeFile(path.join(root, 'original.config.mjs'), `
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
process.once('exit', code => console.log('native startup failure exit=' + code))
export default { plugins: [{
  name: 'native-initialization-failure',
  async configureServer() {
    await delay(20)
    throw new Error('original-configure-startup-failure')
  },
}] }
`)
  const dev = await startRuntimeDevProcess('vite', [nativeCli, 'dev', '--host', '127.0.0.1', '--port', '0', '--config', 'original.config.mjs'], {
    cwd: root,
    env: createDevProcessEnv(),
    all: true,
  })
  let released = false
  try {
    await vi.waitFor(() => {
      expect(dev.getOutput()).toContain('original-configure-startup-failure')
    }, { timeout: 10_000, interval: 10 })
    await expect(dev.stop(0)).rejects.toMatchObject({
      name: 'Error',
      message: expect.stringContaining('original-configure-startup-failure'),
    })
    expect(dev.getOutput()).toContain('native startup failure exit=1')
    expect(await readdir(path.join(root, '.weapp-vite'))).not.toEqual(expect.arrayContaining([expect.stringMatching(/^e2e-native-host-/)]))
    released = true
  }
  finally {
    if (released) {
      await rm(root, { recursive: true, force: true })
    }
  }
}, 20_000)

it.each(['native', 'weapp'] as const)('closes a real %s host after stop races an asynchronous config restart without a late listener', async (profile) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-runtime-restart-close-'))
  const release = path.join(root, 'release-config')
  const configFile = path.join(root, 'original.config.mjs')
  const adapter = pathToFileURL(path.resolve(import.meta.dirname, '../../packages/weapp-vite/dist/vite.mjs')).href
  const original = `
import { existsSync } from 'node:fs'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
${profile === 'weapp' ? `import { weapp } from ${JSON.stringify(adapter)}` : ''}
const key = Symbol.for('native-close-probe:' + ${JSON.stringify(root)})
const generation = globalThis[key] = (globalThis[key] ?? 0) + 1
export default async () => {
  if (generation > 1) {
    console.log('CONFIG_RELOAD_ENTERED')
    while (!existsSync(${JSON.stringify(release)})) await delay(10)
  }
  return {
    ${profile === 'weapp' ? 'weapp: { srcRoot: \'src\', autoRoutes: false, mcp: false, hmr: { runtime: \'stateful-experimental\' } },' : ''}
    plugins: [${profile === 'weapp' ? 'weapp(),' : ''}{
      name: 'native-restart-close-observer',
      configureServer(server) {
        server.httpServer?.on('listening', () => console.log('NATIVE_LISTEN=' + server.httpServer.address().port))
      },
      async closeServer() {
        await delay(20)
        console.log('native generation closed=' + generation)
        console.error('native generation diagnostic=' + generation)
      },
    }],
  }
}
process.once('exit', code => console.log('native restart fixture exit=' + code))
`
  await writeFile(path.join(root, 'package.json'), '{"name":"native-restart-close-probe","private":true,"type":"module"}')
  await writeFile(configFile, original)
  if (profile === 'weapp') {
    await mkdir(path.join(root, 'src/pages/index'), { recursive: true })
    await writeFile(path.join(root, 'src/app.js'), 'App({})')
    await writeFile(path.join(root, 'src/app.json'), '{"pages":["pages/index/index"]}')
    await writeFile(path.join(root, 'src/pages/index/index.js'), 'Page({data:{marker:"native-restart"}})')
    await writeFile(path.join(root, 'src/pages/index/index.wxml'), '<view>{{marker}}</view>')
    await writeFile(path.join(root, 'src/pages/index/index.json'), '{}')
    await writeFile(path.join(root, 'project.config.json'), '{"miniprogramRoot":"dist"}')
    await writeFile(path.join(root, 'tsconfig.json'), '{"files":[],"references":[{"path":"./.weapp-vite/tsconfig.app.json"}]}')
  }
  const dev = await startRuntimeDevProcess('vite', [nativeCli, 'dev', '--host', '127.0.0.1', '--port', '0', '--config', 'original.config.mjs'], {
    cwd: root,
    env: createDevProcessEnv(),
    all: true,
  })
  let released = false
  try {
    await dev.waitForOutput('NATIVE_LISTEN=', 'first native listener', 20_000)
    if (profile === 'weapp') {
      // 控制配置的位置不能改变受管支持文件在项目根目录中的归属。
      await expect(access(path.join(root, '.weapp-vite/tsconfig.app.json'))).resolves.toBeUndefined()
    }
    await writeFile(configFile, `${original}\n// configuration reload probe\n`)
    await dev.waitForOutput('CONFIG_RELOAD_ENTERED', 'gated second configuration', 20_000)
    let stopped = false
    const stopping = dev.stop(3_000, { gracefulTimeoutMs: 15_000 })
    const result = Promise.allSettled([stopping])
    void stopping.then(() => stopped = true, () => stopped = true)
    await dev.waitForOutput('[native-host-control] close requested', 'shutdown received during pending config', 5_000)
    expect(stopped).toBe(false)
    await writeFile(release, 'continue')
    const [completed] = await result
    if (completed?.status === 'rejected') {
      throw completed.reason
    }
    released = true
    const output = dev.getOutput()
    expect(output).toContain('native generation closed=2')
    expect(output).toContain('native generation diagnostic=2')
    expect(output).toContain('native restart fixture exit=0')
    const ports = [...output.matchAll(/NATIVE_LISTEN=(\d+)/g)].map(match => Number(match[1]))
    expect(ports.length).toBeGreaterThanOrEqual(2)
    for (const port of new Set(ports)) {
      await expect(new Promise<void>((resolve, reject) => {
        const socket = connect({ host: '127.0.0.1', port })
        socket.once('connect', () => {
          socket.destroy()
          reject(new Error('A retired native host is still listening'))
        })
        socket.once('error', (error: NodeJS.ErrnoException) => error.code === 'ECONNREFUSED' ? resolve() : reject(error))
      })).resolves.toBeUndefined()
    }
  }
  finally {
    await writeFile(release, 'continue')
    await dev.stop(3_000, { gracefulTimeoutMs: 500 }).then(() => released = true, () => {})
    if (released) {
      await rm(root, { recursive: true, force: true })
    }
  }
}, 60_000)
