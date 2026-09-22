import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { parse } from '@weapp-vite/ast/babel'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../plugins/vue/transform/compileVueFile'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../utils/babel'
import {
  collectPageMetaCallsFromPrograms,
  extractPageDeclaration,
  extractPageDeclarationWithDependencies,
  stripPageDeclaration,
} from './index'

describe('static page declarations', () => {
  it('extracts only the route namespace as finite JSON without prototype mutation', () => {
    const source = `<script setup lang="ts">
import { definePageMeta as page } from 'wevu'
const layoutTitle = resolveLayoutTitle()
page({
  layout: { name: 'panel', props: { title: layoutTitle.value } },
  name: 'legacy-page-name',
  meta: { legacy: true },
  route: {
    name: 'home',
    meta: {
      title: '首页',
      requiresAuth: false,
      nested: { count: -1, values: [null, true, \`static\`] },
      '__proto__': { polluted: true },
    },
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

    expect(collectPageMetaCallsFromPrograms({ script: globalAst })).toHaveLength(1)
    expect(collectPageMetaCallsFromPrograms({ script: importedAst })).toHaveLength(1)
    expect(collectPageMetaCallsFromPrograms({ script: localAst })).toHaveLength(0)
    expect(collectPageMetaCallsFromPrograms({ script: foreignAst })).toHaveLength(0)
    expect(collectPageMetaCallsFromPrograms({ script: typescriptValueAst })).toHaveLength(0)
  })

  it('extracts and strips a global route while preserving adjacent metadata pipelines', () => {
    const source = `const layoutTitle = resolveLayoutTitle()
definePageMeta({
  layout: { name: 'panel', props: { title: layoutTitle.value } },
  meta: { title: 'legacy metadata' },
  customField: loadLegacyMetadata(),
  route: { name: 'global-home', meta: { requiresAuth: false } },
})
definePageJson({ navigationBarTitleText: 'Global home' })`

    expect(extractPageDeclaration(source, '/project/src/pages/global.ts')).toEqual({
      name: 'global-home',
      meta: { requiresAuth: false },
    })
    const stripped = stripPageDeclaration(source, '/project/src/pages/global.ts')
    expect(stripped?.code).not.toContain('definePageMeta')
    expect(stripped?.code).toContain('const layoutTitle')
    expect(stripped?.code).toContain('definePageJson')
  })

  it('strips an imported layout-only macro before runtime compilation', async () => {
    const source = `<script setup lang="ts">
import { definePageMeta as pageMeta, ref } from 'wevu'
const title = ref('Dynamic layout title')
pageMeta({ layout: { name: 'panel', props: { title: title.value } } })
</script>
<template><view>{{ title }}</view></template>`

    expect(extractPageDeclaration(source, '/project/src/pages/layout-only.vue')).toBeUndefined()
    const stripped = stripPageDeclaration(source, '/project/src/pages/layout-only.vue')
    expect(stripped?.code).not.toContain('definePageMeta')
    expect(stripped?.code).not.toContain('pageMeta(')
    expect(stripped?.code).toContain(`import {`)
    expect(stripped?.code).toContain('ref')

    const compiled = await compileVueFile(source, '/project/src/pages/layout-only.vue', {
      isPage: true,
      sourceMap: true,
    })
    expect(compiled.script).not.toContain('definePageMeta')
    expect(compiled.script).not.toContain('pageMeta')
    expect(compiled.script).toContain('Dynamic layout title')
  })

  it('erases only canonical macro imports and the recognized declaration', () => {
    const source = `import runtimeDefault, { definePageMeta as page, ref } from 'wevu'
import { definePageMeta as unusedPage, useRouter } from 'wevu'
import { definePageMeta } from 'another-router'
page({ layout: false, route: { name: 'home', meta: { title: '首页' } } })
definePageJson({ navigationBarTitleText: '首页' })
function invoke(page: (value: unknown) => void) {
  page({ runtime: true })
}
definePageMeta({ runtime: true })
console.log(runtimeDefault, ref, useRouter, invoke)`

    const result = stripPageDeclaration(source, '/project/src/pages/home.ts')
    expect(result).toBeDefined()
    expect(result!.code).toContain('runtimeDefault')
    expect(result!.code).toContain('ref')
    expect(result!.code).toContain('useRouter')
    expect(result!.code).not.toContain('definePageMeta as unusedPage')
    expect(result!.code).not.toContain('definePageMeta as page')
    expect(result!.code).toContain(`import { definePageMeta } from 'another-router'`)
    expect(result!.code).toContain(`definePageJson({ navigationBarTitleText: '首页' })`)
    expect(result!.code).toContain('page({ runtime: true })')
    expect(result!.code).toContain('definePageMeta({ runtime: true })')
    parse(result!.code, BABEL_TS_MODULE_PARSER_OPTIONS)
  })

  it('preserves line mappings while removing the declaration', () => {
    const source = `import { definePageMeta } from 'wevu'
definePageMeta({ route: { name: 'mapped' } })
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
    const source = `import { definePageMeta as page } from 'wevu'
page({ route: { name: 'web-page' } })`
    expect(extractPageDeclaration(
      source,
      '/project/src/pages/web.vue?vue&type=script&setup=true&lang.ts',
    )).toEqual({ name: 'web-page' })
  })

  it('returns undefined for absent, obsolete, unrelated and value-shadowed declarations', () => {
    const unrelated = `import { definePageMeta } from 'another-router'
definePageMeta({ route: { name: dynamicName } })`
    const obsolete = `import { definePage } from 'wevu/router'
definePage({ name: 'obsolete' })`
    const shadowed = `import { definePageMeta as page } from 'wevu'
function run(page: (value: unknown) => void) {
  page({ route: { name: dynamicName } })
}`

    expect(extractPageDeclaration('const value = 1', '/project/src/page.ts')).toBeUndefined()
    expect(stripPageDeclaration(unrelated, '/project/src/page.ts')).toBeUndefined()
    expect(stripPageDeclaration(obsolete, '/project/src/page.ts')).toBeUndefined()
    expect(extractPageDeclaration(shadowed, '/project/src/page.ts')).toBeUndefined()
    const strippedShadow = stripPageDeclaration(shadowed, '/project/src/page.ts')
    expect(strippedShadow?.code).not.toContain(`from 'wevu'`)
    expect(strippedShadow?.code).toContain('page({ route: { name: dynamicName } })')
  })

  it('rejects duplicate declarations across both SFC script blocks', () => {
    const source = `<script lang="ts">
import { definePageMeta as page } from 'wevu'
page({ route: { name: 'first' } })
</script>
<script setup lang="ts">
page({ route: { name: 'second' } })
</script>`

    expect(() => extractPageDeclaration(source, '/project/src/pages/duplicate.vue'))
      .toThrow('/project/src/pages/duplicate.vue:6:1')
  })

  it('rejects escaped macro bindings at their original SFC location', () => {
    const source = `<template><view /></template>
<script setup lang="ts">
import { definePageMeta as page } from 'wevu'
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
import { definePageMeta as page } from 'wevu'
export default {}
</script>
<script setup lang="ts">
${namespaceDeclaration}
page({ route: { name: '${routeName}' } })
</script>`

    expect(extractPageDeclaration(source, '/project/src/pages/cross-block.vue'))
      .toEqual({ name: routeName })
    const result = stripPageDeclaration(source, '/project/src/pages/cross-block.vue')
    expect(result).toBeDefined()
    expect(result!.code).toContain(namespaceDeclaration)
    expect(result!.code).not.toContain(`from 'wevu'`)
    expect(result!.code).not.toContain(`name: '${routeName}'`)
  })

  it('keeps same-block type queries separate from runtime macro references', () => {
    const source = `import { definePageMeta as page } from 'wevu'
interface page { value: string }
type PageFactory = typeof page
page({ route: { name: 'type-query' } })`
    expect(extractPageDeclaration(source, '/project/src/pages/type-query.ts')).toEqual({ name: 'type-query' })
    const result = stripPageDeclaration(source, '/project/src/pages/type-query.ts')
    expect(result?.code).toContain('type PageFactory = typeof page')
    expect(result?.code).not.toContain(`from 'wevu'`)
  })

  it.each([
    `enum page { Value }; const selected = page.Value`,
    `namespace page { export const value = 1 }; const selected = page.value`,
    `import page = Other.runtime; const selected = page`,
  ])('does not treat a TypeScript runtime value shadow as a macro: %s', (runtimeSource) => {
    const source = `<script lang="ts">
import { definePageMeta as page } from 'wevu'
export default {}
</script><script setup lang="ts">${runtimeSource}</script>`
    expect(extractPageDeclaration(source, '/project/src/pages/value-shadow.vue')).toBeUndefined()
    const stripped = stripPageDeclaration(source, '/project/src/pages/value-shadow.vue')
    expect(stripped?.code).not.toContain(`from 'wevu'`)
    expect(stripped?.code).toContain(runtimeSource)
  })

  it('keeps TypeScript value shadows inside their function and namespace scopes', () => {
    const source = `import { definePageMeta as page } from 'wevu'
function local() { enum page { Value }; return page.Value }
namespace Other { export enum page { Value }; export const selected = page.Value }
page({ route: { name: 'outer-scope' } })`
    expect(extractPageDeclaration(source, '/project/src/pages/scopes.ts')).toEqual({ name: 'outer-scope' })
    const result = stripPageDeclaration(source, '/project/src/pages/scopes.ts')
    expect(result?.code).toContain('return page.Value')
    expect(result?.code).toContain('selected = page.Value')
    expect(result?.code).not.toContain(`from 'wevu'`)
  })

  it.each(['page as unknown', 'page!'])('rejects runtime references wrapped by TypeScript syntax: %s', (reference) => {
    const source = `import { definePageMeta as page } from 'wevu'; const escaped = ${reference}`
    expect(() => extractPageDeclaration(source, '/project/src/pages/escaped.ts'))
      .toThrow('/project/src/pages/escaped.ts:1:')
  })

  it.each([
    ['declaration-level', `import type { definePageMeta as page } from 'wevu'`],
    ['specifier-level', `import { type definePageMeta as page } from 'wevu'`],
  ])('rejects %s type-only macro imports used as cross-block values', (_, macroImport) => {
    const source = `<script lang="ts">
${macroImport}
export default {}
</script>
<script setup lang="ts">
page({ route: { name: 'type-only-cross-block' } })
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
import { definePageMeta as page } from 'wevu'
export default {}
</script>
<script setup lang="ts">
${write}
</script>`

    expect(() => extractPageDeclaration(source, '/project/src/pages/cross-block-write.vue'))
      .toThrow(`/project/src/pages/cross-block-write.vue:6:${column}`)
  })

  it('keeps the same-block macro reassignment diagnostic', () => {
    const source = `import { definePageMeta } from 'wevu'
definePageMeta = replacement`

    expect(() => extractPageDeclaration(source, '/project/src/pages/same-block-write.ts'))
      .toThrow('/project/src/pages/same-block-write.ts:2:1')
  })

  it('erases a cross-block declaration without touching value-shadowed aliases', () => {
    const source = `<script lang="ts">
import { definePageMeta as page } from 'wevu'
export default {}
</script>
<script setup lang="ts">
page({ route: { name: 'cross-block-shadow' } })
function invoke(page: (value: unknown) => void, replacement: (value: unknown) => void) {
  page({ runtime: true })
  page = replacement
}
</script>`

    expect(extractPageDeclaration(source, '/project/src/pages/cross-block-shadow.vue'))
      .toEqual({ name: 'cross-block-shadow' })
    const result = stripPageDeclaration(source, '/project/src/pages/cross-block-shadow.vue')
    expect(result).toBeDefined()
    expect(result!.code).not.toContain(`from 'wevu'`)
    expect(result!.code).not.toContain(`name: 'cross-block-shadow'`)
    expect(result!.code).toContain('page({ runtime: true })')
    expect(result!.code).toContain('page = replacement')
  })

  it.each([
    'const escaped = definePageMeta',
    `if (ready) definePageMeta({ route: { name: 'home' } })`,
  ])('rejects a global macro outside a top-level direct call: %s', (source) => {
    expect(() => extractPageDeclaration(source, '/project/src/pages/global.ts'))
      .toThrow('/project/src/pages/global.ts:1:')
  })

  it.each([
    'definePageMeta = replacement',
    '({ definePageMeta } = replacement)',
    'definePageMeta++',
    'for (definePageMeta of replacements) {}',
  ])('rejects a global macro write target: %s', (source) => {
    expect(() => extractPageDeclaration(source, '/project/src/pages/global-write.ts'))
      .toThrow('/project/src/pages/global-write.ts:1:')
  })

  it.each([
    [`definePageMeta({ get route() { return { name: 'home' } } })`, 'route 必须使用非计算的静态对象属性'],
    [`definePageMeta({ ['route']: { name: 'home' } })`, 'route 必须使用非计算的静态对象属性'],
    [`definePageMeta({ route: { name: routeName } })`, 'route.name 必须是非空静态字符串'],
    [`definePageMeta({ route: { name: '' } })`, 'route.name 必须是非空静态字符串'],
    [`definePageMeta({ route: routeConfig })`, 'route 必须是静态对象'],
    [`definePageMeta({ route: { meta: {} } })`, 'route 必须声明非空静态 name'],
    [`definePageMeta({ route: { name: 'first' }, route: { name: 'second' } })`, 'route 属性不能重复'],
    [`definePageMeta({ route: { name: 'bad', path: '/bad' } })`, 'route 不支持属性 "path"'],
    [`definePageMeta({ route: { name: 'bad', ...extra } })`, 'route 不支持展开'],
    [`definePageMeta({ route: { ['name']: 'bad' } })`, 'route 不支持计算或动态属性名'],
    [`definePageMeta({ route: { name: 'bad', meta: routeMeta } })`, 'route.meta 必须是静态对象'],
    [`definePageMeta({ route: { name: 'bad', meta: { value: undefined } } })`, 'route.meta 只能包含静态有限 JSON 值'],
    [`definePageMeta({ route: { name: 'bad', meta: { value: 1e400 } } })`, 'route.meta 只能包含静态有限 JSON 值'],
  ])('rejects a non-static route declaration in %s', (call, message) => {
    expect(() => extractPageDeclaration(call, '/project/src/pages/invalid.ts')).toThrow(message)
  })

  it('removes the macro before mini-program SFC runtime generation', async () => {
    const source = `<script setup lang="ts">
import { definePageMeta as page, ref } from 'wevu'
page({
  layout: false,
  route: { name: 'compiled-home', meta: { title: '首页' } },
})
definePageJson({ navigationBarTitleText: '宿主标题' })
const title = ref('consumer-visible')
</script>
<template><view>{{ title }}</view></template>`

    const result = await compileVueFile(source, '/project/src/pages/compiled.vue', {
      isPage: true,
      sourceMap: true,
    })

    expect(result.script).not.toContain('definePageMeta')
    expect(result.script).not.toContain('compiled-home')
    expect(result.script).toContain('consumer-visible')
    expect(result.template).toContain('{{title}}')
    expect(JSON.parse(result.config!)).toMatchObject({ navigationBarTitleText: '宿主标题' })
    expect(result.scriptMap).toBeTruthy()
  })

  it('erases declarations whose import binding uses escaped source text', async () => {
    const source = String.raw`<script setup lang="ts">
import { definePage\u004deta as page } from "w\u0065vu"
page({ route: { name: 'escaped-home' } })
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
    ['script', `import { definePageMeta } from 'wevu'
definePageMeta({ route: { name: 'external-script', meta: { source: 'script' } } })
export const visible = 'external-script-visible'
export default {}`],
    ['script setup', `import { ref } from 'wevu'
import { suffix } from './helpers'
import { definePageMeta as page } from 'wevu'
page({ route: { name: 'external-setup', meta: { source: 'setup' } } })
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
    expect(result.script).not.toContain('definePageMeta')
    expect(result.script).not.toMatch(/from\s+['"]wevu['"]/)
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
    const externalSource = `import { definePageMeta } from 'wevu'

definePageMeta({ route: { name: routeName } })`

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
import { definePageMeta } from 'wevu'
definePageMeta({ route: { name: 'inline' } })
export default {}
</script>
<script setup lang="ts" src="../pageScripts/external-duplicate.ts"></script>`
    const externalSource = `import { definePageMeta as page } from 'wevu'
page({ route: { name: 'external' } })`

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
    const externalSource = `import { definePageMeta } from 'wevu'
definePageMeta({ route: { name: 'external-json' } })
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
    expect(result.script).not.toContain('definePageMeta')
    expect(JSON.parse(result.config!)).toMatchObject({
      navigationBarTitleText: 'External JSON',
    })
  })

  it('keeps a cross-block external declaration erased after defineOptions preprocessing', async () => {
    const filename = '/project/src/pages/external-options.vue'
    const externalFilename = '/project/src/pageScripts/external-options.ts'
    const source = `<script lang="ts" src="../pageScripts/external-options.ts"></script>
<script setup lang="ts">
page({ route: { name: 'external-options' } })
defineOptions(() => ({ name: 'VisibleOptions' }))
const visible = 'options-visible'
</script>`
    const externalSource = `import { definePageMeta as page } from 'wevu'
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
    expect(result.script).not.toContain('definePageMeta')
  })
})
