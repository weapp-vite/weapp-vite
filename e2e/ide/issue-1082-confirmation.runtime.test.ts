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
import { createIssue1082Project } from '../utils/issue1082Project'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'

const routes = ['/pages/home/index']

describe('issue #1082: stateful publication confirmation', { concurrent: false }, () => {
  let directory: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: MiniProgram | undefined
  let disposeTransport: (() => void) | undefined

  beforeAll(async () => {
    directory = await createIssue1082Project()
    const root = path.resolve(import.meta.dirname, '../..')
    dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', '--non-interactive'], {
      cwd: directory,
      env: createDevProcessEnv(),
      all: true,
    })
    await dev.waitForInitialBuild()
    // fixture 关闭 IDE 热重载，刻意覆盖宿主自动重编译造成的客户端更换。
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

  it('continues delivering patches after the host replaces client sessions', async (context) => {
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
    const acceptance = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1082-confirmation', ['first', 'second', 'restored'].map(id => ({
      id,
      route: routes[0]!,
      action: '更新业务模块并检查宿主重建客户端后的连续交付',
      nodes: [{ selector: '#source', text: `vue-${id}` }],
    })))
    for (const label of ['first', 'second', 'restored']) {
      await writeFile(path.join(directory, 'src/pages/home/label.js'), `export const label = '${label}'\n`)
      await expect.poll(async () => (await (await session.currentPage()).$('#source'))?.text(), { timeout: 60_000 }).toBe(`vue-${label}`)
      await acceptance.check(label, session, await session.currentPage())
    }
    const current = await session.currentPage()
    await (await current.$('#increment'))!.tap()
    await expect.poll(async () => (await current.$('#increment'))?.text()).toBe('1')
    expect(page.path).toBe(routes[0]!.slice(1))
  }, 150_000)
})
