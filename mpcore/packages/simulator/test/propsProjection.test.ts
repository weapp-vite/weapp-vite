import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createPropsProjectionFiles } from './helpers/propsProjection'

describe.each(['node', 'browser'] as const)('%s compiled props projection (issue #1261)', (provider) => {
  it('keeps safe bindings direct and preserves local state across prop updates and reLaunch', async () => {
    const projectPath = await mkdtemp(path.join(tmpdir(), 'props-projection-'))
    try {
      const { files, bindings } = await createPropsProjectionFiles(provider === 'node' ? projectPath : undefined)
      const navigation = bindings['components/navBar/index']!
      for (const name of ['haveNext', 'havePrev']) {
        expect(navigation.filter(binding => binding.sourceRoots.includes(name)).map(binding => binding.outputPath)).toEqual([name])
      }
      for (const entry of ['components/conflictProbe/index', 'components/mutableProbe/index']) {
        const local = bindings[entry]!.filter(binding => binding.sourceRoots.includes('canvasId'))
        expect(local).toHaveLength(1)
        expect(local[0]!.outputPath).toMatch(/^__wv_bind_/)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      try {
        const page = session.reLaunch('/pages/index/index')
        session.renderCurrentPage()
        const nav = page.selectComponent!('#nav-probe')!
        const probes = ['#conflict-probe', '#mutable-probe'].map(selector => page.selectComponent!(selector)!)
        const checkNavigation = async (current: number, max: number) => {
          await vi.waitFor(() => {
            const rendered = session.renderCurrentPage().wxml
            expect(nav.data).toMatchObject({ current, max, haveNext: current < max, havePrev: current > 1 })
            expect(rendered).toContain(`${current}/${max}`)
          })
        }
        const checkCanvas = async (local: string, parent: string) => {
          await vi.waitFor(() => {
            session.renderCurrentPage()
            for (const probe of probes) {
              expect(probe.properties.canvasId).toBe(parent)
              const entry = probe === probes[0] ? 'components/conflictProbe/index' : 'components/mutableProbe/index'
              const output = bindings[entry]!.find(binding => binding.sourceRoots.includes('canvasId'))!.outputPath
              expect(probe.data[output]).toBe(local)
              expect(probe.data.props.canvasId).toBe(parent)
            }
          })
        }
        await checkNavigation(1, 3)
        await checkCanvas('local-canvas', 'parent-canvas')
        nav.next()
        await checkNavigation(2, 3)
        nav.previous()
        await checkNavigation(1, 3)
        nav.next()
        nav.next()
        await checkNavigation(3, 3)
        page.extendMax()
        await checkNavigation(3, 4)
        nav.next()
        await checkNavigation(4, 4)
        page.updateParentCanvas()
        await checkCanvas('local-canvas', 'updated-parent')
        for (const probe of probes) {
          probe.changeLocal()
        }
        await checkCanvas('changed-local', 'updated-parent')

        const reopened = session.reLaunch('/pages/index/index')
        expect(reopened).not.toBe(page)
        await vi.waitFor(() => {
          session.renderCurrentPage()
          expect(reopened.selectComponent!('#nav-probe')!.data).toMatchObject({ current: 1, max: 3, haveNext: true, havePrev: false })
          for (const [selector, entry] of [
            ['#conflict-probe', 'components/conflictProbe/index'],
            ['#mutable-probe', 'components/mutableProbe/index'],
          ] as const) {
            const probe = reopened.selectComponent!(selector)!
            const output = bindings[entry]!.find(binding => binding.sourceRoots.includes('canvasId'))!.outputPath
            expect(probe.properties.canvasId).toBe('parent-canvas')
            expect(probe.data[output]).toBe('local-canvas')
          }
        })
        expect(session.getDiagnostics()).toEqual([])
      }
      finally {
        session.close()
      }
    }
    finally {
      await rm(projectPath, { recursive: true, force: true })
    }
  })
})

describe.each(['node', 'browser'] as const)('%s compiled mergeModels props projection (issue #1295)', (provider) => {
  it('keeps unrelated bindings direct across updates and fresh page instances', async () => {
    const projectPath = await mkdtemp(path.join(tmpdir(), 'merge-models-projection-'))
    try {
      const { files, bindings } = await createPropsProjectionFiles(provider === 'node' ? projectPath : undefined, 1295)
      const pageBindings = bindings['pages/index/index']!
      for (const name of ['change', 'selectA', 'selectB', 'localVisible', 'localResult', 'hasNext']) {
        expect(pageBindings.filter(binding => binding.sourceRoots.includes(name)).map(binding => binding.outputPath)).toEqual([name])
      }
      const model = pageBindings.find(binding => binding.sourceRoots.includes('modelValue'))
      expect(model?.outputPath).toMatch(/^__wv_bind_/)

      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      try {
        let page = session.reLaunch('/pages/index/index')
        const check = async (updated = false) => {
          await vi.waitFor(() => {
            const rendered = session.renderCurrentPage().wxml
            const values = {
              change: updated ? 'updated-change' : 'change',
              selectA: updated ? 'updated-a' : 'selectA',
              selectB: updated ? 'updated-b' : 'selectB',
              localVisible: !updated,
              localResult: updated ? 'updated-result' : 'localResult',
              hasNext: !updated,
            }
            expect(page.data).toMatchObject(values)
            for (const [selector, name] of [
              ['model-value', model!.outputPath],
              ['change', 'change'],
              ['select-a', 'selectA'],
              ['select-b', 'selectB'],
              ['local-visible', 'localVisible'],
              ['local-result', 'localResult'],
              ['has-next', 'hasNext'],
            ]) {
              const text = selector === 'model-value' ? 'modelValue' : page.data[name!]
              expect(rendered).toMatch(new RegExp(`id="${selector}"[^>]*>${text}<\\/text>`))
            }
            expect(page.data[model!.outputPath]).toBe('modelValue')
          })
        }
        await check()
        page.changeBindings()
        await check(true)
        const previous = page
        page = session.reLaunch('/pages/index/index')
        expect(page).not.toBe(previous)
        await check()
        expect(session.getDiagnostics()).toEqual([])
      }
      finally {
        session.close()
      }
    }
    finally {
      await rm(projectPath, { recursive: true, force: true })
    }
  })
})
