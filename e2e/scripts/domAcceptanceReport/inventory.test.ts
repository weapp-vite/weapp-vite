import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeCaseSource, importedTestSources } from './inventoryAnalyzer'
import { collectInventorySources } from './inventorySources'

describe('static DOM plan inventory', () => {
  it('follows invoked local plan helpers and known GitHub wrappers without counting unused helpers', () => {
    const cases = analyzeCaseSource(`
      import { createDomAcceptance } from '../utils/domAcceptance'
      import { runGithubDom as run } from './githubIssuesDom'
      function unused(ctx) { createDomAcceptance(ctx, 'unused', []) }
      function recursive(ctx) { recursive(ctx); createDomAcceptance(ctx, 'e2e-apps/base', []) }
      it('local', ctx => recursive(ctx))
      it('github', ctx => run(ctx, '/pages/issue/index', CHECKPOINTS))
      it('empty', ctx => page.data('text'))
    `, 'e2e/ide/example.test.ts')
    expect(cases.map(item => item.plans.length)).toEqual([1, 1, 0])
    expect(cases[0]?.plans[0]?.fixture).toBe('e2e-apps/base')
    expect(cases[1]?.routes).toEqual(['/pages/issue/index'])
  })

  it('expands literal formats and does not infer coverage from an unused import', () => {
    const cases = analyzeCaseSource(`
      import { createDomAcceptance } from '../utils/domAcceptance'
      const FORMATS = ['esm', 'cjs'] as const
      for (const format of FORMATS) {
        describe(\`runtime [\${format}]\`, () => {
          it('renders', async () => { await page.data('text') })
        })
      }
    `, 'e2e/ide/sample.test.ts')
    expect(cases.map(item => item.name)).toEqual(['runtime [esm] > renders', 'runtime [cjs] > renders'])
    expect(cases.every(item => !item.plans.length)).toBe(true)
  })

  it('records direct, template and behavior registrations separately', () => {
    const cases = analyzeCaseSource(`
      import { createDomAcceptance as register } from '../utils/domAcceptance'
      import { NATIVE_DOM } from '../utils/templateAcceptance/native'
      it('direct', (ctx) => { register(ctx, 'e2e-apps/base', [{ id: 'ready', route: '/pages/index/index', action: 'launch', nodes: [] }]) })
      it('template', (ctx) => { runTemplateE2E({ context: ctx, templateRoot: ROOT, acceptance: NATIVE_DOM }) })
      it('behavior', (ctx) => { withBehaviorPage(ctx, 'use-attrs', [], async () => {}) })
    `, 'e2e/ide/sample.test.ts')
    expect(cases.map(item => item.plans[0]?.registration)).toEqual(['createDomAcceptance', 'runTemplateE2E', 'withBehaviorPage'])
    expect(cases[0]?.routes).toEqual(['/pages/index/index'])
    expect(cases[1]?.plans[0]?.source).toBe('e2e/utils/templateAcceptance/native.ts')
    expect(cases[2]?.routes).toEqual(['/pages/use-attrs/index'])
  })

  it('expands template invocation names but labels unresolved dynamic tables', () => {
    const content = `it.each(ACTIVE_TEMPLATE_CASES)('$name renders', async () => {})`
    expect(analyzeCaseSource(content, 'e2e/ide/template.test.ts', ['template-a', 'template-b']).map(item => item.name)).toEqual(['template-a renders', 'template-b renders'])
    expect(analyzeCaseSource(content, 'e2e/ide/template.test.ts')[0]?.notes).toContain('Dynamic each table: it.each(ACTIVE_TEMPLATE_CASES)')
  })

  it('retains individual route operations within a single case', () => {
    const [item] = analyzeCaseSource(`
      it('navigates', async () => { await app.reLaunch('/pages/a/index'); await app.redirectTo('/pages/b/index') })
    `, 'e2e/ide/sample.test.ts')
    expect(item?.routes).toEqual(['/pages/a/index', '/pages/b/index'])
    expect(item?.operations).toEqual(['reLaunch(/pages/a/index)', 'redirectTo(/pages/b/index)'])
  })

  it('resolves aggregate test imports without treating shared helpers as test children', () => {
    expect(importedTestSources(`import './child.test'; import './other.test.ts'; import './shared'`, 'e2e/ide/aggregate.test.ts')).toEqual(['e2e/ide/child.test.ts', 'e2e/ide/other.test.ts'])
  })

  it('expands factory matrices with the same named rows as the runtime manifest', () => {
    const cases = analyzeCaseSource(`
      function createSuite(suiteName, runtimeCases) {
        describe(suiteName, () => {
          for (const runtimeCase of runtimeCases) {
            it(\`renders \${runtimeCase.id}\`, async () => {})
          }
        })
      }
    `, 'e2e/ide/shared.ts', [], { suiteName: 'matrix', runtimeCases: [{ id: 'hoist' }, { id: 'duplicate' }] })
    expect(cases.map(item => item.name)).toEqual(['matrix > renders hoist', 'matrix > renders duplicate'])
  })

  it('tracks helper changes without treating CRLF as a different inventory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-inventory-sources-'))
    try {
      fs.mkdirSync(path.join(root, 'e2e'))
      fs.writeFileSync(path.join(root, 'e2e/case.ts'), 'import { value } from \'./plan\'\nexport { value }\n')
      fs.writeFileSync(path.join(root, 'e2e/plan.ts'), 'export const value = \'initial\'\n')
      const initial = collectInventorySources(root, ['e2e/case.ts'])
      fs.writeFileSync(path.join(root, 'e2e/case.ts'), 'import { value } from \'./plan\'\r\nexport { value }\r\n')
      expect(collectInventorySources(root, ['e2e/case.ts'])).toEqual(initial)
      fs.writeFileSync(path.join(root, 'e2e/plan.ts'), 'export const value = \'changed\'\n')
      const changed = collectInventorySources(root, ['e2e/case.ts'])
      expect(changed.find(item => item.file === 'e2e/plan.ts')?.sha256).not.toBe(initial.find(item => item.file === 'e2e/plan.ts')?.sha256)
      expect(changed.map(item => item.file)).toEqual(['e2e/case.ts', 'e2e/plan.ts'])
    }
    finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
