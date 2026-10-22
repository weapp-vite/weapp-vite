import type { DomCheckpoint } from '../utils/domAcceptance/types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sanitizeAcceptanceValue } from '../scripts/domAcceptanceReport/helpers'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { createDomAcceptance } from '../utils/domAcceptance'
import { waitForEmittedStylesheet } from '../utils/emittedStylesheet'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { createWevuTailwindHmrProject } from '../utils/wevuTailwindHmrProject'
import { createWevuTailwindHmrSession } from '../utils/wevuTailwindHmrProject/session'
import {
  addWevuTailwindLocalPriority,
  updateWevuTailwindProbe,
  WEVU_TAILWIND_INITIAL_CLASS,
  WEVU_TAILWIND_INITIAL_HEX,
  WEVU_TAILWIND_PROBE,
  WEVU_TAILWIND_ROUTE,
  WEVU_TAILWIND_UPDATES,
} from '../utils/wevuTailwindHmrProject/source'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE_COLOR = 'rgb(246, 247, 251)'
const BASE_TEXT_COLOR = 'rgb(31, 26, 63)'
const headless = resolveRuntimeProviderName() === 'headless'

describe('template wevu TailwindCSS TDesign HMR in real WeChat DevTools', { concurrent: false }, () => {
  let fixture: Awaited<ReturnType<typeof createWevuTailwindHmrProject>> | undefined
  let session: ReturnType<typeof createWevuTailwindHmrSession> | undefined

  beforeAll(async () => {
    fixture = await createWevuTailwindHmrProject(ROOT)
    session = createWevuTailwindHmrSession(ROOT, fixture)
    await session.start()
  }, 300_000)

  afterAll(async () => {
    await runCleanupSteps([
      { label: 'Wevu Tailwind template session', run: async () => { await session?.close() } },
      { label: 'Wevu Tailwind isolated template', run: async () => {
        if (session && !session.released) {
          throw new Error('Preserving fixture because owned runtime or watcher release is unconfirmed')
        }
        await fixture?.cleanup()
      } },
    ])
  }, 60_000)

  it('preserves script state and serializes stylesheet and Tailwind template updates through sticky classic', async (context) => {
    const host = session!
    const project = fixture!.project
    const pageWxss = path.join(project, 'dist/pages/index/index.wxss')
    const pageWxml = path.join(project, 'dist/pages/index/index.wxml')
    const appWxss = path.join(project, 'dist/app.wxss')
    const base = { color: BASE_COLOR, textColor: BASE_TEXT_COLOR, hex: WEVU_TAILWIND_INITIAL_HEX }
    const stages = [
      { id: 'initial', ...base, count: 0 },
      { id: 'prepared', ...base, count: 1 },
      { id: 'script-saved', ...base, count: 1 },
      { id: 'script-interaction', ...base, count: 3 },
      { id: 'script-restored', ...base, count: 3 },
      { id: 'script-restored-interaction', ...base, count: 4 },
      { id: 'style-saved', ...base, textColor: 'rgb(37, 99, 235)', count: 0 },
      { id: 'style-interaction', ...base, textColor: 'rgb(37, 99, 235)', count: 1 },
      { id: 'style-restored', ...base, count: 0 },
      { id: 'style-restored-interaction', ...base, count: 1 },
      ...WEVU_TAILWIND_UPDATES.flatMap((update, index) => [
        { id: `background:${index}:default`, ...update, textColor: BASE_TEXT_COLOR, count: 0 },
        { id: `background:${index}:interaction`, ...update, textColor: BASE_TEXT_COLOR, count: 1 },
      ]),
      { id: 'local-style-priority:default', color: 'rgb(252, 231, 243)', textColor: BASE_TEXT_COLOR, hex: 'fce7f3', count: 0, local: true },
      { id: 'local-style-priority:interaction', color: 'rgb(252, 231, 243)', textColor: BASE_TEXT_COLOR, hex: 'fce7f3', count: 1, local: true },
      { id: 'restored:default', ...base, count: 0, localAbsent: true },
      { id: 'restored:interaction', ...base, count: 1, localAbsent: true },
    ]
    const checkpoints = stages.map((stage): DomCheckpoint => ({
      id: stage.id,
      route: WEVU_TAILWIND_ROUTE,
      action: `验收 ${stage.id} 的背景、局部优先级、计算文本与交互`,
      nodes: [
        { selector: `#${WEVU_TAILWIND_PROBE}`, count: 1, attributes: { 'data-e2e-bg': stage.hex }, ...(!headless ? { styles: { 'background-color': stage.color, 'color': stage.textColor }, visible: true } : {}) },
        { selector: '#count-label', count: 1, text: `已点击 ${stage.count} 次` },
        ...('local' in stage ? [{ selector: '#wevu-tailwind-local-probe', count: 1, text: 'Local style', ...(!headless ? { styles: { 'background-color': 'rgb(31, 41, 55)' }, visible: true } : {}) }] : []),
        ...('localAbsent' in stage ? [{ selector: '#wevu-tailwind-local-probe', count: 0 }] : []),
      ],
    }))
    const dom = createDomAcceptance(context, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template', checkpoints)
    context.onTestFailed(async () => {
      process.stdout.write(host.dev.getOutput().slice(-16_000))
      const files = await Promise.all([
        ['source', fixture!.source],
        ['page-style', pageWxss],
        ['global-style', path.join(project, 'dist', `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`)],
        ['profile', host.profilePath],
      ].map(async ([label, file]) => {
        try {
          const source = await readFile(file!, 'utf8')
          return { label, source: label === 'profile' ? source.slice(-64_000) : source, length: source.length }
        }
        catch (error) {
          return { label, error: error instanceof Error ? error.message : String(error) }
        }
      }))
      process.stdout.write(`[template-wevu-tailwindcss-tdesign:failure-files] ${JSON.stringify(sanitizeAcceptanceValue(files))}\n`)
    })
    const diagnostics = createHmrRuntimeDiagnostics(host.app, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template')
    const initialIdentity = await diagnostics.initialize()
    expect(initialIdentity.errors).toEqual([])
    expect(initialIdentity.pageId).toEqual(expect.any(Number))
    expect(initialIdentity.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true, appLaunchProbe: expect.any(Number) })

    async function check(id: string) {
      await dom.check(id, host.app, await host.page())
      await host.captureFiles(`${id}:rendered`)
      host.assertNoRuntimeErrors()
    }

    async function interact(id: string) {
      await (await host.page()).callMethodWithOptions('handleCountTap', { routeOnly: true })
      await check(id)
    }

    async function assertStatefulIdentity(id: string) {
      await host.assertStateful()
      const rendered = await diagnostics.capture(id)
      expect(rendered.errors).toEqual([])
      expect(rendered.pageId).toBe(initialIdentity.pageId)
      expect(rendered.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
    }

    let current = fixture!.original
    await check('initial')
    await interact('prepared')
    try {
      // 只修改 script 中的方法实现；模板静态结构不变，补丁必须保留现有实例和计数。
      const script = current.replace('count.value += 1', 'count.value += 2')
      expect(script).not.toBe(current)
      let version = Number((await host.state()).version)
      await replaceFileByRename(fixture!.source, script)
      await expect.poll(async () => Number((await host.state()).version), { timeout: 45_000 }).toBeGreaterThan(version)
      await assertStatefulIdentity('script-saved')
      await check('script-saved')
      await interact('script-interaction')
      version = Number((await host.state()).version)
      await replaceFileByRename(fixture!.source, current)
      await expect.poll(async () => Number((await host.state()).version), { timeout: 45_000 }).toBeGreaterThan(version)
      await assertStatefulIdentity('script-restored')
      await check('script-restored')
      await interact('script-restored-interaction')

      // 首次纯样式变更触发 classic；恢复及后续模板变化都不得重启旧客户端。
      await host.markInstances()
      const styled = host.publication.capture(fixture!.source)
      await replaceFileByRename(fixture!.source, current.replace('color: #1f1a3f', 'color: #2563eb'))
      await styled.wait()
      await waitForEmittedStylesheet(pageWxss, '#2563eb')
      await host.observeClassic(WEVU_TAILWIND_INITIAL_HEX)
      await check('style-saved')
      await interact('style-interaction')
      await host.markInstances()
      const styleRestored = host.publication.capture(fixture!.source)
      await replaceFileByRename(fixture!.source, current)
      await styleRestored.wait()
      await waitForEmittedStylesheet(pageWxss, '#2563eb', { absent: true })
      await host.observeClassic(WEVU_TAILWIND_INITIAL_HEX)
      await check('style-restored')
      await interact('style-restored-interaction')

      let previousClass = WEVU_TAILWIND_INITIAL_CLASS
      let previousEscapedClass = 'bg-_b_hf6f7fb_B'
      let previousHex = WEVU_TAILWIND_INITIAL_HEX
      for (const [index, update] of WEVU_TAILWIND_UPDATES.entries()) {
        await host.captureFiles(`background:${index}:before`)
        const next = updateWevuTailwindProbe(current, previousClass, update.className, previousHex, update.hex)
        expect(next).not.toBe(current)
        await host.markInstances()
        const publication = host.publication.capture(fixture!.source)
        const startedAt = Date.now()
        await replaceFileByRename(fixture!.source, next)
        await publication.wait()
        const expectedClass = update.escapedClass
        await expect.poll(async () => {
          const source = await readFile(pageWxml, 'utf8')
          return expectedClass ? source.includes(expectedClass) : !source.includes(previousEscapedClass)
        }, { timeout: 45_000 }).toBe(true)
        if (update.css) {
          await waitForEmittedStylesheet(appWxss, update.css)
        }
        const outputMs = Date.now() - startedAt
        await host.observeClassic(update.hex)
        await check(`background:${index}:default`)
        const runtimeMs = Date.now() - startedAt
        process.stdout.write(`[template-wevu-tailwindcss-tdesign:hmr] update action=${update.action} class=${update.className || '<removed>'} outputMs=${outputMs} runtimeMs=${runtimeMs}\n`)
        expect(outputMs).toBeLessThan(45_000)
        expect(runtimeMs).toBeLessThan(45_000)
        await interact(`background:${index}:interaction`)
        current = next
        previousClass = update.className
        previousEscapedClass = update.escapedClass
        previousHex = update.hex
      }

      await host.markInstances()
      const local = host.publication.capture(fixture!.source)
      current = addWevuTailwindLocalPriority(current)
      await replaceFileByRename(fixture!.source, current)
      await local.wait()
      await Promise.all([waitForFileContains(pageWxml, 'wevu-tailwind-local-probe'), waitForEmittedStylesheet(pageWxss, '#1f2937')])
      await host.observeClassic('fce7f3')
      await check('local-style-priority:default')
      await interact('local-style-priority:interaction')

      await host.markInstances()
      const restored = host.publication.capture(fixture!.source)
      await replaceFileByRename(fixture!.source, fixture!.original)
      await restored.wait()
      await host.observeClassic(WEVU_TAILWIND_INITIAL_HEX)
      await waitForEmittedStylesheet(pageWxss, '#1f2937', { absent: true })
      await check('restored:default')
      await interact('restored:interaction')
      expect(host.dev.getOutput().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)
      expect(host.dev.getOutput()).toContain('"reason":"stylesheet-output"')
      host.assertNoRuntimeErrors()
    }
    finally {
      await host.captureFiles('finally')
    }
  }, 600_000)
})
