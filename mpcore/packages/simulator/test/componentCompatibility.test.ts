import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'

const projectFiles = [
  ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/empty/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({
    usingComponents: {
      'forward-host': '/components/forward-host',
      'generic-host': '/components/generic-host',
      'projected-target': '/components/projected-target',
      'selector-host': '/components/selector-host',
      'slot-content': '/components/slot-content',
      'slot-host': '/components/slot-host',
    },
  })],
  ['pages/index/index.js', `
Page({
  data: {
    __wvOwnerId: 'owner-1',
    deviceCanIUse: false,
    deviceInfo: null,
    componentIs: '',
    enabled: false,
    eventValue: '',
    forwardedFound: false,
    initialFallbackSize: -1,
    nestedFound: false,
    ownerAvailableDuringAttached: false,
    queryId: '',
    projectedRendered: false,
    slotEventValue: '',
    slotFound: false,
    slotLabel: 'projected',
    scopedSelection: '',
    scopedOwnNode: '',
  },
  onSlotChange(event) {
    this.setData({ eventValue: event.detail.value })
  },
  onProjectedChange(event) {
    this.setData({ slotEventValue: event.detail.value })
  },
  onProjectedRendered(event) {
    this.setData({ projectedRendered: event.detail.value })
  },
  inspectCompatibility() {
    const booleanTarget = this.selectComponent('#boolean-target')
    const target = this.selectComponent('#nested-target')
    let queryId = ''
    wx.createSelectorQuery()
      .in({ $: target, $el: target })
      .select('#inner-target')
      .fields({ id: true }, (result) => {
        queryId = result?.id || ''
      })
      .exec()
    target?.emitChange()
    const slotHost = this.selectComponent('#slot-host')
    const projectedTarget = slotHost?.selectComponent('#projected-target')
    const forwardHost = this.selectComponent('#forward-host')
    const forwardedTarget = forwardHost?.selectComponent('#forwarded-target')
    const selectorHost = this.selectComponent('#selector-host')
    selectorHost?.inspectSelection()
    projectedTarget?.emitChange()
    projectedTarget?.show()
    this.setData({
      deviceCanIUse: wx.canIUse('getDeviceInfo.return.model'),
      deviceInfo: wx.getDeviceInfo(),
      componentIs: target?.is || '',
      enabled: Boolean(booleanTarget?.properties.enabled),
      forwardedFound: Boolean(forwardedTarget),
      initialFallbackSize: booleanTarget?.data.initialFallbackSize ?? -1,
      nestedFound: Boolean(target),
      ownerAvailableDuringAttached: Boolean(target?.data.ownerAvailable),
      queryId,
      scopedOwnNode: booleanTarget?.inspectOwnNode?.() || '',
      scopedSelection: selectorHost?.data.scopedSelection || '',
      slotFound: Boolean(projectedTarget),
    })
  },
  scheduleDetachedQuery() {
    return this.selectComponent('#nested-target')?.queryAfterDetach()
  },
})
`],
  ['pages/index/index.wxml', `
<generic-host
  id="boolean-target"
  __wvSlotOwnerId="{{__wvSlotOwnerId || __wvOwnerId || ''}}"
  bindslotchange="onSlotChange"
  enabled
  items="{{missingItems}}"
  metadata="{{ {default:true} }}"
  generic:content="slot-content"
/>
<slot-host id="slot-host" show-content>
  <projected-target id="projected-target" label="{{slotLabel}}" bindchange="onProjectedChange" bindrendered="onProjectedRendered" />
  <view id="named-slot" slot="footer">footer-{{slotLabel}}</view>
</slot-host>
<forward-host id="forward-host">
  <projected-target id="forwarded-target" label="{{slotLabel}}" />
</forward-host>
<selector-host id="selector-host" />
`],
  ['components/generic-host.json', JSON.stringify({
    component: true,
    componentGenerics: {
      content: {
        default: './default-content',
      },
    },
  })],
  ['components/generic-host.js', `
Component({
  data: {
    visible: false,
  },
  data: {
    structurallyStableObserverCalls: 0,
  },
  properties: {
    __wvSlotOwnerId: {
      type: String,
      value: '',
    },
    enabled: {
      type: Boolean,
      optionalTypes: [null],
      value: false,
    },
    metadata: {
      type: Object,
      value: null,
      observer() {
        this.data.structurallyStableObserverCalls += 1
      },
    },
    items: {
      type: Array,
      value: () => [],
    },
    optionalObject: Object,
  },
  lifetimes: {
    attached() {
      this.setData({
        initialFallbackSize: this.properties.items.length,
      })
    },
  },
  methods: {
    inspectOwnNode() {
      let id = ''
      wx.createSelectorQuery()
        .in(this)
        .select('#generic-own-node')
        .fields({ id: true }, result => {
          id = result?.id || ''
        })
        .exec()
      return id
    },
  },
})
`],
  ['components/generic-host.wxml', '<view id="generic-own-node">own</view><content wx:if="{{__wvSlotOwnerId}}" />'],
  ['components/default-content.json', JSON.stringify({ component: true })],
  ['components/default-content.js', 'Component({})'],
  ['components/default-content.wxml', '<view wx:if="{{false}}" />'],
  ['components/slot-host.json', JSON.stringify({ component: true })],
  ['components/slot-host.js', 'Component({ properties: { showContent: Boolean } })'],
  ['components/slot-host.wxml', '<view id="default-slot"><block wx:if="{{showContent}}"><slot><text id="slot-fallback">fallback</text></slot></block></view><view id="footer-slot"><slot name="footer" /></view>'],
  ['components/projected-target.json', JSON.stringify({ component: true })],
  ['components/projected-target.js', `
Component({
  properties: {
    label: String,
  },
  methods: {
    emitChange() {
      this.triggerEvent('change', { value: this.properties.label })
    },
    show() {
      this.setData({ visible: true }, () => {
        this.triggerEvent('rendered', { value: true })
      })
    },
  },
})
`],
  ['components/projected-target.wxml', '<view id="projected-label">{{label}}<text wx:if="{{visible}}">projected-visible</text></view>'],
  ['components/selector-host.json', JSON.stringify({
    component: true,
    usingComponents: {
      'selector-nested-host': './selector-nested-host',
      'selector-target': './selector-target',
    },
  })],
  ['components/selector-host.js', `
Component({
  data: {
    scopedSelection: '',
  },
  methods: {
    inspectSelection() {
      const target = this.selectComponent('.shared-ref')
      this.setData({ scopedSelection: target?.properties.label || '' })
    },
  },
})
`],
  ['components/selector-host.wxml', '<selector-nested-host /><selector-target class="shared-ref" label="direct" />'],
  ['components/selector-nested-host.json', JSON.stringify({
    component: true,
    usingComponents: {
      'selector-target': './selector-target',
    },
  })],
  ['components/selector-nested-host.js', 'Component({})'],
  ['components/selector-nested-host.wxml', '<selector-target class="shared-ref" label="nested" />'],
  ['components/selector-target.json', JSON.stringify({ component: true })],
  ['components/selector-target.js', 'Component({ properties: { label: String } })'],
  ['components/selector-target.wxml', '<view>{{label}}</view>'],
  ['components/forward-host.json', JSON.stringify({
    component: true,
    usingComponents: {
      'forward-slot': './forward-slot',
      'transition-host': './transition-host',
    },
  })],
  ['components/forward-host.js', 'Component({})'],
  ['components/forward-host.wxml', '<transition-host generic:scoped-slots-default="forward-slot" />'],
  ['components/transition-host.json', JSON.stringify({
    component: true,
    componentGenerics: {
      'scoped-slots-default': true,
    },
  })],
  ['components/transition-host.js', 'Component({})'],
  ['components/transition-host.wxml', '<scoped-slots-default />'],
  ['components/forward-slot.json', JSON.stringify({ component: true })],
  ['components/forward-slot.js', 'Component({})'],
  ['components/forward-slot.wxml', '<slot />'],
  ['components/slot-content.json', JSON.stringify({
    component: true,
    usingComponents: {
      'nested-target': '/components/nested-target',
    },
  })],
  ['components/slot-content.js', `
Component({
  methods: {
    forwardChange(event) {
      this.triggerEvent('slotchange', event.detail, {
        bubbles: true,
        composed: true,
      })
    },
  },
})
`],
  ['components/slot-content.wxml', '<nested-target id="nested-target" bindchange="forwardChange" />'],
  ['components/nested-target.json', JSON.stringify({ component: true })],
  ['components/nested-target.js', `
const shared = require('./shared-target')
exports.default = shared.definition
`],
  ['components/nested-target.wxml', '<view id="inner-target" style="width: 80px; height: 32px;">nested</view>'],
  ['components/shared-target.js', `
const definition = {
  data: {
    label: 'nested',
  },
}
const registeredDefinition = {
  ...definition,
  lifetimes: {
    attached() {
      this.setData({
        ownerAvailable: Boolean(this.selectOwnerComponent()),
      })
    },
  },
  methods: {
    emitChange() {
      this.triggerEvent('change', { value: 'changed' })
    },
    queryAfterDetach() {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            wx.createSelectorQuery()
              .in(this)
              .select('#inner-target')
              .fields({ id: true }, result => resolve(result?.id || ''))
              .exec()
          }
          catch (error) {
            reject(error)
          }
        }, 20)
      })
    },
  },
}
Component(registeredDefinition)
exports.definition = definition
`],
  ['pages/empty/index.json', '{}'],
  ['pages/empty/index.js', 'Page({})'],
  ['pages/empty/index.wxml', '<view id="empty-page">empty</view>'],
] satisfies Array<[string, string]>

function createFilesystemProject() {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-compatibility-'))
  fs.writeFileSync(path.join(projectPath, 'project.config.json'), JSON.stringify({
    appid: 'wx1234567890abcdef',
    miniprogramRoot: 'dist/',
  }))
  for (const [relativePath, source] of projectFiles) {
    const target = path.join(projectPath, 'dist', relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  return projectPath
}

function expectCompatibilityResult(page: Record<string, any>) {
  expect(page.data).toMatchObject({
    deviceCanIUse: true,
    componentIs: 'components/nested-target',
    enabled: true,
    eventValue: 'changed',
    forwardedFound: true,
    initialFallbackSize: 0,
    nestedFound: true,
    ownerAvailableDuringAttached: true,
    projectedRendered: true,
    queryId: 'inner-target',
    scopedOwnNode: 'generic-own-node',
    scopedSelection: 'direct',
    slotEventValue: 'projected',
    slotFound: true,
  })
  expect(page.data.deviceInfo).toMatchObject({
    brand: 'devtools',
    model: 'headless-simulator',
    platform: 'devtools',
  })
}

function expectStructurallyStableObjectProperty(page: Record<string, any>) {
  const initialTarget = page.selectComponent('#boolean-target')
  expect(initialTarget?.properties.metadata).toEqual({ default: true })
  expect(initialTarget?.properties.optionalObject).toBeNull()
  expect(initialTarget?.data.structurallyStableObserverCalls).toBe(1)

  page.setData({ unrelatedUpdate: 1 })
  const updatedTarget = page.selectComponent('#boolean-target')
  expect(updatedTarget?.properties.metadata).toEqual({ default: true })
  expect(updatedTarget?.data.structurallyStableObserverCalls).toBe(1)
}

describe('component compatibility', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('supports exported definitions, component generics and proxy selector scopes in the runtime', async () => {
    const projectPath = createFilesystemProject()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })
    const page = session.reLaunch('/pages/index/index')

    expect(page.selectComponent?.('#boolean-target')?.properties.enabled).toBe(true)
    expectStructurallyStableObjectProperty(page)
    page.inspectCompatibility()
    await Promise.resolve()
    await Promise.resolve()

    expectCompatibilityResult(page)
    expect(session.renderCurrentPage().wxml).toContain('footer-projected')
    expect(session.renderCurrentPage().wxml).toContain('projected-visible')
    expect(session.renderCurrentPage().wxml).not.toContain('slot-fallback')
    expect(session.callWxMethod('canIUse', 'getDeviceInfo.return.model')).toBe(true)

    const detachedQuery = page.scheduleDetachedQuery()
    session.reLaunch('/pages/empty/index')
    await expect(detachedQuery).resolves.toBe('inner-target')
  })

  it('supports exported definitions, component generics and proxy selector scopes in the browser runtime', async () => {
    const files = createBrowserVirtualFiles(projectFiles)
    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')

    expect(page.selectComponent?.('#boolean-target')?.properties.enabled).toBe(true)
    expectStructurallyStableObjectProperty(page)
    page.inspectCompatibility()
    await Promise.resolve()
    await Promise.resolve()

    expectCompatibilityResult(page)
    expect(session.renderCurrentPage().wxml).toContain('footer-projected')
    expect(session.renderCurrentPage().wxml).toContain('projected-visible')
    expect(session.renderCurrentPage().wxml).not.toContain('slot-fallback')

    const detachedQuery = page.scheduleDetachedQuery()
    session.reLaunch('/pages/empty/index')
    await expect(detachedQuery).resolves.toBe('inner-target')
  })
})
