import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { reactive } from '../../../../../../wevu/src/reactivity/reactive'
import { ref, unref } from '../../../../../../wevu/src/reactivity/ref'
import { generate, parse, traverse } from '../../../../utils/babel'
import { compileVueTemplateToWxml } from '../../compiler/template'
import { buildScopedSlotComponentScript } from '../../compiler/template/scopedSlotScript'
import { compileVueFile } from './index'

interface InlineEntry {
  fn: (context: Record<string, unknown>, scope: Record<string, unknown>) => unknown
}

function evaluateInlineMap(source: string) {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] })
  const helpers: Record<string, unknown> = {}
  let map: t.ObjectExpression | undefined
  traverse(ast, {
    ImportDeclaration(path) {
      for (const specifier of path.node.specifiers) {
        if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported, { name: 'unref' })) {
          helpers[specifier.local.name] = unref
        }
      }
    },
    ObjectExpression(path) {
      if (path.node.properties.some(property => (
        t.isObjectProperty(property)
        && t.isStringLiteral(property.key, { value: 'i0' })
        && t.isObjectExpression(property.value)
      ))) {
        map = path.node
      }
    },
  })
  expect(map).toBeDefined()
  return runInNewContext(`(${generate(map!).code})`, helpers) as Record<string, InlineEntry>
}

async function compileHandler(script: string, expression: string) {
  const result = await compileVueFile(
    `<script setup lang="ts">${script}</script><template><button @tap="${expression}" /></template>`,
    'src/pages/issue-1313/index.vue',
  )
  return evaluateInlineMap(result.script!).i0!.fn
}

describe('issue #1313: inline maybe-ref reads', () => {
  it('executes both original reactive toggles without inserting a ref-only property access', async () => {
    const source = await readFile(new URL('../../../../../../../e2e-apps/github-issues/fixtures/issue-1313/src/pages/index/index.vue', import.meta.url), 'utf8')
    const result = await compileVueFile(source, 'src/pages/issue-1313/index.vue')
    const handlers = evaluateInlineMap(result.script!)
    const controls = reactive({ scope: false, settings: false })
    const context = { controls }

    handlers.i0!.fn(context, {})
    expect(controls).toEqual({ scope: true, settings: false })
    handlers.i1!.fn(context, {})
    expect(controls).toEqual({ scope: true, settings: true })
    handlers.i0!.fn(context, {})
    handlers.i1!.fn(context, {})
    expect(controls).toEqual({ scope: false, settings: false })
  })

  it.each([
    ['alias', 'import { reactive as makeState } from \'wevu\'; const controls = makeState({ scope: false })', () => reactive({ scope: false })],
    ['reactive factory', 'import { reactive } from \'wevu\'; const create = () => reactive({ scope: false }); const controls = create()', () => reactive({ scope: false })],
    ['plain factory', 'const create = () => ({ scope: false }); const controls = create()', () => ({ scope: false })],
    ['ref factory', 'import { ref } from \'wevu\'; const create = () => ref({ scope: false }); const controls = create()', () => ref({ scope: false })],
    ['known ref', 'import { ref } from \'vue\'; const controls = ref({ scope: false })', () => ref({ scope: false })],
  ] as const)('keeps property writes on %s results', async (_name, script, create) => {
    const handler = await compileHandler(script, 'controls.scope = !controls.scope')
    const controls = create()
    handler({ controls }, {})
    expect(unref(controls).scope).toBe(true)
    handler({ controls }, {})
    expect(unref(controls).scope).toBe(false)
  })

  it.each([0, false, '', null, undefined, { value: 7 }])('preserves the maybe-ref argument %j', async (value) => {
    const handler = await compileHandler('const create = () => null; const value = create()', 'capture(value)')
    expect(handler({ value, capture: (input: unknown) => input }, {})).toBe(value)
  })

  it.each(['wevu', 'vue'])('preserves bare ref writes and explicit value accesses from %s', async (moduleName) => {
    const handler = await compileHandler(
      `import { ref } from '${moduleName}'; const count = ref(0); const next = { count: 8 }`,
      '(count = count + 1, count += 2, count++, ++count, ({ count } = next), count.value += 1, count)',
    )
    const count = ref(0)
    expect(handler({ count, next: { count: 8 } }, {})).toBe(9)
    expect(count.value).toBe(9)
  })

  it('keeps nested member writes, optional reads and callback locals on their original owners', async () => {
    const handler = await compileHandler(
      'import { reactive } from \'wevu\'; const controls = reactive({ scope: 0 }); const next = { scope: 4 }',
      '([2].map(controls => controls + 1)[0], controls.scope += 2, controls.scope++, ++controls.scope, ({ scope: controls.scope } = next), controls?.scope)',
    )
    const controls = reactive({ scope: 0 })
    expect(handler({ controls, next: { scope: 4 } }, {})).toBe(4)
    expect(controls.scope).toBe(4)
  })

  it('isolates helper imports from component bindings, expression locals and neighboring handlers', async () => {
    const result = await compileVueFile(`<script setup lang="ts">
import { reactive } from 'wevu'
const controls = reactive({ scope: false })
const _wevuInlineUnref = 7
const _unref = 11
</script><template>
<button @tap="(( _unref2 ) => { controls.scope = !controls.scope; return _unref2 + _unref + _wevuInlineUnref })(3)" />
<button @tap="controls.scope = !controls.scope" />
</template>`, 'src/pages/helper-conflicts/index.vue')
    const handlers = evaluateInlineMap(result.script!)
    const context = { controls: reactive({ scope: false }), _wevuInlineUnref: 7, _unref: 11 }
    expect(handlers.i0!.fn(context, {})).toBe(21)
    expect(context.controls.scope).toBe(true)
    handlers.i1!.fn(context, {})
    expect(context.controls.scope).toBe(false)
  })

  it('binds the same helper contract in generated scoped-slot scripts', () => {
    const template = compileVueTemplateToWxml('<button @tap="controls.scope = !controls.scope" />', 'src/components/slot.vue', {
      scriptSetupBindings: { controls: 'setup-maybe-ref' },
    })
    expect(template.diagnostics).toEqual([])
    const source = buildScopedSlotComponentScript({
      classStyleBindings: [],
      inlineExpressions: template.inlineExpressions!,
      layoutHosts: [],
      templateRefs: [],
      bindingManifest: template.bindingManifest,
      runtimeBindingManifest: 'diagnostic',
    })
    const handler = evaluateInlineMap(source).i0!.fn
    for (const controls of [reactive({ scope: false }), ref({ scope: false })]) {
      handler({ controls }, {})
      expect(unref(controls).scope).toBe(true)
    }
  })

  it('adds no unref helper for definite refs or ordinary lexical bindings', async () => {
    const result = await compileVueFile(`<script setup>import { ref } from 'vue'; const count = ref(0)</script><template><button @tap="count++" /></template>`, 'src/pages/known-ref.vue')
    const ast = parse(result.script!, { sourceType: 'module' })
    const imports = ast.program.body.filter(t.isImportDeclaration)
    expect(imports.flatMap(node => node.specifiers).some(specifier => t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported, { name: 'unref' }))).toBe(false)
    const count = ref(0)
    evaluateInlineMap(result.script!).i0!.fn({ count }, {})
    expect(count.value).toBe(1)
  })
})
