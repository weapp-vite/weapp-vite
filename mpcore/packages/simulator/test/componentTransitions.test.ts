import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createComponentInstance, runComponentLifecycle } from '../src/runtime/componentInstance'
import { cleanupTempDirs } from './helpers'
import { componentTransitionFiles } from './helpers/componentTransitions'

it('resolves named observers with new and previous nested property values', () => {
  const events: unknown[] = []
  const instance = createComponentInstance({
    definition: {
      properties: { options: { type: Object, value: { title: 'initial' }, observer: 'onOptions' } },
      methods: {
        onOptions(value: unknown, oldValue: unknown) { events.push({ value, oldValue }) },
      },
    },
  })
  instance.setData({ 'options.title': 'updated' })
  expect(instance.properties.options).toEqual({ title: 'updated' })
  expect(events).toEqual([{ value: { title: 'updated' }, oldValue: { title: 'initial' } }])
})

it('prefers lifetimes within each definition without discarding behavior callbacks', () => {
  const events: string[] = []
  const instance = createComponentInstance({
    definition: {
      behaviors: [{
        __isHeadlessBehavior__: true,
        attached() { events.push('legacy-behavior') },
        lifetimes: { attached() { events.push('behavior') } },
      }],
      attached() { events.push('legacy-component') },
      lifetimes: { attached() { events.push('component') } },
    },
  })
  runComponentLifecycle(instance, 'attached')
  expect(events).toEqual(['behavior', 'component'])
})

describe.each(['node', 'browser'] as const)('%s component transition observers', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSession() {
    if (provider === 'browser') {
      return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentTransitionFiles) })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-transitions-'))
    directories.push(projectPath)
    for (const [file, source] of componentTransitionFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  it('runs behavior and component lifetimes and renders API-driven property changes', () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      expect(session.renderCurrentPage().wxml).not.toContain('id="dialog-title"')
      const dialog = page.selectComponent!('#dialog')
      expect(session.getApp()?.globalData.events).toEqual(['behavior-created', 'component-created', 'behavior-attached', 'component-attached'])
      dialog.setData({ visible: true, label: 'Confirm dialog' })
      expect(dialog.properties).toMatchObject({ visible: true, label: 'Confirm dialog' })
      expect(session.renderCurrentPage().wxml).toContain('>Confirm dialog<')
      page.setData({ unrelated: 1 })
      expect(session.renderCurrentPage().wxml).toContain('>Confirm dialog<')
      page.setData({ label: 'Parent update' })
      expect(session.renderCurrentPage().wxml).toContain('>Parent update<')
      dialog.close()
      expect(session.renderCurrentPage().wxml).not.toContain('id="dialog-title"')
      expect(session.getApp()?.globalData.events.slice(-2)).toEqual(['visible:false:true', 'visible:true:false'])
      const app = session.getApp()
      session.close()
      expect(app?.globalData.events.slice(-2)).toEqual(['behavior-detached', 'component-detached'])
    }
    finally {
      session.close()
    }
  })
})
