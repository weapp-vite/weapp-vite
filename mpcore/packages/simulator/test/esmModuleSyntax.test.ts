import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { transformMiniProgramModule } from '../src/runtime/moduleSyntax'
import { esmModuleCycleFiles, esmModuleInitialState, esmModuleLiveFiles, esmModuleRuntimePreludeFiles, esmModuleSyntaxCases, esmModuleSyntaxFiles } from './helpers/esmModuleSyntax'

describe.each(['node', 'browser'] as const)('%s static module syntax', (provider) => {
  function withSession(files: Array<[string, string]>, check: (session: ReturnType<typeof createHeadlessSession> | ReturnType<typeof createBrowserHeadlessSession>) => void) {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-esm-syntax-'))
    for (const [file, content] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, content)
    }
    const session = provider === 'browser'
      ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      : createHeadlessSession({ projectPath })
    try {
      check(session)
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  }

  it.each(esmModuleSyntaxCases)('loads $name ESM artifacts without depending on line formatting', ({ source }) => {
    withSession(esmModuleSyntaxFiles(source), (session) => {
      const page = session.reLaunch('/pages/index')
      expect(page.data.marker).toBe('esm-ready')
      expect(session.renderCurrentPage().wxml).toContain('esm-ready')
    })
  })

  it('keeps live imports and re-exports, lexical shadowing, readonly bindings and strict module this', () => {
    withSession(esmModuleLiveFiles(), (session) => {
      const page = session.reLaunch('/pages/index')
      expect(page.data).toMatchObject(esmModuleInitialState)
      page.increment()
      expect(page.data).toMatchObject({ count: 2, namespaceCount: 2, sharedCount: 2 })
      expect(session.renderCurrentPage().wxml).toContain('2')
    })
  })

  it('executes a bundled runtime export prelude before sealing the completed module namespace', () => {
    withSession(esmModuleRuntimePreludeFiles(), (session) => {
      expect(session.reLaunch('/pages/index').data).toMatchObject({ marker: 'esm-ready', installed: 'runtime-ready', readonly: true, extensible: false })
    })
  })

  it.each([
    ['parenthesized expression', 'export default ("esm-ready");'],
    ['commented expression', 'export /* default is a comment */ default /* value */ ((("esm-ready")));'],
    ['named declaration', 'export default function marker() { return "esm-ready"; }'],
    ['anonymous declaration', 'export default function() { return "esm-ready"; }'],
  ])('preserves default export syntax: %s', (_name, shared) => {
    const files = esmModuleSyntaxFiles('import value from "../shared.js"; Page({ data: { marker: typeof value === "function" ? value() : value } });')
      .map(([file, content]): [string, string] => [file, file === 'shared.js' ? shared : content])
    withSession(files, (session) => {
      expect(session.reLaunch('/pages/index').data.marker).toBe('esm-ready')
    })
  })

  it.each([false, true])('initializes cyclic static dependencies before reading their hoisted functions (anonymous default: %s)', (anonymousDefault) => {
    withSession(esmModuleCycleFiles(anonymousDefault), (session) => {
      expect(session.reLaunch('/pages/index').data.marker).toBe('esm-ready')
    })
  })
})

describe('static module transformation boundary', () => {
  it('returns CommonJS bytes unchanged even when comments or literals mention module syntax', () => {
    const source = '/* export default */ const text = "import { untouched } from \\\"module\\\""; module.exports = { text }; return;'
    expect(transformMiniProgramModule(source)).toBe(source)
  })

  it.each([
    ['export {}; await Promise.resolve();', 'Top-level await'],
    ['export {}; import("./dynamic.js");', 'Dynamic import'],
    ['export default import.meta.url;', 'import.meta'],
    ['import value from "./data.json" with { type: "json" }; export { value };', 'Import attributes'],
  ])('rejects unsupported synchronous semantics: %s', (source, reason) => {
    expect(() => transformMiniProgramModule(source)).toThrow(reason)
  })
})
