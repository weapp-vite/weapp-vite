import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createWxmlTransformProject } from '../utils/wxmlTransformProject'

describe('WXML external dependency watch recovery runtime', { concurrent: false }, () => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: MiniProgram | undefined
  const kinds = ['native', 'vue']

  // 产物恢复必须先完成；惰性创建后同一 suite 的两个页面复用唯一宿主。
  async function ensureHost() {
    host ??= await launchAutomator({ projectPath: project, warmupRoute: '/pages/native/index', warmupRootSelectors: ['#transform-root'] })
    return host
  }

  async function templates() {
    return Promise.all(kinds.map(kind => readFile(path.join(project, `dist/pages/${kind}/index.wxml`), 'utf8').catch(() => '')))
  }

  async function waitForRule(label: string) {
    await vi.waitFor(async () => {
      expect((await templates()).every(code => code.includes(`data-rule="${label}"`))).toBe(true)
    }, { timeout: 45_000 })
  }

  beforeAll(async () => {
    project = await createWxmlTransformProject()
    const root = path.resolve(import.meta.dirname, '../..')
    dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv({ usePolling: false }),
      all: true,
    })
    await dev.waitForInitialBuild()
    await waitForRule('initial')
  }, 180_000)

  afterAll(async () => {
    await host?.close()
    await dev?.stop()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 60_000)

  it('renders restored dependency attributes and keeps events in native and Vue pages', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/wxml-transform', kinds.map(kind => ({
      id: kind,
      route: `/pages/${kind}/index`,
      action: '验证外部依赖删除后自然重建恢复的模板与点击事件',
      nodes: [{ selector: '#renamed', text: 'renamed', attributes: { 'data-rule': 'restored' } }, { selector: '#result', text: '1:track' }],
      expectedErrors: kind === 'native' ? [{ source: 'build', level: 'error', channel: 'dev-process', text: 'ERROR Build failed with 1 error:', count: 1 }] : [],
    })))
    context.onTestFailed(() => {
      process.stdout.write(dev!.getOutput().slice(-12_000))
    })
    const rules = path.join(project, 'transform-rules.json')
    await writeFile(rules, JSON.stringify({ label: 'changed' }))
    await waitForRule('changed')
    const validTemplates = await templates()
    await acceptance.act('native', async () => {
      const outputOffset = dev!.getOutput().length
      await rm(rules)
      await expect.poll(() => dev!.getOutput().slice(outputOffset), { timeout: 45_000 }).toMatch(/ENOENT[^\n]*transform-rules\.json/)
      expect(await templates()).toEqual(validTemplates)
      await writeFile(rules, JSON.stringify({ label: 'restored' }))
      await waitForRule('restored')
      await dev!.stop()
    })
    // 验证自然 watch 恢复产物的运行时语义，不把重新启动宿主称为页面热更新。
    for (const kind of kinds) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist/pages/${kind}/index.${extension}`))
      }
    }
    const session = await ensureHost()
    for (const kind of kinds) {
      const page = await session.reLaunch(`/pages/${kind}/index`)
      await (await page.$('#tap'))?.tap()
      await acceptance.check(kind, session, page)
    }
  }, 180_000)
})
