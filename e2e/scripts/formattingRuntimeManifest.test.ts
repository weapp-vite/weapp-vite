import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { useIsolatedTopologyTestEnvironment } from '../../scripts/verification/topologyTestFixture'
import { E2E_RUNTIME_PROVIDER_ENV } from '../utils/runtimeProvider'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'
import { readTaskCases } from './domAcceptanceReport/inventory'
import { createInventorySourceReader } from './domAcceptanceReport/inventorySourceReader'
import { readSelectedAcceptanceCases } from './domAcceptanceReport/selectedCases'
import { readPlannedTaskCases } from './domAcceptanceReport/taskCases'
import { getIdeExhaustiveTasks, getSuiteTasks } from './e2e-suite-manifest'
import { CLASSIC_HMR_EXCLUDED_CASES_ENV, CLASSIC_HMR_OUT_OF_SCOPE_TASKS, CLASSIC_HMR_SCOPE_ENV } from './hmrAcceptance/stableScope'
import { CLASSIC_BUILD_CASES, CLASSIC_IDE_CASES } from './hmrAcceptance/stableScopeCases'

const ROOT = path.resolve(import.meta.dirname, '../..')

useIsolatedTopologyTestEnvironment()

describe('template formatting runtime coverage', () => {
  const label = 'ide/template-formatting.runtime.test.ts'
  const expected = [{
    file: `e2e/${label}`,
    name: 'template Oxfmt runtime semantics > preserves branches, loops, whitespace, bind/catch events and WXSS after real formatting',
  }]

  it.each(['ide-full:templates', 'ide-dom-headless', 'ide-headless-full'])(
    'registers the provider-compatible formatting comparison in %s',
    async (suite) => {
      expect((await getSuiteTasks(suite)).filter(task => task.label === label)).toHaveLength(1)
    },
  )

  it('retains the formatting comparison in exhaustive DevTools coverage', () => {
    expect(getIdeExhaustiveTasks().filter(task => task.label === label)).toHaveLength(1)
  })

  it('freezes the complete formatting case outside experimental HMR exclusions', () => {
    const inventory = readTaskCases(ROOT, label)
    expect(inventory.map(({ name }) => ({ file: `e2e/${label}`, name }))).toEqual(expected)
    expect(inventory[0]?.notes).toEqual([])
    // 清单保留跨文件引用及计划表达式；实际常量由下一项源码契约独立核验。
    expect(inventory[0]?.plans).toEqual([expect.objectContaining({
      registration: 'createDomAcceptance',
      fixture: 'FORMATTING_FIXTURE',
      checkpoints: 'FORMATTING_ROUTES.flatMap(route => formattingCheckpoints(route, resolveRuntimeProviderName() === \'devtools\'))',
    })])
    expect(CLASSIC_HMR_OUT_OF_SCOPE_TASKS[label]).toBeUndefined()
    expect(CLASSIC_IDE_CASES[label]).toBeUndefined()
    expect(CLASSIC_BUILD_CASES[label]).toBeUndefined()
  })

  it('freezes the imported fixture definition and both control and formatted routes', () => {
    const readSource = createInventorySourceReader(ROOT)
    const runtimeSource = readSource(`e2e/${label}`)
    const projectImport = runtimeSource.statements.find(statement => ts.isImportDeclaration(statement)
      && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === '../utils/formattingProject')
    const bindings = projectImport && ts.isImportDeclaration(projectImport) ? projectImport.importClause?.namedBindings : undefined
    const importedBindings = bindings && ts.isNamedImports(bindings)
      ? bindings.elements.map(element => ({ imported: element.propertyName?.text ?? element.name.text, local: element.name.text }))
      : []
    expect(importedBindings).toEqual(expect.arrayContaining([
      { imported: 'FORMATTING_FIXTURE', local: 'FORMATTING_FIXTURE' },
      { imported: 'FORMATTING_ROUTES', local: 'FORMATTING_ROUTES' },
    ]))

    const declarations = readSource('e2e/utils/formattingProject.ts').statements.flatMap(statement => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [])
    const fixture = declarations.find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'FORMATTING_FIXTURE')?.initializer
    expect(fixture && ts.isStringLiteral(fixture) ? fixture.text : undefined).toBe('e2e-apps/github-issues/fixtures/formatting-runtime')
    const routesInitializer = declarations.find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'FORMATTING_ROUTES')?.initializer
    const routes = routesInitializer && ts.isAsExpression(routesInitializer) ? routesInitializer.expression : routesInitializer
    expect(routes && ts.isArrayLiteralExpression(routes)
      ? routes.elements.map(element => ts.isStringLiteral(element) ? element.text : undefined)
      : undefined).toEqual(['/pages/raw/index', '/pages/formatted/index'])
  })

  it.each([
    ['ide-full:exhaustive', 'devtools'],
    ['ide-dom-headless', 'headless'],
    ['ide-headless-full', 'headless'],
  ] as const)('preserves the complete formatting task and provider in %s:classic', async (suite, provider) => {
    const original = (await getSuiteTasks(suite, { topology: 'optimized-v1' })).filter(task => task.label === label)
    const supported = (await getSuiteTasks(`${suite}:classic`, { topology: 'optimized-v1' })).filter(task => task.label === label)
    expect(original).toHaveLength(1)
    expect(supported).toEqual(original)
    // 格式化语义独立于 HMR 模式；两个 provider 都执行原始完整用例，不筛选或排除。
    for (const task of [...original, ...supported]) {
      expect(task.outOfScopeReason).toBeUndefined()
      expect(task.acceptanceTemplates).toBeUndefined()
      expect(task.args.some(arg => arg === '-t' || arg.startsWith('--testNamePattern'))).toBe(false)
      expect(task.env?.[E2E_TARGET_FILE_ENV]).toBe(label)
      expect(task.env?.[E2E_RUNTIME_PROVIDER_ENV] ?? 'devtools').toBe(provider)
      expect(task.env?.[CLASSIC_HMR_SCOPE_ENV]).toBeUndefined()
      expect(task.env?.[CLASSIC_HMR_EXCLUDED_CASES_ENV]).toBeUndefined()
      expect(readSelectedAcceptanceCases(task.env)).toBeUndefined()
      expect(await readPlannedTaskCases(task, provider)).toEqual(expected)
    }
  })

  it.each(['hmr-build', 'ide-hmr', 'ide-hmr-headless'])('keeps the formatting comparison outside the HMR-only %s suite', async (suite) => {
    for (const scope of [suite, `${suite}:classic`]) {
      expect((await getSuiteTasks(scope, { topology: 'optimized-v1' })).some(task => task.label === label)).toBe(false)
    }
  })
})
