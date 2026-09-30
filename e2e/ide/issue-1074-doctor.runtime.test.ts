import type { DoctorReport } from '../../packages/weapp-vite/src/doctor/types'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveProjectAutomatorPort } from 'weapp-ide-cli'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssue1074Project, ISSUE_1074_CLI } from '../utils/issue1074Project'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

describe('issue #1074: Doctor runtime fixture', () => {
  let project: string
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  beforeAll(async () => {
    project = await createIssue1074Project()
    await execa(process.execPath, [ISSUE_1074_CLI, 'build'], { cwd: project })
    for (const route of ['pages/index/index', 'isolated/index']) {
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await readFile(path.join(project, 'dist', `${route}.${extension}`), 'utf8')).not.toBe('')
      }
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      port: resolveProjectAutomatorPort(project),
      warmupRoute: '/pages/index/index',
      warmupRootSelectors: ['#doctor-root'],
    })
  }, 120_000)
  afterAll(async () => {
    await host?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  it('retains custom methods, events and independent navigation and reads the real host probe', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1074', [
      { id: 'custom', route: '/pages/index/index', action: '读取自定义 at 方法', nodes: [{ selector: '#doctor-result', text: 'custom-at' }] },
      { id: 'event', route: '/pages/index/index', action: '点击按钮调用自定义 replaceAll 方法', nodes: [{ selector: '#doctor-result', text: 'custom-replace' }, { selector: '#increment', text: '1' }] },
      { id: 'independent', route: '/isolated/index', action: '进入独立分包', nodes: [{ selector: '#doctor-independent', text: 'independent-ready' }] },
    ])
    let page = await host!.reLaunch('/pages/index/index')
    await acceptance.check('custom', host!, page)
    await (await page.$('#increment'))!.tap()
    await acceptance.check('event', host!, page)
    page = await host!.reLaunch('/isolated/index')
    await acceptance.check('independent', host!, page)
    if (resolveRuntimeProviderName() === 'devtools') {
      const session = Reflect.get(host!, '__WEAPP_VITE_SESSION_METADATA') as { port: number }
      const probe = await execa(process.execPath, [ISSUE_1074_CLI, 'doctor', '--runtime', '--runtime-port', String(session.port), '--format', 'json'], { cwd: project, reject: false })
      const report = JSON.parse(probe.stdout) as DoctorReport
      expect(report.coverage, probe.stderr).toContainEqual(expect.objectContaining({ layer: 'runtime', status: 'complete' }))
      expect(report.runtime.weapp.route).toBe('isolated/index')
      expect(probe.exitCode).toBe(0)
    }
  }, 60_000)
})
