import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

function createCtx(
  root: string,
  weappViteConfig: Record<string, any>,
  pages: string[] = ['pages/home/index'],
) {
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
      appEntry: { json: { pages } },
      loadAppEntry: async () => ({ json: { pages } }),
      loadSubPackages: () => [],
    },
  } as any
}

describe('wevu defaults compile-time merge', () => {
  it('injects component defaults into component options', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-defaults-comp-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, {
        wevu: {
          defaults: {
            component: {
              options: {
                virtualHost: true,
                styleIsolation: 'apply-shared',
              },
              setData: {
                includeComputed: false,
              },
            },
          },
        },
      }))
      const file = path.join(srcRoot, 'components', 'demo', 'index.vue')

      const transformed = await plugin.transform!(
        `
<template><view>ok</view></template>
<script setup lang="ts">
const count = 0
</script>
        `.trim(),
        file,
      )

      expect(transformed?.code).toContain('virtualHost')
      expect(transformed?.code).toContain('apply-shared')
      expect(transformed?.code).toContain('includeComputed')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('disables virtualHost defaults for pages by default', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-defaults-page-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, {
        wevu: {
          defaults: {
            component: {
              options: {
                virtualHost: true,
                styleIsolation: 'apply-shared',
              },
            },
          },
        },
      }))
      const file = path.join(srcRoot, 'pages', 'home', 'index.vue')

      const transformed = await plugin.transform!(
        `
<template><view>page</view></template>
<script setup lang="ts">
const count = 0
</script>
        `.trim(),
        file,
      )

      expect(transformed?.code).toMatch(/virtualHost:\s*false/)
    }
    finally {
      await fs.remove(root)
    }
  })
})
