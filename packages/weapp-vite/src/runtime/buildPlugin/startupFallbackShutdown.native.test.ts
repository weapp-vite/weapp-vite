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
// 与真实 runtime DevProcess 的退出门禁一致；超时后的强杀只能使测试失败。
const shutdownTimeout = 90_000

async function waitFor(check: () => boolean | Promise<boolean>, exited: Promise<unknown>, label: string, output: () => string) {
  const deadline = Date.now() + 20_000
  while (!await check()) {
    if (Date.now() >= deadline) {
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
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-startup-fallback-shutdown-')))
  let child: ChildProcess | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let stdout = ''
  let stderr = ''
  const output = () => `${stdout}\n${stderr}`
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
    const preload = path.join(root, 'shutdown-observer.mts')
    await writeFile(preload, `
      import { writeSync } from 'node:fs'
      import { DevShutdownScope } from ${JSON.stringify(shutdown)}
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
    child = spawn(process.execPath, ['--import', 'tsx', '--import', pathToFileURL(preload).href, cli, 'dev', root, '--platform', 'weapp', '--skipNpm'], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })
    child.stdout!.on('data', chunk => stdout += String(chunk))
    child.stderr!.on('data', chunk => stderr += String(chunk))
    const exited = once(child, 'exit')
    const completed = Promise.all([exited, finished(child.stdout!), finished(child.stderr!)])
    const readTarget = () => readFile(target, 'utf8').catch(() => '')
    await waitFor(() => stdout.includes('[weapp-vite] HMR classic ready '), exited, 'startup classic readiness', output)
    expect(output()).toContain('"reason":"compiler-provider"')
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
    timer = setTimeout(() => child!.kill('SIGKILL'), shutdownTimeout)
    const [[code, signal]] = await completed
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
  finally {
    clearTimeout(timer)
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGKILL')
      await exited
    }
    await rm(root, { recursive: true, force: true })
  }
}, 180_000)
