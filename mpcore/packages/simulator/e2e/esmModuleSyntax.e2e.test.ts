import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { esmModuleCycleFiles, esmModuleInitialState, esmModuleLiveFiles, esmModuleRuntimePreludeFiles, esmModuleSyntaxCases, esmModuleSyntaxFiles } from '../test/helpers/esmModuleSyntax'

it.each(esmModuleSyntaxCases)('renders $name emitted ESM through the browser session', ({ source }) => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(esmModuleSyntaxFiles(source)) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    expect(session.reLaunch('/pages/index').data.marker).toBe('esm-ready')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#marker')?.textContent).toBe('esm-ready')
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('renders updated live imports after an interaction across named and namespace re-exports', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(esmModuleLiveFiles()) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index')
    expect(page.data).toMatchObject(esmModuleInitialState)
    session.callScopeMethod(null, 'increment', {})
    expect(page.data).toMatchObject({ count: 2, namespaceCount: 2, sharedCount: 2 })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#marker')?.textContent).toBe('2')
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('loads an anonymous default function before a cyclic dependency reads it', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(esmModuleCycleFiles(true)) })
  try {
    expect(session.reLaunch('/pages/index').data.marker).toBe('esm-ready')
    expect(session.renderCurrentPage().wxml).toContain('esm-ready')
  }
  finally {
    session.close()
  }
})

it('loads an emitted runtime export prelude and keeps the finished namespace sealed', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(esmModuleRuntimePreludeFiles()) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    expect(session.reLaunch('/pages/index').data).toMatchObject({ marker: 'esm-ready', installed: 'runtime-ready', readonly: true, extensible: false })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#marker')?.textContent).toBe('esm-ready')
  }
  finally {
    session.close()
    preview.remove()
  }
})
