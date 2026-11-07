import type { InternalRuntimeState, RuntimeApp } from '../../../../../wevu/src/runtime/types'
import { runInNewContext } from 'node:vm'
import { WEVU_NATIVE_DECLARATION_METHOD, WEVU_NATIVE_SLOT_PARENT_METHOD, WEVU_SCOPED_SLOT_CREATOR_KEY } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WE_VU_COMPILER_REACTIVITY_MODULE_ID,
  WE_VU_COMPILER_RUNTIME_MODULE_ID,
} from '../../../constants'
import { generate, parseJsLike } from '../../../utils/babel'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from '../compiler/template'
import { compileVueFile } from './compileVueFile'
import { transformScript } from './script'

function executeRuntimeScript(code: string, modules: Record<string, object>): unknown {
  const ast = parseJsLike(code)
  const globals: Record<string, unknown> = {}
  ast.program.body = ast.program.body.filter((statement) => {
    if (t.isExportDefaultDeclaration(statement)) {
      return false
    }
    if (!t.isImportDeclaration(statement)) {
      return true
    }
    const module = modules[statement.source.value]
    if (!module) {
      throw new Error(`Unexpected runtime module: ${statement.source.value}`)
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) {
        throw new Error('Expected a named runtime import')
      }
      const name = t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value
      globals[specifier.local.name] = Reflect.get(module, name)
    }
    return false
  })
  return runInNewContext(generate(ast).code, globals)
}

beforeEach(() => {
  // 静态导入会复用已求值的运行时，无法验证首次安装边界。
  // 不能让其他用例安装的能力掩盖生成脚本遗漏或晚于注册的安装调用。
  vi.resetModules()
  vi.stubGlobal(WEVU_SCOPED_SLOT_CREATOR_KEY, undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generated capability scripts with the internal runtime', () => {
  it.each([
    ['scriptless', ''],
    ['JSON-only', '<script setup>defineComponentJson({ options: { virtualHost: true } })</script>'],
  ])('installs and mounts native slot owners from a %s component', async (_kind, script) => {
    const runtime = await import('../../../../../wevu/src/internal-runtime')
    const { getScopedSlotMountState, runtimeCapabilityRegistry } = await import('../../../../../wevu/src/runtime/capabilities')
    const { getOwnerProxy } = await import('../../../../../wevu/src/runtime/scopedSlots')
    expect(runtimeCapabilityRegistry.scopedSlots).toBeUndefined()
    const result = await compileVueFile(`${script}<template><view><slot /></view></template>`, 'src/layouts/default.vue', {
      sourceMap: false,
      template: {
        platform: getMiniProgramTemplatePlatform('weapp'),
        scopedSlotsRequireProps: true,
        nativeSlotContext: true,
      },
    })
    const register = vi.fn<(definition: Record<string, any>) => void>()
    vi.stubGlobal('Component', register)
    executeRuntimeScript(result.script!, { [WE_VU_COMPILER_RUNTIME_MODULE_ID]: runtime })
    expect(register).toHaveBeenCalledOnce()
    const definition = register.mock.calls[0]![0]
    expect(definition.methods[WEVU_NATIVE_SLOT_PARENT_METHOD]).toBeTypeOf('function')
    expect(definition.methods[WEVU_NATIVE_DECLARATION_METHOD]).toBeTypeOf('function')
    const instances = Array.from({ length: 2 }, () => ({
      data: { ...definition.data },
      properties: {},
      ...definition.methods,
      setData(value: Record<string, unknown>) {
        Object.assign(this.data, value)
      },
    } as InternalRuntimeState))
    const ownerIds: string[] = []
    try {
      for (const instance of instances) {
        definition.lifetimes.created.call(instance)
        definition.lifetimes.attached.call(instance)
        const state = getScopedSlotMountState(instance)
        expect(state?.ownerId).toBeTypeOf('string')
        expect(getOwnerProxy(state!.ownerId)).toBe(instance.__wevu!.proxy)
        ownerIds.push(state!.ownerId)
      }
      expect(new Set(ownerIds).size).toBe(2)
    }
    finally {
      for (const instance of instances) {
        definition.lifetimes.detached.call(instance)
      }
    }
    expect(ownerIds.map(getOwnerProxy)).toEqual([undefined, undefined])
  })

  it('mounts and patches outer options despite shadowed factory locals', async () => {
    const runtime = await import('../../../../../wevu/src/internal-runtime')
    const { nextTick } = await import('../../../../../wevu/src/scheduler')
    const result = transformScript(`
import { createApp } from 'wevu'
const strategy = 'patch'
const enabled = true
const warning = { enabled }
const options = {
  data: () => ({ count: 0 }),
  setData: { strategy, highFrequencyWarning: warning },
}
function boot() {
  const strategy = 'diff'
  const enabled = false
  const warning = false
  return createApp(options)
}
boot()
    `.trim(), { sourceMap: false })

    const app = executeRuntimeScript(result.code, {
      [WE_VU_COMPILER_RUNTIME_MODULE_ID]: runtime,
    }) as RuntimeApp<{ count: number }, Record<string, never>, Record<string, never>>
    const payloads: Array<Record<string, unknown>> = []
    const instance = app.mount({
      setData(payload) {
        payloads.push(payload)
      },
    })
    try {
      expect(instance.proxy.count).toBe(0)
      instance.proxy.count = 1
      await nextTick()
      await nextTick()
      expect(payloads.at(-1)).toMatchObject({ count: 1 })
    }
    finally {
      instance.unmount()
    }
  })

  it('registers extracted layout hosts on attach and removes them on detach', async () => {
    const runtime = await import('../../../../../wevu/src/internal-runtime')
    const reactivity = await import('../../../../../wevu/src/reactivity')
    const { resolveLayoutHost } = await import('../../../../../wevu/src/runtime/layoutBridge')
    const compiled = compileVueTemplateToWxml(`
<Card v-slot="{ item }">
  <t-toast layout-host="toast">{{ item }}</t-toast>
</Card>
    `.trim(), 'src/components/layout-slot.vue', {
      scopedSlotsCompiler: 'augmented',
      scopedSlotsRequireProps: false,
    })
    const asset = compiled.scopedSlotComponents?.[0]
    const binding = asset?.layoutHosts?.[0]
    if (!asset?.script || !binding) {
      throw new Error('Expected an extracted scoped slot with a layout host')
    }
    interface NativeDefinition {
      lifetimes: Record<'attached' | 'detached', (this: Record<string, unknown>) => void>
    }
    const registerComponent = vi.fn<(definition: NativeDefinition) => void>()
    vi.stubGlobal('Component', registerComponent)
    executeRuntimeScript(asset.script, {
      [WE_VU_COMPILER_RUNTIME_MODULE_ID]: runtime,
      [WE_VU_COMPILER_REACTIVITY_MODULE_ID]: reactivity,
    })
    const definition = registerComponent.mock.calls[0]?.[0]
    if (!definition) {
      throw new Error('Expected the generated scoped slot to register a native component')
    }
    const page = { route: 'pages/index/index', __wevuSetPageLayout() {} }
    const toast = { show: vi.fn() }
    const instance = {
      properties: {},
      setData: vi.fn(),
      selectOwnerComponent: () => page,
      selectComponent: (selector: string) => selector === binding.selector ? toast : null,
    }

    expect(resolveLayoutHost('toast', { context: page })).toBeNull()
    try {
      definition.lifetimes.attached.call(instance)
      expect(resolveLayoutHost('toast', { context: page })).toBe(toast)
    }
    finally {
      definition.lifetimes.detached.call(instance)
    }
    expect(resolveLayoutHost('toast', { context: page })).toBeNull()
  })
})
