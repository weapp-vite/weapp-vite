import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createComponentInstance } from '../src/runtime/componentInstance'
import { cleanupTempDirs } from './helpers'
import { behaviorPropertyDeliveryFiles } from './helpers/behaviorPropertyDelivery'
import { initialPropertyDeliveryFiles } from './helpers/initialPropertyDelivery'
import { assertPropertyDeliveryEvents } from './helpers/propertyDeliveryAssertions'

describe('native component shared property data', () => {
  it('shares declared properties and local data while keeping host attributes outside the instance', () => {
    const instance = createComponentInstance({
      definition: { properties: { first: String }, data: { local: 'local-data' } },
      properties: { first: 'OWNER', local: 'host-local', extra: 'attribute-extra' },
    })

    expect(instance.properties).toBe(instance.data)
    expect(instance.properties).toEqual({ first: 'OWNER', local: 'local-data' })
    instance.data.first = 'SELF'
    expect(instance.properties.first).toBe('SELF')
  })

  it('runs data observers for same-value writes without reentering own property observers', () => {
    const events: unknown[] = []
    const instance = createComponentInstance({
      definition: {
        properties: {
          first: { type: String, value: 'OWNER', observer(value: unknown, oldValue: unknown) {
            events.push(['property', value, oldValue])
          } },
        },
        observers: { first(value: unknown) { events.push(['data', value]) } },
      },
    })

    instance.data.first = 'SELF'
    instance.setData({ first: 'SELF' })
    instance.setData({ first: 'SELF' })
    instance.setData({ first: 'SELF-CHANGED' })

    expect(events).toEqual([
      ['data', 'SELF'],
      ['data', 'SELF'],
      ['data', 'SELF-CHANGED'],
      ['property', 'SELF-CHANGED', 'SELF'],
    ])
  })
})

describe.each(['node', 'browser'] as const)('%s component property delivery parity', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSession(files: Array<[string, string]>) {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-property-delivery-'))
    directories.push(projectPath)
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
  }

  it('delivers initial properties in one batch and observes changed self writes once', async () => {
    const session = createSession(initialPropertyDeliveryFiles)
    try {
      const page = session.reLaunch('/pages/index/index')
      const component = page.selectComponent!('#probe')
      expect(component.data).toBe(component.properties)
      assertPropertyDeliveryEvents(session.getApp()!.globalData.propertyEvents, 'initial')
      page.updateBoth()
      session.renderCurrentPage()
      assertPropertyDeliveryEvents(session.getApp()!.globalData.propertyEvents, 'updated')
      await page.writeSelf()
      assertPropertyDeliveryEvents(session.getApp()!.globalData.propertyEvents, 'self-written')
      expect(page.data.first).toBe('OWNER-UPDATED')
      expect(component.data.first).toBe('SELF-CHANGED')
      expect(session.renderCurrentPage().wxml).toContain('>SELF-CHANGED:SLOT-UPDATED<')
    }
    finally {
      session.close()
    }
  })

  it('delivers behavior-declared properties before attached without inspecting method names', () => {
    const session = createSession(behaviorPropertyDeliveryFiles)
    try {
      const page = session.reLaunch('/pages/index/index')
      const component = page.selectComponent!('#probe')
      expect(component.data).toEqual({ first: 'OWNER', attachedFirst: 'OWNER' })
      expect(component.properties).toBe(component.data)
      page.updateFirst()
      expect(session.renderCurrentPage().wxml).toContain('>OWNER-UPDATED:OWNER<')
    }
    finally {
      session.close()
    }
  })

  it('applies behavior definition filters before delivering property observers', () => {
    const session = createSession([
      ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: '.' })],
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.json', JSON.stringify({ usingComponents: { 'computed-probe': '../../components/computed-probe/index' } })],
      ['pages/index/index.js', `Page({
        data: { a: 1, b: 2 },
        update() { this.setData({ a: 3, b: 4 }) },
      })`],
      ['pages/index/index.wxml', '<computed-probe a="{{a}}" b="{{b}}" />'],
      ['components/computed-probe/index.json', '{}'],
      ['components/computed-probe/index.js', `const computedBehavior = Behavior({
        definitionFilter(definition) {
          definition.observers ||= {}
          definition.observers['a, b'] = function (a, b) {
            this.setData({ sum: a + b })
          }
        },
      })
      Component({
        behaviors: [computedBehavior],
        properties: { a: Number, b: Number },
        data: { sum: 0 },
      })`],
      ['components/computed-probe/index.wxml', '<view id="sum">{{sum}}</view>'],
    ])
    try {
      const page = session.reLaunch('/pages/index/index')
      expect(session.renderCurrentPage().wxml).toContain('>3<')
      page.update()
      expect(session.renderCurrentPage().wxml).toContain('>7<')
    }
    finally {
      session.close()
    }
  })

  it('queues observer writes that reenter before an observer commits its snapshot', () => {
    const session = createSession([
      ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: '.' })],
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.json', JSON.stringify({ usingComponents: { 'reentry-probe': '../../components/reentry-probe/index' } })],
      ['pages/index/index.js', `Page({
        data: { source: 1 },
        update() { this.setData({ source: 2 }) },
      })`],
      ['pages/index/index.wxml', '<reentry-probe source="{{source}}" />'],
      ['components/reentry-probe/index.json', '{}'],
      ['components/reentry-probe/index.js', `const behavior = Behavior({
        definitionFilter(definition) {
          let previousSource = 0
          definition.observers ||= {}
          definition.observers['**'] = function () {
            if (this.data.source === previousSource) return
            this.setData({ doubled: this.data.source * 2 })
            previousSource = this.data.source
          }
        },
      })
      Component({
        behaviors: [behavior],
        properties: { source: Number },
        data: { doubled: 0 },
      })`],
      ['components/reentry-probe/index.wxml', '<view id="doubled">{{doubled}}</view>'],
    ])
    try {
      const page = session.reLaunch('/pages/index/index')
      expect(session.renderCurrentPage().wxml).toContain('>2<')
      page.update()
      expect(session.renderCurrentPage().wxml).toContain('>4<')
    }
    finally {
      session.close()
    }
  })
})
