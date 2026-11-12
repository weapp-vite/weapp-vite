import type { createDomAcceptance } from '../../utils/domAcceptance'
import type { createHmrRuntimeDiagnostics } from '../../utils/hmrRuntimeDiagnostics'
import type { createNativeHmrPublication } from '../../utils/nativeHmrPublication'
import { expect, vi } from 'vitest'
import { waitForEmittedStylesheet } from '../../utils/emittedStylesheet'
import { replaceFileByRename, waitForFileContains } from '../../utils/hmr-helpers'

const ROUTE = '/pages/index/index'
const PROBE = '#tailwind-hmr-probe'
const GREEN = '10b981'
const stages = [
  { id: 'initial', mode: 'light', color: 'rgb(243, 244, 246)', hex: 'f3f4f6' },
  { id: 'dark', mode: 'dark', color: 'rgb(16, 24, 40)', hex: 'f3f4f6' },
  { id: 'classic-updated', mode: 'light', color: 'rgb(16, 185, 129)', hex: GREEN },
  { id: 'updated-dark', mode: 'dark', color: 'rgb(16, 24, 40)', hex: GREEN },
  { id: 'updated-light', mode: 'light', color: 'rgb(16, 185, 129)', hex: GREEN },
  { id: 'restored', mode: 'light', color: 'rgb(243, 244, 246)', hex: 'f3f4f6' },
  { id: 'restored-dark', mode: 'dark', color: 'rgb(16, 24, 40)', hex: 'f3f4f6' },
]

export const tdesignTailwindCheckpoints = stages.map(stage => ({
  id: `tailwind:${stage.id}`,
  route: ROUTE,
  action: `验收 ${stage.id} 的页面数据、实际背景和模式控件`,
  nodes: [
    { selector: PROBE, attributes: { 'data-e2e-bg': stage.hex }, styles: { 'background-color': stage.color }, visible: true },
    { selector: '#tailwind-mode', text: `当前模式 ${stage.mode} 切换模式`, visible: true },
  ],
}))

/** 样式与模板无可靠状态保持能力，验证原 owner 自动完整重载和后续 classic 保存。 */
export async function verifyTdesignTailwindFallback(options: {
  dom: ReturnType<typeof createDomAcceptance>
  app: () => any
  page: () => Promise<any>
  tapMode: () => Promise<void>
  reconnect: () => Promise<void>
  diagnostics: ReturnType<typeof createHmrRuntimeDiagnostics>
  publication: ReturnType<typeof createNativeHmrPublication>
  source: string
  emittedTemplate: string
  emittedStylesheet: string
  initial: string
  updated: string
}) {
  const { diagnostics, publication, dom } = options
  const check = async (id: string, mode: string) => {
    const page = await options.page()
    await dom.check(`tailwind:${id}`, options.app(), page)
    await expect.poll(() => page.data('mode')).toBe(mode)
  }
  await check('initial', 'light')
  await options.tapMode()
  await check('dark', 'dark')
  const initial = await diagnostics.initialize()
  expect(initial.errors).toEqual([])
  expect(initial.runtime).toMatchObject({ clientPresent: true, transportPhase: 'polling' })

  const update = async (source: string, hex: string, color: string, id: string) => {
    const previous = await diagnostics.initialize()
    const write = publication.capture(options.source)
    await replaceFileByRename(options.source, source)
    await write.wait()
    await waitForFileContains(options.emittedTemplate, `data-e2e-bg="${hex}"`)
    await waitForEmittedStylesheet(options.emittedStylesheet, `background-color: #${color}`)
    // 仅重连原受管窗口；不导航、不编译，DOM 必须来自 IDE 自动完整重载。
    await options.reconnect()
    await vi.waitFor(async () => {
      const page = await options.page()
      expect(await page.data('mode')).toBe('light')
      expect(await options.app().evaluate(() => (getApp() as any).__e2eHmrLaunch)).not.toBe(previous.runtime?.appLaunchProbe)
      const node = await page.$(PROBE, { fallback: false })
      expect(await node.attribute('data-e2e-bg')).toBe(hex)
    }, { timeout: 45_000 })
    await check(id, 'light')
    const current = await diagnostics.capture(`tailwind:${id}-runtime`)
    expect(current.errors).toEqual([])
    expect(current.pageId).not.toBeNull()
    expect(current.pageId).not.toBe(previous.pageId)
    expect(current.runtime).toMatchObject({
      pageMarkerRetained: false,
      appMarkerRetained: false,
      clientPresent: false,
      controlPresent: false,
      bridgeReady: false,
    })
    expect(current.runtime?.appLaunchProbe).not.toBeNull()
    expect(current.runtime?.appLaunchProbe).not.toBe(previous.runtime?.appLaunchProbe)
    await publication.assertClassicRuntime(options.app())
  }
  await update(options.updated, GREEN, GREEN, 'classic-updated')
  await options.tapMode()
  await check('updated-dark', 'dark')
  await options.tapMode()
  await check('updated-light', 'light')
  await options.tapMode()
  await update(options.initial, 'f3f4f6', 'f3f4f6', 'restored')
  await options.tapMode()
  await check('restored-dark', 'dark')
  await publication.assertClassicRuntime(options.app())
}
