import type { HeadlessWx, HeadlessWxRouteEvent } from '../src/host'
import { expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { querySelectorAll } from '../src/view/selectors'
import { routeEventFiles } from '../test/helpers/routeEvents'

it('publishes route completion after the browser render commit and captures before redirect teardown', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles(routeEventFiles),
    onRender: () => { preview.innerHTML = session.renderCurrentPage().wxml },
  })
  try {
    const home = session.reLaunch('/pages/home/index')
    const wx = session.getApp()!.getWx() as HeadlessWx
    const displayed: Array<{ path: string, routeEventId: string, text: string | null }> = []
    const done = (event: HeadlessWxRouteEvent) => {
      displayed.push({ path: event.path, routeEventId: event.routeEventId, text: preview.querySelector('#ready')?.textContent ?? null })
    }
    wx.onAppRouteDone(done)
    await vi.waitFor(() => expect(displayed).toEqual([
      expect.objectContaining({ path: home.route, text: 'true' }),
    ]))
    home.setData({ top: 250, left: 75 })
    await vi.waitFor(() => expect(home.data.scroll).toEqual({ scrollTop: 250, scrollLeft: 75 }))
    const captured: unknown[] = []
    wx.onBeforePageUnload(event => captured.push({
      samePage: event.page === home,
      unloaded: event.page.data.unloaded,
      coordinates: event.page.measure('#primary'),
    }))
    wx.redirectTo({ url: '/pages/detail/index' })
    expect(captured).toEqual([{ samePage: true, unloaded: false, coordinates: { scrollTop: 250, scrollLeft: 75 } }])
    expect(displayed).toHaveLength(1)
    await vi.waitFor(() => expect(displayed[1]).toMatchObject({ path: 'pages/detail/index', text: 'true' }))
    expect(displayed[1]!.routeEventId).not.toBe(displayed[0]!.routeEventId)
    wx.offAppRouteDone(done)
    session.reLaunch('/pages/other/index')
    await vi.waitFor(() => expect(session.getCurrentPages().at(-1)?.data.ready).toBe(true))
    expect(displayed.map(event => event.path)).toEqual(['pages/home/index', 'pages/detail/index'])
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('acknowledges the real workbench Vue flush after its preview shadow DOM is updated', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const viewport = ref({ height: 844, width: 390 })
  const workbench = useWorkbenchSession(viewport)
  const app = createApp({
    setup: () => () => h(DevicePreview, {
      markup: workbench.previewMarkup.value,
      styleText: workbench.previewStyles.value,
      route: workbench.currentRoute.value,
      viewportHeight: viewport.value.height,
      viewportWidth: viewport.value.width,
      onDispatchTap: workbench.handleDispatchTap,
      onSelectScope: workbench.handleSelectScope,
    }),
  })
  app.mount(preview)
  workbench.loadSession('route-events', createBrowserVirtualFiles([
    ...routeEventFiles,
    ['pages/home/index.js', `Page({
      data: { ready: false, taps: [] },
      onReady() { this.setData({ ready: true }) },
      recordTap(event) { this.setData({ taps: [...this.data.taps, event.currentTarget.id] }) },
    })`],
    ['pages/home/index.wxml', `
      <view id="ready">{{ready}}</view>
      <view id="outer" bindtap="recordTap">
        <navigator id="forward" url="/pages/detail/index?from=navigator" bindtap="recordTap">
          <text id="forward-label">open</text>
          <view id="caught" catchtap="recordTap"><text id="caught-label">stay</text></view>
        </navigator>
      </view>
    `],
  ]))
  const session = workbench.session.value!
  try {
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)?.shadowRoot
    expect(shadow).toBeTruthy()
    const displayed: Array<{ path: string, text: string | null }> = []
    const wx = session.getApp()!.getWx() as HeadlessWx
    wx.onAppRouteDone(event => displayed.push({
      path: event.path,
      text: shadow!.querySelector('#ready')?.textContent ?? null,
    }))
    await vi.waitFor(() => expect(displayed).toEqual([{ path: 'pages/home/index', text: 'true' }]))

    const callbacks: Array<string | null> = []
    const home = session.getCurrentPages().at(-1)!
    home.setData({ ready: false }, () => {
      callbacks.push(shadow!.querySelector('#ready')?.textContent ?? null)
    })
    await vi.waitFor(() => expect(callbacks).toEqual(['false']))
    shadow!.querySelector<HTMLElement>('#caught-label')!.click()
    expect(session.getCurrentPages()).toEqual([home])
    expect(home.data.taps).toEqual(['caught'])
    shadow!.querySelector<HTMLElement>('#forward-label')!.click()
    expect(home.data.taps).toEqual(['caught', 'forward', 'outer'])
    expect(session.getCurrentPages().at(-1)?.options).toEqual({ from: 'navigator' })
    await vi.waitFor(() => expect(displayed).toEqual([
      { path: 'pages/home/index', text: 'true' },
      { path: 'pages/detail/index', text: 'true' },
    ]))
  }
  finally {
    session.close()
    app.unmount()
    preview.remove()
  }
})

it.each(['scheduled', 'acknowledgment'] as const)('retires the outgoing workbench session while its render is %s', async (phase) => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const viewport = ref({ height: 844, width: 390 })
  const workbench = useWorkbenchSession(viewport)
  const app = createApp({
    setup: () => () => h(DevicePreview, {
      markup: workbench.previewMarkup.value,
      styleText: workbench.previewStyles.value,
      route: workbench.currentRoute.value,
      viewportHeight: viewport.value.height,
      viewportWidth: viewport.value.width,
      onDispatchTap: workbench.handleDispatchTap,
      onSelectScope: workbench.handleSelectScope,
    }),
  })
  app.mount(preview)
  workbench.loadSession('outgoing', createBrowserVirtualFiles(routeEventFiles))
  const outgoing = workbench.session.value!
  try {
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)!.shadowRoot!
    const outgoingDone: string[] = []
    const wx = outgoing.getApp()!.getWx() as HeadlessWx
    wx.onAppRouteDone(event => outgoingDone.push(event.path))
    await vi.waitFor(() => expect(outgoingDone).toEqual(['pages/home/index']))
    outgoing.navigateTo('/pages/detail/index')
    await vi.waitFor(() => expect(outgoingDone).toEqual(['pages/home/index', 'pages/detail/index']))

    const outgoingCallbacks: Array<string | null> = []
    outgoing.navigateBack()
    outgoing.getCurrentPages().at(-1)!.setData({ ready: 'retired' }, () => {
      outgoingCallbacks.push(shadow.querySelector('#replacement')?.textContent ?? null)
    })
    const replacementDone: Array<{ path: string, text: string | null }> = []
    const replace = () => {
      workbench.loadSession('replacement', createBrowserVirtualFiles([
        ...routeEventFiles,
        ['pages/home/index.wxml', '<view id="replacement">{{ready}}</view>'],
      ]))
      const nextWx = workbench.session.value!.getApp()!.getWx() as HeadlessWx
      nextWx.onAppRouteDone(event => replacementDone.push({
        path: event.path,
        text: shadow.querySelector('#replacement')?.textContent ?? null,
      }))
    }
    if (phase === 'acknowledgment') {
      // 旧 render 微任务先进入 onRender，再在 Vue flush 确认之前替换会话。
      await new Promise<void>((resolve) => {
        queueMicrotask(() => {
          replace()
          resolve()
        })
      })
    }
    else {
      replace()
    }
    await vi.waitFor(() => expect(replacementDone).toEqual([{ path: 'pages/home/index', text: 'true' }]))
    expect(outgoingDone).toEqual(['pages/home/index', 'pages/detail/index'])
    expect(outgoingCallbacks).toEqual([])
    expect(() => outgoing.getCurrentPages()).toThrow()
    expect(() => outgoing.assertActive()).toThrow()

    const replacementCallbacks: Array<string | null> = []
    workbench.session.value!.getCurrentPages().at(-1)!.setData({ ready: 'current' }, () => {
      replacementCallbacks.push(shadow.querySelector('#replacement')?.textContent ?? null)
    })
    await vi.waitFor(() => expect(replacementCallbacks).toEqual(['current']))
  }
  finally {
    outgoing.close()
    workbench.session.value?.close()
    app.unmount()
    preview.remove()
  }
})

it('keeps the displayed workbench session usable when replacement startup or directory import fails', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const viewport = ref({ height: 844, width: 390 })
  const workbench = useWorkbenchSession(viewport)
  const app = createApp({
    setup: () => () => h(DevicePreview, {
      markup: workbench.previewMarkup.value,
      styleText: workbench.previewStyles.value,
      route: workbench.currentRoute.value,
      viewportHeight: viewport.value.height,
      viewportWidth: viewport.value.width,
      onDispatchTap: workbench.handleDispatchTap,
      onSelectScope: workbench.handleSelectScope,
    }),
  })
  app.mount(preview)
  workbench.loadSession('displayed', createBrowserVirtualFiles(routeEventFiles), 'displayed-scenario')
  const displayed = workbench.session.value!
  try {
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)!.shadowRoot!
    await vi.waitFor(() => expect(shadow.querySelector('#ready')?.textContent).toBe('true'))
    expect(() => workbench.loadSession('broken', createBrowserVirtualFiles([
      ...routeEventFiles,
      ['pages/home/index.js', 'Page({ onLoad() { throw new Error("replacement-start-failed") } })'],
    ]), 'broken-scenario')).toThrow('replacement-start-failed')
    expect(workbench.session.value).toBe(displayed)
    expect(workbench.projectLabel.value).toBe('displayed')
    expect(workbench.currentScenarioId.value).toBe('displayed-scenario')

    const input = document.createElement('input')
    input.type = 'file'
    const transfer = new DataTransfer()
    const invalidConfig = new File(['{'], 'app.json')
    Object.defineProperty(invalidConfig, 'webkitRelativePath', { value: 'broken/app.json' })
    transfer.items.add(invalidConfig)
    input.files = transfer.files
    const event = new Event('change')
    input.dispatchEvent(event)
    await workbench.handleDirectoryChange(event)
    expect(workbench.session.value).toBe(displayed)
    expect(workbench.projectLabel.value).toBe('displayed')
    expect(workbench.currentScenarioId.value).toBe('displayed-scenario')

    const callbacks: Array<string | null> = []
    displayed.getCurrentPages().at(-1)!.setData({ ready: 'still-current' }, () => {
      callbacks.push(shadow.querySelector('#ready')?.textContent ?? null)
    })
    await vi.waitFor(() => expect(callbacks).toEqual(['still-current']))
  }
  finally {
    displayed.close()
    workbench.session.value?.close()
    app.unmount()
    preview.remove()
  }
})

it('serializes asynchronous commits and coalesces pending updates without reordering their callbacks', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const commits: Array<() => void> = []
  let holdRender = false
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles(routeEventFiles),
    onRender() {
      const markup = session.renderCurrentPage().wxml
      if (!holdRender) {
        preview.innerHTML = markup
        return 1
      }
      return new Promise<void>((resolve) => {
        commits.push(() => {
          preview.innerHTML = markup
          resolve()
        })
      })
    },
  })
  try {
    const page = session.reLaunch('/pages/home/index')
    const events = session.getApp()!.globalData.events
    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ stage: 'done', path: page.route }))
    holdRender = true
    const observed: Array<{ callback: string, text: string | null }> = []
    page.setData({ ready: 'first' }, () => {
      observed.push({ callback: 'first', text: preview.querySelector('#ready')?.textContent ?? null })
    })
    await vi.waitFor(() => expect(commits).toHaveLength(1))
    page.setData({ ready: 'second' }, () => {
      observed.push({ callback: 'second', text: preview.querySelector('#ready')?.textContent ?? null })
    })
    page.setData({ ready: 'latest' }, () => {
      observed.push({ callback: 'third', text: preview.querySelector('#ready')?.textContent ?? null })
    })
    await Promise.resolve()
    expect(commits).toHaveLength(1)
    expect(observed).toEqual([])
    expect(preview.querySelector('#ready')?.textContent).toBe('true')
    commits[0]!()
    await vi.waitFor(() => expect(commits).toHaveLength(2))
    expect(observed).toEqual([{ callback: 'first', text: 'first' }])
    expect(preview.querySelector('#ready')?.textContent).toBe('first')
    commits[1]!()
    await vi.waitFor(() => expect(observed).toEqual([
      { callback: 'first', text: 'first' },
      { callback: 'second', text: 'latest' },
      { callback: 'third', text: 'latest' },
    ]))
    expect(preview.querySelector('#ready')?.textContent).toBe('latest')
  }
  finally {
    session.close()
    commits.forEach(commit => commit())
    preview.remove()
  }
})

it('does not publish stale completion when navigation or close interrupts an asynchronous commit', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const commits: Array<() => void> = []
  let holdRender = false
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles(routeEventFiles),
    onRender() {
      const markup = session.renderCurrentPage().wxml
      if (!holdRender) {
        preview.innerHTML = markup
        return
      }
      return new Promise<void>((resolve) => {
        commits.push(() => {
          preview.innerHTML = markup
          resolve()
        })
      })
    },
  })
  try {
    session.reLaunch('/pages/home/index')
    const wx = session.getApp()!.getWx() as HeadlessWx
    const displayed: Array<{ path: string, text: string | null }> = []
    wx.onAppRouteDone(event => displayed.push({
      path: event.path,
      text: preview.querySelector('#ready')?.textContent ?? null,
    }))
    await vi.waitFor(() => expect(displayed).toEqual([{ path: 'pages/home/index', text: 'true' }]))
    holdRender = true
    session.navigateTo('/pages/detail/index')
    await vi.waitFor(() => expect(commits).toHaveLength(1))
    const replacement = session.redirectTo('/pages/other/index')
    await vi.waitFor(() => expect(replacement.data.ready).toBe(true))
    commits[0]!()
    await vi.waitFor(() => expect(commits).toHaveLength(2))
    expect(displayed).toEqual([{ path: 'pages/home/index', text: 'true' }])
    commits[1]!()
    await vi.waitFor(() => expect(displayed).toEqual([
      { path: 'pages/home/index', text: 'true' },
      { path: 'pages/other/index', text: 'true' },
    ]))
    session.navigateTo('/pages/detail/index')
    const callbacks: string[] = []
    session.requestRender(() => callbacks.push('closed'))
    await vi.waitFor(() => expect(commits).toHaveLength(3))
    session.close()
    commits[2]!()
    await Promise.resolve()
    await Promise.resolve()
    expect(callbacks).toEqual([])
    expect(displayed.map(event => event.path)).toEqual(['pages/home/index', 'pages/other/index'])
  }
  finally {
    session.close()
    commits.forEach(commit => commit())
    preview.remove()
  }
})

it('uses the same native navigation and scroll owner for browser interactions', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(routeEventFiles) })
  try {
    const page = session.reLaunch('/pages/home/index')
    page.setData({ top: 120, left: 30, secondTop: 60 })
    await vi.waitFor(() => expect(page.data.scroll).toEqual({ scrollTop: 120, scrollLeft: 30 }))
    const root = session.renderCurrentPage().root
    const scroller = querySelectorAll(root, '#primary')[0]!
    session.dispatchNativeNodeEvent(scroller, 'scroll', { detail: { scrollTop: 400, scrollLeft: 80 } })
    expect(page.measure('#primary')).toEqual({ scrollTop: 400, scrollLeft: 80 })
    expect(page.measure('#secondary')).toEqual({ scrollTop: 60, scrollLeft: 0 })
    const navigatorLabel = querySelectorAll(root, '#forward-label')[0]!
    session.dispatchNativeNodeEvent(navigatorLabel, 'tap', {})
    const detail = session.getCurrentPages().at(-1)!
    expect(detail.route).toBe('pages/detail/index')
    expect(detail.options).toEqual({ from: 'navigator' })
    const events = session.getApp()!.globalData.events
    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ stage: 'done', path: detail.route, openType: 'navigateTo' }))
    session.navigateBack()
    expect(session.getCurrentPages().at(-1)).toBe(page)
    expect(page.measure('#primary')).toEqual({ scrollTop: 400, scrollLeft: 80 })
  }
  finally {
    session.close()
  }
})
