import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { cleanupTempDirs } from './helpers'
import { tdesignStyleBindingFiles, tdesignStyleProbes, tdesignStyleRoute, tdesignStyleScenarios } from './helpers/tdesignStyleBindings'

describe('TDesign native class/style boundary', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  for (const provider of ['node', 'browser'] as const) {
    it(`replaces all ten probes through five scenarios without stale class/style values in ${provider}`, async () => {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-tdesign-style-'))
      directories.push(projectPath)
      for (const [file, source] of tdesignStyleBindingFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(tdesignStyleBindingFiles) })
      try {
        const page = session.reLaunch(tdesignStyleRoute)
        for (const state of tdesignStyleScenarios) {
          if (state.method) {
            page[state.method]()
          }
          const root = new HeadlessTestingNodeHandle(session.renderCurrentPage().root)
          expect(await root.$$('[id^="class-binding-probe-"]')).toHaveLength(10)
          expect(await (await root.$('#scenario-state'))?.text()).toBe(state.id)
          for (const [key, title] of tdesignStyleProbes) {
            const probe = await root.$(`#class-binding-probe-${key}`)
            expect(await probe?.text()).toBe(title)
          }
          const classProbe = async (key: string, name: string) => String(await (await root.$(`#class-binding-probe-${key}`))?.attr('class')).split(/\s+/).includes(name)
          for (const key of ['class-object', 'class-static-object', 'class-reactive', 'class-array', 'class-cond-array', 'class-array-key']) {
            expect(await classProbe(key, 'demo-active')).toBe(state.active)
            expect(await classProbe(key, 'text-danger')).toBe(key === 'class-object' ? false : state.error)
            expect(await classProbe(key, 'demo-ghost')).toBe(key === 'class-static-object' || (['class-reactive', 'class-array-key'].includes(key) && state.ghost))
            expect(await classProbe(key, 'demo-round')).toBe(['class-reactive', 'class-array'].includes(key) && state.round)
          }
          const style = async (key: string) => await (await root.$(`#class-binding-probe-${key}`))?.attr('style')
          expect(await style('style-object')).toContain(`border-radius:${state.round ? 999 : 18}rpx;`)
          expect(await style('style-object')).toContain(`border-style:${state.ghost ? 'dashed' : 'solid'};`)
          expect(await style('style-array')).toContain(`opacity:${state.ghost ? '0.78' : '1'};border-radius:${state.round ? 999 : 18}rpx;`)
          expect(await style('style-string')).toContain(`font-size:${state.active ? 26 : 24}rpx;`)
          expect(await style('style-var')).toBe(`--lab-accent:${state.error ? '#ef4444' : '#2563eb'};color:var(--lab-accent);border-color:var(--lab-accent);`)
          expect(session.getCurrentPages()[0]).toBe(page)
        }
      }
      finally {
        session.close()
      }
    })
  }
})
