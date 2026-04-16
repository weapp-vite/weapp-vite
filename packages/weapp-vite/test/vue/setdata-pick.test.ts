import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

function createCtx(root: string, weappViteConfig: Record<string, any> = {}) {
  const absoluteSrcRoot = path.join(root, 'src')
  return {
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
    scanService: {
      appEntry: { json: { pages: ['pages/index/index'] } },
      loadAppEntry: async () => ({ json: { pages: ['pages/index/index'] } }),
      loadSubPackages: () => [],
    },
  } as any
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

      const transformed = await plugin.transform!(
        `
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
        `.trim(),
        file,
      )

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

      const transformed = await plugin.transform!(
        `
<template>
  <view>{{ count }}</view>
</template>
<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
</script>
        `.trim(),
        file,
      )

      expect(transformed?.code).not.toContain('setData')
      expect(transformed?.code).not.toContain('pick')
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

      const transformed = await plugin.transform!(
        `
<template>
  <view>{{ count }}</view>
</template>
<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
</script>
        `.trim(),
        file,
      )

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

      const transformed = await plugin.transform!(
        `
<template>
  <view>{{ count }}</view>
</template>
<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
</script>
        `.trim(),
        file,
      )

      expect(transformed?.code).toContain('setData')
      expect(transformed?.code).not.toContain('pick:')
    }
    finally {
      await fs.remove(root)
    }
  })
})
