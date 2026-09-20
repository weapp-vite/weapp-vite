import type { Plugin } from 'vite'
import type { RequestClientsRealDevSetupResult } from '../utils/requestClientsRealDevPlugin'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { requestClientsRealDevPlugin } from '../utils/requestClientsRealDevPlugin'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'

const utilityPath = path.resolve(import.meta.dirname, '../utils/requestClientsRealDevPlugin.ts')
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
})
