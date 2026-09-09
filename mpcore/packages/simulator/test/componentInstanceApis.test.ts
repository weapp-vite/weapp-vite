import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPONENT_INSTANCE_API_INITIAL_TRACE } from '../../../../e2e/utils/componentInstanceApiContract'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createComponentInstance } from '../src/runtime/componentInstance'
import { syncComponentRelations } from '../src/runtime/componentInstance/relations'
import { createComponentInstanceApiFiles } from './helpers/componentInstanceApis'

describe.each(['node', 'browser'] as const)('%s component instance APIs', (provider) => {
  it.each([false, true])('links projected descendants, scopes queries, and unlinks removed instances (query during attached: %s)', (queryDuringAttached) => {
    const componentInstanceApiFiles = createComponentInstanceApiFiles(queryDuringAttached)
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-instance-apis-'))
    fs.writeFileSync(path.join(projectPath, 'project.config.json'), '{"appid":"wx1234567890abcdef","miniprogramRoot":"."}')
    for (const [relativePath, source] of componentInstanceApiFiles) {
      const target = path.join(projectPath, relativePath)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentInstanceApiFiles) })
    try {
      const page = session.reLaunch('/pages/index/index')
      const parent = page.selectComponent?.('#parent')
      const child = parent.getRelationNodes('./child')[0]
      expect(child?.is).toBe('components/child')
      expect(child.getRelationNodes('./parent')).toEqual([parent])
      expect(parent.data.queryResult).toBe('parent')
      expect(child.data.queryResult).toBe('child')
      expect(page.snapshot()).toEqual(expect.arrayContaining(['parent:linked:child', 'child:linked:parent']))
      expect(page.snapshot()).toEqual(expect.arrayContaining(['parent:ready:child', 'child:ready:parent']))
      const initial = page.snapshot()
      expect(initial).toEqual(COMPONENT_INSTANCE_API_INITIAL_TRACE)
      expect(initial.filter((event: string) => event.includes(':ready:'))).toEqual(['parent:ready:child', 'child:ready:parent'])
      session.renderCurrentPage()
      session.renderCurrentPage()
      expect(page.snapshot()).toEqual(initial)
      const returned = parent.getRelationNodes('./child')
      returned.length = 0
      expect(parent.getRelationNodes('./child')).toEqual([child])

      page.removeChild()
      session.renderCurrentPage()
      expect(parent.getRelationNodes('./child')).toEqual([])
      expect(child.getRelationNodes('./parent')).toEqual([])
      expect(page.snapshot().slice(initial.length)).toEqual(['child:detached:parent', 'parent:unlinked:none', 'child:unlinked:none'])

      const beforeRestore = page.snapshot().length
      page.restoreChild()
      session.renderCurrentPage()
      expect(page.snapshot().slice(beforeRestore)).toEqual(['child:attached:none', 'parent:linked:child', 'child:linked:parent', 'child:ready:parent'])
      const restored = parent.getRelationNodes('./child')[0]
      expect(restored).not.toBe(child)
      expect(restored.getRelationNodes('./parent')).toEqual([parent])
      session.reLaunch('/pages/empty/index')
      expect(parent.getRelationNodes('./child')).toEqual([])
      expect(restored.getRelationNodes('./parent')).toEqual([])
      expect(session.getApp()?.trace).toEqual(expect.arrayContaining(['parent:detached:child']))
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})

it('requires reciprocal relations, distinguishes direct children, and resolves behavior targets', () => {
  const behavior = { __isHeadlessBehavior__: true }
  const parent = createComponentInstance({ definition: { relations: {
    './child': { type: 'child' },
    'behavior-descendant': { type: 'descendant', target: behavior },
  } } })
  parent.is = 'components/parent'
  const direct = createComponentInstance({ definition: { relations: { './parent': { type: 'parent' } } } })
  direct.is = 'components/child'
  const unrelated = createComponentInstance({ definition: {} })
  unrelated.is = 'components/child'
  const nested = createComponentInstance({ definition: { behaviors: [behavior], relations: { '/components/parent': { type: 'ancestor' } } } })
  nested.is = 'components/child'
  const cache = new Map([
    ['page:index/parent', parent],
    ['page:index/parent/direct', direct],
    ['page:index/parent/unrelated', unrelated],
    ['page:index/parent/direct/nested', nested],
  ])
  syncComponentRelations(cache, new Set(cache.keys()), 'page:index')
  expect(parent.getRelationNodes('./child')).toEqual([direct])
  expect(parent.getRelationNodes('behavior-descendant')).toEqual([nested])
  expect(unrelated.getRelationNodes('./parent')).toEqual([])
  expect(nested.getRelationNodes('/components/parent')).toEqual([parent])
})
