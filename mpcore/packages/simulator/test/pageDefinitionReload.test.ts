import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingSessionHandle } from '../src/testing'
import { pageDefinitionFiles, pageDefinitionSource } from './helpers/pageDefinitionReload'

const route = '/pages/index/index'
const entry = 'pages/index/index.js'

function createFixture(provider: 'node' | 'browser', registration: 'page' | 'component' = 'page') {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-page-definition-'))
  const entries = pageDefinitionFiles(registration)
  const files = createBrowserVirtualFiles(entries)
  for (const [file, source] of entries) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const createSession = () => provider === 'node' ? createHeadlessSession({ projectPath }) : createBrowserHeadlessSession({ files })
  const session = createSession()
  return {
    projectPath,
    createSession,
    session,
    write(file: string, source: string) {
      if (provider === 'node') {
        const target = path.join(projectPath, file)
        const stat = fs.statSync(target)
        fs.writeFileSync(target, source)
        fs.utimesSync(target, stat.atime, stat.mtime)
      }
      else {
        files.set(file, source)
      }
    },
    remove(file: string) {
      if (provider === 'node') {
        fs.rmSync(path.join(projectPath, file))
      }
      else {
        files.delete(file)
      }
    },
    close() {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    },
  }
}

describe.each(['node', 'browser'] as const)('%s explicit page definition reload', (provider) => {
  it.each(['page', 'component'] as const)('replaces a changed %s entry by bytes while retaining App, shared modules, other routes and sessions', (registration) => {
    const fixture = createFixture(provider, registration)
    const { session } = fixture
    const other = fixture.createSession()
    try {
      let page = session.reLaunch(route)
      const app = session.getApp()
      const shared = page.shared()
      page.increment()
      session.reLaunch('/pages/other/index')
      page = session.reLaunch(route)
      other.reLaunch(route)
      expect(page.data).toMatchObject({ marker: 'BASE', count: 1 })
      expect(session.reloadPageDefinition(route)).toBe(false)

      fixture.write(entry, pageDefinitionSource('NEXT', registration))
      fixture.write('pages/other/index.js', pageDefinitionSource('EDIT'))
      expect(session.reLaunch(route).data).toMatchObject({ marker: 'BASE', count: 1 })
      const active = session.getCurrentPages()[0]
      expect(session.reloadPageDefinition(route)).toBe(true)
      expect(session.getCurrentPages()[0]).toBe(active)
      expect(active?.data.marker).toBe('BASE')
      page = session.reLaunch(route)
      expect(page.data).toMatchObject({ marker: 'NEXT', count: 1 })
      expect(page.shared()).toBe(shared)
      expect(session.getApp()).toBe(app)
      expect(app?.dependencyLoads).toBe(1)
      expect(session.reLaunch('/pages/other/index').data.marker).toBe('SIDE')
      expect(other.reLaunch(route).data).toMatchObject({ marker: 'BASE', count: 0 })
      expect(other.getApp()?.dependencyLoads).toBe(1)

      fixture.write(entry, pageDefinitionSource('BASE', registration))
      expect(session.reloadPageDefinition('pages/index/index')).toBe(true)
      expect(session.reLaunch(route).data).toMatchObject({ marker: 'BASE', count: 1 })
      expect(session.reloadPageDefinition(route)).toBe(false)
      expect(session.getDiagnostics()).toEqual([])
    }
    finally {
      other.close()
      fixture.close()
    }
  })

  it.each(['page', 'component'] as const)('restores cached definitions after syntax, registration and evaluation failures for a %s entry', (registration) => {
    const fixture = createFixture(provider, registration)
    const { session } = fixture
    try {
      const initial = session.reLaunch(route)
      const app = session.getApp()
      const shared = initial.shared()
      initial.increment()
      session.reLaunch('/pages/other/index')
      session.reLaunch(route)
      const failures = [
        ['Page({', /Unexpected|expected|parse|missing/i],
        ['Page({});Page({})', /Duplicate page registration/],
        ['module.exports={}', /Page\(\) was not registered/],
        ['require(\'../../shared/extra\');Component({});throw new Error(\'candidate-failed\')', /candidate-failed/],
      ] as const
      for (const [source, error] of failures) {
        const active = session.getCurrentPages()[0]
        fixture.write(entry, source)
        expect(() => session.reloadPageDefinition(route)).toThrow(error)
        expect(session.getCurrentPages()[0]).toBe(active)
        const restored = session.reLaunch(route)
        expect(restored.data).toMatchObject({ marker: 'BASE', count: 1 })
        expect(restored.shared()).toBe(shared)
        expect(session.reLaunch('/pages/other/index').data.marker).toBe('SIDE')
        session.reLaunch(route)
      }
      fixture.write(entry, `require('../../shared/extra');${pageDefinitionSource('NEXT', registration)}`)
      expect(session.reloadPageDefinition(route)).toBe(true)
      expect(session.reLaunch(route).data).toMatchObject({ marker: 'NEXT', count: 1 })
      expect(app?.extraLoads).toBe(2)
      expect(app?.dependencyLoads).toBe(1)
      expect(session.getApp()).toBe(app)
    }
    finally {
      fixture.close()
    }
  })

  it('rejects unknown, unloaded, missing and closed targets without navigating', () => {
    const fixture = createFixture(provider)
    const { session } = fixture
    try {
      expect(() => session.reloadPageDefinition(route)).toThrow(/before it is loaded/)
      expect(session.getApp()).toBeNull()
      const page = session.reLaunch(route)
      for (const target of ['', '/unknown', `${route}?value=1`, `${route}#hash`]) {
        expect(() => session.reloadPageDefinition(target)).toThrow()
        expect(session.getCurrentPages()[0]).toBe(page)
      }
      expect(() => session.reloadPageDefinition('/pages/unloaded/index')).toThrow(/before it is loaded/)
      fixture.remove(entry)
      expect(() => session.reloadPageDefinition(route)).toThrow(/Missing page script/)
      expect(session.reLaunch(route).data.marker).toBe('BASE')
      session.close()
      expect(() => session.reloadPageDefinition(route)).toThrow(/closed/i)
    }
    finally {
      fixture.close()
    }
  })
})

it('exposes explicit reload through the async testing handle without implicit navigation', async () => {
  const fixture = createFixture('node')
  const session = createHeadlessSession({ projectPath: fixture.projectPath })
  const handle = new HeadlessTestingSessionHandle(session.project, session)
  try {
    const page = await handle.reLaunch(route)
    fixture.write(entry, pageDefinitionSource('NEXT'))
    await expect(handle.reloadPageDefinition(route)).resolves.toBe(true)
    expect((await handle.currentPage())?.pageId).toBe(page.pageId)
    expect(await page.data('marker')).toBe('BASE')
    expect(await (await handle.reLaunch(route)).data('marker')).toBe('NEXT')
    await expect(handle.reloadPageDefinition(route)).resolves.toBe(false)
    await expect(handle.reloadPageDefinition('/unknown')).rejects.toThrow(/Unknown/)
    await handle.close()
    await expect(handle.reloadPageDefinition(route)).rejects.toThrow(/closed/i)
  }
  finally {
    await handle.close()
    fixture.close()
  }
})
