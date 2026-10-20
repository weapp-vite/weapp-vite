import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { assertIssue1172Artifacts, ROUTES } from './issue1172/artifacts'
import { tapButton, textNode } from './issue1172/dom'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1172'

// 三种配置分别构建，共用原生投影与纯展示、响应式组件场景。
describe.each(['default', 'disabled', 'enabled'] as const)('issue #1174: %s native slot context', { concurrent: false }, (mode) => {
  let project: string | undefined
  let miniProgram: MiniProgram | undefined
  const runtimeErrors: string[] = []

  beforeAll(async () => {
    project = await createIssueRegressionProject(1172)
    const configPath = path.join(project, 'vite.config.ts')
    const config = await readFile(configPath, 'utf8')
    await writeFile(configPath, mode === 'default'
      ? config.replace(', nativeSlotContext: true', '')
      : mode === 'disabled' ? config.replace('nativeSlotContext: true', 'nativeSlotContext: false') : config)
    await buildIssueRegressionProject(project, 'weapp')
    await assertIssue1172Artifacts(project, true)
    const protocolFreeFiles = ['components/plainCounter/index', 'components/plainContainer/index', 'components/plainOptionsCounter/index', 'components/plainDualScriptCounter/index', 'components/plainReactiveCounter/index']
    if (mode !== 'enabled') {
      protocolFreeFiles.push('pages/plain/index', 'components/outlet/index', 'pages/index/index')
    }
    for (const file of protocolFreeFiles) {
      const template = await readFile(path.join(project, 'dist', `${file}.wxml`), 'utf8')
      expect(template).not.toMatch(/__wv_nativeDeclaration|__wevu_native_declaration|__wevu_native_slot_parent|data-wevu-native-slot-parent/)
    }
    miniProgram = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTES.plain,
      warmupRootSelectors: ['#plain-root'],
    }) as MiniProgram
    miniProgram.on('exception', event => runtimeErrors.push(event.message))
  }, 180_000)

  afterAll(async () => {
    try {
      await miniProgram?.close()
    }
    finally {
      if (project) {
        await rm(project, { recursive: true, force: true })
      }
    }
  }, 60_000)

  it('1174.plain-slot-updates', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTES.plain, action: '原生投影与 HTML 映射、Options API、双脚本和响应式纯组件正常挂载', nodes: [textNode('plain-count', '0'), textNode('plain-leaf-label', 'Context-free container'), textNode('plain-leaf-count', '0'), textNode('plain-options-count', '0'), textNode('plain-dual-count', '0'), textNode('plain-reactive-count', '0'), textNode('plain-reactive-initial', '0')] },
      { id: 'leaf-incremented', route: ROUTES.plain, action: '没有协议注入的 ref 组件仍能响应点击并更新', nodes: [textNode('plain-leaf-count', '1'), textNode('plain-count', '0')] },
      { id: 'variants-incremented', route: ROUTES.plain, action: '没有协议注入的不同纯组件写法均能独立更新', nodes: [textNode('plain-options-count', '1'), textNode('plain-dual-count', '1'), textNode('plain-reactive-count', '1'), textNode('plain-reactive-initial', '0'), textNode('plain-leaf-count', '1'), textNode('plain-count', '0')] },
      { id: 'incremented', route: ROUTES.plain, action: '点击后更新原生插槽内容', nodes: [textNode('plain-count', '1')] },
      { id: 'reopened', route: ROUTES.plain, action: '隐藏期间更新后重新投影最新值', nodes: [textNode('plain-count', '2')] },
    ])
    const page = await miniProgram!.reLaunch(ROUTES.plain)
    await dom.check('initial', miniProgram!, page)
    await tapButton(page, 'plain-leaf-increment')
    await dom.check('leaf-incremented', miniProgram!, page)
    await tapButton(page, 'plain-options-increment')
    await tapButton(page, 'plain-dual-increment')
    await tapButton(page, 'plain-reactive-increment')
    await dom.check('variants-incremented', miniProgram!, page)
    await tapButton(page, 'plain-increment')
    await dom.check('incremented', miniProgram!, page)
    await tapButton(page, 'plain-toggle')
    await tapButton(page, 'plain-increment')
    await tapButton(page, 'plain-toggle')
    await dom.check('reopened', miniProgram!, page)
    expect(runtimeErrors).toEqual([])
  })
})
