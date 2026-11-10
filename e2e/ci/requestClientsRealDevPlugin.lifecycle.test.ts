import type { Plugin } from 'vite'
import type { RequestClientsRealDevSetupResult } from '../utils/requestClientsRealDevPlugin'
import { execFile, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { build, createServer, loadConfigFromFile } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { requestClientsRealDevPlugin } from '../utils/requestClientsRealDevPlugin'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'

const utilityPath = path.resolve(import.meta.dirname, '../utils/requestClientsRealDevPlugin.ts')
const cliEntry = path.resolve(import.meta.dirname, '../../packages/weapp-vite/dist/cli.mjs')
const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
const originalConfig = JSON.stringify({ condition: { miniprogram: { list: [{ pathName: 'pages/index/index', query: 'fixture=original' }] } } })
const originalModule = 'export const REQUEST_CLIENTS_REAL_DEV_BASE_URL = ""\n'
const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

async function createProject() {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'request-client-lifecycle-'))
  cleanups.push(() => rm(projectRoot, { recursive: true, force: true }))
  await mkdir(path.join(projectRoot, 'src/shared'), { recursive: true })
  await writeFile(path.join(projectRoot, 'project.private.config.json'), originalConfig)
  await writeFile(path.join(projectRoot, 'src/shared/requestClientsRealDevBaseUrl.ts'), originalModule)
  return projectRoot
}

async function expectOriginalFiles(projectRoot: string) {
  expect(await readFile(path.join(projectRoot, 'project.private.config.json'), 'utf8')).toBe(originalConfig)
  expect(await readFile(path.join(projectRoot, 'src/shared/requestClientsRealDevBaseUrl.ts'), 'utf8')).toBe(originalModule)
}

async function availableServerPort() {
  const probe = await startRequestClientsRealServer()
  const port = Number(new URL(probe.baseUrl).port)
  await probe.stop()
  return port
}

async function requestCount(baseUrl: string) {
  const response = await fetch(`${baseUrl}/fetch`, { method: 'POST', body: '{}' })
  return (await response.json() as { requestCount: number }).requestCount
}

async function waitForOutput(child: ReturnType<typeof spawn>, matcher: string, output: { value: string }, timeoutMs = 60_000) {
  if (output.value.includes(matcher)) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let cleanup = () => {}
    const onData = (chunk: unknown) => {
      output.value += String(chunk)
      if (output.value.includes(matcher)) {
        cleanup()
        resolve()
      }
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup()
      reject(new Error(`CLI exited before ${matcher}: code=${code}, signal=${signal}\n${output.value}`))
    }
    cleanup = () => {
      clearTimeout(timer)
      child.stdout?.off('data', onData)
      child.stderr?.off('data', onData)
      child.off('exit', onExit)
    }
    timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for child output: ${matcher}\n${output.value}`))
    }, timeoutMs)
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.once('exit', onExit)
  })
}

async function waitForExit(child: ReturnType<typeof spawn>, output: { value: string }, timeoutMs = 30_000) {
  return await new Promise<{ code: number | null, signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Timed out waiting for CLI exit.\n${output.value}`))
    }, timeoutMs)
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal })
    })
  })
}

describe('request client dev server ownership across config runners', () => {
  it('shares the fixed-port server across independent Vite config runners and restores original files', async () => {
    const projectRoot = await createProject()
    const serverPort = await availableServerPort()
    const configFile = path.join(projectRoot, 'vite.config.mjs')
    await writeFile(configFile, [
      `import { requestClientsRealDevPlugin } from ${JSON.stringify(pathToFileURL(utilityPath).href)}`,
      'export default async () => {',
      `  const runtime = await requestClientsRealDevPlugin(${JSON.stringify({ projectRoot, serverPort })})`,
      '  return { plugins: [{ ...runtime.plugin, api: runtime }] }',
      '}',
    ].join('\n'))
    const load = () => loadConfigFromFile({ command: 'serve', mode: 'development' }, configFile, projectRoot, 'silent', undefined, 'runner')
    const runtimeFrom = (loaded: Awaited<ReturnType<typeof load>>) =>
      (loaded!.config.plugins![0] as Plugin & { api: RequestClientsRealDevSetupResult }).api
    const beforeListeners = process.listenerCount('SIGTERM')
    const first = runtimeFrom(await load())
    cleanups.push(first.stop)
    expect(await requestCount(first.baseUrl)).toBe(1)

    const second = runtimeFrom(await load())
    expect(second.baseUrl).toBe(`http://127.0.0.1:${serverPort}`)
    expect(await requestCount(second.baseUrl)).toBe(2)
    expect(process.listenerCount('SIGTERM')).toBe(beforeListeners + 1)
    expect(await readFile(path.join(projectRoot, 'project.private.config.json'), 'utf8')).toContain('baseUrl=')

    await Promise.all([first.stop(), second.stop()])
    expect(process.listenerCount('SIGTERM')).toBe(beforeListeners)
    await expectOriginalFiles(projectRoot)
    const restarted = await requestClientsRealDevPlugin({ projectRoot, serverPort })
    cleanups.push(restarted.stop)
    expect(await requestCount(restarted.baseUrl)).toBe(1)
  })

  it('restores completed writes before later shutdown listeners run', async () => {
    const projectRoot = await createProject()
    const script = [
      'import { readFileSync } from \'node:fs\'',
      `import { requestClientsRealDevPlugin } from ${JSON.stringify(pathToFileURL(utilityPath).href)}`,
      `await requestClientsRealDevPlugin(${JSON.stringify({ projectRoot, serverPort: 0 })})`,
      'process.once(\'SIGTERM\', () => {',
      `  const config = readFileSync(${JSON.stringify(path.join(projectRoot, 'project.private.config.json'))}, 'utf8')`,
      `  const source = readFileSync(${JSON.stringify(path.join(projectRoot, 'src/shared/requestClientsRealDevBaseUrl.ts'))}, 'utf8')`,
      `  console.log(JSON.stringify({ restored: config === ${JSON.stringify(originalConfig)} && source === ${JSON.stringify(originalModule)} }))`,
      '})',
      'process.emit(\'SIGTERM\')',
    ].join('\n')
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script])
    expect(JSON.parse(stdout.trim())).toEqual({ restored: true })
    await expectOriginalFiles(projectRoot)
  })

  it.each([true, false])('retains fixture files through snapshot builds until the owning Vite server closes (middlewareMode=%s)', async (middlewareMode) => {
    const projectRoot = await createProject()
    const runtime = await requestClientsRealDevPlugin({ projectRoot, serverPort: 0 })
    cleanups.push(runtime.stop)
    const server = await createServer({
      root: projectRoot,
      configFile: false,
      plugins: [runtime.plugin],
      server: { middlewareMode },
    })
    cleanups.push(() => server.close())
    expect(await requestCount(runtime.baseUrl)).toBe(1)
    await build({
      root: projectRoot,
      configFile: false,
      plugins: [runtime.plugin],
      build: {
        write: false,
        lib: { entry: path.join(projectRoot, 'src/shared/requestClientsRealDevBaseUrl.ts'), formats: ['es'] },
      },
    })
    expect(await requestCount(runtime.baseUrl)).toBe(2)
    expect(await readFile(path.join(projectRoot, 'src/shared/requestClientsRealDevBaseUrl.ts'), 'utf8')).toContain(runtime.baseUrl)
    await server.close()
    await expectOriginalFiles(projectRoot)
  })

  it('coalesces concurrent initialization for normalized project paths', async () => {
    const projectRoot = await createProject()
    const serverPort = await availableServerPort()
    const first = requestClientsRealDevPlugin({ projectRoot, serverPort })
    const second = requestClientsRealDevPlugin({ projectRoot: path.relative(process.cwd(), projectRoot), serverPort })
    const [a, b] = await Promise.all([first, second])
    cleanups.push(a.stop)
    expect(a.baseUrl).toBe(b.baseUrl)
    expect(await requestCount(a.baseUrl)).toBe(1)
    expect(await requestCount(b.baseUrl)).toBe(2)
    await expect(requestClientsRealDevPlugin({ projectRoot, serverPort: 0 })).rejects.toThrow('不同的服务端口')
  })

  it('rolls back partial setup and allows retry on the same port', async () => {
    const projectRoot = await createProject()
    const serverPort = await availableServerPort()
    const modulePath = path.join(projectRoot, 'src/shared/requestClientsRealDevBaseUrl.ts')
    const beforeListeners = process.listenerCount('SIGTERM')
    await rm(modulePath)
    await expect(requestClientsRealDevPlugin({ projectRoot, serverPort })).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(projectRoot, 'project.private.config.json'), 'utf8')).toBe(originalConfig)
    expect(process.listenerCount('SIGTERM')).toBe(beforeListeners)
    await writeFile(modulePath, originalModule)
    const retry = await requestClientsRealDevPlugin({ projectRoot, serverPort })
    cleanups.push(retry.stop)
    expect(await requestCount(retry.baseUrl)).toBe(1)
    await retry.stop()
    await expectOriginalFiles(projectRoot)
  })

  it('reports an externally occupied port without changing fixture files', async () => {
    const projectRoot = await createProject()
    const externalServer = await startRequestClientsRealServer()
    cleanups.push(externalServer.stop)
    const serverPort = Number(new URL(externalServer.baseUrl).port)
    await expect(requestClientsRealDevPlugin({ projectRoot, serverPort })).rejects.toMatchObject({ code: 'EADDRINUSE' })
    await expectOriginalFiles(projectRoot)
    expect(await requestCount(externalServer.baseUrl)).toBe(1)
    await externalServer.stop()
    cleanups.pop()
    const retry = await requestClientsRealDevPlugin({ projectRoot, serverPort })
    cleanups.push(retry.stop)
    expect(await requestCount(retry.baseUrl)).toBe(1)
  })

  it.each(['SIGTERM', 'disconnect'] as const)('lets the built CLI finish %s cleanup without forcing a zero exit', async (request) => {
    const projectRoot = await createProject()
    const serverPort = await availableServerPort()
    await mkdir(path.join(projectRoot, 'src/pages/index'), { recursive: true })
    await writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'request-clients-real-signal', private: true, type: 'module' }))
    await writeFile(path.join(projectRoot, 'project.config.json'), JSON.stringify({
      appid: 'wxb3d842a4a7e3440d',
      compileType: 'miniprogram',
      miniprogramRoot: 'dist/',
      srcMiniprogramRoot: 'src/',
    }))
    await writeFile(path.join(projectRoot, 'src/app.js'), 'App({})')
    await writeFile(path.join(projectRoot, 'src/app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
    await writeFile(path.join(projectRoot, 'src/pages/index/index.js'), 'Page({})')
    await writeFile(path.join(projectRoot, 'src/pages/index/index.json'), '{}')
    await writeFile(path.join(projectRoot, 'src/pages/index/index.wxml'), '<view>signal</view>')
    await writeFile(path.join(projectRoot, 'vite.config.mjs'), [
      'import process from \'node:process\'',
      `import { requestClientsRealDevPlugin } from ${JSON.stringify(pathToFileURL(utilityPath).href)}`,
      'if (process.platform === \'win32\') {',
      '  process.on(\'message\', message => { if (message === \'SIGTERM\') process.emit(\'SIGTERM\') })',
      '}',
      `const runtime = await requestClientsRealDevPlugin(${JSON.stringify({ projectRoot, serverPort })})`,
      'export default {',
      `  weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, npm: { enable: false }, mcp: false },`,
      '  plugins: [runtime.plugin],',
      '}',
    ].join('\n'))

    const output = { value: '' }
    const child = spawn(process.execPath, ['--import', tsxLoader, cliEntry, 'dev', projectRoot, '--no-mcp', '--non-interactive'], {
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: 'development', CONSOLA_LEVEL: '3' },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })
    cleanups.push(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
      await expectOriginalFiles(projectRoot)
    })

    try {
      await waitForOutput(child, '小程序初次构建完成', output)
      if (request === 'disconnect') {
        child.disconnect()
      }
      else if (process.platform === 'win32') {
        child.send(request)
      }
      else {
        child.kill(request)
      }
      await expect(await waitForExit(child, output)).toEqual({ code: request === 'SIGTERM' ? 143 : 0, signal: null })
      await expectOriginalFiles(projectRoot)
      const restarted = await startRequestClientsRealServer({ port: serverPort })
      await restarted.stop()
    }
    finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
    }
  })
})
