import { describe, expect, it } from 'vitest'
import { createSidecarSourceSpecifier } from '../moduleGraph/protocol'
import { transformUniAppCompatibilitySource, uniAppCompatibility, UniAppCompatibilityTransformError } from './uniApp'

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
    expect(external.code).toContain(`import { createUniAppHost as __wevuCreateUniAppHost } from 'wevu/internal-runtime'`)
    expect(external.code).toContain('const uni = __wevuCreateUniAppHost(wx)')
  })

  it('does not touch unrelated dependencies or other mini-program platforms', async () => {
    const plugin = uniAppCompatibility(createContext())[0]
    expect(await (plugin.transform as any)('const value = uni.test()', '/project/node_modules/other/index.ts')).toBeNull()
    expect(uniAppCompatibility(createContext({ platform: 'alipay' }))).toEqual([])
  })

  it('transforms explicit Vue virtual blocks and skips graph-tracking sidecar sources', async () => {
    const plugin = uniAppCompatibility(createContext())[0]
    const transform = plugin.transform as any
    const owner = encodeURIComponent('/project/src/pages/index.vue')
    const scriptId = `/project/src/pages/index.vue?raw&weapp-vite-sidecar-owner=${owner}&weapp-vite-sidecar=script&lang.js`
    const jsonId = `/project/src/pages/index.vue?raw&weapp-vite-sidecar-owner=${owner}&weapp-vite-sidecar=json&lang.js`
    const styleId = '/project/src/pages/index.vue?weapp-vite-vue&type=style&index=0&lang.css'
    expect(await transform(`export default ${JSON.stringify(`<script>\n// #ifdef MP-WEIXIN\nexport default {}\n// #endif\n</script>`)}`, scriptId)).toBeNull()
    expect(await transform('/* #ifdef MP-WEIXIN */\n.ready {}\n/* #endif */', styleId)).toMatchObject({
      code: expect.stringContaining('.ready {}'),
    })
    expect(await transform('{ "component": true }', jsonId)).toBeNull()
  })
})

describe('shared uni-app compiler input preparation', () => {
  const source = `<template>
<!-- #ifdef MP-WEIXIN -->
<view>wechat-only</view>
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<Child><template #default="{ value }">{{ value }}</template></Child>
<!-- #endif -->
</template>
<script>
import Child from './Child.vue'
export default { components: { Child } }
</script>`

  it.each([
    '/project/src/components/Table.vue',
    '/project/node_modules/@wot-ui/ui/components/Table.vue',
  ])('prepares the same platform branches for normal and direct compilation of %s', (id) => {
    const context = createContext()
    const prepared = transformUniAppCompatibilitySource(context.configService, source, id)
    const hook = uniAppCompatibility(context)[0].transform as any
    expect(prepared).toContain('<view>wechat-only</view>')
    expect(prepared).not.toContain('<Child>')
    expect(prepared).not.toContain('#default')
    expect(prepared).toContain('import Child from \'./Child.vue\'')
    expect(hook(source, id)).toEqual({ code: prepared, map: null })
    expect(transformUniAppCompatibilitySource(context.configService, prepared, id)).toBe(prepared)
  })

  it.each([
    ['disabled compatibility', { weappViteConfig: { uniApp: false } }, '/project/src/Table.vue'],
    ['another platform', { platform: 'alipay' }, '/project/src/Table.vue'],
    ['unrelated package', {}, '/project/node_modules/unrelated/Table.vue'],
    ['unsupported extension', {}, '/project/src/Table.json'],
    ['virtual module', {}, '\0/project/src/Table.vue'],
    ['unsupported virtual block', {}, '/project/src/Table.vue?weapp-vite-vue&type=custom'],
    ['graph sidecar source', {}, createSidecarSourceSpecifier('/project/src/Table.vue', '/project/src/Table.vue', 'template')],
  ] as const)('preserves raw input for %s', (_name, overrides, id) => {
    expect(transformUniAppCompatibilitySource(createContext(overrides).configService, source, id)).toBe(source)
  })

  it('prepares external blocks by their declared type while retaining sidecar ownership', () => {
    const config = createContext().configService
    const template = '<view>active</view>\n<!-- #ifndef MP-WEIXIN -->\n<Hidden />\n<!-- #endif -->'
    expect(transformUniAppCompatibilitySource(config, template, '/project/src/template.ts', 'template')).toContain('<view>active</view>')
    expect(transformUniAppCompatibilitySource(config, template, '/project/src/template.ts', 'template')).not.toContain('<Hidden />')
    const script = 'import { ref } from "vue"'
    expect(transformUniAppCompatibilitySource(config, script, '/project/src/setup.html', 'script')).toMatch(/from\s+['"]wevu['"]/)
    expect(transformUniAppCompatibilitySource(config, script, '/project/src/setup.html')).toBe(script)
    const sidecar = createSidecarSourceSpecifier('/project/src/Table.vue', '/project/src/Table.vue', 'template')
    expect(transformUniAppCompatibilitySource(config, template, sidecar, 'template')).toBe(template)
  })

  it.each([
    ['/project/src/Invalid.vue', '<project-source>', 'sfc'],
    ['/project/node_modules/@wot-ui/ui/Invalid.vue?weapp-vite-vue&type=script', '@wot-ui/ui', 'script'],
  ])('retains preprocessing failure context for %s', (id, packageName, block) => {
    const input = block === 'sfc' ? '<script>const = 1</script>' : 'const = 1'
    let failure: unknown
    try {
      transformUniAppCompatibilitySource(createContext().configService, input, id)
    }
    catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(UniAppCompatibilityTransformError)
    expect(failure).toMatchObject({
      message: expect.stringContaining(`[uni-app] package=${packageName} file=${id.split('?', 1)[0]} block=${block}:`),
      cause: expect.any(Error),
    })
  })
})
