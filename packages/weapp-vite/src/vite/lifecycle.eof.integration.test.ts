import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { finished } from 'node:stream/promises'
import { expect, it } from 'vitest'

const lifecycleUrl = new URL('./lifecycle.ts', import.meta.url).href
const ownerUrl = new URL('../runtime/classicIdeConfig/index.ts', import.meta.url).href

it.each(['restart', 'duplicate-close', 'configure-error', 'post-error', ...process.platform === 'win32' ? [] : ['sigterm']])(
  'waits for the whole native host restart before EOF can exit during %s',
  async (mode) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-native-eof-')))
    const file = path.join(root, 'project.private.config.json')
    const original = '{"setting":{"compileHotReLoad":true}}\r\n'
    await writeFile(file, original)
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import { writeSync } from 'node:fs'
    import { createServer } from 'vite'
    import { bindHostLifecycle, takeHostLifecycle } from ${JSON.stringify(lifecycleUrl)}
    import { ClassicIdeConfigOwner } from ${JSON.stringify(ownerUrl)}
    const owner = new ClassicIdeConfigOwner()
    await owner.activate(${JSON.stringify(file)})
    const log = value => writeSync(1, value + '\\n')
    const mode = ${JSON.stringify(mode)}
    let generation = 0
    const server = await createServer({
      root: ${JSON.stringify(root)}, configFile: false,
      appType: 'custom', publicDir: false, logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0, ws: false, watch: null },
      plugins: [{
        name: 'native-eof-restart-fixture',
        async configureServer(host) {
          const current = ++generation
          const inherited = takeHostLifecycle(host.config.inlineConfig)
          bindHostLifecycle(host, async () => {}, inherited, undefined, async () => {
            await owner.close()
            log('CONFIG_RESTORED')
          })
          if (current === 2) {
            // 两代原生 EOF 回调均已登记，父重启仍在等待新代 configureServer。
            const released = new Promise(resolve => mode === 'sigterm'
              ? process.once('SIGTERM', resolve)
              : process.stdin.once('end', resolve))
            process.send('replacement-ready')
            await released
          }
        },
        closeServer({ reason }) { log('HOST_CLOSED:' + reason) },
      }, {
        name: 'user-startup-failure-fixture',
        configureServer() {
          if (generation !== 2) return
          if (mode === 'configure-error') throw new Error('user configureServer failed')
          if (mode === 'post-error') return () => { throw new Error('user post hook failed') }
        },
      }],
    })
    await server.listen()
    if (mode === 'duplicate-close') {
      process.stdin.once('end', () => {
        void server.close()
        void server.close()
        queueMicrotask(() => process.stdin.emit('end'))
      })
    }
    process.stdin.resume()
    try {
      await server.restart()
    } catch (error) {
      log('RESTART_FAILED:' + error.message)
      await server.close()
    }
  `], {
      env: { ...process.env, CI: 'false' },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout!.on('data', chunk => stdout += String(chunk))
    child.stderr!.on('data', chunk => stderr += String(chunk))
    const exited = once(child, 'exit')
    const completed = Promise.all([exited, finished(child.stdout!), finished(child.stderr!)])
    child.once('message', () => mode === 'sigterm' ? child.kill('SIGTERM') : child.stdin!.end())
    const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
    try {
      const [[code, signal]] = await completed
      expect({ code, signal }, stderr).toEqual({ code: mode === 'sigterm' ? 143 : 0, signal: null })
      expect(await readFile(file, 'utf8'), stdout).toBe(original)
      expect(stdout).toContain('CONFIG_RESTORED\n')
      if (mode.endsWith('-error')) {
        expect(stdout).toContain('RESTART_FAILED:')
      }
    }
    finally {
      clearTimeout(timer)
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
        await exited
      }
      await rm(root, { recursive: true, force: true })
    }
  },
  15_000,
)
