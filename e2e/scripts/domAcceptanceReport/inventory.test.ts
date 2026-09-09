import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertDomAcceptanceInventoryComplete } from './inventory'
import { analyzeCaseSource, importedTestSources } from './inventoryAnalyzer'
import { collectInventorySources } from './inventorySources'

describe('static DOM plan inventory', () => {
  it.each(['casesMissingPlan', 'unresolvedParameterizations', 'tasksWithoutCaseDeclarations'] as const)('rejects a regenerated but incomplete inventory: %s', (field) => {
    const summary = {
      taskCount: 1,
      wechatTaskCount: 1,
      outOfScopeTaskCount: 0,
      expandedCaseDeclarations: 1,
      casesWithPlan: 1,
      casesMissingPlan: 0,
      unresolvedParameterizations: 0,
      tasksWithoutCaseDeclarations: 0,
    }
    expect(() => assertDomAcceptanceInventoryComplete({ summary })).not.toThrow()
    expect(() => assertDomAcceptanceInventoryComplete({ summary: { ...summary, [field]: 1 } })).toThrow('DOM inventory incomplete')
  })
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

  it('follows called local closures but does not count uncalled nested registrations', () => {
    const cases = analyzeCaseSource(`
      it('unused', ctx => {
        function unused() { createDomAcceptance(ctx, 'unused-function', []) }
        const unusedArrow = () => createDomAcceptance(ctx, 'unused-arrow', [])
        const unusedExpression = function () { createDomAcceptance(ctx, 'unused-expression', []) }
      })
      it('called', ctx => {
        const register = () => createDomAcceptance(ctx, 'e2e-apps/base', PLAN)
        const check = id => dom.check(id, app, page)
        register()
        check('mounted')
        check('updated')
      })
    `, 'e2e/ide/closures.test.ts')
    expect(cases.map(item => item.plans.length)).toEqual([0, 1])
    expect(cases[1]?.operations).toEqual(['check(mounted)', 'check(updated)'])
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

  it.each(['each', 'for'])('expands template %s invocation names but labels unresolved dynamic tables', (method) => {
    const content = `it.${method}(ACTIVE_TEMPLATE_CASES)('$name renders', async () => {})`
    expect(analyzeCaseSource(content, 'e2e/ide/template.test.ts', ['template-a', 'template-b']).map(item => item.name)).toEqual(['template-a renders', 'template-b renders'])
    expect(analyzeCaseSource(content, 'e2e/ide/template.test.ts')[0]?.notes).toContain(`Dynamic ${method} table: it.${method}(ACTIVE_TEMPLATE_CASES)`)
  })

  it('expands aliased generic for calls and retains context-based template registrations', () => {
    const cases = analyzeCaseSource(`
      import { test as scenario } from 'vitest'
      scenario.skip.for<TemplateCase> (ACTIVE_TEMPLATE_CASES)('$name renders', async (templateCase, ctx) => {
        await runTemplateE2E({ context: ctx, templateRoot: ROOT, acceptance: TEMPLATE_DOM })
      })
    `, 'e2e/ide/template.test.ts', ['template-a', 'template-b'])
    expect(cases.map(item => item.name)).toEqual(['template-a renders', 'template-b renders'])
    expect(cases.map(item => item.plans[0]?.registration)).toEqual(['runTemplateE2E', 'runTemplateE2E'])
    expect(cases.every(item => item.notes.some(note => note.includes('skip')))).toBe(true)
    expect(cases.every(item => item.notes.every(note => !note.startsWith('Dynamic')))).toBe(true)
  })

  it('does not infer parameterization from an argument expression', () => {
    const cases = analyzeCaseSource(`
      it.skipIf(enabled.for(TABLE))('single case', async () => {})
    `, 'e2e/ide/template.test.ts', ['template-a', 'template-b'])
    expect(cases.map(item => item.name)).toEqual(['single case'])
    expect(cases[0]?.notes.every(note => !note.startsWith('Dynamic'))).toBe(true)
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

  it('expands each local fixture factory invocation with its own name and plan', () => {
    const cases = analyzeCaseSource(`
      function createSuite(options) {
        const { suiteName, fixture, checkpoints, routes } = options
        function navigate(route) { return app.reLaunch(route) }
        describe(suiteName, () => {
          it('renders', async ctx => {
            createDomAcceptance(ctx, fixture, checkpoints)
            for (const route of routes) { await navigate(route.path) }
          })
        })
      }
      createSuite({ suiteName: 'complex A', fixture: 'e2e-apps/a', checkpoints: A_DOM, routes: [{ path: '/pages/main' }, { path: '/sub/a' }] })
      createSuite({ suiteName: 'complex B', fixture: 'e2e-apps/b', checkpoints: B_DOM, routes: [{ path: '/pages/home' }, { path: '/sub/b' }] })
    `, 'e2e/ide/complex.test.ts')
    expect(cases.map(item => item.name)).toEqual(['complex A > renders', 'complex B > renders'])
    expect(cases.map(item => item.plans[0]?.fixture)).toEqual(['e2e-apps/a', 'e2e-apps/b'])
    expect(cases.map(item => item.routes)).toEqual([['/pages/main', '/sub/a'], ['/pages/home', '/sub/b']])
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
