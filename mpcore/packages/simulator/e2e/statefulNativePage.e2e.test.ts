// @ts-expect-error 此模块由 browser E2E 配置在 Node 侧编译真实 Page fixture 后提供。
import sources from 'virtual:stateful-native-page-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { resolveTestingPageMethodTarget } from '../src/testing/pageMethodTarget'

it('renders independent WXSS updates and real Page bridge patches without resetting DOM state', async () => {
  const files = createBrowserVirtualFiles(sources as Array<[string, string]>)
  const session = createBrowserHeadlessSession({ files })
  const host = document.createElement('div')
  document.body.append(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  const preview = document.createElement('div')
  shadow.append(style, preview)
  const render = () => {
    const result = session.renderCurrentPage()
    style.textContent = result.styles.cssText
    preview.innerHTML = result.wxml
  }
  const action = (selector: string, event = {}) => {
    render()
    const node = preview.querySelector(selector)!
    expect(node).not.toBeNull()
    const method = node.getAttribute('data-sim-tap') ?? node.getAttribute('bindinput')
    expect(method).toBeTruthy()
    session.callScopeMethod(node.getAttribute('data-sim-scope')!, method!, event)
  }
  try {
    const page = session.reLaunch('/pages/native/index?source=e2e')
    const app = session.getApp()
    const check = (count: number, color: string, input = 'held-input') => {
      render()
      expect(preview.querySelector('.count')?.textContent).toBe(String(count))
      expect(preview.querySelector('.input')?.getAttribute('value')).toBe(input)
      expect(getComputedStyle(preview.querySelector('.page')!).backgroundColor).toBe(color)
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
    }
    const white = 'rgb(255, 255, 255)'
    const blue = 'rgb(219, 234, 254)'
    const styleFile = 'pages/native/index.wxss'
    const originalStyle = files.get(styleFile)!
    check(0, white, '')
    action('.input', { detail: { value: 'held-input' } })
    action('.increment')
    check(1, white)
    files.set(styleFile, originalStyle.replace('#fff', '#dbeafe'))
    check(1, blue)
    page.patchPage()
    check(1, blue)
    action('.increment')
    check(3, blue)
    page.restorePage()
    files.set(styleFile, originalStyle)
    check(3, white)
    action('.increment')
    check(4, white)
    const templateFile = 'pages/native/index.wxml'
    const originalTemplate = files.get(templateFile)!
    for (const template of [originalTemplate.replace('<input', '<view>template update</view><input'), originalTemplate]) {
      files.set(templateFile, template)
      check(4, white)
    }
    page.patchPage()
    await page.reLaunch()
    const fresh = session.getCurrentPages().at(-1)!
    expect(fresh).not.toBe(page)
    render()
    expect(preview.querySelector('.count')?.textContent).toBe('7')
    action('.increment')
    render()
    expect(preview.querySelector('.count')?.textContent).toBe('9')
    fresh.restorePage()
    render()
    expect(preview.querySelector('.count')?.textContent).toBe('9')
    await fresh.reLaunch()
    render()
    expect(preview.querySelector('.count')?.textContent).toBe('0')
  }
  finally {
    session.close()
    host.remove()
  }
})

it('renders mode changes from external CommonJS modules after native Page update and restoration', async () => {
  const files = createBrowserVirtualFiles(sources as Array<[string, string]>)
  const session = createBrowserHeadlessSession({ files })
  const host = document.createElement('div')
  document.body.append(host)
  const render = () => {
    host.innerHTML = session.renderCurrentPage().wxml
  }
  const tap = () => {
    render()
    const control = host.querySelector('#mode')!
    expect(control).not.toBeNull()
    const method = control.getAttribute('data-sim-tap')
    expect(method).toBe('switchMode')
    session.callScopeMethod(control.getAttribute('data-sim-scope')!, method!, {})
  }
  const baseline = 'runtime-vendor-hmr-baseline'
  const updated = 'runtime-vendor-hmr-updated'
  const nativeOptions = { fallback: false }
  const routeOptions = { routeOnly: true, fallback: false }
  try {
    const page = session.reLaunch('/pages/external/index')
    const app = session.getApp()
    const check = (text: string, calls: number, definitionMarker = baseline) => {
      render()
      expect(host.querySelector('#mode')?.textContent).toBe(text)
      expect(host.querySelector('#vendor-marker')?.textContent).toBe(baseline)
      expect(host.querySelector('#vendor-calls')?.textContent).toBe(String(calls))
      const current = resolveTestingPageMethodTarget(page, session.getCurrentPages(), nativeOptions)!
      expect(current).toBe(page)
      const nativeResult = current.readVendorState()
      expect(nativeResult).toMatchObject({ calls, definitionMarker, marker: baseline })
      const routeTarget = resolveTestingPageMethodTarget(page, session.getCurrentPages(), routeOptions)!
      expect(routeTarget).toBe(current)
      expect(routeTarget.readVendorState()).toEqual(nativeResult)
      expect(current.data).toMatchObject({ vendorCalls: calls, vendorMarker: baseline })
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
      expect(page.route).toBe('pages/external/index')
    }
    check('当前模式 light 切换模式', 0)
    tap()
    check('当前模式 dark 切换模式', 1)
    const firstUpdate = page.patchPage()
    check('当前模式 dark 切换模式', 1, updated)
    await firstUpdate
    tap()
    check('当前模式 npm-dark 切换模式', 2, updated)
    const restoration = page.restorePage()
    check('当前模式 npm-dark 切换模式', 2)
    await restoration
    tap()
    check('当前模式 light 切换模式', 3)
    const nextUpdate = page.patchPage()
    check('当前模式 light 切换模式', 3, updated)
    await nextUpdate

    const replacement = session.reLaunch('/pages/external/index')
    expect(replacement).not.toBe(page)
    expect(() => resolveTestingPageMethodTarget(page, session.getCurrentPages(), nativeOptions)).toThrow('page is not on top of page stack')
    expect(resolveTestingPageMethodTarget(page, session.getCurrentPages(), routeOptions)).toBeUndefined()
    const current = resolveTestingPageMethodTarget(replacement, session.getCurrentPages(), nativeOptions)!
    expect(current).toBe(replacement)
    expect(current.readVendorState()).toEqual({ mode: 'light', calls: 0, definitionMarker: updated, marker: updated })
    const routeTarget = resolveTestingPageMethodTarget(replacement, session.getCurrentPages(), routeOptions)!
    expect(routeTarget).toBe(current)
    expect(routeTarget.readVendorState()).toEqual(current.readVendorState())
    render()
    expect(host.querySelector('#mode')?.textContent).toBe('当前模式 light 切换模式')
    expect(host.querySelector('#vendor-marker')?.textContent).toBe(updated)
    expect(host.querySelector('#vendor-calls')?.textContent).toBe('0')
    tap()
    expect(current.readVendorState()).toEqual({ mode: 'npm-light', calls: 1, definitionMarker: updated, marker: updated })
    expect(routeTarget.readVendorState()).toEqual(current.readVendorState())
    expect(current.data).toMatchObject({ mode: 'npm-light', vendorCalls: 1, vendorMarker: updated })
    render()
    expect(host.querySelector('#mode')?.textContent).toBe('当前模式 npm-light 切换模式')
    expect(host.querySelector('#vendor-marker')?.textContent).toBe(updated)
    expect(host.querySelector('#vendor-calls')?.textContent).toBe('1')
  }
  finally {
    session.close()
    host.remove()
  }
})

it('computes native batch styles alongside updated templates and script handlers', () => {
  const files = createBrowserVirtualFiles(sources as Array<[string, string]>)
  const initial = new Map(files)
  const session = createBrowserHeadlessSession({ files })
  const host = document.createElement('div')
  document.body.append(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  const preview = document.createElement('div')
  shadow.append(style, preview)
  try {
    const page = session.reLaunch('/pages/batch/index')
    const markers = ['BATCH_BASE', 'BATCH_FIRST', 'BATCH_NEXT', 'BATCH_BASE']
    const colors = ['#112233', '#223344', '#334455', '#112233']
    const computed = ['rgb(17, 34, 51)', 'rgb(34, 51, 68)', 'rgb(51, 68, 85)', 'rgb(17, 34, 51)']
    for (const [index, marker] of markers.entries()) {
      if (index) {
        for (const extension of ['wxml', 'wxss', 'json']) {
          const file = `pages/batch/index.${extension}`
          files.set(file, initial.get(file)!.replaceAll('BATCH_BASE', marker).replace(/color: #[\da-f]+/i, `color: ${colors[index]!}`))
        }
        page.patchBatch(marker)
      }
      page.increment()
      const rendered = session.renderCurrentPage()
      style.textContent = rendered.styles.cssText
      preview.innerHTML = rendered.wxml
      expect(preview.querySelector('#batch')?.textContent).toBe(marker)
      expect(preview.querySelector('#script')?.textContent).toBe(marker)
      expect(preview.querySelector('#increment')?.textContent).toBe(String(index + 1))
      expect(getComputedStyle(preview.querySelector('#batch')!).color).toBe(computed[index])
      expect(files.get('pages/batch/index.json')).toContain(marker)
      expect(session.getCurrentPages()[0]).toBe(page)
    }
  }
  finally {
    session.close()
    host.remove()
  }
})
