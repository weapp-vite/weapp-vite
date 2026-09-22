import path from 'node:path'
import ts from 'typescript'
import wevuAutoImports from '../../weapp-vite/src/auto-import-presets/wevu'
import {
  createVueLanguageService,
  findOffset,
  normalizeFileName,
} from './languageService'

function renderAutoImportDeclarations(imports: Record<string, string[]>) {
  const declarations = Object.entries(imports).flatMap(([moduleName, names]) => (
    names.map(name => `  const ${name}: typeof import('${moduleName}').${name}`)
  ))
  return [
    'export {}',
    'declare global {',
    ...declarations,
    '}',
  ].join('\n')
}

function signatureParameterText(
  service: ts.LanguageService,
  fileName: string,
  source: string,
  callee: string,
) {
  const position = findOffset(source, `${callee}(`) + callee.length + 1
  const help = service.getSignatureHelpItems(fileName, position, undefined)
  const signature = help?.items[help.selectedItemIndex]
  return ts.displayPartsToString(signature?.parameters[0]?.displayParts ?? [])
}

function expectRouteFieldCompletions(
  service: ts.LanguageService,
  fileName: string,
  source: string,
  callee: string,
) {
  const position = findOffset(source, `${callee}({`) + callee.length + 2
  const names = service
    .getCompletionsAtPosition(fileName, position, {})
    ?.entries
    .map(entry => entry.name)
  expect(names).toEqual(expect.arrayContaining(['name', 'meta']))
}

function expectChineseMacroHover(
  service: ts.LanguageService,
  fileName: string,
  source: string,
  callee: string,
) {
  const info = service.getQuickInfoAtPosition(fileName, findOffset(source, callee))
  expect(ts.displayPartsToString(info?.documentation ?? []))
    .toMatch(/\p{Script=Han}/u)
}

function expectErrorAt(
  service: ts.LanguageService,
  fileName: string,
  source: string,
  token: string,
) {
  const tokenStart = findOffset(source, `${token}:`)
  const tokenEnd = tokenStart + token.length
  const diagnostics = service.getSemanticDiagnostics(fileName)
  expect(diagnostics.some(diagnostic => (
    diagnostic.category === ts.DiagnosticCategory.Error
    && diagnostic.start !== undefined
    && diagnostic.length !== undefined
    && diagnostic.start <= tokenStart
    && diagnostic.start + diagnostic.length >= tokenEnd
  ))).toBe(true)
}

describe('definePage language tooling', () => {
  it('uses generated globals and published router declarations for IntelliSense and diagnostics', () => {
    const fixtureDir = normalizeFileName(path.resolve('packages/volar/test/fixtures/page-route'))
    const autoImportsFile = `${fixtureDir}/auto-imports.d.ts`
    const globalFile = `${fixtureDir}/Global.vue`
    const globalCompletionFile = `${fixtureDir}/GlobalCompletion.vue`
    const aliasFile = `${fixtureDir}/Alias.vue`
    const aliasCompletionFile = `${fixtureDir}/AliasCompletion.vue`
    const invalidJsonFile = `${fixtureDir}/InvalidJson.vue`
    const invalidLayoutFile = `${fixtureDir}/InvalidLayout.vue`
    const invalidPathFile = `${fixtureDir}/InvalidPath.vue`

    const globalSource = `<script setup lang="ts">
definePage({
  name: 'home',
  meta: { requiresAuth: true },
})
</script>`
    const globalCompletionSource = `<script setup lang="ts">
definePage({

})
</script>`
    const aliasSource = `<script setup lang="ts">
import { definePage as declareRoute } from 'wevu/router'
declareRoute({
  name: 'profile',
  meta: { section: 'account' },
})
</script>`
    const aliasCompletionSource = `<script setup lang="ts">
import { definePage as declareRoute } from 'wevu/router'
declareRoute({

})
</script>`
    const invalidJsonSource = `<script setup lang="ts">
definePage({
  name: 'invalid-json',
  meta: { missing: undefined },
})
</script>`
    const invalidLayoutSource = `<script setup lang="ts">
import { definePage as declareRoute } from 'wevu/router'
declareRoute({
  name: 'invalid-layout',
  layout: false,
})
</script>`
    const invalidPathSource = `<script setup lang="ts">
import { definePage as declareRoute } from 'wevu/router'
declareRoute({
  name: 'invalid-path',
  path: '/pages/invalid/index',
})
</script>`

    const service = createVueLanguageService(new Map([
      [autoImportsFile, renderAutoImportDeclarations(wevuAutoImports)],
      [globalFile, globalSource],
      [globalCompletionFile, globalCompletionSource],
      [aliasFile, aliasSource],
      [aliasCompletionFile, aliasCompletionSource],
      [invalidJsonFile, invalidJsonSource],
      [invalidLayoutFile, invalidLayoutSource],
      [invalidPathFile, invalidPathSource],
    ]))

    expectRouteFieldCompletions(
      service,
      globalCompletionFile,
      globalCompletionSource,
      'definePage',
    )
    expectRouteFieldCompletions(
      service,
      aliasCompletionFile,
      aliasCompletionSource,
      'declareRoute',
    )
    expectChineseMacroHover(service, globalFile, globalSource, 'definePage')
    expectChineseMacroHover(service, aliasFile, aliasSource, 'declareRoute')
    expect(signatureParameterText(service, globalFile, globalSource, 'definePage'))
      .toContain('StaticPageDeclaration')
    expect(signatureParameterText(service, aliasFile, aliasSource, 'declareRoute'))
      .toContain('StaticPageDeclaration')
    expect(service.getSyntacticDiagnostics(globalFile)).toEqual([])
    expect(service.getSemanticDiagnostics(globalFile)).toEqual([])
    expect(service.getSyntacticDiagnostics(aliasFile)).toEqual([])
    expect(service.getSemanticDiagnostics(aliasFile)).toEqual([])
    expectErrorAt(service, invalidJsonFile, invalidJsonSource, 'missing')
    expectErrorAt(service, invalidLayoutFile, invalidLayoutSource, 'layout')
    expectErrorAt(service, invalidPathFile, invalidPathSource, 'path')
  })
})
