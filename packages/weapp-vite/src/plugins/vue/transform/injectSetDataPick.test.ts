import { WEVU_SLOT_NAMES_PROP, WEVU_SLOT_OWNER_ID_KEY, WEVU_SLOT_OWNER_ID_PROP, WEVU_SLOT_SCOPE_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { getWxmlDirectivePrefix } from '../../../platform'
import { collectSetDataPickKeysFromTemplate, injectScopedSlotHostPropertiesInJs, injectScopedSlotOwnerSetDataPickInJs, injectSetDataPickInJs, mayNeedInjectSetDataPickInJs, mayNeedScopedSlotHostPropertiesForSetupSlotsInJs, pruneScopedSlotOwnerAutoSetDataPickKeys, shouldUseScopedSlotOwnerOnlySetDataPick } from './injectSetDataPick'

const DEFAULT_WXML_DIRECTIVE_PREFIX = getWxmlDirectivePrefix()

describe('inject setData.pick', () => {
  it('collects top-level keys from template expressions and skips loop aliases', () => {
    const template = `
<view ${DEFAULT_WXML_DIRECTIVE_PREFIX}:for="{{ list }}" ${DEFAULT_WXML_DIRECTIVE_PREFIX}:for-item="row" ${DEFAULT_WXML_DIRECTIVE_PREFIX}:for-index="i">
  <text>{{ row.name }}</text>
  <text>{{ __wv_bind_0[i] }}</text>
</view>
<text>{{ count > 0 ? count : 0 }}</text>
    `.trim()

    const keys = collectSetDataPickKeysFromTemplate(template)
    expect(keys).toEqual(['__wv_bind_0', 'count', 'list'])
  })

  it('injects setData.pick into wevu component options', () => {
    const source = `
import { createWevuComponent } from 'wevu'
const __wevuOptions = {
  setup() {
    return {}
  },
}
createWevuComponent(__wevuOptions)
    `.trim()

    const injected = injectSetDataPickInJs(source, ['count', 'total'])
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('setData')
    expect(injected.code).toContain('pick')
    expect(injected.code).toContain('"count"')
    expect(injected.code).toContain('"total"')
  })

  it('keeps slot bridge keys in injected setData.pick', () => {
    const source = `
import { defineComponent } from 'wevu'
defineComponent({
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectSetDataPickInJs(source, ['count'])
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('"count"')
    expect(injected.code).toContain(`"${WEVU_SLOT_NAMES_PROP}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_OWNER_ID_PROP}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_SCOPE_KEY}"`)
  })

  it('injects only scoped slot owner bridge keys when auto pick is disabled', () => {
    const source = `
import { defineComponent } from 'wevu'
defineComponent({
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectScopedSlotOwnerSetDataPickInJs(source)
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain(`"${WEVU_SLOT_OWNER_ID_KEY}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_NAMES_PROP}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_OWNER_ID_PROP}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_SCOPE_KEY}"`)
    expect(injected.code).not.toContain('"__wv_bind_0"')
  })

  it('keeps normal state keys when injecting scoped slot owner pick after pruning auto pick', () => {
    const source = `
import { defineComponent } from 'wevu'
defineComponent({
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectScopedSlotOwnerSetDataPickInJs(source, ['currentStep', 'formState'])
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('"currentStep"')
    expect(injected.code).toContain('"formState"')
    expect(injected.code).toContain(`"${WEVU_SLOT_OWNER_ID_KEY}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_NAMES_PROP}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_OWNER_ID_PROP}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_SCOPE_KEY}"`)
  })

  it('detects oversized scoped slot owner auto pick keys', () => {
    const smallKeys = Array.from({ length: 200 }, (_, index) => `__wv_bind_${index}`)
    const largeKeys = Array.from({ length: 201 }, (_, index) => `__wv_bind_${index}`)

    expect(shouldUseScopedSlotOwnerOnlySetDataPick(smallKeys)).toBe(false)
    expect(shouldUseScopedSlotOwnerOnlySetDataPick(largeKeys)).toBe(true)
    expect(shouldUseScopedSlotOwnerOnlySetDataPick([...largeKeys.slice(0, 200), 'count'])).toBe(false)
  })

  it('prunes oversized auto bind keys but keeps normal state keys', () => {
    const bindKeys = Array.from({ length: 201 }, (_, index) => `__wv_bind_${index}`)

    expect(pruneScopedSlotOwnerAutoSetDataPickKeys([
      'currentStep',
      ...bindKeys,
      'formState',
      'paceModel.value',
      'formState.urgent',
    ])).toEqual([
      'currentStep',
      'formState',
      'paceModel.value',
      'formState.urgent',
    ])
  })

  it('detects whether js may need setData.pick injection', () => {
    expect(mayNeedInjectSetDataPickInJs('createWevuComponent(options)')).toBe(true)
    expect(mayNeedInjectSetDataPickInJs('defineComponent({})')).toBe(true)
    expect(mayNeedInjectSetDataPickInJs('Page({})')).toBe(false)
  })

  it('detects setup useSlots calls that need slot host properties', () => {
    expect(mayNeedScopedSlotHostPropertiesForSetupSlotsInJs(`
import { useSlots } from 'wevu/internal-runtime'
const slots = useSlots()
    `.trim())).toBe(true)

    expect(mayNeedScopedSlotHostPropertiesForSetupSlotsInJs(`
import { useSlots as useSetupSlots } from 'wevu'
const slots = useSetupSlots()
    `.trim())).toBe(true)

    expect(mayNeedScopedSlotHostPropertiesForSetupSlotsInJs(`
import { useSlots } from 'wevu'
const slots = {}
    `.trim())).toBe(false)

    expect(mayNeedScopedSlotHostPropertiesForSetupSlotsInJs(`
const useSlots = () => ({})
const slots = useSlots()
    `.trim())).toBe(false)
  })

  it('merges with existing setData.pick array', () => {
    const source = `
import { defineComponent } from 'wevu'
defineComponent({
  setData: {
    strategy: 'patch',
    pick: ['count'],
  },
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectSetDataPickInJs(source, ['list', 'count'])
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('strategy: \'patch\'')
    expect(injected.code).toMatch(/['"]count['"]/)
    expect(injected.code).toMatch(/['"]list['"]/)
  })

  it('wraps non-object setData with spread and pick', () => {
    const source = `
import { defineComponent } from 'wevu'
const setDataOption = getSetDataConfig()
defineComponent({
  setData: setDataOption,
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectSetDataPickInJs(source, ['count'])
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('setData: {')
    expect(injected.code).toContain('"count"')
    expect(injected.code).toContain(`"${WEVU_SLOT_NAMES_PROP}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_OWNER_ID_PROP}"`)
    expect(injected.code).toContain(`"${WEVU_SLOT_SCOPE_KEY}"`)
    expect(injected.code).toContain('...setDataOption')
  })

  it('injects scoped slot host properties into wevu component options', () => {
    const source = `
import { createWevuComponent } from 'wevu'
createWevuComponent({
  setData: { pick: ['__wvSlotOwnerId'] },
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectScopedSlotHostPropertiesInJs(source)
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('properties')
    expect(injected.code).toContain('vueSlots')
    expect(injected.code).toContain('__wvSlotOwnerId')
    expect(injected.code).toContain('__wvSlotScope')
  })

  it('merges scoped slot host properties with existing properties object', () => {
    const source = `
import { defineComponent } from 'wevu'
defineComponent({
  properties: {
    title: String,
  },
})
    `.trim()

    const injected = injectScopedSlotHostPropertiesInJs(source)
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('title: String')
    expect(injected.code).toContain('vueSlots')
    expect(injected.code).toContain('__wvSlotOwnerId')
    expect(injected.code).toContain('__wvSlotScope')
  })

  it('injects scoped slot host properties into compiled runtime calls', () => {
    const source = `
const require_runtime = require("../../../weapp-vendors/wevu-watch.js")
require_runtime.so({
  setData: { pick: ["__wvSlotOwnerId"] },
  __wevu_isPage: true,
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectScopedSlotHostPropertiesInJs(source)
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('properties')
    expect(injected.code).toContain('vueSlots')
    expect(injected.code).toContain('__wvSlotOwnerId')
    expect(injected.code).toContain('__wvSlotScope')
  })

  it('injects scoped slot host properties into compiled component runtime calls without page marker', () => {
    const source = `
const require_runtime = require("../../../weapp-vendors/wevu-watch.js")
require_runtime.so({
  allowNullPropInput: true,
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectScopedSlotHostPropertiesInJs(source)
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('properties')
    expect(injected.code).toContain('vueSlots')
    expect(injected.code).toContain('__wvSlotOwnerId')
    expect(injected.code).toContain('__wvSlotScope')
  })

  it('returns original js when no wevu component call hint exists', () => {
    const source = 'Page({ data: { count: 1 } })'
    const injected = injectSetDataPickInJs(source, ['count'])

    expect(injected.transformed).toBe(false)
    expect(injected.code).toBe(source)
  })
})
