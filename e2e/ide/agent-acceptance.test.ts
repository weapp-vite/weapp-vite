import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'

const repository = path.resolve(import.meta.dirname, '../..')

beforeAll(() => {
  execFileSync(process.execPath, ['scripts/weapp-agent/create-fixtures.mjs'], { cwd: repository, stdio: 'pipe', timeout: 60_000 })
}, 70_000)

for (const kind of ['native', 'wevu']) {
  describe(`agent acceptance counter (${kind})`, { concurrent: false }, () => {
    let program: Awaited<ReturnType<typeof launchAutomator>>
    let pendingProgram: ReturnType<typeof launchAutomator> | undefined
    beforeAll(async () => {
      const projectPath = path.join(repository, '.cache/acceptance-fixtures', kind)
      execFileSync(process.execPath, [path.join(repository, 'packages/weapp-vite/bin/weapp-vite.js'), 'build'], { cwd: projectPath, stdio: 'pipe', timeout: 60_000 })
      // 构建和启动各自有界，外层钩子必须等待启动完成，不能超时后与下一项目重叠。
      pendingProgram = launchAutomator({ projectPath, skipWarmup: true, timeout: 90_000, maxLaunchRetries: 1 })
      program = await pendingProgram
    }, 180_000)
    afterAll(async () => {
      // 即使 setup 提前失败，也等待已登记的启动结束并释放迟到的会话。
      const ownedProgram = await pendingProgram?.catch(() => undefined)
      await ownedProgram?.close()
    }, 120_000)
    it('observes initial state, interaction, injected mismatch and fresh rerun', async (context) => {
      const dom = createDomAcceptance(context, `.cache/acceptance-fixtures/${kind}`, [
        { id: 'initial', route: '/pages/agent-proof/index', action: '初始状态', nodes: [{ selector: '#count', text: '0' }] },
        { id: 'updated', route: '/pages/agent-proof/index', action: '点击更新', nodes: [{ selector: '#count', text: '1' }] },
        { id: 'fresh', route: '/pages/agent-proof/index', action: '重新进入页面', nodes: [{ selector: '#count', text: '0' }] },
      ])
      const page = await program.reLaunch('/pages/agent-proof/index')
      const count = await page.$('#count')
      expect(await count?.text()).toBe('0')
      await dom.check('initial', program, page)
      await (await page.$('#increment'))?.tap()
      await expect.poll(async () => (await page.$('#count'))?.text()).toBe('1')
      await dom.check('updated', program, page)
      // The deliberately wrong expected state must remain a mismatch on both providers.
      expect(await (await page.$('#count'))?.text()).not.toBe('2')
      const fresh = await program.reLaunch('/pages/agent-proof/index')
      expect(await (await fresh.$('#count'))?.text()).toBe('0')
      await dom.check('fresh', program, fresh)
    })
  })
}
