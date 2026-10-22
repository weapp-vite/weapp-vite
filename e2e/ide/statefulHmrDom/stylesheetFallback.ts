import type { launchAutomator } from '../../utils/automator'
import type { startDevProcess } from '../../utils/dev-process'
import type { DomCheckpoint, DomProvider } from '../../utils/domAcceptance/types'
import type { createNativeHmrPublication } from '../../utils/nativeHmrPublication'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { expect } from 'vitest'
import { waitForEmittedStylesheet } from '../../utils/emittedStylesheet'
import { replaceFileByRename, waitForFileContains, waitForFileRemoved } from '../../utils/hmr-helpers'
import { captureNativeConfigReload } from '../../utils/nativePublication/configReload'
import { armNativePrewriteGate } from '../../utils/nativePublication/prewriteGate'

const BASE = 'STATEFUL-NATIVE-BASE'
const WHITE = 'rgb(255, 255, 255)'
const BLUE = 'rgb(219, 234, 254)'
const GREEN = 'rgb(220, 252, 231)'
const PINK = 'rgb(252, 231, 243)'
const INPUT = 'held-fallback-input'
const stages = [
  { id: 'initial', color: WHITE },
  { id: 'prepared', color: WHITE, count: 1, input: INPUT },
  { id: 'style-updated', color: GREEN },
  { id: 'style-interaction', color: GREEN, count: 1 },
  { id: 'rapid-saves', color: PINK },
  { id: 'style-restored', color: WHITE },
  { id: 'restored-interaction', color: WHITE, count: 1 },
  { id: 'style-repeated', color: BLUE },
  { id: 'style-removed', color: 'rgba(0, 0, 0, 0)' },
  { id: 'style-recreated', color: WHITE },
  { id: 'script-updated', color: WHITE, marker: 'STYLE-SCRIPT-A' },
  { id: 'script-interaction', color: WHITE, marker: 'STYLE-SCRIPT-A', count: 2 },
  { id: 'script-restored', color: WHITE },
  { id: 'config-before', color: WHITE, marker: 'CONFIG-A' },
  { id: 'config-after', color: WHITE, marker: 'CONFIG-B' },
  { id: 'post-config-style', color: BLUE, marker: 'CONFIG-B' },
  { id: 'post-config-restored', color: WHITE, marker: 'CONFIG-B' },
]

/** 独占会话验收样式自动回退，避免污染后续脚本、模板与资产的 stateful 覆盖。 */
export function stylesheetFallbackCheckpoints(provider: DomProvider): DomCheckpoint[] {
  return stages.map(stage => ({
    id: stage.id,
    route: '/pages/native/index',
    action: `验收样式回退 ${stage.id} 的真实背景、节点及重载后的交互状态`,
    nodes: [
      { selector: '.page', ...(provider === 'devtools' ? { styles: { 'background-color': stage.color }, visible: true } : {}) },
      { selector: '.marker', text: stage.marker ?? BASE },
      { selector: '.count', text: String(stage.count ?? 0) },
      { selector: '.input', attributes: { value: stage.input ?? '' } },
    ],
  }))
}

interface StylesheetFallbackOptions {
  project: string
  dev: ReturnType<typeof startDevProcess>
  publication: ReturnType<typeof createNativeHmrPublication>
  app: () => Awaited<ReturnType<typeof launchAutomator>>
  observeClassic: (marker: string) => Promise<void>
  saveClassic: (content: string, marker: string) => Promise<void>
  initialSource: string
  configFile: string
  configSource: string
  compilerHost: 'wv' | 'vite' | 'vite-plus'
  check: (id: string) => Promise<void>
}

/** 真实 IDE 仅重连原 owner，headless 的重新打开由调用方显式作为 companion 处理。 */
export async function verifyStylesheetFallback(options: StylesheetFallbackOptions) {
  const { project, dev, publication, app, check } = options
  const style = path.join(project, 'src/pages/native/index.wxss')
  const output = path.join(project, 'dist/pages/native/index.wxss')
  const original = await fs.readFile(style, 'utf8')
  expect(original).toContain('background-color: #fff')
  const colored = (color: string) => original.replace('background-color: #fff', `background-color: ${color}`)
  const currentPage = async () => {
    const page = await app().currentPage()
    if (!page) {
      throw new Error('Stylesheet fallback page is unavailable')
    }
    return page
  }
  const markBeforeReload = async () => {
    await app().evaluate(() => {
      const pages = getCurrentPages()
      ;(pages[pages.length - 1] as any).__capabilityIdentity = 'before-stylesheet-reload'
      ;(getApp() as any).__stylesheetFallbackIdentity = 'before-stylesheet-reload'
    })
    const input = await (await currentPage()).$('.input', { fallback: false })
    expect(input).not.toBeNull()
    await input!.input(INPUT)
    await expect.poll(() => app().evaluate(() => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1] as any
      return { input: page.data.input, identity: page.__capabilityIdentity }
    }), { timeout: 10_000 }).toEqual({ input: INPUT, identity: 'before-stylesheet-reload' })
  }
  const assertClassicState = async () => {
    expect(await app().evaluate(() => (getApp() as any).__stylesheetFallbackIdentity ?? null)).toBeNull()
    expect(publication.stateful).toBe(false)
    expect(dev.getBuildErrors()).toEqual([])
  }
  const observeClassic = async (marker = BASE) => {
    await options.observeClassic(marker)
    await assertClassicState()
  }
  const tap = async (id: string) => {
    const increment = await (await currentPage()).$('.increment', { fallback: false })
    expect(increment).not.toBeNull()
    await increment!.tap()
    await check(id)
  }
  const saveStyles = async (id: string, colors: readonly string[], marker = BASE) => {
    await markBeforeReload()
    const pending = publication.capture(style)
    for (const color of colors) {
      await replaceFileByRename(style, colored(color))
    }
    await pending.wait()
    await waitForEmittedStylesheet(output, colors.at(-1)!)
    await observeClassic(marker)
    await check(id)
  }

  await expect.poll(() => app().evaluate((key: string) => {
    const client = (globalThis as any)[key]
    return client?.getTransportState?.()
  }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toMatchObject({ phase: 'polling', initialReady: true })
  await check('initial')
  await markBeforeReload()
  await tap('prepared')

  // 真实 classic 首构停在原生写出前，确保再次保存发生在 switching 期间。
  const beforeStyles = await fs.readFile(output, 'utf8')
  const firstPublication = publication.capture(style)
  const gate = await armNativePrewriteGate(project)
  const entering = new AbortController()
  const transitionOffset = dev.getOutput().length
  try {
    await replaceFileByRename(style, colored('#dbeafe'))
    await dev.waitForOutput('[weapp-vite] HMR fallback ', 'compiled stylesheet capability decision')
    await dev.waitFor(gate.waitEntered(90_000, entering.signal), 'classic native prewrite gate')
    const transition = () => dev.getOutput().slice(transitionOffset)
    expect(transition()).toContain('"reason":"stylesheet-output"')
    expect(transition().split('[weapp-vite] HMR fallback ')).toHaveLength(2)
    expect(transition()).not.toContain('[weapp-vite] HMR classic ready ')
    await replaceFileByRename(style, colored('#fce7f3'))
    await replaceFileByRename(style, colored('#dcfce7'))
    expect(transition()).not.toContain('[weapp-vite] HMR classic ready ')
    expect(await fs.readFile(output, 'utf8')).toBe(beforeStyles)
  }
  finally {
    entering.abort()
    await gate.release()
  }
  await firstPublication.wait()
  await waitForEmittedStylesheet(output, '#dcfce7')
  await observeClassic()
  await check('style-updated')
  await tap('style-interaction')

  await saveStyles('rapid-saves', ['#dbeafe', '#fce7f3'])
  await saveStyles('style-restored', ['#fff'])
  await tap('restored-interaction')
  await saveStyles('style-repeated', ['#dbeafe'])

  await markBeforeReload()
  const removed = publication.capture(style)
  await fs.remove(style)
  await removed.wait()
  await waitForFileRemoved(output)
  await observeClassic()
  await check('style-removed')
  await saveStyles('style-recreated', ['#fff'])

  await markBeforeReload()
  const patched = options.initialSource.replace(BASE, 'STYLE-SCRIPT-A').replace('this.data.count + 1', 'this.data.count + 2')
  expect(patched).not.toBe(options.initialSource)
  await options.saveClassic(patched, 'STYLE-SCRIPT-A')
  await assertClassicState()
  await check('script-updated')
  await tap('script-interaction')
  await markBeforeReload()
  await options.saveClassic(options.initialSource, BASE)
  await assertClassicState()
  await check('script-restored')

  await options.saveClassic(options.initialSource.replace(`'${BASE}'`, '__HMR_CAPABILITY_CONFIG_MARKER__'), 'CONFIG-A')
  await check('config-before')
  await markBeforeReload()
  const configPublication = captureNativeConfigReload(dev, project, options.compilerHost)
  await replaceFileByRename(options.configFile, options.configSource.replace('CONFIG-A', 'CONFIG-B'))
  await configPublication.wait(90_000)
  await dev.waitFor(waitForFileContains(path.join(project, 'dist/pages/native/index.js'), 'CONFIG-B'), 'classic stylesheet fixture config reload')
  await observeClassic('CONFIG-B')
  await check('config-after')
  await saveStyles('post-config-style', ['#dbeafe'], 'CONFIG-B')
  await saveStyles('post-config-restored', ['#fff'], 'CONFIG-B')
  expect(await fs.readFile(style, 'utf8')).toBe(original)
  await publication.assertClassicRuntime(app())
  expect(dev.getOutput().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)
  expect(dev.getOutput()).toContain('"reason":"stylesheet-output"')
}
