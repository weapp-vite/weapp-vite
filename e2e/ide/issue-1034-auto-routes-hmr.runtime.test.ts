import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssue1034Project } from '../utils/issue1034Project'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'

const routes = ['/pages/home/index']

describe('issue #1034: stateful sibling dependency delivery', { concurrent: false }, () => {
  let directory: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: MiniProgram | undefined
  let disposeTransport: (() => void) | undefined

  beforeAll(async () => {
    directory = await createIssue1034Project()
    const privateConfig = path.join(directory, 'project.private.config.json')
    const settings = JSON.parse(await readFile(privateConfig, 'utf8')) as Record<string, unknown>
    await writeFile(privateConfig, JSON.stringify({ ...settings, setting: { compileHotReLoad: true, urlCheck: false } }))
    const config = path.join(directory, 'weapp-vite.config.ts')
    await writeFile(config, (await readFile(config, 'utf8')).replace('srcRoot: \'src\',', 'srcRoot: \'src\', hmr: { runtime: \'stateful-experimental\' },'))
    const root = path.resolve(import.meta.dirname, '../..')
    dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', '--non-interactive'], {
      cwd: directory,
      env: createDevProcessEnv(),
      all: true,
    })
    await dev.waitForInitialBuild()
    host = await launchAutomator({
      projectPath: directory,
      bridgeProjectMode: 'direct',
      warmupRoute: routes[0],
      warmupRootSelectors: ['#source'],
      configureHeadlessSession(session) {
        disposeTransport = installStatefulHmrTransport(session, path.join(directory, 'dist'))
      },
    })
  }, 180_000)

  afterAll(async () => {
    disposeTransport?.()
    await host?.close()
    await dev?.stop()
    if (directory) {
      await rm(directory, { recursive: true, force: true })
    }
  }, 60_000)

  it('applies consecutive explicit sibling module updates to a loaded page', async (context) => {
    context.onTestFailed(async () => {
      process.stdout.write(dev?.getOutput().slice(-12_000) ?? '')
      const diagnostics = await host?.evaluate((key: string) => {
        const client = (globalThis as any)[key]
        return { transport: client?.getTransportState(), apply: client?.getLastApply() }
      }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)
      process.stdout.write(JSON.stringify(diagnostics))
      const update = await readFile(path.join(directory, 'dist', WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8').catch(() => '')
      process.stdout.write(update.slice(-8_000))
    })
    const session = host!
    const page = await session.reLaunch(routes[0]!)
    await expect.poll(() => session.evaluate((key: string) => (globalThis as any)[key].getTransportState().initialReady, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
    const acceptance = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1034', ['first', 'second'].map(id => ({
      id,
      route: routes[0]!,
      action: '更新显式导入的同名业务模块',
      nodes: [{ selector: '#source', text: `vue-${id}` }],
    })))
    await (await page.$('#increment'))!.tap()
    for (const label of ['first', 'second']) {
      await writeFile(path.join(directory, 'src/pages/home/index.js'), `export const label = '${label}'\n`)
      await expect.poll(async () => (await (await session.currentPage()).$('#source'))?.text(), { timeout: 60_000 }).toBe(`vue-${label}`)
      await acceptance.check(label, session, await session.currentPage())
      await expect.poll(async () => (await (await session.currentPage()).$('#increment'))?.text()).toBe('1')
    }
    expect(page.path).toBe(routes[0]!.slice(1))
  }, 150_000)
})
