import type { Plugin } from 'vite'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { build } from 'vite'
import { createVueResolverPlugin } from '../../src/plugins/vue/resolver'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'
import { WEAPP_VUE_STYLE_VIRTUAL_PREFIX } from '../../src/plugins/vue/transform/styleRequest'
import { callPluginHook } from '../pluginHook'

function createCtx(root: string) {
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

describe('Vue SFC style pipeline', () => {
  it('injects a Vite CSS request for <style lang="scss"> and exposes style content via load()', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-style-pipeline-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root))
      const file = path.join(srcRoot, 'app.vue')

      const transformed = await callPluginHook(plugin.transform as any, {}, `
<template><view>app</view></template>
<script setup lang="ts">
defineAppJson({ pages: ['pages/index/index'] })
</script>
<style lang="scss">
.a { color: red; }
</style>
        `.trim(), file)

      const match = transformed?.code.match(/import\s+("([^"]+)");/)
      expect(match?.[1]).toBeTruthy()
      const styleRequestId = JSON.parse(match![1])
      expect(styleRequestId.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX)).toBe(true)
      expect(styleRequestId).toContain('?weapp-vite-vue&type=style&index=0&lang.scss')

      const loaded = await callPluginHook(plugin.load as any, {}, styleRequestId) as any

      expect(loaded?.code).toContain('.a { color: red; }')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('keeps SFC blocks isolated through real Vite/Rolldown plugin scheduling', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-sfc-routing-'))
    const srcRoot = path.join(root, 'src')
    const pageDir = path.join(srcRoot, 'pages', 'index')
    const componentDir = path.join(srcRoot, 'components')
    const pageFile = path.join(pageDir, 'index.vue')
    const componentFile = path.join(componentDir, 'RoutingProbe.vue')
    const styleInputs = new Map<string, string>()
    const vueInputs = new Map<string, string>()

    try {
      await fs.ensureDir(pageDir)
      await fs.ensureDir(componentDir)
      await fs.writeFile(path.join(pageDir, 'logic.ts'), [
        'import RoutingProbe from \'../../components/RoutingProbe.vue\'',
        'export const issue724ScriptMarker = \'issue-724-script-marker\'',
        'export default { components: { RoutingProbe } }',
      ].join('\n'), 'utf8')
      await fs.writeFile(path.join(pageDir, 'external.scss'), [
        '$issue724Color: #123456;',
        '.issue-724-style-src { color: $issue724Color; }',
      ].join('\n'), 'utf8')
      await fs.writeFile(pageFile, [
        '<template><view class="issue-724-inline issue-724-style-src">issue-724-template-marker<RoutingProbe /></view></template>',
        '<script lang="ts" src="./logic.ts"></script>',
        '<style>.issue-724-inline { display: block; }</style>',
        '<style lang="scss" src="./external.scss"></style>',
      ].join('\n'), 'utf8')
      await fs.writeFile(componentFile, [
        '<template><view class="issue-724-component">component marker</view></template>',
        '<script setup lang="ts">',
        'const componentMarker = \'issue-724-component-script\'',
        'void componentMarker',
        '</script>',
        '<style>.issue-724-component { font-weight: 600; }</style>',
      ].join('\n'), 'utf8')

      const runBuild = async () => {
        styleInputs.clear()
        vueInputs.clear()
        const vuePlugin = createVueTransformPlugin(createCtx(root))
        const vueResolverPlugin = createVueResolverPlugin(createCtx(root))
        const sfcRoutingPlugin: Plugin = {
          name: 'weapp-vite:test-sfc-routing',
          resolveId: vuePlugin.resolveId,
          load: vuePlugin.load,
          transform: vuePlugin.transform,
        }
        const sfcResolverPlugin: Plugin = {
          name: 'weapp-vite:test-sfc-resolver',
          resolveId: vueResolverPlugin.resolveId,
        }
        const styleLoadProbe: Plugin = {
          name: 'weapp-vite:test-style-load-probe',
          enforce: 'pre',
          transform(code, id) {
            if (!id.includes('?weapp-vite-vue&type=style')) {
              return null
            }
            expect(code).not.toMatch(/<(?:template|script|style)(?:\s|>)/)
            styleInputs.set(id, code)
            return null
          },
        }
        const downstreamJsProbe: Plugin = {
          name: 'weapp-vite:test-downstream-js-probe',
          enforce: 'post',
          transform(code, id) {
            if (!id.endsWith('.vue')) {
              return null
            }
            expect(code).not.toMatch(/<(?:template|script|style)(?:\s|>)/)
            vueInputs.set(id, code)
            return null
          },
        }

        await build({
          configFile: false,
          root,
          logLevel: 'silent',
          plugins: [styleLoadProbe, sfcResolverPlugin, sfcRoutingPlugin, downstreamJsProbe],
          build: {
            write: false,
            minify: false,
            lib: {
              entry: pageFile,
              formats: ['es'],
              name: 'Issue724RoutingFixture',
              cssFileName: 'issue-724-routing',
            },
            rolldownOptions: {
              external: id => !id.startsWith('.') && !path.isAbsolute(id) && !id.startsWith('\0'),
            },
          },
        })

        expect(styleInputs.size).toBe(3)
        const findVueInput = (filename: string) => [...vueInputs]
          .find(([id]) => id.includes(filename))?.[1]
        expect(findVueInput(pageFile)).toContain('issue-724-script-marker')
        expect(findVueInput(componentFile)).toContain('issue-724-component-script')
        expect([...styleInputs.values()]).toEqual(expect.arrayContaining([
          expect.stringContaining('.issue-724-inline'),
          expect.stringContaining('.issue-724-style-src'),
          expect.stringContaining('.issue-724-component'),
        ]))
        for (const styleCode of styleInputs.values()) {
          expect(styleCode).not.toContain('issue-724-template-marker')
          expect(styleCode).not.toContain('issue-724-script-marker')
        }
      }

      await runBuild()
      await runBuild()
    }
    finally {
      await fs.remove(root)
    }
  })
})
