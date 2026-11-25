// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { WeappNavigator } from '../src/runtime/nativeComponents/navigator'
import { VISUAL_WEB_COMPONENT_CONSTRUCTORS } from '../src/runtime/nativeComponents/registry'
import { NATIVE_COMPONENT_DESCRIPTORS } from '../src/shared/nativeComponents'

describe('原生组件注册表拆分', () => {
  it('全量注册仍覆盖所有描述符标签', () => {
    ensureNativeComponentsDefined()
    for (const descriptor of NATIVE_COMPONENT_DESCRIPTORS) {
      expect(customElements.get(descriptor.webTag as keyof typeof VISUAL_WEB_COMPONENT_CONSTRUCTORS)).toBeTypeOf('function')
    }
  })

  it('路由标签沿用同一构造器', () => {
    ensureNativeComponentsDefined()
    expect(customElements.get('weapp-navigator')).toBe(WeappNavigator)
  })

  it('视觉注册表与运行时注册结果类身份一致', () => {
    ensureNativeComponentsDefined()
    for (const [tag, constructor] of Object.entries(VISUAL_WEB_COMPONENT_CONSTRUCTORS)) {
      expect(customElements.get(tag)).toBe(constructor)
    }
  })
})
