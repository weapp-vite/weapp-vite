import type { VueTransformResult } from './types'
import path from 'node:path'
import { WEVU_CSS_MODULES_KEY, WEVU_CSS_VARS_STYLE_KEY } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { parse, traverse } from '../../../../utils/babel'
import { compileVueFile } from './index'

function collectCssVarNames(style: string | undefined) {
  const names = [...(style ?? '').matchAll(/var\(--((?:\\.|[^)])+)\)/g)]
    .map(match => match[1]!.replace(/\\(.)/g, '$1'))
  return [...new Set(names)]
}

function collectRegisteredCssVarNames(script: string | undefined) {
  const names: string[] = []
  traverse(parse(script ?? '', { sourceType: 'module' }), {
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee)) {
        return
      }
      const binding = path.scope.getBinding(path.node.callee.name)
      if (!binding?.path.isImportSpecifier()
        || !t.isIdentifier(binding.path.node.imported, { name: 'useCssVars' })) {
        return
      }
      const getter = path.node.arguments[0]
      if (t.isArrowFunctionExpression(getter) && t.isObjectExpression(getter.body)) {
        for (const property of getter.body.properties) {
          if (t.isObjectProperty(property) && t.isStringLiteral(property.key)) {
            names.push(property.key.value)
          }
        }
      }
    },
  })
  return names
}

function collectRuntimeImportContract(script: string | undefined) {
  const imports: string[] = []
  traverse(parse(script ?? '', { sourceType: 'module' }), {
    ImportDeclaration(path) {
      for (const specifier of path.node.specifiers) {
        if (!t.isImportSpecifier(specifier)) {
          continue
        }
        const imported = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value
        imports.push(`${path.node.source.value}:${imported}`)
      }
    },
  })
  return imports.sort()
}

function expectCssVarContract(result: VueTransformResult) {
  const cssVarNames = collectCssVarNames(result.style)
  expect(cssVarNames).toHaveLength(result.meta?.cssVars?.length ?? 0)
  expect(collectRegisteredCssVarNames(result.script)).toEqual(cssVarNames)
  return cssVarNames
}

describe('compileVueFile SFC styles', () => {
  it('connects scoped styles, modules and CSS variables across all SFC outputs', async () => {
    const result = await compileVueFile(`
<template>
  <view class="root" style="color: black">
    <view :class="$style.card" :style="extra">{{ theme.active }}</view>
    <slot />
  </view>
  <view class="second" />
</template>
<script setup lang="ts">
import { ref } from 'vue'
const color = ref('red')
const extra = { padding: '2px' }
</script>
<style scoped module>
.card { color: v-bind(color); }
:deep(.child) { color: red; }
:global(.global) { color: blue; }
:slotted(.projected) { color: green; }
</style>
<style module="theme">
.active { font-weight: bold; }
</style>
    `.trim(), 'fixtures/style/index.vue', {
      bindingManifestSourceFile: 'src/pages/style/index.vue',
    })

    const style = result.style ?? ''
    expect(style).not.toContain('v-bind(')
    expect(style).toContain('var(--')
    expect(style).toContain('.child')
    expect(style).toContain('.global')
    expect(style).toContain('.projected')

    expect(result.cssModules).toEqual({
      $style: expect.objectContaining({ card: expect.any(String) }),
      theme: expect.objectContaining({ active: expect.any(String) }),
    })
    expect(result.script).toContain(WEVU_CSS_MODULES_KEY)
    expect(result.script).toContain('useCssVars')
    expect(result.script).not.toContain('fixtures/style/index.vue')
    expect(result.script).toContain('src/pages/style/index.vue')

    expectCssVarContract(result)

    const scopeAttributes = result.template?.match(/data-v-[a-z0-9]+=""/g) ?? []
    expect(scopeAttributes.length).toBeGreaterThanOrEqual(3)
    expect(result.script).toContain(WEVU_CSS_VARS_STYLE_KEY)
    expect(result.script).toContain('color: black')
    expect(result.script).toContain('extra')
    expect(result.template?.match(/style="\{\{__wv_style_\d+\}\}"/g)).toHaveLength(3)
    expect(result.template).toMatch(/data-v-[a-z0-9]+-s=""/)
  })

  it('keeps mixed inline and external CSS variable outputs identical to all-inline compilation', async () => {
    const filename = path.resolve('src/pages/style/index.vue')
    const styleFilename = path.join(path.dirname(filename), 'theme.css')
    const inlineCss = `
/* v-bind(inlineGhost) */
.inline { color: v-bind("tone"); }
`.trim()
    const externalCss = `
.external { color: v-bind(resolveShade(palette.primary, fallback)); }
.duplicate { border-color: v-bind("tone"); }
`.trim()
    const base = `
<script setup>
const tone = 'red'
const palette = { primary: 'blue' }
const fallback = 'black'
const resolveShade = (primary, backup) => primary || backup
</script>
<template><view class="box" /></template>
`.trim()
    const inline = await compileVueFile(
      `${base}<style>${inlineCss}</style><style>${externalCss}</style>`,
      filename,
    )
    const external = await compileVueFile(
      `${base}<style>${inlineCss}</style><style src="./theme.css"></style>`,
      filename,
      {
        sfcSrc: {
          resolveId: async () => styleFilename,
          readFile: async () => externalCss,
        },
      },
    )

    expect(external.style).toBe(inline.style)
    expect(external.script).toBe(inline.script)
    expect(external.template).toBe(inline.template)
    expectCssVarContract(inline)
    expectCssVarContract(external)
    expect(external.meta?.cssVars).toEqual([
      'tone',
      'resolveShade(palette.primary, fallback)',
    ])
    expect(external.meta?.sfcSrcDeps).toEqual([styleFilename])
  })

  it('rebuilds external CSS variable metadata when the dependency content changes', async () => {
    const filename = path.resolve('src/pages/style/index.vue')
    const styleFilename = path.join(path.dirname(filename), 'theme.css')
    const source = `
<script setup>
const color = 'red'
const surfaceColor = 'orange'
const borderColor = 'black'
</script>
<template><view class="box" /></template>
<style src="./theme.css"></style>
`.trim()
    let css = '.box { color: v-bind("color"); }'
    let readCount = 0
    const options = {
      sfcSrc: {
        resolveId: async () => styleFilename,
        readFile: async () => {
          readCount++
          return css
        },
      },
    }

    const initial = await compileVueFile(source, filename, options)
    const initialNames = expectCssVarContract(initial)
    expect(initial.meta?.cssVars).toEqual(['color'])

    css = '.box { background-color: v-bind("surfaceColor"); border-color: v-bind(borderColor); }'
    const changed = await compileVueFile(source, filename, options)
    const changedNames = expectCssVarContract(changed)
    expect(changedNames).toHaveLength(2)
    expect(changedNames).not.toEqual(initialNames)
    expect(changed.meta?.cssVars).toEqual(['surfaceColor', 'borderColor'])
    expect(changed.meta?.sfcSrcDeps).toEqual(initial.meta?.sfcSrcDeps)
    for (const initialName of initialNames) {
      expect(collectRegisteredCssVarNames(changed.script)).not.toContain(initialName)
    }

    css = '.box { color: black; }'
    const removed = await compileVueFile(source, filename, options)
    expect(collectCssVarNames(removed.style)).toEqual([])
    expect(removed.meta?.cssVars).toEqual([])
    expect(collectRegisteredCssVarNames(removed.script)).toEqual([])
    expect(removed.template).toBe('<view class="box" />')
    expect(removed.meta?.sfcSrcDeps).toEqual(initial.meta?.sfcSrcDeps)

    css = '.box { color: v-bind("color"); }'
    const readded = await compileVueFile(source, filename, options)
    expectCssVarContract(readded)
    expect(readded.meta?.cssVars).toEqual(['color'])
    expect(readded.meta?.sfcSrcDeps).toEqual(initial.meta?.sfcSrcDeps)
    expect(readCount).toBe(4)
  })

  it.each([false, true])('keeps stateful development CSS variable imports stable without project Vue (skipComponentTransform: %s)', async (skipComponentTransform) => {
    const filename = path.resolve('src/pages/style/stable.vue')
    const styleFilename = path.join(path.dirname(filename), 'stable.css')
    const source = `
<script setup>
import { ref } from 'wevu'
const color = ref('red')
</script>
<template><view class="box" /></template>
<style src="./stable.css"></style>
`.trim()
    let css = '.box { color: v-bind(color); }'
    const options = {
      stabilizeCssVarsRuntime: true,
      skipComponentTransform,
      sfcSrc: {
        resolveId: async () => styleFilename,
        readFile: async () => css,
      },
    }

    const results: VueTransformResult[] = []
    for (const content of [
      '.box { color: black; }',
      '.box { color: v-bind(color); }',
      '.box { color: black; }',
      '.box { color: v-bind(color); }',
    ]) {
      css = content
      results.push(await compileVueFile(source, filename, options))
    }

    const [empty, initial, removed, restored] = results
    expect(empty.meta?.cssVars).toEqual([])
    expect(initial.meta?.cssVars).toEqual(['color'])
    expect(removed.meta?.cssVars).toEqual([])
    expect(restored.meta?.cssVars).toEqual(['color'])
    for (const result of results) {
      expect(result.template).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
      expect(result.script).toContain('useCssVars')
      expect(result.script).toContain('unref')
      expect(collectRuntimeImportContract(result.script)).toContain('virtual:weapp-vite/runtime/reactivity:unref')
      expect(collectRuntimeImportContract(result.script).some(entry => entry.startsWith('vue:'))).toBe(false)
      expectCssVarContract(result)
    }
    expect(collectRuntimeImportContract(empty.script)).toEqual(collectRuntimeImportContract(initial.script))
    expect(collectRuntimeImportContract(removed.script)).toEqual(collectRuntimeImportContract(initial.script))
    expect(collectRuntimeImportContract(restored.script)).toEqual(collectRuntimeImportContract(initial.script))
  })
})
