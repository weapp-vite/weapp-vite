import os from 'node:os'
import { WEVU_SLOT_NAMES_PROP, WEVU_SLOT_OWNER_ID_KEY, WEVU_SLOT_OWNER_ID_PROP, WEVU_SLOT_SCOPE_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'
import { callPluginHook } from '../pluginHook'
import { createTestModuleGraphService } from './moduleGraph'

function createCtx(root: string, weappViteConfig: Record<string, any> = {}) {
  const absoluteSrcRoot = path.join(root, 'src')
  return {
    moduleGraphService: createTestModuleGraphService(),
    runtimeState: {
      scan: {
        isDirty: false,
      },
    },
    configService: {
      cwd: root,
      absoluteSrcRoot,
      weappViteConfig,
      isDev: true,
      relativeOutputPath(absoluteBase: string) {
        if (!absoluteBase.startsWith(`${absoluteSrcRoot}/`)) {
          return undefined
        }
        return absoluteBase.slice(absoluteSrcRoot.length + 1).replace(/\\/g, '/')
      },
      relativeCwd(p: string) {
        return path.relative(root, p).replace(/\\/g, '/')
      },
    },
    resolve(source: string, importer?: string) {
      return Promise.resolve({
        id: importer ? path.resolve(path.dirname(importer), source) : source,
      })
    },
    scanService: {
      appEntry: { json: { pages: ['pages/index/index'] } },
      loadAppEntry: async () => ({ json: { pages: ['pages/index/index'] } }),
      loadSubPackages: () => [],
    },
  } as any
}

function getSetDataPickSection(code: string | undefined) {
  return code?.match(/setData\s*:\s*\{\s*pick\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
}

describe('auto setData.pick injection', () => {
  it('injects setData.pick when wevu.autoSetDataPick is enabled', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-setdata-pick-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, {
        wevu: {
          autoSetDataPick: true,
        },
      }))
      const file = path.join(srcRoot, 'components/card.vue')

      const transformed = await callPluginHook(plugin.transform as any, {}, `
<template>
  <view>{{ count }}</view>
  <view wx:for="{{ list }}" wx:for-item="row">{{ row.label }}</view>
  <view>{{ sayHello() }}</view>
</template>
<script setup lang="ts">
import { computed, ref } from 'wevu'
const count = ref(0)
const list = ref([{ label: 'a' }])
const sayHello = () => 'hi'
const text = computed(() => list.value.length)
</script>
        `.trim(), file)

      expect(transformed?.code).toContain('setData')
      expect(transformed?.code).toContain('pick')
      expect(transformed?.code).toContain('"count"')
      expect(transformed?.code).toContain('"list"')
      expect(transformed?.code).toContain('"__wv_bind_0"')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('does not inject setData.pick when wevu.autoSetDataPick is disabled', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-setdata-pick-off-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root))
      const file = path.join(srcRoot, 'components/card.vue')

      const transformed = await callPluginHook(plugin.transform as any, {}, `
<template>
  <view>{{ count }}</view>
</template>
<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
</script>
        `.trim(), file)

      expect(transformed?.code).not.toContain('setData')
      expect(transformed?.code).not.toContain('pick')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('injects scoped slot owner pick when autoSetDataPick is disabled', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-setdata-pick-scoped-slot-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, {
        wevu: {
          autoSetDataPick: false,
        },
      }))
      const file = path.join(srcRoot, 'pages/index/index.vue')

      const transformed = await callPluginHook(plugin.transform as any, {}, `
<template>
  <SlotCell
    :p0="{ value: count }"
    :p1="{ value: count + 1 }"
    __wvSlotOwnerId="{{__wvOwnerId || ''}}"
  />
</template>
<script setup lang="ts">
import SlotCell from '../../components/SlotCell/index.vue'

const count = 1
</script>
        `.trim(), file)

      const pickSection = getSetDataPickSection(transformed?.code)
      expect(transformed?.code).toContain('setData')
      expect(pickSection).toContain(`"${WEVU_SLOT_OWNER_ID_KEY}"`)
      expect(pickSection).toContain(`"${WEVU_SLOT_NAMES_PROP}"`)
      expect(pickSection).toContain(`"${WEVU_SLOT_OWNER_ID_PROP}"`)
      expect(pickSection).toContain(`"${WEVU_SLOT_SCOPE_KEY}"`)
      expect(pickSection).toContain('"__wv_bind_0"')
      expect(pickSection).toContain('"__wv_bind_1"')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('uses owner id pick for oversized scoped slot host pages even when autoSetDataPick is enabled', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-setdata-pick-scoped-slot-large-'))
    const srcRoot = path.join(root, 'src')
    const attrs = Array.from({ length: 201 }, (_, index) => `:p${index}="{ value: count + ${index} }"`).join('\n    ')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, {
        wevu: {
          autoSetDataPick: true,
        },
      }))
      const file = path.join(srcRoot, 'pages/index/index.vue')

      const transformed = await callPluginHook(plugin.transform as any, {}, `
<template>
  <view>{{ count }}</view>
  <SlotCell
    ${attrs}
    __wvSlotOwnerId="{{__wvOwnerId || ''}}"
  />
</template>
<script setup lang="ts">
import SlotCell from '../../components/SlotCell/index.vue'

const count = 1
</script>
        `.trim(), file)

      const pickSection = getSetDataPickSection(transformed?.code)
      expect(pickSection).toContain(`"${WEVU_SLOT_OWNER_ID_KEY}"`)
      expect(pickSection).toContain(`"${WEVU_SLOT_NAMES_PROP}"`)
      expect(pickSection).toContain(`"${WEVU_SLOT_OWNER_ID_PROP}"`)
      expect(pickSection).toContain(`"${WEVU_SLOT_SCOPE_KEY}"`)
      expect(pickSection).toContain('"count"')
      expect(pickSection).not.toContain('"__wv_bind_0"')
      expect(pickSection).not.toContain('"__wv_bind_200"')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('injects setData.pick when performance preset is enabled', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-setdata-pick-preset-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, {
        wevu: {
          preset: 'performance',
        },
      }))
      const file = path.join(srcRoot, 'components/card.vue')

      const transformed = await callPluginHook(plugin.transform as any, {}, `
<template>
  <view>{{ count }}</view>
</template>
<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
</script>
        `.trim(), file)

      expect(transformed?.code).toContain('setData')
      expect(transformed?.code).toContain('pick')
      expect(transformed?.code).toContain('"count"')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('respects explicit autoSetDataPick=false even with performance preset', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-setdata-pick-preset-off-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, {
        wevu: {
          preset: 'performance',
          autoSetDataPick: false,
        },
      }))
      const file = path.join(srcRoot, 'components/card.vue')

      const transformed = await callPluginHook(plugin.transform as any, {}, `
<template>
  <view>{{ count }}</view>
</template>
<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
</script>
        `.trim(), file)

      expect(transformed?.code).toContain('setData')
      expect(transformed?.code).not.toContain('pick:')
    }
    finally {
      await fs.remove(root)
    }
  })
})
