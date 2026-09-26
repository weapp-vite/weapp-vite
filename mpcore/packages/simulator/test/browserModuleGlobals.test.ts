import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

function createSession(pageSource: string, modules: Array<[string, string]>, globals: Record<string, unknown> = {}) {
  return createBrowserHeadlessSession({
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index'] })],
      ['app.js', 'App({})'],
      ['pages/index.js', pageSource],
      ['pages/index.wxml', '<view>{{value}}</view>'],
      ...modules,
    ]),
    globals,
  })
}

describe('browser module live globals', () => {
  it('reads globals added and replaced by a synchronous dependency in the same module', () => {
    const session = createSession(`
      const readVersion = () => version;
      const before = readVersion();
      require('../dependency');
      Page({ data: { before, value: runtimeValue, version: readVersion() } });
    `, [['dependency.js', 'globalThis.runtimeValue = "ready"; globalThis.version = 2;']], { version: 1 })
    try {
      expect(session.reLaunch('/pages/index').data).toMatchObject({ before: 1, value: 'ready', version: 2 })
    }
    finally {
      session.close()
    }
  })

  it('keeps CommonJS parameters and local declarations separate from session globals', () => {
    const session = createSession(`
      'use strict';
      const sharedValue = 'local';
      const dependency = require('../dependency');
      Page({ data: {
        value: sharedValue,
        dependency: dependency.value,
        global: globalThis.sharedValue,
        hidden: typeof dependencyLocal,
        builtIn: Math.max(1, 3),
        filename: __filename,
        moduleType: typeof module.exports,
      } });
    `, [['dependency.js', `
      const dependencyLocal = 'private';
      const sharedValue = 'dependency-local';
      module.exports = { value: sharedValue };
    `]], { sharedValue: 'global', module: 'shadow', require: 'shadow', __filename: 'shadow' })
    try {
      expect(session.reLaunch('/pages/index').data).toMatchObject({
        value: 'local',
        dependency: 'dependency-local',
        global: 'global',
        hidden: 'undefined',
        builtIn: 3,
        filename: '/pages/index.js',
        moduleType: 'object',
      })
    }
    finally {
      session.close()
    }
  })

  it('keeps dynamic global updates and asynchronous closures in their own session', async () => {
    const page = `
      require('../dependency');
      Page({ data: { value: sessionValue }, async refresh() {
        await Promise.resolve();
        sessionValue += ':updated';
        this.setData({ value: sessionValue });
      } });
    `
    const first = createSession(page, [['dependency.js', 'globalThis.sessionValue = "first";']])
    const second = createSession(page, [['dependency.js', 'globalThis.sessionValue = "second";']])
    const hostBefore = Object.getOwnPropertyDescriptor(globalThis, 'sessionValue')
    try {
      const firstPage = first.reLaunch('/pages/index')
      const secondPage = second.reLaunch('/pages/index')
      await firstPage.refresh()
      expect(firstPage.data.value).toBe('first:updated')
      expect(secondPage.data.value).toBe('second')
      await secondPage.refresh()
      expect(secondPage.data.value).toBe('second:updated')
      expect(Object.getOwnPropertyDescriptor(globalThis, 'sessionValue')).toEqual(hostBefore)
    }
    finally {
      first.close()
      second.close()
    }
  })
})
