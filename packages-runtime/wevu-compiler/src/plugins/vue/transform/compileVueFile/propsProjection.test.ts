import { runInNewContext } from 'node:vm'
import * as t from '@weapp-vite/ast/babelTypes'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as runtime from '../../../../../../wevu/src/internal-runtime'
import * as templateRuntime from '../../../../../../wevu/src/internal-template'
import * as reactivity from '../../../../../../wevu/src/reactivity'
import { nextTick } from '../../../../../../wevu/src/scheduler'
import { generate, parseJsLike } from '../../../../utils/babel'
import { generateScopedId } from '../scopedId'
import { compileVueFile } from './index'

vi.mock('../../../../utils/babel', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../utils/babel')>()
  return { ...original, parseJsLike: vi.fn(original.parseJsLike) }
})

afterEach(() => vi.unstubAllGlobals())

function registerGeneratedComponent(script: string) {
  let registered: Record<string, any> | undefined
  vi.stubGlobal('Component', (definition: Record<string, any>) => registered = definition)
  const ast = parseJsLike(script)
  const globals: Record<string, unknown> = { String, console }
  const modules: Record<string, object> = {
    'virtual:weapp-vite/runtime': runtime,
    'virtual:weapp-vite/runtime/template': templateRuntime,
    'virtual:weapp-vite/runtime/reactivity': reactivity,
    './props': { declaredProps: { canvasId: { type: String, default: '' } } },
  }
  ast.program.body = ast.program.body.filter((statement) => {
    if (t.isExportDefaultDeclaration(statement)) {
      return false
    }
    if (!t.isImportDeclaration(statement)) {
      return true
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) {
        throw new Error('Expected a named runtime import')
      }
      const name = t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value
      globals[specifier.local.name] = Reflect.get(modules[statement.source.value]!, name)
    }
    return false
  })
  runInNewContext(generate(ast).code, globals)
  return registered!
}

describe('setup bindings shadowing native props', () => {
  it('shares one compiled-script parse between props derivation and setup projection', async () => {
    const filename = 'src/components/shared-props-analysis.vue'
    const source = `<script setup>
import { ref } from 'wevu'
const props = defineProps({ canvasId: String })
const canvasId = ref(props.canvasId || 'shared-props-analysis')
</script><template><canvas :canvas-id="canvasId" /></template>`
    const { descriptor } = parse(source, { filename })
    const compiled = compileScript(descriptor, { id: generateScopedId(filename), isProd: false }).content
    vi.mocked(parseJsLike).mockClear()
    await compileVueFile(source, filename)
    const compiledScriptParses = vi.mocked(parseJsLike).mock.calls.filter(([input]) => input === compiled)
    expect(compiledScriptParses).toHaveLength(1)
  })

  it.each([
    ['inline', '', '{ canvasId: { type: String, default: "" } }'],
    ['imported', 'import { declaredProps } from "./props"', 'declaredProps'],
    ['spread', 'import { declaredProps } from "./props"', '{ ...declaredProps }'],
  ])('projects a same-name setup ref without writing the %s prop', async (_kind, imports, props) => {
    const result = await compileVueFile(`<script setup>
import { ref } from 'wevu'
${imports}
const props = defineProps(${props})
const canvasId = ref(props.canvasId || 'generated-canvas')
</script>
<template>
  <canvas :canvas-id="canvasId" />
  <text>{{ props.canvasId }}</text>
  <view v-for="canvasId in ['local-item']" :key="canvasId">{{ canvasId }}</view>
</template>`, 'src/components/projected-canvas.vue')
    const binding = result.bindingManifest?.bindings.find(item => item.sourceRoots.includes('canvasId') && item.kind === 'attribute')
    expect(binding?.outputPath).toMatch(/^__wv_bind_/)
    expect(result.template).toContain(`canvas-id="{{${binding!.outputPath}}}"`)
    expect(result.template).toContain('{{props.canvasId}}')
    expect(result.template).toContain('{{canvasId}}')
    expect(result.script).toMatch(/__wevuResolvePropValue\(this,\s*"canvasId",\s*this.canvasId\)/)

    const definition = registerGeneratedComponent(result.script!)
    const payloads: Record<string, unknown>[] = []
    const instance: any = {
      properties: { canvasId: '' },
      data: { canvasId: '' },
      triggerEvent: vi.fn(),
      setData(patch: Record<string, unknown>, complete?: () => void) {
        payloads.push(patch)
        Object.assign(this.data, patch)
        complete?.()
      },
    }
    definition.lifetimes.created.call(instance)
    definition.lifetimes.attached.call(instance)
    try {
      await nextTick()
      expect(instance.data[binding!.outputPath]).toBe('generated-canvas')
      instance.properties.canvasId = 'parent-canvas'
      definition.observers.canvasId.call(instance, 'parent-canvas', '')
      await nextTick()
      expect(instance.data[binding!.outputPath]).toBe('generated-canvas')
      expect(instance.__wevu.proxy.props.canvasId).toBe('parent-canvas')
      instance.__wevu.setupState.canvasId.value = 'updated-local-canvas'
      await nextTick()
      expect(instance.data[binding!.outputPath]).toBe('updated-local-canvas')
      expect(instance.properties.canvasId).toBe('parent-canvas')
      expect(payloads.some(patch => Object.hasOwn(patch, 'canvasId'))).toBe(false)
    }
    finally {
      definition.lifetimes.detached.call(instance)
    }
  })

  it('leaves unrelated setup state direct when declared prop names are known', async () => {
    const result = await compileVueFile(`<script setup>
import { ref } from 'wevu'
defineProps({ title: String })
const canvasId = ref('generated-canvas')
</script><template><canvas :canvas-id="canvasId" /></template>`, 'src/components/unrelated-canvas.vue')
    expect(result.template).toContain('canvas-id="{{canvasId}}"')
  })

  it('keeps scoped slot names local instead of projecting the outer setup binding', async () => {
    const result = await compileVueFile(`<script setup>
import { ref } from 'wevu'
import { declaredProps } from './props'
defineProps(declaredProps)
const canvasId = ref('outer-canvas')
</script><template><Panel v-slot="{ canvasId }"><canvas :canvas-id="canvasId" /></Panel></template>`, 'src/components/slot-canvas.vue')
    expect(result.script).not.toContain('模板运行时表达式执行失败: __wv_bind_')
    for (const asset of result.scopedSlotComponents ?? []) {
      expect(asset.script).not.toContain('模板运行时表达式执行失败: __wv_bind_')
    }
  })
})
