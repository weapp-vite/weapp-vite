import { describe, expect, it } from 'vitest'
import { hasWevuTemplateRuntimeBindings, isDefineComponentJsonOnlyScript, shouldEmitScriptlessVueLayoutJs } from './scriptlessVueLayout'

describe('scriptless vue layout helpers', () => {
  it('detects runtime host bindings in templates', () => {
    expect(hasWevuTemplateRuntimeBindings('<view><toast layout-host="toast" /></view>')).toBe(true)
    expect(hasWevuTemplateRuntimeBindings('<view :ref="toastRef" />')).toBe(true)
    expect(hasWevuTemplateRuntimeBindings('<view>plain</view>')).toBe(false)
  })

  it('recognizes defineComponentJson-only scripts', () => {
    expect(isDefineComponentJsonOnlyScript('defineComponentJson({ component: true })')).toBe(true)
    expect(isDefineComponentJsonOnlyScript('defineComponentJson({ component: true });\ndefineComponentJson({ options: {} })')).toBe(true)
    expect(isDefineComponentJsonOnlyScript('const ready = true')).toBe(false)
  })

  it('decides whether a vue layout needs a scriptless js fallback', () => {
    expect(shouldEmitScriptlessVueLayoutJs('<template><view>plain</view></template>', '/project/src/layouts/default.vue')).toBe(true)
    expect(shouldEmitScriptlessVueLayoutJs([
      '<script setup lang="ts">',
      'defineComponentJson({ component: true })',
      '</script>',
      '<template><view>plain</view></template>',
    ].join('\n'), '/project/src/layouts/default.vue')).toBe(true)
    expect(shouldEmitScriptlessVueLayoutJs([
      '<script setup lang="ts">',
      'defineComponentJson({ component: true })',
      '</script>',
      '<template><view><toast layout-host="toast" /></view></template>',
    ].join('\n'), '/project/src/layouts/default.vue')).toBe(false)
    expect(shouldEmitScriptlessVueLayoutJs([
      '<script setup lang="ts">',
      'const count = 1',
      '</script>',
      '<template><view>plain</view></template>',
    ].join('\n'), '/project/src/layouts/default.vue')).toBe(false)
  })
})
