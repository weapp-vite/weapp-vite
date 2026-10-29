import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { finished } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'

const cli = fileURLToPath(new URL('../../cli.ts', import.meta.url))
const shutdown = new URL('../../devLifecycle/shutdown.ts', import.meta.url).href
const dependencies = fileURLToPath(new URL('../../../../../node_modules', import.meta.url))
const privateConfig = '{"setting":{"compileHotReLoad":true},"condition":{"miniprogram":{"list":[{"name":"Startup fallback","pathName":"pages/home/index"}]}}}'
const startupTimeout = 60_000
const publicationTimeout = 20_000
// 与真实 runtime DevProcess 的退出门禁一致；超时后的强杀只能使测试失败。
const shutdownTimeout = 90_000
const cleanupTimeout = 10_000
// 首次启动 60s、三次发布各 20s、自然退出 90s，余下 30s 留给 fixture 与失败收尾。
const testTimeout = 240_000

async function within<T>(pending: Promise<T>, timeoutMs: number, label: string, output: () => string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}\n${output()}`)), timeoutMs)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

async function waitFor(check: () => boolean | Promise<boolean>, exited: Promise<unknown>, label: string, output: () => string, timeoutMs = publicationTimeout) {
  const deadline = performance.now() + timeoutMs
  while (!await check()) {
    if (performance.now() >= deadline) {
      throw new Error(`Timed out waiting for ${label}\n${output()}`)
    }
    const stopped = await Promise.race([
      exited.then(() => true),
      new Promise<boolean>(resolve => setTimeout(resolve, 20, false)),
    ])
    if (stopped) {
      throw new Error(`CLI exited before ${label}\n${output()}`)
    }
  }
}

it.each(['auto', 'stateful-experimental'] as const)('naturally exits after %s startup fallback, edits and config reload', async (requested) => {
  const startedAt = performance.now()
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-startup-fallback-shutdown-')))
  let child: ChildProcess | undefined
  let completed: Promise<[number | null, NodeJS.Signals | null]> | undefined
  let terminalConfirmed = false
  let failure: Error | undefined
  let stdout = ''
  let stderr = ''
  const lifecycle: Record<string, unknown>[] = []
  const record = (event: string, details: Record<string, unknown> = {}) => {
    lifecycle.push({ event, elapsedMs: Math.round(performance.now() - startedAt), ...details })
  }
  const output = () => {
    const phase = [...stdout.matchAll(/^STARTUP_PHASE:([^\r\n]+)/gm)].at(-1)?.[1] ?? 'none'
    return `PARENT_LIFECYCLE:${JSON.stringify(lifecycle)}\nLAST_CHILD_PHASE:${phase}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
  }
  try {
    await symlink(dependencies, path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    const configFile = path.join(root, 'weapp-vite.config.mjs')
    const source = path.join(root, 'src/pages/home/index.js')
    const target = path.join(root, 'dist/pages/home/index.js')
    const config = `export default {
      define: { __STARTUP_CONFIG_MARKER__: JSON.stringify('WV-CONFIG-A') },
      build: { minify: false, cssMinify: false },
      plugins: [{ name: 'shutdown-provider-observer', configureServer(server) {
        const close = server.close.bind(server)
        const identity = globalThis.shutdownProviderGeneration = (globalThis.shutdownProviderGeneration ?? 0) + 1
        server.close = async () => {
          console.log('PROVIDER_CLOSE_START:' + identity)
          try { await close() } finally { console.log('PROVIDER_CLOSE_DONE:' + identity) }
        }
      } }],
      weapp: {
        srcRoot: 'src', autoRoutes: false, vue: { enable: false }, tailwindcss: false,
        hmr: { runtime: '${requested}', logLevel: 'verbose' },
        compilerPlugins: [{ name: 'legacy-compiler', capabilities: { content: true }, create() { return {} } }],
      },
    }`
    const original = 'Page({ data: { marker: "WV-STARTUP-BASE", count: 0 }, increment() { this.setData({ count: this.data.count + 1 }) } })'
    for (const [relative, contents] of Object.entries({
      'package.json': '{"name":"startup-fallback-shutdown","type":"module","private":true}',
      'project.config.json': '{"appid":"wxb3d842a4a7e3440d","miniprogramRoot":"dist/","srcMiniprogramRoot":"src/"}',
      'project.private.config.json': privateConfig,
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.js': original,
      'src/pages/home/index.json': '{}',
      'src/pages/home/index.wxml': '<view>{{marker}}</view>',
      'weapp-vite.config.mjs': config,
    })) {
      const file = path.join(root, relative)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, contents)
    }
    const bootstrap = path.join(root, 'startup-bootstrap.mjs')
    await writeFile(bootstrap, `
      import { writeSync } from 'node:fs'
      writeSync(1, 'STARTUP_PHASE:node-preload\\n')
    `)
    const preload = path.join(root, 'shutdown-observer.mts')
    await writeFile(preload, `
      import { writeSync } from 'node:fs'
      writeSync(1, 'STARTUP_PHASE:observer-start\\n')
      const { DevShutdownScope } = await import(${JSON.stringify(shutdown)})
      writeSync(1, 'STARTUP_PHASE:shutdown-imported\\n')
      const own = DevShutdownScope.prototype.own
      const request = DevShutdownScope.prototype.request
      const run = DevShutdownScope.prototype.run
      let identity = 0
      let operationIdentity = 0
      const observed = new WeakSet()
      DevShutdownScope.prototype.request = function(reason) {
        writeSync(1, 'SHUTDOWN_REQUEST:' + (reason ?? 'close') + ':PENDING=' + this.pending.size + '\\n')
        if (!observed.has(this)) {
          observed.add(this)
          this.done.then(() => writeSync(1, 'SHUTDOWN_DONE:' + JSON.stringify(process.getActiveResourcesInfo()) + '\\n'))
        }
        return request.call(this, reason)
      }
      DevShutdownScope.prototype.run = function(phase, action) {
        const operation = ++operationIdentity
        writeSync(1, 'OPERATION_START:' + operation + ':' + phase + '\\n')
        return run.call(this, phase, action).finally(() => writeSync(1, 'OPERATION_DONE:' + operation + ':' + phase + '\\n'))
      }
      DevShutdownScope.prototype.own = function(cleanup) {
        const owner = ++identity
        return own.call(this, async () => {
          writeSync(1, 'OWNER_CLOSE_START:' + owner + '\\n')
          try { await cleanup() } finally { writeSync(1, 'OWNER_CLOSE_DONE:' + owner + '\\n') }
        })
      }
      process.once('disconnect', () => writeSync(1, 'CLI_DISCONNECT_RECEIVED\\n'))
      process.on('beforeExit', () => writeSync(1, 'CLI_NATURAL_EXIT\\n'))
      writeSync(1, 'STARTUP_PHASE:observer-ready\\n')
    `)
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'development',
      CHOKIDAR_USEPOLLING: '1',
      CHOKIDAR_INTERVAL: '120',
      // 子进程 cwd 属于临时 app，源码 CLI 的内部别名仍取所属包配置。
      TSX_TSCONFIG_PATH: fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
    }
    for (const key of ['CI', 'TEST', 'VITEST', 'VITEST_MODE', 'VITEST_POOL_ID', 'VITEST_WORKER_ID', 'NODE_OPTIONS']) {
      delete env[key]
    }
    record('spawn-requested', { node: process.version, platform: process.platform })
    child = spawn(process.execPath, ['--import', pathToFileURL(bootstrap).href, '--import', 'tsx', '--import', pathToFileURL(preload).href, cli, 'dev', root, '--platform', 'weapp', '--skipNpm'], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })
    child.once('spawn', () => record('spawn', { pid: child!.pid }))
    child.on('error', error => record('error', { message: error.message }))
    child.once('exit', (code, signal) => record('exit', { code, signal }))
    child.stdout!.on('data', chunk => stdout += String(chunk))
    child.stderr!.on('data', chunk => stderr += String(chunk))
    const exited = once(child, 'exit')
    child.once('close', (code, signal) => record('close', { code, signal }))
    const streams = Promise.allSettled([finished(child.stdout!), finished(child.stderr!)])
    // 本机 Node 在父端断开 IPC 后未发出 child close；以真实退出与两条流结束共同确认终态。
    completed = Promise.all([exited, streams]).then(([exit, results]) => {
      const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
      record('stdio-settled', { errors: errors.map(String) })
      if (errors.length) {
        throw new AggregateError(errors, 'CLI stdio failed to drain')
      }
      terminalConfirmed = true
      return exit as [number | null, NodeJS.Signals | null]
    })
    // 后续发布断言失败时，收尾仍会等待同一份退出与流结束结果。
    void exited.catch(() => {})
    void completed.catch(() => {})
    const readTarget = () => readFile(target, 'utf8').catch(() => '')
    await waitFor(() => stdout.includes('[weapp-vite] HMR classic ready '), exited, 'startup classic readiness', output, startupTimeout)
    expect(stdout).toContain('STARTUP_PHASE:node-preload\n')
    expect(stdout).toContain('STARTUP_PHASE:observer-ready\n')
    expect(output()).toContain('"reason":"ide-classic-handoff"')
    await writeFile(source, original.replace('WV-STARTUP-BASE', 'WV-STARTUP-EDITED'))
    await waitFor(async () => (await readTarget()).includes('WV-STARTUP-EDITED'), exited, 'script edit publication', output)
    await writeFile(source, original.replace('"WV-STARTUP-BASE"', '__STARTUP_CONFIG_MARKER__'))
    await waitFor(async () => (await readTarget()).includes('WV-CONFIG-A'), exited, 'config marker publication', output)
    await writeFile(configFile, config.replace('WV-CONFIG-A', 'WV-CONFIG-B'))
    await waitFor(async () => (await readTarget()).includes('WV-CONFIG-B')
      && stdout.includes('Vite 配置已重新加载，小程序开发构建已重启。'), exited, 'configuration restart publication', output)
    expect(output().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)

    // 只通过 CLI 的 IPC 断连请求正常释放；强杀仅防止失败测试残留，不能作为通过依据。
    child.disconnect()
    record('disconnect-requested')
    const [code, signal] = await within(completed, shutdownTimeout, 'natural CLI shutdown and stdio drain', output)
    expect(signal, output()).toBeNull()
    expect(code, output()).toBe(0)
    expect(stdout).toContain('CLI_DISCONNECT_RECEIVED\n')
    expect(stdout).toContain('CLI_NATURAL_EXIT\n')
    expect(stdout).toContain('SHUTDOWN_DONE:')
    expect(stdout).toContain('OWNER_CLOSE_START:')
    expect(stdout).toContain('PROVIDER_CLOSE_START:')
    for (const kind of ['OWNER_CLOSE', 'PROVIDER_CLOSE']) {
      const identities = (stage: string) => [...stdout.matchAll(new RegExp(`${kind}_${stage}:(\\d+)`, 'g'))].map(match => match[1]).sort()
      expect(identities('START'), output()).toEqual(identities('DONE'))
    }
    expect(await readFile(path.join(root, 'project.private.config.json'), 'utf8')).toBe(privateConfig)
  }
  catch (error) {
    failure = new Error(`Startup fallback ${requested} failed\n${output()}`, { cause: error })
  }
  try {
    if (child && !terminalConfirmed && child.exitCode === null && child.signalCode === null) {
      record('cleanup-kill', { signal: 'SIGKILL', sent: child.kill('SIGKILL') })
    }
    if (completed) {
      await within(completed, cleanupTimeout, 'owned CLI termination and stdio drain', output)
    }
    if (child && !terminalConfirmed) {
      throw new Error('Owned CLI termination was not confirmed')
    }
    await rm(root, { recursive: true, force: true })
  }
  catch (error) {
    const cleanupError = new Error(`CLI cleanup incomplete; fixture at ${root}\n${output()}`, { cause: error })
    throw failure
      ? new AggregateError([failure, cleanupError], 'Startup fallback and cleanup failed', { cause: failure })
      : cleanupError
  }
  if (failure) {
    failure.message = `Startup fallback ${requested} failed\n${output()}`
    throw failure
  }
}, testTimeout)
