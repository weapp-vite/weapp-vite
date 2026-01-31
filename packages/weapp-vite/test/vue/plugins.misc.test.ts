import fs from 'fs-extra'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { vuePlugin } from '../../src/plugins/vue'
import { createVueResolverPlugin, getSourceFromVirtualId, getVirtualModuleId } from '../../src/plugins/vue/resolver'
import { buildWeappVueStyleRequest, WEAPP_VUE_STYLE_VIRTUAL_PREFIX } from '../../src/plugins/vue/transform/styleRequest'
import { createVueWatchPlugin } from '../../src/plugins/vue/watch'

describe('vue plugin misc coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolver resolves virtual ids and reads files', async () => {
    const readFile = vi.spyOn(fs, 'readFile').mockResolvedValue('code from file')
    const pathExists = vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
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
    expect(readFile).toHaveBeenCalledWith('/root/src/foo.vue', 'utf-8')
    expect(loaded?.moduleSideEffects).toBe(false)

    const noExt = await plugin.resolveId!('./pages/home/index', '/root/src/app.vue')
    expect(noExt).toBe(path.resolve('/root/src/pages/home/index.vue'))
    expect(pathExists).toHaveBeenCalled()

    expect(getVirtualModuleId('abc')).toBe('\0vue:abc')
    expect(getSourceFromVirtualId('\0vue:xyz')).toBe('xyz')
  })

  it('watch plugin triggers full reload on vue changes', async () => {
    const send = vi.fn()
    let changeCb: ((id: string) => void) | undefined
    const watcher = {
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
    expect(passed.properties).toEqual({ foo: String })

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
