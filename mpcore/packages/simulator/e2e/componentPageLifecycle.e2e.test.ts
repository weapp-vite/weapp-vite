import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { attachmentBindingTrace, createAttachmentBindingFiles } from '../test/helpers/attachmentBindings'
import { attachmentClampTrace, attachmentDetachTrace, createAttachmentBatchFiles, createAttachmentCreatedWriteFiles, createAttachmentOwnerWriteFiles, createAttachmentReentryFiles } from '../test/helpers/attachmentReentry'
import { componentPageLifecycleFiles, componentPageLifecycleTrace } from '../test/helpers/componentPageLifecycle'

it('dispatches both Component page lifetime and page method callbacks', async () => {
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/next/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Component({
  data: { lifecycle: [] },
  lifetimes: {
    ready() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'lifetime-ready'] })
    },
  },
  pageLifetimes: {
    show() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'page-show'] })
    },
    hide() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'page-hide'] })
    },
  },
  methods: {
    onShow() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'method-show'] })
    },
    onHide() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'method-hide'] })
    },
    onReady() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'method-ready'] })
    },
    openNext() {
      return new Promise((resolve, reject) => {
        wx.navigateTo({ url: '/pages/next/index', success: resolve, fail: reject })
      })
    },
  },
})
`],
      ['pages/index/index.wxml', '<view>{{lifecycle.join("|")}}</view>'],
      ['pages/next/index.js', 'Page({})'],
      ['pages/next/index.wxml', '<view>next</view>'],
    ]),
  })
  try {
    const page = session.reLaunch('/pages/index/index')
    await vi.waitFor(() => expect(page.data.lifecycle).toEqual(['page-show', 'method-show', 'lifetime-ready', 'method-ready']))
    await page.openNext()
    expect(page.data.lifecycle).toEqual(['page-show', 'method-show', 'lifetime-ready', 'method-ready', 'page-hide', 'method-hide'])
  }
  finally {
    session.close()
  }
})

it('does not duplicate Component page lifetimes when top-level aliases coexist', async () => {
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/next/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Component({
  data: { lifecycle: [] },
  pageLifetimes: {
    show() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'page-show'] })
    },
    hide() {
      this.setData({ lifecycle: [...this.data.lifecycle, 'page-hide'] })
    },
  },
  onShow() {
    this.setData({ lifecycle: [...this.data.lifecycle, 'top-level-show'] })
  },
  onHide() {
    this.setData({ lifecycle: [...this.data.lifecycle, 'top-level-hide'] })
  },
  methods: {
    openNext() {
      return new Promise((resolve, reject) => {
        wx.navigateTo({ url: '/pages/next/index', success: resolve, fail: reject })
      })
    },
  },
})
`],
      ['pages/index/index.wxml', '<view>{{lifecycle.join("|")}}</view>'],
      ['pages/next/index.js', 'Page({})'],
      ['pages/next/index.wxml', '<view>next</view>'],
    ]),
  })
  try {
    const page = session.reLaunch('/pages/index/index')
    await vi.waitFor(() => expect(page.data.lifecycle).toEqual(['page-show']))
    await page.openNext()
    expect(page.data.lifecycle).toEqual(['page-show', 'page-hide'])
  }
  finally {
    session.close()
  }
})

it('renders a child that reads its Component page context during attachment', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentPageLifecycleFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    for (let index = 0; index < 2; index++) {
      const page = session.reLaunch('/pages/index/index')
      await expect.poll(() => page.snapshot()).toEqual(componentPageLifecycleTrace)
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#injected-value')?.textContent).toBe('page-provide-value')
      const trace = preview.querySelector('#lifecycle-trace')?.textContent?.split('|') ?? []
      expect(trace).toEqual(componentPageLifecycleTrace)
      session.reLaunch('/pages/empty/index')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#injected-value')).toBeNull()
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})

it.each([
  ['page', false, false],
  ['page', true, false],
  ['component', false, false],
  ['component', true, false],
  ['page', false, true],
  ['page', true, true],
  ['component', false, true],
  ['component', true, true],
] as const)('synchronizes %s attachment bindings with hidden=%s and insert=%s before descendant attachment', (owner, hidden, insert) => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createAttachmentBindingFiles(owner, hidden, insert)) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.readTrace()).toEqual(insert ? attachmentBindingTrace.slice(1) : attachmentBindingTrace)
    preview.innerHTML = session.renderCurrentPage().wxml
    if (hidden) {
      expect(preview.querySelector('#bound-model')).toBeNull()
    }
    else {
      expect(preview.querySelector('#bound-model')?.textContent).toBe('bound')
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})

it.each(['clamp', 'detach'] as const)('renders reentrant %s updates without replaying observers or teardown', async (scenario) => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createAttachmentReentryFiles(scenario)) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    if (scenario === 'detach') {
      page.trigger()
    }
    preview.innerHTML = session.renderCurrentPage().wxml
    const expected = scenario === 'clamp' ? attachmentClampTrace : attachmentDetachTrace
    expect(page.readTrace()).toEqual(expected)
    if (scenario === 'clamp') {
      expect(preview.querySelector('#clamped')?.textContent).toBe('100')
    }
    else {
      expect(preview.querySelector('#retained')?.textContent).toBe('B')
      expect(preview.querySelector('#removed')).toBeNull()
    }
    const completion = Promise.withResolvers<void>()
    session.requestRender(completion.resolve)
    await completion.promise
    expect(page.readTrace()).toEqual(expected)
  }
  finally {
    session.close()
    preview.remove()
  }
})

it.each(['existing', 'inserted', 'loop', 'unprojected'] as const)('renders the latest nested owner write across %s bindings', (scenario) => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createAttachmentOwnerWriteFiles(scenario)) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    const snapshot = page.snapshot() as { after: number[], delivered: number[], attached: Record<string, number[]> }
    expect(snapshot.after).toEqual([2, 2])
    expect(snapshot.attached).toEqual({ first: [2], second: [2] })
    expect(snapshot.delivered.at(-1)).toBe(2)
    expect(snapshot.delivered.slice(snapshot.delivered.indexOf(2))).not.toContain(1)
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#latest-owner-value')?.textContent ?? null).toBe(scenario === 'unprojected' ? null : '2')
  }
  finally {
    session.close()
    preview.remove()
  }
})

it.each(['middle', 'leaf'] as const)('renders complete private bindings after %s created writes', (writer) => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createAttachmentCreatedWriteFiles(writer)) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.snapshot()).toEqual({
      created: [['first', 'second']],
      observed: [[['first', 'bound'], ['second', 'bound']]],
      attached: { first: ['bound'], second: ['bound'] },
    })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#created-write-first')?.textContent).toBe('bound')
    expect(preview.querySelector('#created-write-second')?.textContent).toBe('bound')
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('renders a sibling batch after every attachment write and before ready', async () => {
  const rows = Array.from({ length: 32 }, (_, index) => index)
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createAttachmentBatchFiles(rows.length)) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    await expect.poll(() => page.snapshot()).toEqual([
      ...rows.flatMap(row => [['attached', row], ['after', row, true]]),
      ...rows.map(row => ['ready', row]),
    ])
    preview.innerHTML = session.renderCurrentPage().wxml
    expect([...preview.querySelectorAll('[id^="batch-"]')].map(node => node.textContent)).toEqual(rows.map(() => 'true'))
  }
  finally {
    session.close()
    preview.remove()
  }
})
