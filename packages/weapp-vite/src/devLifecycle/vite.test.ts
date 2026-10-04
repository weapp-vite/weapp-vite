import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { finished } from 'node:stream/promises'
import { expect, it } from 'vitest'

const factoryUrl = new URL('./vite.ts', import.meta.url).href
const scopeUrl = new URL('./shutdown.ts', import.meta.url).href
const lifecycleUrl = new URL('../vite/lifecycle.ts', import.meta.url).href

async function runChild(source: string, stop?: (child: ReturnType<typeof spawn>) => void) {
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', source], {
    env: { ...process.env, CI: 'false' },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout!.on('data', chunk => stdout += String(chunk))
  child.stderr!.on('data', chunk => stderr += String(chunk))
  const exited = once(child, 'exit')
  // 父端主动 disconnect 后 Node 可能不再触发 ChildProcess.close；直接等待退出与输出流排空。
  const completed = Promise.all([exited, finished(child.stdout!), finished(child.stderr!)])
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
  child.once('message', () => stop?.(child))
  try {
    const [[code, signal]] = await completed
    return { code, signal, stdout, stderr }
  }
  finally {
    clearTimeout(timer)
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await exited
    }
  }
}

it('collects complete child output after the parent disconnects IPC', async () => {
  const result = await runChild(`
    import { setTimeout } from 'node:timers/promises'
    process.on('disconnect', async () => {
      process.stdout.write('CLEANUP_START\\n')
      await setTimeout(20)
      process.stdout.write('CLEANUP_DONE\\n')
      process.stderr.write('DIAGNOSTIC_DONE\\n')
    })
    process.send('ready')
  `, child => child.disconnect())
  expect(result).toEqual({
    code: 0,
    signal: null,
    stdout: 'CLEANUP_START\nCLEANUP_DONE\n',
    stderr: 'DIAGNOSTIC_DONE\n',
  })
}, 15_000)

const modes = ['ready', 'sigint', 'closing', 'startup', 'startup-config', 'startup-error', 'restart', 'restart-config', 'restart-error', 'restart-error-signal', 'multiple', 'restore-error', 'wrapper-error', 'disconnect', 'stdin'] as const

it.each(modes)('waits for the full owned shutdown with real Vite during %s', async (mode) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-owned-vite-')))
  const configFile = path.join(root, 'vite.config.mjs')
  await writeFile(configFile, `
    import { writeSync } from 'node:fs'
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    export default {
      plugins: [{
        name: 'user-config-pre-hook', enforce: 'pre',
        async configResolved() {
          const generation = globalThis.testViteResolution = (globalThis.testViteResolution ?? 0) + 1
          if ((${JSON.stringify(mode)} === 'startup-config' && generation === 1)
            || (${JSON.stringify(mode)} === 'restart-config' && generation === 2)) {
            process.send('ready')
            await delay(100)
          }
        },
        configureServer: { order: 'pre', async handler(server) {
          const generation = globalThis.testViteGeneration = (globalThis.testViteGeneration ?? 0) + 1
          const previousClose = server.close
          server.close = async () => {
            writeSync(1, 'USER_CLOSE_START:' + generation + '\\n')
            if (${JSON.stringify(mode)} === 'closing') process.send('ready')
            await delay(100)
            writeSync(1, 'USER_CLOSE_DONE:' + generation + '\\n')
            await previousClose()
          }
          if ((['startup', 'startup-error'].includes(${JSON.stringify(mode)}) && generation === 1)
            || (['restart', 'restart-error-signal'].includes(${JSON.stringify(mode)}) && generation === 2)) {
            process.send('ready')
            await delay(100)
            if (${JSON.stringify(mode)} === 'startup-error') throw new Error('fixture startup failed')
          }
          if (['restart-error', 'restart-error-signal'].includes(${JSON.stringify(mode)}) && generation === 2) {
            throw new Error('fixture replacement failed')
          }
          writeSync(1, 'CONFIGURED:' + generation + '\\n')
        } },
        async closeServer({ reason }) {
          if (reason === 'restart') return
          writeSync(1, 'RESTORE_START\\n')
          await delay(40)
          writeSync(1, 'RESTORE_DONE\\n')
          if (${JSON.stringify(mode)} === 'restore-error') throw new Error('fixture restore failed')
        },
      }],
    }
  `)
  try {
    const result = await runChild(`
      import { writeSync } from 'node:fs'
      import { createDevViteServer } from ${JSON.stringify(factoryUrl)}
      import { createDevShutdownScope } from ${JSON.stringify(scopeUrl)}
      import { bindHostLifecycle } from ${JSON.stringify(lifecycleUrl)}
      const log = text => writeSync(1, text + '\\n')
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
      const scope = createDevShutdownScope({ reportError: error => log('REPORTED:' + error.message) })
      scope.own(async () => { await delay(200); log('FINAL_CLEANUP_DONE') })
      try {
        const server = await scope.run('startup', async () => {
          const created = await createDevViteServer({
            root: ${JSON.stringify(root)}, configFile: ${JSON.stringify(configFile)},
            appType: 'custom', publicDir: false, logLevel: 'silent',
            server: { host: '127.0.0.1', port: 0, ws: false, watch: null },
            plugins: [{ name: 'owned-host-lifecycle', configureServer(server) {
              bindHostLifecycle(server, async () => { await delay(20); log('SESSION_CLOSED') })
              if (${JSON.stringify(mode)} === 'wrapper-error') {
                server.close = async () => {
                  await delay(100)
                  throw new Error('fixture wrapper failed')
                }
              }
            } }],
          })
          if (!scope.stopping) await created.listen()
          return created
        })
        if (${JSON.stringify(mode)}.startsWith('restart')) {
          await server.restart(true)
          log('RESTART_FINISHED')
        }
        if (${JSON.stringify(mode)} === 'multiple') {
          await scope.run('startup', async () => {
            const second = await createDevViteServer({
              root: ${JSON.stringify(root)}, configFile: ${JSON.stringify(configFile)},
              appType: 'custom', publicDir: false, logLevel: 'silent',
              server: { host: '127.0.0.1', port: 0, ws: false, watch: null },
            })
            await second.listen()
          })
        }
        if (${JSON.stringify(mode)} === 'closing') await server.close()
        if (!['closing', 'startup', 'startup-config', 'startup-error', 'restart', 'restart-config', 'restart-error-signal'].includes(${JSON.stringify(mode)})) process.send('ready')
        if (${JSON.stringify(mode)} === 'stdin') process.stdin.resume()
        await scope.signal
        await scope.close()
      } catch (error) {
        await scope.close(error).catch(() => {})
      }
    `, (child) => {
      if (mode === 'stdin') {
        child.stdin!.end()
      }
      else if (mode === 'disconnect' || process.platform === 'win32') {
        child.disconnect()
      }
      else {
        child.kill(mode === 'sigint' ? 'SIGINT' : 'SIGTERM')
      }
    })
    expect(result.signal, result.stderr).toBeNull()
    expect(result.code, result.stderr).toBe(['restore-error', 'startup-error', 'wrapper-error', 'restart-error-signal'].includes(mode) ? 1 : mode === 'stdin' || mode === 'disconnect' || process.platform === 'win32' ? 0 : mode === 'sigint' ? 130 : 143)
    expect(result.stdout).toContain('RESTORE_DONE\n')
    expect(result.stdout).toContain('FINAL_CLEANUP_DONE\n')
    expect(result.stdout.match(/USER_CLOSE_DONE/g)).toHaveLength(['multiple', 'restart-error', 'restart-error-signal'].includes(mode) ? 2 : 1)
    if (mode === 'restore-error') {
      expect(result.stdout).toContain('REPORTED:fixture restore failed')
    }
    if (mode === 'startup-error') {
      expect(result.stdout).toContain('REPORTED:fixture startup failed')
    }
    if (mode === 'wrapper-error') {
      expect(result.stdout).toContain('REPORTED:fixture wrapper failed')
      expect(result.stdout).toContain('SESSION_CLOSED\n')
    }
    if (mode === 'multiple') {
      expect(result.stdout.match(/RESTORE_DONE/g)).toHaveLength(2)
    }
    if (mode === 'startup-config' || mode === 'restart-config') {
      expect(result.stdout).toContain(`CONFIGURED:${mode === 'startup-config' ? 1 : 2}\n`)
    }
    if (mode === 'restart-error' || mode === 'restart-error-signal') {
      expect(result.stdout.match(/RESTORE_DONE/g)).toHaveLength(2)
      if (mode === 'restart-error') {
        expect(result.stdout).toContain('RESTART_FINISHED\n')
        expect(result.stdout.indexOf('USER_CLOSE_DONE:2')).toBeLessThan(result.stdout.indexOf('RESTART_FINISHED'))
      }
      else {
        expect(result.stdout).toContain('REPORTED:Vite replacement server initialization failed during development shutdown')
      }
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 15_000)

it('reloads config on ordinary and forced native restarts without turning local close into shutdown', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-owned-vite-restart-')))
  try {
    const result = await runChild(`
      import { writeFile } from 'node:fs/promises'
      import path from 'node:path'
      import { createDevViteServer } from ${JSON.stringify(factoryUrl)}
      import { createDevShutdownScope } from ${JSON.stringify(scopeUrl)}
      const root = ${JSON.stringify(root)}
      const configFile = path.join(root, 'vite.config.mjs')
      const source = version => 'export default { define: { TEST_VERSION: ' + JSON.stringify(version) + ' } }'
      await writeFile(configFile, source('first'))
      const scope = createDevShutdownScope()
      try {
        const server = await scope.run('startup', () => createDevViteServer({
          root, configFile, logLevel: 'silent',
          server: { middlewareMode: true, ws: false, watch: null },
        }))
        const versions = [server.config.define.TEST_VERSION]
        await writeFile(configFile, source('second'))
        await server.restart()
        versions.push(server.config.define.TEST_VERSION)
        await writeFile(configFile, source('third'))
        await server.restart(true)
        versions.push(server.config.define.TEST_VERSION)
        await server.close()
        console.log(JSON.stringify({ versions, forced: server.config.environments.client.optimizeDeps.force, stopping: scope.stopping,
          configFile: server.config.configFile, dependencies: server.config.configFileDependencies }))
      } finally { await scope.close() }
    `)
    expect(result.code, result.stderr).toBe(0)
    const report = JSON.parse(result.stdout) as {
      versions: string[]
      forced: boolean
      stopping: boolean
      configFile: string
      dependencies: string[]
    }
    expect(report.versions).toEqual(['first', 'second', 'third'])
    expect(report.forced).toBe(true)
    expect(report.stopping).toBe(false)
    expect(path.normalize(report.configFile)).toBe(path.join(root, 'vite.config.mjs'))
    expect(report.dependencies.map(file => path.normalize(file))).toContain(path.join(root, 'vite.config.mjs'))
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 15_000)
