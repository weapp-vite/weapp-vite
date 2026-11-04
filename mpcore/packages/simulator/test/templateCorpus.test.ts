import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { createTemplateCorpusFiles, templateCorpusBindingStates, templateCorpusRoutes } from './helpers/templateCorpus'

const fixture = path.resolve(import.meta.dirname, '../../../../e2e-apps/github-issues/fixtures/template-corpus')

it('uses the exact native template corpus fixture sources in both simulator providers', () => {
  for (const [file, source] of createTemplateCorpusFiles()) {
    expect(fs.readFileSync(path.join(fixture, 'src', file), 'utf8'), file).toBe(source)
  }
})

describe.each(['node', 'browser'] as const)('%s native template corpus parity', (provider) => {
  it('preserves adjacent attributes, event datasets and reactive branches across page transitions', async () => {
    const files = createTemplateCorpusFiles()
    let projectPath: string | undefined
    if (provider === 'node') {
      projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-template-corpus-'))
      try {
        const projectConfig = JSON.parse(fs.readFileSync(path.join(fixture, 'project.config.json'), 'utf8')) as Record<string, unknown>
        fs.writeFileSync(path.join(projectPath, 'project.config.json'), JSON.stringify({ ...projectConfig, miniprogramRoot: '.', srcMiniprogramRoot: '.' }))
        for (const [file, source] of files) {
          const target = path.join(projectPath, file)
          fs.mkdirSync(path.dirname(target), { recursive: true })
          fs.writeFileSync(target, source)
        }
      }
      catch (error) {
        fs.rmSync(projectPath, { recursive: true, force: true })
        throw error
      }
    }
    const session = provider === 'browser'
      ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      : createHeadlessSession({ projectPath: projectPath! })
    const render = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
    try {
      const [adjacent, bindings] = templateCorpusRoutes
      session.reLaunch(adjacent)
      const probe = await render().$('#adjacent-probe')
      expect(probe).not.toBeNull()
      expect(await probe!.text()).toBe('adjacent')
      expect(await probe!.attr('data-first')).toBe('one')
      expect(await probe!.attr('data-second')).toBe('two')
      expect(await probe!.attr('data-empty')).toBe('')
      expect(await (await render().$('#adjacent-result'))!.text()).toBe('pending')
      await probe!.tap()
      expect(await (await render().$('#adjacent-result'))!.text()).toBe('one|two|string|')

      session.reLaunch(bindings)
      for (const state of templateCorpusBindingStates) {
        if (state.target) {
          await (await render().$(state.target))!.tap()
        }
        const binding = await render().$('#binding-probe')
        if (state.visible) {
          expect(binding).not.toBeNull()
          expect(await binding!.text()).toBe(`${state.label}:${state.count}`)
          expect(await binding!.attr('class')).toBe(`visible-${state.count}`)
          expect(await binding!.attr('data-value')).toBe(String(state.count + 1))
          expect(await binding!.attr('data-label')).toBe(state.label)
        }
        else {
          expect(binding).toBeNull()
        }
        expect(await (await render().$('#binding-state'))!.text()).toBe(`${state.visible ? 'visible' : 'hidden'}:${state.count}`)
      }
      expect(session.getCurrentPages().map(page => page.route)).toEqual([bindings.slice(1)])
    }
    finally {
      session.close()
      if (projectPath) {
        fs.rmSync(projectPath, { recursive: true, force: true })
      }
    }
  })
})
