import { describe, expect, it } from 'vitest'
import { uniAppCompatibility } from './uniApp'

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    configService: {
      absoluteSrcRoot: '/project/src',
      platform: 'weapp',
      weappViteConfig: {
        uniApp: { include: ['@wot-ui/ui'] },
      },
      ...overrides,
    },
  } as any
}

describe('uniAppCompatibility plugin', () => {
  it('transforms project and included package sources', async () => {
    const plugin = uniAppCompatibility(createContext())[0]
    const transform = plugin.transform as any
    const local = await transform('<script setup>\nimport { ref } from "vue"\n</script>', '/project/src/pages/index.vue')
    const external = await transform('export const platform = uni.getSystemInfoSync()', '/project/node_modules/@wot-ui/ui/common/util.ts')
    expect(local.code).toMatch(/from\s+['"]wevu['"]/)
    expect(external.code).toContain('const uni = wx')
  })

  it('does not touch unrelated dependencies or other mini-program platforms', async () => {
    const plugin = uniAppCompatibility(createContext())[0]
    expect(await (plugin.transform as any)('const value = uni.test()', '/project/node_modules/other/index.ts')).toBeNull()
    expect(uniAppCompatibility(createContext({ platform: 'alipay' }))).toEqual([])
  })

  it('uses explicit sidecar block types and ignores json sidecars', async () => {
    const plugin = uniAppCompatibility(createContext())[0]
    const transform = plugin.transform as any
    const owner = encodeURIComponent('/project/src/pages/index.vue')
    const scriptId = `/project/src/pages/index.vue?raw&weapp-vite-sidecar-owner=${owner}&weapp-vite-sidecar=script&lang.js`
    const jsonId = `/project/src/pages/index.vue?raw&weapp-vite-sidecar-owner=${owner}&weapp-vite-sidecar=json&lang.js`
    const styleId = '/project/src/pages/index.vue?weapp-vite-vue&type=style&index=0&lang.css'
    const result = await transform(`import { ref } from 'vue'\nconst info = uni.getSystemInfoSync()`, scriptId)
    expect(result.code).toContain('const uni = wx')
    expect(result.code).toContain('wevu')
    expect(await transform('/* #ifdef MP-WEIXIN */\n.ready {}\n/* #endif */', styleId)).toMatchObject({
      code: expect.stringContaining('.ready {}'),
    })
    expect(await transform('{ "component": true }', jsonId)).toBeNull()
  })
})
