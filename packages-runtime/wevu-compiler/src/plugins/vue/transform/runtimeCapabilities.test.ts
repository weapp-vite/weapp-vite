import type { WevuRuntimeCapabilityName } from '../../../runtimeCapabilities'
import { WEVU_LAYOUT_HOSTS_KEY, WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import {
  WE_VU_RUNTIME_CAPABILITY_INSTALLERS,
  WE_VU_RUNTIME_CAPABILITY_ORDER,
} from '../../../runtimeCapabilities'
import { parseJsLike } from '../../../utils/babel'
import { compileJsxFile } from '../../jsx/compileJsxFile'
import { compileVueTemplateToWxml } from '../compiler/template'
import { compileVueFile } from './compileVueFile'
import { transformScript } from './script'
import { analyzeWevuRuntimeCalls } from './transformScript/runtimeCapabilities'

const OPTION_CAPABILITIES: WevuRuntimeCapabilityName[] = [
  'patchStrategy',
  'setDataHighFrequencyWarning',
]

function collectInstallerCallPositions(code: string) {
  const ast = parseJsLike(code)
  const capabilityByInstaller: Record<string, WevuRuntimeCapabilityName> = Object.fromEntries(
    WE_VU_RUNTIME_CAPABILITY_ORDER.map(capability => [
      WE_VU_RUNTIME_CAPABILITY_INSTALLERS[capability],
      capability,
    ]),
  )
  const capabilityByLocal = new Map<string, WevuRuntimeCapabilityName>()
  const positions = new Map<WevuRuntimeCapabilityName, number[]>()
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement)) {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) {
        continue
      }
      const importedName = t.isIdentifier(specifier.imported)
        ? specifier.imported.name
        : specifier.imported.value
      const capability = capabilityByInstaller[importedName]
      if (capability) {
        capabilityByLocal.set(specifier.local.name, capability)
      }
    }
  }
  for (const [index, statement] of ast.program.body.entries()) {
    if (
      !t.isExpressionStatement(statement)
      || !t.isCallExpression(statement.expression)
      || !t.isIdentifier(statement.expression.callee)
      || statement.expression.arguments.length > 0
    ) {
      continue
    }
    const capability = capabilityByLocal.get(statement.expression.callee.name)
    if (capability) {
      const existing = positions.get(capability)
      if (existing) {
        existing.push(index)
      }
      else {
        positions.set(capability, [index])
      }
    }
  }
  return positions
}

function countInstallerCalls(code: string, capability: WevuRuntimeCapabilityName) {
  return collectInstallerCallPositions(code).get(capability)?.length ?? 0
}

function expectCanonicalCalls(code: string, required: WevuRuntimeCapabilityName[]) {
  const positions = collectInstallerCallPositions(code)
  let previousIndex = -1
  for (const capability of WE_VU_RUNTIME_CAPABILITY_ORDER) {
    const callPositions = positions.get(capability) ?? []
    if (required.includes(capability)) {
      expect(callPositions).toHaveLength(1)
      expect(callPositions[0]).toBeGreaterThan(previousIndex)
      previousIndex = callPositions[0]!
    }
    else {
      expect(callPositions).toEqual([])
    }
  }
}

describe('wevu runtime capability metadata and emission', () => {
  it('skips full AST traversal when no relevant wevu value binding exists', () => {
    const ast = parseJsLike(`import { ref } from 'wevu'; function untouched() {}`)
    const declaration = ast.program.body.find(statement => t.isFunctionDeclaration(statement))
    if (!declaration || !t.isFunctionDeclaration(declaration)) {
      throw new Error('expected function declaration fixture')
    }
    Object.defineProperty(declaration, 'body', {
      get() {
        throw new Error('unexpected full traversal')
      },
    })

    expect(analyzeWevuRuntimeCalls(ast)).toBeUndefined()
  })

  it('keeps a no-feature module free of installer references', () => {
    const result = transformScript(`
import { createApp } from 'wevu'
createApp({
  setData: {
    strategy: 'patch',
    strategy: 'diff',
    highFrequencyWarning: true,
    highFrequencyWarning: false,
  },
})
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toBeUndefined()
    expect(result.code).not.toContain('__wevuInstall')
    expect(result.code).not.toContain('installPatchStrategy')
    expect(result.code).not.toContain('installSetDataHighFrequencyWarning')
  })

  it.each([
    [
      `import { createApp } from 'wevu'; createApp({ setData: { strategy: 'patch', highFrequencyWarning: false } })`,
      'patchStrategy',
    ],
    [
      `import { createApp } from 'wevu'; createApp({ setData: { strategy: 'diff', highFrequencyWarning: {} } })`,
      'setDataHighFrequencyWarning',
    ],
  ] satisfies Array<[string, WevuRuntimeCapabilityName]>)('derives one option capability from %s', (source, capability) => {
    const result = transformScript(source, { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({ required: [capability] })
    expectCanonicalCalls(result.code, [capability])
  })

  it.each([
    `import { createWevuScopedSlotComponent } from 'wevu'; createWevuScopedSlotComponent()`,
    `import { createWevuScopedSlotComponent as createSlot } from 'wevu'; createSlot()`,
    `import { createWevuScopedSlotComponent } from 'wevu'; const createSlot = createWevuScopedSlotComponent; createSlot()`,
  ])('retains scoped-slot compatibility for a direct or aliased creator: %s', (source) => {
    const result = transformScript(source, { sourceMap: false })
    const required: WevuRuntimeCapabilityName[] = ['templateRefs', 'inlineEvents', 'scopedSlots']

    expect(result.runtimeCapabilities).toEqual({
      required,
      conservative: ['templateRefs', 'inlineEvents'],
    })
    expectCanonicalCalls(result.code, required)
  })

  it('retains scoped-slot and option compatibility for a runtime namespace', () => {
    const result = transformScript(
      `import * as runtime from 'wevu'; runtime.createWevuScopedSlotComponent()`,
      { sourceMap: false },
    )
    const required: WevuRuntimeCapabilityName[] = [
      'patchStrategy',
      'templateRefs',
      'inlineEvents',
      'setDataHighFrequencyWarning',
      'scopedSlots',
    ]

    expect(result.runtimeCapabilities).toEqual({
      required,
      conservative: required.filter(capability => capability !== 'scopedSlots'),
    })
    expectCanonicalCalls(result.code, required)
  })

  it.each([
    ['patchStrategy'],
    ['templateRefs'],
    ['inlineEvents'],
    ['setDataHighFrequencyWarning'],
    ['scopedSlots'],
  ] satisfies Array<[WevuRuntimeCapabilityName]>)('emits exactly the %s capability', (capability) => {
    const result = transformScript('export default {}', {
      runtimeCapabilities: { required: [capability] },
      sourceMap: false,
    })

    expect(result.runtimeCapabilities).toEqual({ required: [capability] })
    expectCanonicalCalls(result.code, [capability])
  })

  it('closes the layout dependency and calls template refs first', () => {
    const result = transformScript('export default {}', {
      runtimeCapabilities: { required: ['layout'] },
      sourceMap: false,
    })

    expect(result.runtimeCapabilities).toEqual({ required: ['templateRefs', 'layout'] })
    expectCanonicalCalls(result.code, ['templateRefs', 'layout'])
  })

  it('combines feature sources in canonical order before defaults and registration', () => {
    const result = transformScript(`
import { setWevuDefaults } from 'wevu'
setWevuDefaults({ app: { setData: { strategy: 'patch' } } })
export default { setData: { highFrequencyWarning: true } }
    `.trim(), {
      isApp: true,
      runtimeCapabilities: {
        required: ['layout', 'scopedSlots', 'inlineEvents'],
      },
      sourceMap: false,
    })

    expect(result.runtimeCapabilities).toEqual({ required: [...WE_VU_RUNTIME_CAPABILITY_ORDER] })
    expectCanonicalCalls(result.code, [...WE_VU_RUNTIME_CAPABILITY_ORDER])
    const lastInstallerIndex = result.code.indexOf('__wevuInstallLayout()')
    expect(lastInstallerIndex).toBeLessThan(result.code.indexOf('setWevuDefaults('))
    expect(lastInstallerIndex).toBeLessThan(result.code.indexOf('createApp('))
  })

  it('derives exact template capabilities without using page lifecycle features', () => {
    const noFeature = compileVueTemplateToWxml('<view />', '/project/src/components/plain.vue')
    const templateRef = compileVueTemplateToWxml('<ChildCard ref="leaf" />', '/project/src/components/ref.vue')
    const inlineEvent = compileVueTemplateToWxml('<view @tap="count++" />', '/project/src/components/inline.vue')
    const layout = compileVueTemplateToWxml('<t-toast layout-host="toast" />', '/project/src/layouts/default.vue')

    expect(noFeature.runtimeCapabilities).toBeUndefined()
    expect(templateRef.runtimeCapabilities).toEqual({ required: ['templateRefs'] })
    expect(inlineEvent.runtimeCapabilities).toEqual({ required: ['inlineEvents'] })
    expect(layout.runtimeCapabilities).toEqual({ required: ['templateRefs', 'layout'] })
  })

  it('records scoped-slot requirements per generated asset', () => {
    const plain = compileVueTemplateToWxml(`
<Card v-slot="{ item }">
  <view>{{ item }}</view>
</Card>
    `.trim(), '/project/src/components/plain-slot.vue', {
      scopedSlotsCompiler: 'augmented',
      scopedSlotsRequireProps: false,
    })
    const featured = compileVueTemplateToWxml(`
<Card v-slot="{ item }">
  <ChildCard ref="leaf" @tap="select(item)" />
</Card>
    `.trim(), '/project/src/components/featured-slot.vue', {
      scopedSlotsCompiler: 'augmented',
      scopedSlotsRequireProps: false,
    })
    const nestedLayout = compileVueTemplateToWxml(`
<Card v-slot="{ item }">
  <t-toast layout-host="toast">{{ item }}</t-toast>
</Card>
    `.trim(), '/project/src/components/layout-slot.vue', {
      scopedSlotsCompiler: 'augmented',
      scopedSlotsRequireProps: false,
    })

    expect(plain.runtimeCapabilities).toEqual({ required: ['scopedSlots'] })
    expect(plain.scopedSlotComponents?.[0]?.runtimeCapabilities).toEqual({ required: ['scopedSlots'] })
    expect(featured.runtimeCapabilities).toEqual({ required: ['scopedSlots'] })
    expect(featured.scopedSlotComponents?.[0]?.runtimeCapabilities).toEqual({
      required: ['templateRefs', 'inlineEvents', 'scopedSlots'],
    })
    expect(nestedLayout.layoutHosts).toBeUndefined()
    expect(nestedLayout.templateRefs).toBeUndefined()
    expect(nestedLayout.runtimeCapabilities).toEqual({ required: ['scopedSlots'] })
    expect(nestedLayout.scopedSlotComponents?.[0]?.layoutHosts).toEqual([{
      key: 'toast',
      refName: '__wevu_layout_host_0',
      selector: '#__wv-layout-host-0',
      kind: 'component',
    }])
    expect(nestedLayout.scopedSlotComponents?.[0]?.runtimeCapabilities).toEqual({
      required: ['templateRefs', 'scopedSlots', 'layout'],
    })
    const nestedLayoutScript = nestedLayout.scopedSlotComponents?.[0]?.script ?? ''
    expectCanonicalCalls(nestedLayoutScript, ['templateRefs', 'scopedSlots', 'layout'])
    expect(nestedLayoutScript).toContain(JSON.stringify(WEVU_LAYOUT_HOSTS_KEY))
    expect(nestedLayoutScript).toContain('"selector":"#__wv-layout-host-0"')
  })

  it('injects the scoped-slot owner marker only for current template metadata', async () => {
    const noFeature = await compileVueFile(
      '<template><view /></template>',
      '/project/src/components/no-slot-owner.vue',
      { sourceMap: false },
    )
    const plainSlot = await compileVueFile(`
<template>
  <Card v-slot="{ item }"><view>{{ item }}</view></Card>
</template>
    `.trim(), '/project/src/components/plain-slot-owner.vue', {
      sourceMap: false,
      template: {
        scopedSlotsCompiler: 'augmented',
        scopedSlotsRequireProps: false,
      },
    })
    const runtimeOnly = transformScript(`
import { createWevuScopedSlotComponent } from 'wevu'
createWevuScopedSlotComponent()
export default {}
    `.trim(), { sourceMap: false })

    expect(noFeature.script).not.toContain(WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY)
    expect(plainSlot.meta?.runtimeCapabilities).toEqual({ required: ['scopedSlots'] })
    expect(plainSlot.script).toContain(WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY)
    expect(runtimeOnly.runtimeCapabilities?.required).toContain('scopedSlots')
    expect(runtimeOnly.code).not.toContain(WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY)
  })

  it('derives runtime capabilities after applying page layout wrappers', async () => {
    const result = await compileVueFile(
      '<template><view /></template>',
      '/project/src/pages/index/index.vue',
      {
        isPage: true,
        pageLayout: {
          currentLayout: {
            importPath: '/layouts/default/index',
            layoutName: 'default',
            tagName: 'weapp-layout-default',
          },
          dynamicSwitch: false,
          layouts: [{
            importPath: '/layouts/default/index',
            layoutName: 'default',
            tagName: 'weapp-layout-default',
          }],
          dynamicPropKeys: [],
        },
        sourceMap: false,
      },
    )

    expect(result.bindingManifest?.features).toMatchObject({
      layout: true,
      scopedSlots: true,
    })
    expect(result.meta?.runtimeCapabilities).toEqual({
      required: ['templateRefs', 'scopedSlots', 'layout'],
    })
    expectCanonicalCalls(result.script ?? '', ['templateRefs', 'scopedSlots', 'layout'])

    const appShellResult = await compileVueFile(
      '<template><view /></template>',
      '/project/src/pages/app-shell/index.vue',
      {
        appShell: {
          importPath: '/__weapp_vite_app_shell',
          tagName: 'weapp-app-shell',
        },
        isPage: true,
        sourceMap: false,
      },
    )
    expect(appShellResult.bindingManifest?.features.scopedSlots).toBe(true)
    expect(appShellResult.meta?.runtimeCapabilities).toEqual({
      required: ['scopedSlots'],
    })
    expectCanonicalCalls(appShellResult.script ?? '', ['scopedSlots'])
  })

  it('uses resolved app and component defaults, including performance preset values', () => {
    const presetResult = transformScript('export default {}', {
      isApp: true,
      sourceMap: false,
      wevuDefaults: {
        app: {
          setData: {
            strategy: 'diff',
            highFrequencyWarning: false,
          },
        },
        component: {
          setData: {
            strategy: 'patch',
            highFrequencyWarning: true,
          },
        },
      },
    })

    expect(presetResult.runtimeCapabilities).toEqual({ required: OPTION_CAPABILITIES })
    expectCanonicalCalls(presetResult.code, OPTION_CAPABILITIES)

    const partialOverride = transformScript(`
export default { setData: { highFrequencyWarning: false } }
    `.trim(), {
      sourceMap: false,
      wevuDefaults: {
        component: { setData: { strategy: 'patch', highFrequencyWarning: true } },
      },
    })
    expect(partialOverride.runtimeCapabilities).toEqual({ required: ['patchStrategy'] })
    expectCanonicalCalls(partialOverride.code, ['patchStrategy'])

    const componentOverride = transformScript(`
export default {
  setData: {
    strategy: 'diff',
    highFrequencyWarning: { enabled: false },
  },
}
    `.trim(), {
      sourceMap: false,
      wevuDefaults: {
        component: {
          setData: {
            strategy: 'patch',
            highFrequencyWarning: true,
          },
        },
      },
    })
    expect(componentOverride.runtimeCapabilities).toBeUndefined()
    expect(componentOverride.code).not.toContain('__wevuInstall')
  })

  it.each([
    'null',
    'false',
    '0',
    '[]',
    '() => ({})',
  ])('keeps configured defaults for a non-plain setData override: %s', (setDataOverride) => {
    const result = transformScript(`export default { setData: ${setDataOverride} }`, {
      sourceMap: false,
      wevuDefaults: {
        component: {
          setData: {
            strategy: 'patch',
            highFrequencyWarning: true,
          },
        },
      },
    })

    expect(result.runtimeCapabilities).toEqual({ required: OPTION_CAPABILITIES })
    expectCanonicalCalls(result.code, OPTION_CAPABILITIES)
  })

  it('unions multiple manual defaults calls without flow-sensitive uninstallation', () => {
    const result = transformScript(`
import { setWevuDefaults } from 'wevu'
setWevuDefaults({ app: { setData: { strategy: 'patch' } } })
setWevuDefaults({ app: { setData: { strategy: 'diff' } } })
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({ required: ['patchStrategy'] })
    expectCanonicalCalls(result.code, ['patchStrategy'])
  })

  it('proves explicit last writes and spread-before values are off', () => {
    const result = transformScript(`
import { createApp } from 'wevu'
const inherited = resolveOptions()
createApp({
  ...inherited,
  setData: {
    ...inherited.setData,
    strategy: 'patch',
    strategy: 'diff',
    highFrequencyWarning: true,
    highFrequencyWarning: { enabled: false },
  },
})
    `.trim(), { sourceMap: false })

    expect(result.runtimeCapabilities).toBeUndefined()
    expect(result.code).not.toContain('__wevuInstall')
  })

  it.each([
    `import { createApp } from 'wevu'; createApp(resolveOptions())`,
    `import { createApp } from 'wevu'; let options = {}; createApp(options)`,
    `import { createApp } from 'wevu'; const options = {}; consume(options); createApp(options)`,
    `import { createApp } from 'wevu'; const factory = createApp; factory({})`,
    `import * as runtime from 'wevu'; runtime.createApp({ setData: { strategy: 'diff' } })`,
    `const options = { setData: { strategy: 'diff', highFrequencyWarning: false } }; consume(options); export default options`,
    `import { createApp } from 'wevu'; createApp({ setData: { strategy: 'diff', highFrequencyWarning: false, [key]: value } })`,
    `import { createApp } from 'wevu'; createApp({ setData: { strategy: 'diff', highFrequencyWarning: false, ...late } })`,
  ])('preserves unknown or escaped options conservatively: %s', (source) => {
    const result = transformScript(source, { sourceMap: false })

    expect(result.runtimeCapabilities).toEqual({
      required: OPTION_CAPABILITIES,
      conservative: OPTION_CAPABILITIES,
    })
    expectCanonicalCalls(result.code, OPTION_CAPABILITIES)
  })

  it('deduplicates repeated metadata into one direct call per capability', () => {
    const result = transformScript(`
import { installTemplateRefs as __wevuInstallTemplateRefs } from 'virtual:weapp-vite/runtime'
__wevuInstallTemplateRefs()
export default {}
    `.trim(), {
      sourceMap: false,
      templateRefs: [{ selector: '.leaf', inFor: false, name: 'leaf', kind: 'component' }],
      runtimeCapabilities: {
        required: ['templateRefs', 'templateRefs'],
      },
    })

    expect(result.runtimeCapabilities).toEqual({ required: ['templateRefs'] })
    expect(countInstallerCalls(result.code, 'templateRefs')).toBe(1)
  })

  it('adds an early installer when an existing call is after registration', () => {
    const result = transformScript(`
import {
  createApp,
  installPatchStrategy as __wevuInstallPatchStrategy,
} from 'virtual:weapp-vite/runtime'
createApp({ setData: { strategy: 'patch' } })
__wevuInstallPatchStrategy()
    `.trim(), { sourceMap: false })

    const firstInstaller = result.code.indexOf('__wevuInstallPatchStrategy()')
    const registration = result.code.indexOf('createApp(')
    const lateInstaller = result.code.lastIndexOf('__wevuInstallPatchStrategy()')
    expect(countInstallerCalls(result.code, 'patchStrategy')).toBe(2)
    expect(firstInstaller).toBeLessThan(registration)
    expect(lateInstaller).toBeGreaterThan(registration)
  })

  it('propagates metadata through template, script transform, Vue and JSX result layers', async () => {
    const templateResult = compileVueTemplateToWxml(
      '<ChildCard ref="leaf" @tap="select(leaf)" />',
      '/project/src/components/meta-template.vue',
    )
    const transformResult = transformScript('export default {}', {
      inlineExpressions: templateResult.inlineExpressions,
      runtimeCapabilities: templateResult.runtimeCapabilities,
      sourceMap: false,
      templateRefs: templateResult.templateRefs,
    })
    const vueResult = await compileVueFile(`
<template><ChildCard ref="leaf" @tap="select('leaf')" /></template>
<script setup>
function select(value) { return value }
</script>
    `.trim(), '/project/src/components/meta-result.vue', { sourceMap: false })
    const jsxResult = await compileJsxFile(`
import { defineComponent } from 'wevu'
export default defineComponent({
  methods: {
    select(value) { return value },
  },
  render() {
    return <view onTap={() => this.select('leaf')} />
  },
})
    `.trim(), '/project/src/components/meta-result.tsx', { sourceMap: false })

    const expected = { required: ['templateRefs', 'inlineEvents'] }
    expect(templateResult.runtimeCapabilities).toEqual(expected)
    expect(transformResult.runtimeCapabilities).toEqual(expected)
    expect(vueResult.meta?.runtimeCapabilities).toEqual(expected)
    expectCanonicalCalls(vueResult.script ?? '', expected.required as WevuRuntimeCapabilityName[])
    expect(jsxResult.meta?.runtimeCapabilities).toEqual({ required: ['inlineEvents'] })
    expectCanonicalCalls(jsxResult.script ?? '', ['inlineEvents'])
  })
})
