import type { LayoutPowerSession } from './layoutPowerDom/session'
import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { feedbackRoundCheckpoints, INDEX_ROUTE, INITIAL_DESCRIPTION, LAYOUT_POWER_FIXTURE, layoutStateCheckpoint, runFeedbackRounds, switchRenderedLayout, UPDATED_DESCRIPTION, UPDATED_POSTER_TITLE } from './layoutPowerDom/feedback'
import { assertRuntimeVendorOutputs, captureLayoutPageState, readHmrVersion, waitForHmrVersion } from './layoutPowerDom/hmr'
import { APP_ROOT, DIST_ROOT, prepareLayoutPowerSession, startLayoutPowerSession } from './layoutPowerDom/session'
import { xpathClass } from './tdesignDom'

const PAGE_SCRIPT = path.join(APP_ROOT, 'src/pages/index/index.ts')
const PAGE_WXML = path.join(APP_ROOT, 'src/pages/index/index.wxml')
const COMMAND_LAYOUT_WXSS = path.join(APP_ROOT, 'src/layouts/command/index.wxss')
const BASELINE_MARKER = 'runtime-vendor-hmr-baseline'
const UPDATED_MARKER = 'runtime-vendor-hmr-updated'
const STYLE_MARKER = 'runtime-vendor-style-hmr'
const MODULE_MISSING_RE = /module 'weapp-vendors\/[^']*runtime[^']*\.js' is not defined/i
const TD_MESSAGE_DUPLICATE_SLOT_RE = /More than one slot named .*tdesign-miniprogram\/message\/message/
const commandTitleSelector = `${xpathClass('theme-layout--command')}//*[contains(concat(" ", @class, " "), " theme-layout__title ")]`

describe('layout-power-demo runtime vendor HMR in real WeChat DevTools', { concurrent: false }, () => {
  let originalScript = ''
  let originalTemplate = ''
  let originalCommandLayoutStyle = ''
  let session: LayoutPowerSession | undefined

  beforeAll(async () => {
    ;[originalScript, originalTemplate, originalCommandLayoutStyle] = await Promise.all([
      fs.readFile(PAGE_SCRIPT, 'utf8'),
      fs.readFile(PAGE_WXML, 'utf8'),
      fs.readFile(COMMAND_LAYOUT_WXSS, 'utf8'),
    ])
    expect(originalScript).toContain(BASELINE_MARKER)
    await prepareLayoutPowerSession()
  }, 60_000)

  afterAll(async () => {
    try {
      await session?.close()
    }
    finally {
      if (originalScript) {
        await fs.writeFile(PAGE_SCRIPT, originalScript, 'utf8')
      }
      if (originalTemplate) {
        await fs.writeFile(PAGE_WXML, originalTemplate, 'utf8')
      }
      if (originalCommandLayoutStyle) {
        await fs.writeFile(COMMAND_LAYOUT_WXSS, originalCommandLayoutStyle, 'utf8')
      }
    }
  }, 60_000)

  it('keeps active runtime vendor chunks available after page script HMR', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, LAYOUT_POWER_FIXTURE, [
      layoutStateCheckpoint('initial', '启动后检查默认界面', 'default', 1),
      ...feedbackRoundCheckpoints('before-script', 1),
      layoutStateCheckpoint('script-preserved', '脚本更新完成后保持海报布局及五次交互状态', 'poster', 5),
      layoutStateCheckpoint('script-command', '热更新后原页面继续响应命令布局切换', 'command', 6),
      layoutStateCheckpoint('script-new-title', '切回海报读取新脚本定义并保留累计交互', 'poster', 7, { posterTitle: UPDATED_POSTER_TITLE }),
      layoutStateCheckpoint('new-page', '重新进入页面检查更新后的定义用于新实例', 'default', 1),
      ...feedbackRoundCheckpoints('after-script', 1, { posterTitle: UPDATED_POSTER_TITLE }),
      layoutStateCheckpoint('template-updated', '模板热更新后检查新文案及保留的海报布局计数', 'poster', 5, { posterTitle: UPDATED_POSTER_TITLE, description: UPDATED_DESCRIPTION }),
      {
        ...layoutStateCheckpoint('style-before', '切到命令布局检查样式更新前的真实标题颜色', 'command', 6, { description: UPDATED_DESCRIPTION }),
        nodes: [
          ...layoutStateCheckpoint('style-before-state', '样式更新前状态', 'command', 6, { description: UPDATED_DESCRIPTION }).nodes,
          { selector: commandTitleSelector, query: 'xpath', text: '命令外壳', styles: { color: 'rgb(255, 255, 255)' }, visible: true },
        ],
      },
      {
        ...layoutStateCheckpoint('style-updated', '样式热更新后检查真实颜色变化及布局计数保留', 'command', 6, { description: UPDATED_DESCRIPTION }),
        nodes: [
          ...layoutStateCheckpoint('style-updated-state', '样式更新后状态', 'command', 6, { description: UPDATED_DESCRIPTION }).nodes,
          { selector: commandTitleSelector, query: 'xpath', text: '命令外壳', styles: { color: 'rgb(17, 153, 119)' }, visible: true },
        ],
      },
    ])
    session = await startLayoutPowerSession()
    const { miniProgram, devProcess, collector } = session
    let page = await miniProgram.reLaunch(INDEX_ROUTE)
    await acceptance.check('initial', miniProgram, page)
    expect(await page.callMethod('runE2E')).toMatchObject({ ok: true, marker: BASELINE_MARKER })
    await runFeedbackRounds(acceptance, miniProgram, page, 'before-script', 1)

    const nextScript = originalScript.replace(BASELINE_MARKER, UPDATED_MARKER).replace('title: \'海报外壳\'', `title: '${UPDATED_POSTER_TITLE}'`)
    expect(nextScript).toContain(UPDATED_POSTER_TITLE)
    const clientVersion = await readHmrVersion(miniProgram)
    expect(clientVersion).toBeGreaterThanOrEqual(0)
    await replaceFileByRename(PAGE_SCRIPT, nextScript)
    await devProcess.waitFor(waitForFileContains(path.join(DIST_ROOT, '__weapp_vite_hmr/update.js'), UPDATED_MARKER, 30_000), 'layout-power script patch')
    await waitForHmrVersion(miniProgram, clientVersion + 1)
    const pageJs = await assertRuntimeVendorOutputs()
    expect(pageJs).toContain(BASELINE_MARKER)
    await acceptance.check('script-preserved', miniProgram, page)
    expect(await page.callMethod('runE2E')).toMatchObject({ currentLayout: 'poster', definitionMarker: UPDATED_MARKER, marker: BASELINE_MARKER, ok: false })
    await switchRenderedLayout(page, 'command')
    await acceptance.check('script-command', miniProgram, page)
    await switchRenderedLayout(page, 'poster')
    await acceptance.check('script-new-title', miniProgram, page)
    await captureLayoutPageState(miniProgram, 'before-new-page')

    // 此处明确验证新页面实例读取已更新定义；前面的旧实例状态检查必须先通过。
    page = await miniProgram.reLaunch(INDEX_ROUTE)
    await acceptance.check('new-page', miniProgram, page)
    await captureLayoutPageState(miniProgram, 'after-new-page')
    expect(await page.callMethod('runE2E')).toMatchObject({ ok: true, definitionMarker: UPDATED_MARKER, marker: UPDATED_MARKER })
    await runFeedbackRounds(acceptance, miniProgram, page, 'after-script', 1)
    expect(devProcess.getOutput()).not.toMatch(MODULE_MISSING_RE)

    const nextTemplate = originalTemplate.replace(INITIAL_DESCRIPTION, UPDATED_DESCRIPTION)
    expect(nextTemplate).not.toBe(originalTemplate)
    await replaceFileByRename(PAGE_WXML, nextTemplate)
    await devProcess.waitFor(waitForFileContains(path.join(DIST_ROOT, 'pages/index/index.wxml'), UPDATED_DESCRIPTION, 30_000), 'layout-power template update')
    page = await miniProgram.currentPage()
    await acceptance.check('template-updated', miniProgram, page, 30_000)
    await assertRuntimeVendorOutputs()

    await switchRenderedLayout(page, 'command')
    await acceptance.check('style-before', miniProgram, page)
    const nextStyle = `${originalCommandLayoutStyle}\n/* ${STYLE_MARKER} */\n.theme-layout--command .theme-layout__title {\n  color: #119977;\n}\n`
    await replaceFileByRename(COMMAND_LAYOUT_WXSS, nextStyle)
    await devProcess.waitFor(waitForFileContains(path.join(DIST_ROOT, 'layouts/command/index.wxss'), STYLE_MARKER, 30_000), 'layout-power style update')
    page = await miniProgram.currentPage()
    await acceptance.check('style-updated', miniProgram, page, 30_000)
    await assertRuntimeVendorOutputs()
    expect(devProcess.getOutput()).not.toMatch(MODULE_MISSING_RE)
    expect(collector.getSince(0)).toEqual([])
    expect(collector.getLogsSince(0)).not.toEqual(expect.arrayContaining([expect.stringMatching(TD_MESSAGE_DUPLICATE_SLOT_RE)]))
  }, 480_000)
})
