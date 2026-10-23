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
})
