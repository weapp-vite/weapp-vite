import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { vuePlugin } from '../../src/plugins/vue'
import { createVueResolverPlugin, getSourceFromVirtualId, getVirtualModuleId } from '../../src/plugins/vue/resolver'
import { buildWeappVueStyleRequest, WEAPP_VUE_STYLE_VIRTUAL_PREFIX } from '../../src/plugins/vue/transform/styleRequest'
import { createVueWatchPlugin } from '../../src/plugins/vue/watch'

const {
  compilerPathExistsMock,
  compilerReadFileMock,
} = vi.hoisted(() => {
  return {
    compilerPathExistsMock: vi.fn(),
    compilerReadFileMock: vi.fn(),
  }
})

vi.mock('wevu/compiler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wevu/compiler')>()
  return {
    __esModule: true,
    ...actual,
    pathExists: compilerPathExistsMock,
    readFile: compilerReadFileMock,
  }
})

describe('vue plugin misc coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    compilerPathExistsMock.mockReset()
    compilerReadFileMock.mockReset()
  })

  it('resolver resolves virtual ids and reads files', async () => {
    compilerReadFileMock.mockResolvedValue('code from file')
    compilerPathExistsMock.mockResolvedValue(true)
    const ctx: any = {
      configService: {
        cwd: '/root',
        absoluteSrcRoot: '/root/src',
      },
    }
    const plugin = createVueResolverPlugin(ctx)

    const resolvedVueId = await plugin.resolveId!('/root/src/foo.vue', '/root/src/app.vue')
    expect(resolvedVueId).toBe('/root/src/foo.vue')

    // 非虚拟模块时，交给 Vite 默认 loader 处理
    expect(await plugin.load!(resolvedVueId as string)).toBeNull()

    const styleRequestId = buildWeappVueStyleRequest('/root/src/pages/index/index.vue', { lang: 'css' } as any, 0)
    const resolvedStyleId = await plugin.resolveId!(styleRequestId, '/root/src/app.vue')
    expect(resolvedStyleId?.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX)).toBe(false)
    expect(resolvedStyleId?.startsWith('/root/src/pages/index/index.vue?')).toBe(true)
    expect(resolvedStyleId).toContain('weapp-vite-vue&type=style')
    expect(resolvedStyleId).toContain('lang.css')

    // 仍兼容读取虚拟模块（用于历史兼容与工具函数覆盖）
    const virtualId = `\0vue:/root/src/foo.vue`
    const loaded = await plugin.load!(virtualId)
    expect(compilerReadFileMock).toHaveBeenCalledWith('/root/src/foo.vue', {
      checkMtime: false,
      encoding: 'utf-8',
    })
    expect(loaded?.moduleSideEffects).toBe(false)

    const noExt = await plugin.resolveId!('./pages/home/index', '/root/src/app.vue')
    expect(noExt).toBe(path.resolve('/root/src/pages/home/index.vue'))
    expect(compilerPathExistsMock).toHaveBeenCalled()

    expect(getVirtualModuleId('abc')).toBe('\0vue:abc')
    expect(getSourceFromVirtualId('\0vue:xyz')).toBe('xyz')
  })

  it('defers aliased vue requests to downstream alias resolvers', async () => {
    const ctx: any = {
      configService: {
        cwd: '/root',
        absoluteSrcRoot: '/root/src',
      },
    }
    const plugin = createVueResolverPlugin(ctx)

    expect(await plugin.resolveId!('@/components/HelloWorld/index.vue', '/root/src/pages/index/index.vue')).toBeNull()
    expect(await plugin.resolveId!('~components/HelloWorld/index', '/root/src/pages/index/index.vue')).toBeNull()
  })

  it('watch plugin triggers full reload on vue changes', async () => {
    const send = vi.fn()
    let changeCb: ((id: string) => void) | undefined
    const addWatchFile = vi.fn()
    const watcher = {
      addWatchFile,
      on(event: string, cb: (id: string) => void) {
        if (event === 'change') {
          changeCb = cb
        }
      },
    }
    const server: any = {
      watcher,
      moduleGraph: {
        getModuleById: vi.fn().mockReturnValue({ id: 'foo' }),
      },
      ws: { send },
    }
    const plugin = createVueWatchPlugin({} as any)
    plugin.configureServer?.(server)
    changeCb?.('file.vue')
    expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: 'file.vue' })
    expect(addWatchFile).not.toHaveBeenCalled()

    const hotResult = await plugin.handleHotUpdate!({ file: 'not-vue.js' } as any)
    expect(hotResult).toBeUndefined()
  })

  it('runtime helpers proxy to wevu defineComponent and passthrough helpers', async () => {
    const defineComponent = vi.fn()
    vi.doMock('wevu', () => ({ defineComponent }))
    const runtime = await import('../../src/plugins/vue/runtime')

    runtime.createWevuComponent({
      data: () => ({ a: 1 }),
      properties: { foo: String },
      methods: { hi: () => 'x' },
    })
    expect(defineComponent).toHaveBeenCalled()
    const passed = defineComponent.mock.calls[0][0]
    expect(passed.allowNullPropInput).toBe(true)
    expect(passed.properties).toEqual({ foo: String })

    runtime.createWevuComponent({
      allowNullPropInput: false,
      properties: { bar: Number },
    })
    expect(defineComponent.mock.calls[1][0].allowNullPropInput).toBe(false)

    const props = runtime.defineProps({ foo: 'bar' })
    expect(props).toEqual({ foo: 'bar' })
    const emits = runtime.defineEmits(['a', 'b'])
    expect(emits).toEqual(['a', 'b'])
  })

  it('vuePlugin returns plugins or empty when disabled', () => {
    const ctx: any = {}
    const enabled = vuePlugin(ctx)
    expect(enabled.length).toBe(3)
    const disabled = vuePlugin(ctx, { enable: false })
    expect(disabled).toEqual([])
  })
})
