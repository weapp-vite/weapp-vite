import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { parse } from '@weapp-vite/ast/babel'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../plugins/vue/transform/compileVueFile'
import { CompilerDiagnosticError } from '../types/diagnostics'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../utils/babel'
import {
  collectPageMetaCallsFromPrograms,
  extractPageDeclaration,
  extractPageDeclarationWithDependencies,
  mayContainPageDeclaration,
  mayContainPageMeta,
  stripPageDeclaration,
} from './index'

describe('static page declarations', () => {
  it('preserves structured SFC parser errors for page declaration callers', () => {
    const filename = '/project/src/pages/invalid-declaration.vue'
    const source = '<template><view></template><script setup>definePage({ name: "invalid" })</script>'

    try {
      extractPageDeclaration(source, filename)
      throw new Error('Expected page declaration SFC parsing to fail')
    }
    catch (error) {
      expect(error).toBeInstanceOf(CompilerDiagnosticError)
      expect(error).toMatchObject({
        code: 'WV2003',
        severity: 'error',
        filename,
        source: 'sfc',
        cause: expect.objectContaining({ code: 24 }),
        loc: expect.objectContaining({
          start: { offset: 10, line: 1, column: 11 },
        }),
      })
    }
  })

  it('extracts a finite route declaration without crossing into page metadata', () => {
    const source = `<script setup lang="ts">
import { definePage as page } from 'wevu/router'
import { definePageMeta } from 'wevu'
const layoutTitle = resolveLayoutTitle()
definePageMeta({
  layout: { name: 'panel', props: { title: layoutTitle.value } },
  route: { name: 'legacy-page-name', meta: { legacy: true } },
})
page({
  name: 'home',
  meta: {
    title: '首页',
    requiresAuth: false,
    nested: { count: -1, values: [null, true, \`static\`] },
    '__proto__': { polluted: true },
  },
} as const)
</script>`

    const declaration = extractPageDeclaration(source, '/project/src/pages/home.vue')
    expect(declaration?.name).toBe('home')
    expect(declaration?.meta).toMatchObject({
      title: '首页',
      requiresAuth: false,
      nested: { count: -1, values: [null, true, 'static'] },
    })
    expect(Object.keys(declaration?.meta ?? {})).toContain('__proto__')
    expect(Object.getPrototypeOf(declaration?.meta)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(declaration?.meta, '__proto__')?.value).toEqual({ polluted: true })
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('collects only global-unbound and canonical imported macro identities from an existing AST', () => {
    const globalAst = parse(
      `definePageMeta({ route: { name: 'global' } })`,
      BABEL_TS_MODULE_PARSER_OPTIONS,
    )
    const importedAst = parse(
      `import { definePageMeta as page } from 'wevu'; page({ route: { name: 'imported' } })`,
      BABEL_TS_MODULE_PARSER_OPTIONS,
    )
    const localAst = parse(
      `const definePageMeta = runtimeMacro; definePageMeta({ route: { name: 'local' } })`,
      BABEL_TS_MODULE_PARSER_OPTIONS,
    )
    const foreignAst = parse(
      `import { definePageMeta } from 'another-router'; definePageMeta({ route: { name: 'foreign' } })`,
      BABEL_TS_MODULE_PARSER_OPTIONS,
    )
    const typescriptValueAst = parse(
      `enum definePageMeta { Value }; definePageMeta({ route: { name: 'enum' } })`,
      BABEL_TS_MODULE_PARSER_OPTIONS,
    )
    const crossBlockImportAst = parse(
      `import { definePageMeta as page } from 'wevu'; export default {}`,
      BABEL_TS_MODULE_PARSER_OPTIONS,
    )
    const crossBlockCallAst = parse(
      `page({ layout: { name: 'panel', props: { title: dynamicTitle } } })`,
      BABEL_TS_MODULE_PARSER_OPTIONS,
    )
    const routeAst = parse(
      `import { definePage } from 'wevu/router'; definePage({ name: 'route' })`,
      BABEL_TS_MODULE_PARSER_OPTIONS,
    )

    expect(collectPageMetaCallsFromPrograms({ script: globalAst })).toHaveLength(1)
    expect(collectPageMetaCallsFromPrograms({ script: importedAst })).toHaveLength(1)
    expect(collectPageMetaCallsFromPrograms({ script: localAst })).toHaveLength(0)
    expect(collectPageMetaCallsFromPrograms({ script: foreignAst })).toHaveLength(0)
    expect(collectPageMetaCallsFromPrograms({ script: typescriptValueAst })).toHaveLength(0)
    expect(collectPageMetaCallsFromPrograms({
      script: crossBlockImportAst,
      scriptSetup: crossBlockCallAst,
    })).toHaveLength(1)
    expect(collectPageMetaCallsFromPrograms({ script: routeAst })).toHaveLength(0)
  })

  it('keeps route declarations and page metadata hints independent', () => {
    expect(mayContainPageDeclaration('definePage({ name: "home" })')).toBe(true)
    expect(mayContainPageDeclaration('definePageMeta({ layout: false })')).toBe(false)
    expect(mayContainPageDeclaration('definePageJson({ navigationBarTitleText: "Home" })')).toBe(false)
    expect(mayContainPageDeclaration('definePageRoute({ name: "obsolete" })')).toBe(false)
    expect(mayContainPageMeta('definePageMeta({ layout: false })')).toBe(true)
    expect(mayContainPageMeta('definePage({ name: "home" })')).toBe(false)
  })

  it('does not register or reject legacy PageMeta.route declarations', () => {
    const source = `import { definePageMeta } from 'wevu'
const escaped = definePageMeta
definePageMeta({ route: { name: routeName, meta: loadMeta() } })
console.log(escaped)`

    expect(extractPageDeclaration(source, '/project/src/pages/legacy-meta.ts')).toBeUndefined()
    expect(stripPageDeclaration(source, '/project/src/pages/legacy-meta.ts')).toBeUndefined()
  })

  it('extracts and strips a global route while preserving page metadata pipelines', () => {
    const source = `const layoutTitle = resolveLayoutTitle()
definePageMeta({
  layout: { name: 'panel', props: { title: layoutTitle.value } },
  meta: { title: 'legacy metadata' },
  customField: loadLegacyMetadata(),
  route: { name: 'legacy-route', meta: { ignored: true } },
})
definePage({ name: 'global-home', meta: { requiresAuth: false } })
definePageJson({ navigationBarTitleText: 'Global home' })`

    expect(extractPageDeclaration(source, '/project/src/pages/global.ts')).toEqual({
      name: 'global-home',
      meta: { requiresAuth: false },
    })
    const stripped = stripPageDeclaration(source, '/project/src/pages/global.ts')
    expect(stripped?.code).not.toMatch(/\bdefinePage\s*\(/)
    expect(stripped?.code).toContain('definePageMeta')
    expect(stripped?.code).toContain(`name: 'legacy-route'`)
    expect(stripped?.code).toContain('const layoutTitle')
    expect(stripped?.code).toContain('definePageJson')
  })

  it('leaves an imported layout-only macro for the page metadata transform', async () => {
    const source = `<script setup lang="ts">
import { definePageMeta as pageMeta, ref } from 'wevu'
const title = ref('Dynamic layout title')
pageMeta({ layout: { name: 'panel', props: { title: title.value } } })
</script>
<template><view>{{ title }}</view></template>`

    expect(extractPageDeclaration(source, '/project/src/pages/layout-only.vue')).toBeUndefined()
    expect(stripPageDeclaration(source, '/project/src/pages/layout-only.vue')).toBeUndefined()

    const compiled = await compileVueFile(source, '/project/src/pages/layout-only.vue', {
      isPage: true,
      sourceMap: true,
    })
    expect(compiled.script).not.toContain('definePageMeta')
    expect(compiled.script).not.toContain('pageMeta')
    expect(compiled.script).toContain('Dynamic layout title')
  })

  it('erases only canonical route imports and the recognized declaration', () => {
    const source = `import runtimeDefault, { definePageMeta, ref } from 'wevu'
import { definePage as page, definePage as unusedPage, useRouter } from 'wevu/router'
import { definePage } from 'another-router'
page({ name: 'home', meta: { title: '首页' } })
definePageJson({ navigationBarTitleText: '首页' })
function invoke(page: (value: unknown) => void) {
  page({ runtime: true })
}
definePageMeta({ route: { name: 'legacy' }, runtime: true })
definePage({ runtime: true })
console.log(runtimeDefault, ref, useRouter, invoke)`

    const result = stripPageDeclaration(source, '/project/src/pages/home.ts')
    expect(result).toBeDefined()
    expect(result!.code).toContain('runtimeDefault')
    expect(result!.code).toContain('ref')
    expect(result!.code).toContain('useRouter')
    expect(result!.code).not.toContain('definePage as unusedPage')
    expect(result!.code).not.toContain('definePage as page')
    expect(result!.code).toContain(`import { definePage } from 'another-router'`)
    expect(result!.code).toContain(`definePageJson({ navigationBarTitleText: '首页' })`)
    expect(result!.code).toContain('page({ runtime: true })')
    expect(result!.code).toContain('definePageMeta({ route:')
    expect(result!.code).toContain('definePage({ runtime: true })')
    parse(result!.code, BABEL_TS_MODULE_PARSER_OPTIONS)
  })

  it('preserves line mappings while removing the declaration', () => {
    const source = `import { definePage } from 'wevu/router'
definePage({ name: 'mapped' })
export const visible = true`
    const result = stripPageDeclaration(source, '/project/src/pages/mapped.ts')
    const traceMapInput = result!.map! as unknown as ConstructorParameters<typeof TraceMap>[0]
    const original = originalPositionFor(new TraceMap(traceMapInput), { line: 3, column: 0 })

    expect(result!.code.split('\n')).toHaveLength(3)
    expect(original).toMatchObject({
      line: 3,
      source: '/project/src/pages/mapped.ts',
    })
  })

  it('treats post-Vue script module ids as JavaScript', () => {
    const source = `import { definePage as page } from 'wevu/router'
page({ name: 'web-page' })`
    expect(extractPageDeclaration(
      source,
      '/project/src/pages/web.vue?vue&type=script&setup=true&lang.ts',
    )).toEqual({ name: 'web-page' })
  })

  it('returns undefined for absent, obsolete, unrelated, legacy metadata and value-shadowed declarations', () => {
    const unrelated = `import { definePage } from 'another-router'
definePage({ name: dynamicName })`
    const obsolete = `import { definePageRoute } from 'wevu/router'
definePageRoute({ name: 'obsolete' })`
    const legacyMeta = `import { definePageMeta } from 'wevu'
definePageMeta({ route: { name: 'legacy' } })`
    const shadowed = `import { definePage as page } from 'wevu/router'
function run(page: (value: unknown) => void) {
  page({ name: dynamicName })
}`

    expect(extractPageDeclaration('const value = 1', '/project/src/page.ts')).toBeUndefined()
    expect(stripPageDeclaration(unrelated, '/project/src/page.ts')).toBeUndefined()
    expect(stripPageDeclaration(obsolete, '/project/src/page.ts')).toBeUndefined()
    expect(extractPageDeclaration(legacyMeta, '/project/src/page.ts')).toBeUndefined()
    expect(stripPageDeclaration(legacyMeta, '/project/src/page.ts')).toBeUndefined()
    expect(extractPageDeclaration(shadowed, '/project/src/page.ts')).toBeUndefined()
    const strippedShadow = stripPageDeclaration(shadowed, '/project/src/page.ts')
    expect(strippedShadow?.code).not.toContain(`from 'wevu/router'`)
    expect(strippedShadow?.code).toContain('page({ name: dynamicName })')
  })

  it('rejects duplicate declarations across both SFC script blocks', () => {
    const source = `<script lang="ts">
import { definePage as page } from 'wevu/router'
page({ name: 'first' })
</script>
<script setup lang="ts">
page({ name: 'second' })
</script>`

    expect(() => extractPageDeclaration(source, '/project/src/pages/duplicate.vue'))
      .toThrow('/project/src/pages/duplicate.vue:6:1')
  })

  it('rejects escaped macro bindings at their original SFC location', () => {
    const source = `<template><view /></template>
<script setup lang="ts">
import { definePage as page } from 'wevu/router'
const escaped = page
</script>`

    expect(() => extractPageDeclaration(source, '/project/src/pages/escaped.vue'))
      .toThrow('/project/src/pages/escaped.vue:4:17')
  })

  it.each([
    ['an ambient declaration', `declare const page: (input: unknown) => void`, 'cross-block-ambient'],
    ['a type-only import', `import type { page } from './page-types'`, 'cross-block-type-import'],
    ['an interface and type reference', `interface page { value: string }; type PageState = page`, 'cross-block-interface'],
    ['a type alias and type reference', `type page = { value: string }; type PageState = page`, 'cross-block-type-alias'],
    ['an ambient namespace', `declare namespace page { type Value = string }`, 'cross-block-ambient-namespace'],
    ['a type-only namespace', `namespace page { export interface Value { value: string } }`, 'cross-block-type-namespace'],
  ])('extracts and erases a cross-block declaration through %s', (_, namespaceDeclaration, routeName) => {
    const source = `<script lang="ts">
import { definePage as page } from 'wevu/router'
export default {}
</script>
<script setup lang="ts">
${namespaceDeclaration}
page({ name: '${routeName}' })
</script>`

    expect(extractPageDeclaration(source, '/project/src/pages/cross-block.vue'))
      .toEqual({ name: routeName })
    const result = stripPageDeclaration(source, '/project/src/pages/cross-block.vue')
    expect(result).toBeDefined()
    expect(result!.code).toContain(namespaceDeclaration)
    expect(result!.code).not.toContain(`from 'wevu/router'`)
    expect(result!.code).not.toContain(`name: '${routeName}'`)
  })

  it('keeps same-block type queries separate from runtime macro references', () => {
    const source = `import { definePage as page } from 'wevu/router'
interface page { value: string }
type PageFactory = typeof page
page({ name: 'type-query' })`
    expect(extractPageDeclaration(source, '/project/src/pages/type-query.ts')).toEqual({ name: 'type-query' })
    const result = stripPageDeclaration(source, '/project/src/pages/type-query.ts')
    expect(result?.code).toContain('type PageFactory = typeof page')
    expect(result?.code).not.toContain(`from 'wevu/router'`)
  })

  it.each([
    `enum page { Value }; const selected = page.Value`,
    `namespace page { export const value = 1 }; const selected = page.value`,
    `import page = Other.runtime; const selected = page`,
  ])('does not treat a TypeScript runtime value shadow as a macro: %s', (runtimeSource) => {
    const source = `<script lang="ts">
import { definePage as page } from 'wevu/router'
export default {}
</script><script setup lang="ts">${runtimeSource}</script>`
    expect(extractPageDeclaration(source, '/project/src/pages/value-shadow.vue')).toBeUndefined()
    const stripped = stripPageDeclaration(source, '/project/src/pages/value-shadow.vue')
    expect(stripped?.code).not.toContain(`from 'wevu/router'`)
    expect(stripped?.code).toContain(runtimeSource)
  })

  it('keeps TypeScript value shadows inside their function and namespace scopes', () => {
    const source = `import { definePage as page } from 'wevu/router'
function local() { enum page { Value }; return page.Value }
namespace Other { export enum page { Value }; export const selected = page.Value }
page({ name: 'outer-scope' })`
    expect(extractPageDeclaration(source, '/project/src/pages/scopes.ts')).toEqual({ name: 'outer-scope' })
    const result = stripPageDeclaration(source, '/project/src/pages/scopes.ts')
    expect(result?.code).toContain('return page.Value')
    expect(result?.code).toContain('selected = page.Value')
    expect(result?.code).not.toContain(`from 'wevu/router'`)
  })

  it.each(['page as unknown', 'page!'])('rejects runtime references wrapped by TypeScript syntax: %s', (reference) => {
    const source = `import { definePage as page } from 'wevu/router'; const escaped = ${reference}`
    expect(() => extractPageDeclaration(source, '/project/src/pages/escaped.ts'))
      .toThrow('/project/src/pages/escaped.ts:1:')
  })

  it.each([
    ['declaration-level', `import type { definePage as page } from 'wevu/router'`],
    ['specifier-level', `import { type definePage as page } from 'wevu/router'`],
  ])('rejects %s type-only macro imports used as cross-block values', (_, macroImport) => {
    const source = `<script lang="ts">
${macroImport}
export default {}
</script>
<script setup lang="ts">
page({ name: 'type-only-cross-block' })
</script>`

    expect(() => extractPageDeclaration(source, '/project/src/pages/type-only-cross-block.vue'))
      .toThrow('/project/src/pages/type-only-cross-block.vue:6:1')
  })

  it.each([
    ['a direct assignment', 'page = replacement', 1],
    ['an array destructuring assignment', '[page] = replacements', 2],
    ['an object destructuring assignment', '({ page } = replacements)', 4],
    ['an update expression', 'page++', 1],
    ['a for-of binding', 'for (page of replacements) {}', 6],
    ['a for-in binding', 'for ({ page } in replacements) {}', 8],
  ])('rejects a cross-block macro alias used by %s', (_, write, column) => {
    const source = `<script lang="ts">
import { definePage as page } from 'wevu/router'
export default {}
</script>
<script setup lang="ts">
${write}
</script>`

    expect(() => extractPageDeclaration(source, '/project/src/pages/cross-block-write.vue'))
      .toThrow(`/project/src/pages/cross-block-write.vue:6:${column}`)
  })

  it('keeps the same-block macro reassignment diagnostic', () => {
    const source = `import { definePage } from 'wevu/router'
definePage = replacement`

    expect(() => extractPageDeclaration(source, '/project/src/pages/same-block-write.ts'))
      .toThrow('/project/src/pages/same-block-write.ts:2:1')
  })

  it('erases a cross-block declaration without touching value-shadowed aliases', () => {
    const source = `<script lang="ts">
import { definePage as page } from 'wevu/router'
export default {}
</script>
<script setup lang="ts">
page({ name: 'cross-block-shadow' })
function invoke(page: (value: unknown) => void, replacement: (value: unknown) => void) {
  page({ runtime: true })
  page = replacement
}
</script>`

    expect(extractPageDeclaration(source, '/project/src/pages/cross-block-shadow.vue'))
      .toEqual({ name: 'cross-block-shadow' })
    const result = stripPageDeclaration(source, '/project/src/pages/cross-block-shadow.vue')
    expect(result).toBeDefined()
    expect(result!.code).not.toContain(`from 'wevu/router'`)
    expect(result!.code).not.toContain(`name: 'cross-block-shadow'`)
    expect(result!.code).toContain('page({ runtime: true })')
    expect(result!.code).toContain('page = replacement')
  })

  it.each([
    'const escaped = definePage',
    `if (ready) definePage({ name: 'home' })`,
  ])('rejects a global macro outside a top-level direct call: %s', (source) => {
    expect(() => extractPageDeclaration(source, '/project/src/pages/global.ts'))
      .toThrow('/project/src/pages/global.ts:1:')
  })

  it.each([
    'definePage = replacement',
    '({ definePage } = replacement)',
    'definePage++',
    'for (definePage of replacements) {}',
  ])('rejects a global macro write target: %s', (source) => {
    expect(() => extractPageDeclaration(source, '/project/src/pages/global-write.ts'))
      .toThrow('/project/src/pages/global-write.ts:1:')
  })

  it.each([
    [`definePage()`, '必须且只能接收一个静态对象参数'],
    [`definePage({ name: 'home' }, extra)`, '必须且只能接收一个静态对象参数'],
    [`definePage(routeConfig)`, '必须且只能接收一个静态对象参数'],
    [`definePage({ name: routeName })`, '.name 必须是非空静态字符串'],
    [`definePage({ name: '' })`, '.name 必须是非空静态字符串'],
    [`definePage({ meta: {} })`, '必须声明非空静态 name'],
    [`definePage({ name: 'first', name: 'second' })`, '属性 "name" 不能重复'],
    [`definePage({ name: 'bad', path: '/bad' })`, '不支持属性 "path"'],
    [`definePage({ name: 'bad', layout: false })`, '不支持属性 "layout"'],
    [`definePage({ route: { name: 'wrapped' } })`, '不支持属性 "route"'],
    [`definePage({ name: 'bad', ...extra })`, '不支持展开'],
    [`definePage({ ['name']: 'bad' })`, '不支持计算或动态属性名'],
    [`definePage({ name: 'bad', meta: routeMeta })`, '.meta 必须是静态对象'],
    [`definePage({ name: 'bad', meta: { value: undefined } })`, '.meta 只能包含静态有限 JSON 值'],
    [`definePage({ name: 'bad', meta: { value: 1e400 } })`, '.meta 只能包含静态有限 JSON 值'],
  ])('rejects a non-static route declaration in %s', (call, message) => {
    expect(() => extractPageDeclaration(call, '/project/src/pages/invalid.ts')).toThrow(message)
  })

  it('removes the macro before mini-program SFC runtime generation', async () => {
    const source = `<script setup lang="ts">
import { definePageMeta, ref } from 'wevu'
import { definePage as page } from 'wevu/router'
definePageMeta({ layout: false })
page({ name: 'compiled-home', meta: { title: '首页' } })
definePageJson({ navigationBarTitleText: '宿主标题' })
const title = ref('consumer-visible')
</script>
<template><view>{{ title }}</view></template>`

    const result = await compileVueFile(source, '/project/src/pages/compiled.vue', {
      isPage: true,
      sourceMap: true,
    })

    expect(result.script).not.toContain('definePageMeta')
    expect(result.script).not.toMatch(/\bdefinePage\s*\(/)
    expect(result.script).not.toContain('compiled-home')
    expect(result.script).toContain('consumer-visible')
    expect(result.template).toContain('{{title}}')
    expect(JSON.parse(result.config!)).toMatchObject({ navigationBarTitleText: '宿主标题' })
    expect(result.scriptMap).toBeTruthy()
  })

  it('erases declarations whose import binding uses escaped source text', async () => {
    const source = String.raw`<script setup lang="ts">
import { defineP\u0061ge as page } from "w\u0065vu/router"
page({ name: 'escaped-home' })
</script>
<template><view>binding</view></template>`

    expect(extractPageDeclaration(source, 'pages/home.vue')).toEqual({ name: 'escaped-home' })
    const result = await compileVueFile(source, 'pages/home.vue', { isPage: true })
    expect(result.script).not.toContain('escaped-home')
    expect(result.template).toContain('binding')
  })

  it('does not parse unrelated page sources without a declaration hint', async () => {
    await expect(extractPageDeclarationWithDependencies(
      '<<< unrelated syntax owned by another transform >>>',
      '/project/src/pages/plain.ts',
    )).resolves.toEqual({ dependencies: [] })
    await expect(extractPageDeclarationWithDependencies(
      '<script><</script>',
      '/project/src/pages/plain.vue',
    )).resolves.toEqual({ dependencies: [] })
  })

  it.each([
    ['script', `import { definePage } from 'wevu/router'
definePage({ name: 'external-script', meta: { source: 'script' } })
export const visible = 'external-script-visible'
export default {}`],
    ['script setup', `import { ref } from 'wevu'
import { suffix } from './helpers'
import { definePage as page } from 'wevu/router'
page({ name: 'external-setup', meta: { source: 'setup' } })
const visible = ref('external-setup-visible' + suffix)
defineExpose({ visible })`],
  ])('extracts and erases a declaration from external %s during actual compilation', async (kind, externalSource) => {
    const filename = `/project/src/pages/external-${kind.replace(' ', '-')}/index.vue`
    const externalFilename = `/project/src/pageScripts/external-${kind.replace(' ', '-')}.ts`
    const source = `<template><view>{{ import.meta.env.MODE }}</view></template>\r\n<script${kind === 'script setup' ? ' setup' : ''} lang="ts" src="../../pageScripts/external-${kind.replace(' ', '-')}.ts"></script>`
    const options = {
      async resolveId() {
        return externalFilename
      },
      async readFile() {
        return externalSource
      },
    }

    await expect(extractPageDeclarationWithDependencies(source, filename, options)).resolves.toMatchObject({
      declaration: {
        meta: { source: kind === 'script' ? 'script' : 'setup' },
        name: kind === 'script' ? 'external-script' : 'external-setup',
      },
      declarationSourceFile: externalFilename,
      dependencies: [externalFilename],
    })
    const result = await compileVueFile(source, filename, {
      isPage: true,
      sourceMap: true,
      sfcSrc: options,
    })

    expect(result.script).toContain(kind === 'script' ? 'external-script-visible' : 'external-setup-visible')
    expect(result.script).not.toMatch(/\bdefinePage\s*\(/)
    expect(result.script).not.toMatch(/from\s+['"]wevu\/router['"]/)
    expect(result.scriptMap?.sources).toContain(externalFilename)
    expect(result.scriptMap?.sourcesContent).toContain(externalSource)
    if (kind === 'script setup') {
      expect(result.script).toMatch(/from\s+['"]\.\.\/\.\.\/pageScripts\/helpers['"]/)
    }
  })

  it('removes an imported layout-only macro from an external setup descriptor', async () => {
    const filename = '/project/src/pages/external/index.vue'
    const externalFilename = '/project/src/pageScripts/external.ts'
    const source = '<script setup lang="ts" src="../../pageScripts/external.ts"></script>'
    const externalSource = `import { definePageMeta as pageMeta } from 'wevu'
import { suffix } from './helpers'
function require(value: string) { return value }
pageMeta({ layout: { name: 'panel', props: { title: suffix } } })
const visible = suffix + require('./visible')
defineExpose({ visible })`
    const result = await compileVueFile(source, filename, {
      isPage: true,
      sourceMap: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expect(result.script).toMatch(/from\s+['"]\.\.\/\.\.\/pageScripts\/helpers['"]/)
    expect(result.script).toMatch(/require\(['"]\.\/visible['"]\)/)
    expect(result.script).not.toContain('definePageMeta')
    expect(result.script).not.toContain('pageMeta')
    expect(result.scriptMap?.sources).toContain(externalFilename)
    expect(result.scriptMap?.sourcesContent).toContain(externalSource)
  })

  it('keeps an external setup require call bound by normal script module scope', async () => {
    const filename = '/project/src/pages/external/index.vue'
    const externalFilename = '/project/src/pageScripts/normal-bound.ts'
    const source = `<script lang="ts">
function require(value: string) { return value }
export default {}
</script>
<script setup lang="ts" src="../../pageScripts/normal-bound.ts"></script>`
    const externalSource = `const visible = require('./normal-bound-value')
defineExpose({ visible })`
    const result = await compileVueFile(source, filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expect(result.script).toMatch(/require\(['"]\.\/normal-bound-value['"]\)/)
    expect(result.script).not.toContain('../../pageScripts/normal-bound-value')
  })

  it('keeps an external normal-script require call bound by a hoisted setup runtime import', async () => {
    const filename = '/project/src/pages/external/index.vue'
    const externalFilename = '/project/src/pageScripts/setup-import-bound.ts'
    const source = `<script lang="ts" src="../../pageScripts/setup-import-bound.ts"></script>
<script setup lang="ts">
import require from './runtime-loader'
const setupVisible = 'runtime-import-visible'
defineExpose({ setupVisible })
</script>`
    const externalSource = `export const visible = require('./setup-import-value')
export default {}`
    const result = await compileVueFile(source, filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expect(result.script).toMatch(/from\s+['"]\.\/runtime-loader['"]/)
    expect(result.script).toMatch(/require\(['"]\.\/setup-import-value['"]\)/)
    expect(result.script).not.toContain('../../pageScripts/setup-import-value')
  })

  it('rebases an external global require despite a setup-local binding', async () => {
    const filename = '/project/src/pages/external/index.vue'
    const externalFilename = '/project/src/pageScripts/setup-local.ts'
    const source = `<script lang="ts" src="../../pageScripts/setup-local.ts"></script>
<script setup lang="ts">
function require(value: string) { return value }
const setupVisible = require('./setup-local-value')
defineExpose({ setupVisible })
</script>`
    const externalSource = `export const visible = require('./external-global-value')
export default {}`
    const result = await compileVueFile(source, filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expect(result.script).toMatch(/require\(['"]\.\.\/\.\.\/pageScripts\/external-global-value['"]\)/)
    expect(result.script).toMatch(/require\(['"]\.\/setup-local-value['"]\)/)
  })

  it('rebases an external global require despite a setup type-only import', async () => {
    const filename = '/project/src/pages/external/index.vue'
    const externalFilename = '/project/src/pageScripts/setup-type-only.ts'
    const source = `<script lang="ts" src="../../pageScripts/setup-type-only.ts"></script>
<script setup lang="ts">
import type { require } from './runtime-types'
const setupVisible = 'type-only-visible'
defineExpose({ setupVisible })
</script>`
    const externalSource = `export const visible = require('./type-only-global-value')
export default {}`
    const result = await compileVueFile(source, filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expect(result.script).toMatch(/require\(['"]\.\.\/\.\.\/pageScripts\/type-only-global-value['"]\)/)
  })

  it('rebases a global require described by an ambient declaration', async () => {
    const filename = '/project/src/pages/external/index.vue'
    const externalFilename = '/project/src/pageScripts/ambient.ts'
    const result = await compileVueFile('<script lang="ts" src="../../pageScripts/ambient.ts"></script>', filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return `declare const require: (id: string) => unknown
export const visible = require('./ambient-global-value')
export default {}`
        },
      },
    })

    expect(result.script).toMatch(/require\(['"]\.\.\/\.\.\/pageScripts\/ambient-global-value['"]\)/)
  })

  it('reports external declaration diagnostics at the original source file', async () => {
    const filename = '/project/src/pages/external-diagnostic.vue'
    const externalFilename = '/project/src/pageScripts/external-diagnostic.ts'
    const source = '<script setup lang="ts" src="../pageScripts/external-diagnostic.ts"></script>'
    const externalSource = `import { definePage } from 'wevu/router'

definePage({ name: routeName })`

    await expect(extractPageDeclarationWithDependencies(source, filename, {
      async resolveId() {
        return externalFilename
      },
      async readFile() {
        return externalSource
      },
    })).rejects.toThrow(`${externalFilename}:3:${externalSource.split('\n')[2]!.indexOf('routeName') + 1}`)
  })

  it('rejects duplicate declarations across inline and external script blocks', async () => {
    const filename = '/project/src/pages/external-duplicate.vue'
    const externalFilename = '/project/src/pageScripts/external-duplicate.ts'
    const source = `<script lang="ts">
import { definePage } from 'wevu/router'
definePage({ name: 'inline' })
export default {}
</script>
<script setup lang="ts" src="../pageScripts/external-duplicate.ts"></script>`
    const externalSource = `import { definePage as page } from 'wevu/router'
page({ name: 'external' })`

    await expect(compileVueFile(source, filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })).rejects.toThrow(`${externalFilename}:2:1`)
  })

  it('keeps an external declaration erased after inline JSON macro preprocessing', async () => {
    const filename = '/project/src/pages/external-json.vue'
    const externalFilename = '/project/src/pageScripts/external-json.ts'
    const source = `<script lang="ts" src="../pageScripts/external-json.ts"></script>
<script setup lang="ts">
definePageJson({ navigationBarTitleText: 'External JSON' })
const visible = 'json-visible'
</script>`
    const externalSource = `import { definePage } from 'wevu/router'
definePage({ name: 'external-json' })
export default {}`

    const result = await compileVueFile(source, filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expect(result.script).toContain('json-visible')
    expect(result.script).not.toContain('external-json')
    expect(result.script).not.toMatch(/\bdefinePage\s*\(/)
    expect(JSON.parse(result.config!)).toMatchObject({
      navigationBarTitleText: 'External JSON',
    })
  })

  it('keeps a cross-block external declaration erased after defineOptions preprocessing', async () => {
    const filename = '/project/src/pages/external-options.vue'
    const externalFilename = '/project/src/pageScripts/external-options.ts'
    const source = `<script lang="ts" src="../pageScripts/external-options.ts"></script>
<script setup lang="ts">
page({ name: 'external-options' })
defineOptions(() => ({ name: 'VisibleOptions' }))
const visible = 'options-visible'
</script>`
    const externalSource = `import { definePage as page } from 'wevu/router'
export default {}`

    const result = await compileVueFile(source, filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expect(result.script).toContain('options-visible')
    expect(result.script).not.toContain('external-options')
    expect(result.script).not.toMatch(/\bdefinePage\s*\(/)
  })
})
