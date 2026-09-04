import type { CompilerPageLayoutPlan, WevuBindingManifestV1 } from '../../../index'
import { WEVU_BINDING_MANIFEST_KEY, WEVU_SLOT_NAMES_PROP, WEVU_SLOT_OWNER_ID_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../transform/compileVueFile'
import { applyCompilerTemplateWrappers } from '../transform/compileVueFile/pageLayout'
import { remapJsxBindingManifestLocations } from '../transform/compileVueFile/script'
import { resolveBindingManifestPickKeys } from '../transform/transformScript/rewrite/bindingManifest'
import { compileVueTemplateToWxml } from './template'
import { createBindingManifest } from './template/bindingManifest'
import { alipayPlatform, ttPlatform, wechatPlatform } from './template/platforms'

describe('binding manifest', () => {
  it('collects stable Vue bindings with paths, modes and source locations', () => {
    const result = compileVueTemplateToWxml(
      '<view v-if="visible">{{ user.name }}{{ table[column] }}</view>',
      '/src/pages/index.vue',
    )

    expect(result.bindingManifest).toMatchObject({
      version: 1,
      sourceFile: '/src/pages/index.vue',
    })
    expect(result.bindingManifest.bindings.map(binding => binding.id)).toEqual(['b0', 'b1', 'b2', 'b3'])
    expect(result.bindingManifest.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'text', outputPath: 'user.name', updateMode: 'exact-path' }),
      expect.objectContaining({ kind: 'text', outputPath: 'table', updateMode: 'top-level' }),
      expect.objectContaining({ kind: 'text', outputPath: 'column', updateMode: 'exact-path' }),
      expect.objectContaining({ kind: 'if', outputPath: 'visible', updateMode: 'exact-path' }),
    ]))
    expect(result.bindingManifest.bindings.every(binding => binding.sourceLocation?.start.line === 1)).toBe(true)
  })

  it('marks opaque calls as materialized snapshot fallbacks', () => {
    const result = compileVueTemplateToWxml(
      '<view>{{ format(user.name) }}</view>',
      '/src/pages/call.vue',
    )

    expect(result.bindingManifest.bindings).toContainEqual(expect.objectContaining({
      kind: 'text',
      outputPath: '__wv_bind_0',
      sourceRoots: ['format', 'user'],
      sourcePaths: ['format', 'user.name'],
      updateMode: 'snapshot-fallback',
    }))
  })

  it('tracks native loop scope and scoped-slot owner attributes', () => {
    const result = compileVueTemplateToWxml(
      `<view wx:for="{{ list }}" wx:for-item="row">{{ row.label }}</view><SlotCell __wvSlotOwnerId="{{__wvOwnerId || ''}}" />`,
      '/src/pages/native-bindings.vue',
    )

    expect(result.bindingManifest.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'for', outputPath: 'list' }),
      expect.objectContaining({ kind: 'text', outputPath: 'list' }),
      expect.objectContaining({ kind: 'component-prop', outputPath: '__wvOwnerId' }),
    ]))
    expect(result.bindingManifest.bindings.some(binding => binding.sourceRoots.includes('row'))).toBe(false)
    expect(result.bindingManifest.features.scopedSlots).toBe(true)
  })

  it('marks declarative layout hosts in manifest features', () => {
    const result = compileVueTemplateToWxml(
      '<NativeCard layout-host="main" />',
      '/src/pages/layout-host.vue',
    )

    expect(result.bindingManifest.features.layout).toBe(true)
    expect(result.bindingManifest.features.templateRefs).toBe(true)
  })

  it('compiles app shell bindings before script generation', async () => {
    const result = await compileVueFile(
      '<template><view>{{ title }}</view></template><script setup>const title = "page"</script>',
      '/src/pages/app-shell.vue',
      {
        isPage: true,
        autoSetDataPick: false,
        appShell: {
          importPath: '/app-shell',
          tagName: 'app-shell',
        },
      },
    )

    expect(result.template).toContain('<app-shell __wvSlotOwnerId=')
    expect(result.config).toContain('"/app-shell"')
    expect(result.bindingManifest?.bindings).toContainEqual(expect.objectContaining({
      kind: 'attribute',
      outputPath: WEVU_SLOT_OWNER_ID_KEY,
    }))
    expect(result.script).toContain('setData')
    expect(result.script).toContain(WEVU_SLOT_OWNER_ID_KEY)
  })

  it('classifies dynamic function props and projected list keys', () => {
    const result = compileVueTemplateToWxml(
      '<HandlerCell :handler="handlers[selected]" /><view v-for="item in items" :key="item.id + suffix">{{ item.name }}</view>',
      '/src/pages/edge-bindings.vue',
      {
        functionPropNames: ['handler'],
      },
    )

    expect(result.bindingManifest.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'component-prop',
        outputPath: '__wv_bind_0',
        sourceRoots: ['handlers', 'selected'],
        updateMode: 'top-level',
      }),
      expect.objectContaining({
        kind: 'for',
        outputPath: '__wv_bind_1',
        sourceRoots: ['items', 'suffix'],
      }),
    ]))
    expect(result.bindingManifest.bindings.some(binding => binding.sourceRoots.includes('item'))).toBe(false)
    expect(result.bindingManifest.features.functionProps).toBe(true)
  })

  it('keeps scoped-slot child bindings in the child manifest and script', () => {
    const result = compileVueTemplateToWxml(
      '<Provider><template #default="{ label }"><text>{{ label }}</text></template></Provider>',
      '/src/pages/slots.vue',
      {
        scopedSlotsCompiler: 'augmented',
        scopedSlotsRequireProps: false,
        wevuComponentTags: ['Provider'],
      },
    )

    const child = result.scopedSlotComponents?.[0]
    expect(result.bindingManifest.features.scopedSlots).toBe(true)
    expect(result.bindingManifest.bindings.some(binding => binding.sourcePaths?.includes('__wvSlotPropsData.label'))).toBe(false)
    expect(child?.bindingManifest.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'text', sourcePaths: ['__wvSlotPropsData.label'] }),
    ]))
    expect(child?.script).toContain('__wevuBindingManifest')
  })

  it('keeps more than 200 automatic bindings inside the scoped-slot child manifest', () => {
    const children = Array.from({ length: 201 }, (_, index) => `<text>{{ format(label + ${index}) }}</text>`).join('')
    const result = compileVueTemplateToWxml(
      `<Provider><template #default="{ label }">${children}</template></Provider>`,
      '/src/pages/large-slot.vue',
      {
        scopedSlotsCompiler: 'augmented',
        scopedSlotsRequireProps: false,
        wevuComponentTags: ['Provider'],
      },
    )

    const parentAutoBindings = result.bindingManifest.bindings.filter(binding => binding.outputPath.startsWith('__wv_bind_'))
    const childAutoBindings = result.scopedSlotComponents?.[0]?.bindingManifest.bindings
      .filter(binding => binding.outputPath.startsWith('__wv_bind_')) ?? []

    expect(parentAutoBindings).toEqual([])
    expect(childAutoBindings).toHaveLength(201)
    expect(childAutoBindings.at(-1)?.outputPath).toBe('__wv_bind_200')
  })

  it('disables automatic pick when manifest collection is incomplete', async () => {
    const wildcardManifest: WevuBindingManifestV1 = {
      version: 1,
      sourceFile: 'src/pages/fallback.vue',
      bindings: [{
        id: 'b0',
        kind: 'text',
        outputPath: '*',
        sourceRoots: [],
        updateMode: 'snapshot-fallback',
      }],
      features: {},
    }
    expect(resolveBindingManifestPickKeys(wildcardManifest, true)).toEqual([])

    const failingPlatform = {
      ...wechatPlatform,
      wrapIf() {
        throw new Error('synthetic template failure')
      },
    }
    const result = await compileVueFile(
      '<template><view v-if="ready">{{ ready }}</view></template><script setup>const ready = true</script>',
      '/src/pages/fallback.vue',
      {
        autoSetDataPick: true,
        template: { platform: failingPlatform },
      },
    )

    expect(result.bindingManifest?.bindings).toContainEqual(expect.objectContaining({
      outputPath: '*',
      updateMode: 'snapshot-fallback',
    }))
    expect(result.script).toContain(WEVU_BINDING_MANIFEST_KEY)
    expect(result.script).not.toContain('setData')
  })

  it('declares slot host properties without bundler template inspection', async () => {
    const result = await compileVueFile(
      '<template><slot><text>fallback</text></slot></template>',
      '/src/components/SlotHost.vue',
    )

    expect(result.bindingManifest?.features.scopedSlots).toBe(true)
    expect(result.script).toContain('properties')
    expect(result.script).toContain(WEVU_SLOT_NAMES_PROP)
    expect(result.script).not.toContain('setData')
  })

  it('keeps app options outside component manifest and pick injection', async () => {
    const result = await compileVueFile(
      '<template><view><slot /></view></template><script setup>const privateState = true</script>',
      '/src/app.vue',
      {
        isApp: true,
        autoSetDataPick: true,
      },
    )

    expect(result.bindingManifest?.features.scopedSlots).toBe(true)
    expect(result.script).not.toContain(WEVU_BINDING_MANIFEST_KEY)
    expect(result.script).not.toContain('setData')
  })

  it('maps SFC JSX binding locations back to the original component', async () => {
    const source = `<script lang="tsx">
const title = 'ready'
export default {
  render() {
    return <view>{title}</view>
  },
}
</script>`
    const result = await compileVueFile(
      source,
      '/src/components/RenderCard.vue',
      { bindingManifestSourceFile: 'src/components/RenderCard.vue' },
    )
    const binding = result.bindingManifest?.bindings.find(item => item.outputPath === 'title')

    expect(binding?.sourceLocation?.start).toEqual({
      offset: source.lastIndexOf('title'),
      line: 5,
      column: 19,
    })
  })

  it('clears generated JSX locations when source maps are unavailable', () => {
    const manifest: WevuBindingManifestV1 = {
      version: 1,
      sourceFile: 'src/components/Generated.vue',
      bindings: [{
        id: 'b0',
        kind: 'text',
        outputPath: 'title',
        sourceRoots: ['title'],
        sourcePaths: ['title'],
        updateMode: 'exact-path',
        sourceLocation: {
          start: { offset: 20, line: 2, column: 5 },
          end: { offset: 25, line: 2, column: 10 },
        },
      }],
      features: {},
    }

    remapJsxBindingManifestLocations(manifest, undefined, 'const title = true', './render.tsx')

    expect(manifest.sourceFile).toBe('./render.tsx')
    expect(manifest.bindings[0]?.sourceLocation).toBeUndefined()

    manifest.bindings[0]!.sourceLocation = {
      start: { offset: 20, line: 2, column: 5 },
      end: { offset: 25, line: 2, column: 10 },
    }
    expect(() => remapJsxBindingManifestLocations(manifest, {
      version: 3,
      names: [],
      sources: ['source.vue'],
      sourcesContent: ['x'],
      mappings: [[null]],
    }, 'const title = true')).not.toThrow()
    expect(manifest.bindings[0]?.sourceLocation).toBeUndefined()
  })

  it('records template-level conditional bindings before pick injection', async () => {
    const result = await compileVueFile(
      '<template><template v-if="visible"><text>{{ title }}</text></template><template v-else-if="pending"><text>{{ subtitle }}</text></template></template><script setup>const visible = true; const pending = false; const title = "ready"; const subtitle = "pending"</script>',
      '/src/pages/template-if.vue',
      { autoSetDataPick: true },
    )

    expect(result.bindingManifest?.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'if', outputPath: 'visible' }),
      expect.objectContaining({ kind: 'if', outputPath: 'pending' }),
      expect.objectContaining({ kind: 'text', outputPath: 'title' }),
    ]))
    expect(result.script).toContain('"visible"')
    expect(result.script).toContain('"title"')
    expect(result.script).toContain('"pending"')
  })

  it('records dynamic component and slot-owned output paths', async () => {
    const result = await compileVueFile(
      `<template>
  <component :is="kind" :title="title" />
  <slot :name="slotName" :payload="payload"><text>fallback</text></slot>
  <Child :slot-wrapper-class="ownerClass">
    <template #header :slot-wrapper-class="headerClass" :slot-wrapper-style="headerStyle" v-if="showHeader">
      <slot />
    </template>
    <template #footer><slot /></template>
  </Child>
</template>
<script setup>
const kind = 'view'
const title = 'title'
const slotName = 'header'
const payload = { ready: true }
const ownerClass = 'owner'
const headerClass = 'header'
const headerStyle = 'color:red'
const showHeader = true
</script>`,
      '/src/components/SpecialBindings.vue',
      { autoSetDataPick: true },
    )
    const sourceRoots = new Set(result.bindingManifest?.bindings.flatMap(binding => binding.sourceRoots))
    const pickKeys = resolveBindingManifestPickKeys(result.bindingManifest!, true)

    for (const root of [
      'headerClass',
      'headerStyle',
      'kind',
      'ownerClass',
      'payload',
      'showHeader',
      'slotName',
      'title',
    ]) {
      expect(sourceRoots).toContain(root)
    }
    expect(result.bindingManifest?.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'component-prop', outputPath: 'kind' }),
      expect.objectContaining({ kind: 'component-prop', outputPath: 'payload' }),
      expect.objectContaining({ kind: 'class', sourceRoots: ['headerClass'] }),
      expect.objectContaining({ kind: 'style', sourceRoots: ['headerStyle'] }),
    ]))
    expect(pickKeys).toContain('kind')
    expect(pickKeys).toContain('payload')
    expect(result.script).toContain('setData')
  })

  it('keeps static and dynamic layout wrapping idempotent', async () => {
    const staticPlan: CompilerPageLayoutPlan = {
      currentLayout: {
        importPath: '/layouts/default',
        layoutName: 'default',
        tagName: 'layout-default',
      },
      dynamicSwitch: false,
      layouts: [],
      dynamicPropKeys: [],
    }
    const staticResult = await compileVueFile(
      '<template><layout-default><view /></layout-default></template>',
      '/src/pages/static-layout.vue',
      {
        pageLayout: staticPlan,
      },
    )
    expect(staticResult.template?.match(/<layout-default/g)).toHaveLength(1)

    const dynamicPlan: CompilerPageLayoutPlan = {
      currentLayout: {
        importPath: '/layouts/default',
        layoutName: 'default',
        tagName: 'layout-default',
      },
      dynamicSwitch: true,
      layouts: [
        { importPath: '/layouts/default', layoutName: 'default', tagName: 'layout-default' },
        { importPath: '/layouts/admin', layoutName: 'admin', tagName: 'layout-admin' },
      ],
      dynamicPropKeys: [],
    }
    const manifest = createBindingManifest('src/pages/dynamic-layout.vue')
    const first = applyCompilerTemplateWrappers({
      template: '<view />',
      manifest,
      platform: wechatPlatform,
      pageLayout: dynamicPlan,
    })
    const second = applyCompilerTemplateWrappers({
      template: first,
      manifest,
      platform: wechatPlatform,
      pageLayout: dynamicPlan,
    })
    expect(second).toBe(first)

    const appShell = {
      importPath: '/app-shell',
      tagName: 'app-shell',
    }
    for (const pageLayout of [staticPlan, dynamicPlan]) {
      const combinedManifest = createBindingManifest('src/pages/combined-layout.vue')
      const combinedFirst = applyCompilerTemplateWrappers({
        template: '<view />',
        manifest: combinedManifest,
        platform: wechatPlatform,
        pageLayout,
        appShell,
      })
      const combinedSecond = applyCompilerTemplateWrappers({
        template: combinedFirst,
        manifest: combinedManifest,
        platform: wechatPlatform,
        pageLayout,
        appShell,
      })
      expect(combinedSecond).toBe(combinedFirst)
      expect(combinedSecond.match(/<app-shell/g)).toHaveLength(1)
      const shellOnlyResult = applyCompilerTemplateWrappers({
        template: '<app-shell><view /></app-shell>',
        manifest: createBindingManifest('src/pages/shell-only.vue'),
        platform: wechatPlatform,
        pageLayout,
        appShell,
      })
      expect(shellOnlyResult.startsWith('<app-shell>')).toBe(true)
      expect(shellOnlyResult.match(/<app-shell/g)).toHaveLength(1)
      expect(shellOnlyResult).toContain(pageLayout.dynamicSwitch ? '<block wx:if=' : '<layout-default')
    }
  })

  it.each([
    ['wechat', wechatPlatform, 'wx:if', 'wx:elif', 'wx:else'],
    ['alipay', alipayPlatform, 'a:if', 'a:elif', 'a:else'],
    ['douyin', ttPlatform, 'tt:if', 'tt:elif', 'tt:else'],
  ])('applies dynamic page layout directives for %s', async (_name, platform, ifAttr, elifAttr, elseAttr) => {
    const pageLayout: CompilerPageLayoutPlan = {
      dynamicSwitch: true,
      currentLayout: {
        importPath: '/layouts/default',
        layoutName: 'default',
        tagName: 'layout-default',
      },
      layouts: [
        { importPath: '/layouts/default', layoutName: 'default', tagName: 'layout-default' },
        { importPath: '/layouts/admin', layoutName: 'admin', tagName: 'layout-admin' },
      ],
      dynamicPropKeys: [],
    }
    const result = await compileVueFile(
      '<template><view>{{ title }}</view></template><script setup>const title = "page"</script>',
      '/src/pages/layout.vue',
      { isPage: true, template: { platform }, pageLayout },
    )

    expect(result.template).toContain(`<block ${ifAttr}=`)
    expect(result.template).toContain(`<block ${elifAttr}=`)
    expect(result.template).toContain(`<block ${elseAttr}>`)
    expect(result.bindingManifest?.features.layout).toBe(true)
    expect(result.config).toContain('layout-default')
    expect(result.script).toContain('__wevuBindingManifest')
  })

  it('exports a typed V1 manifest contract', () => {
    const manifest = {
      version: 1,
      sourceFile: '/src/page.tsx',
      bindings: [],
      features: { jsxIslands: true },
    } satisfies WevuBindingManifestV1
    expect(manifest.version).toBe(1)
  })
})
