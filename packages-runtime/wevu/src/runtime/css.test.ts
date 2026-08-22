import { WEVU_CSS_MODULES_KEY, WEVU_CSS_VARS_STYLE_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it } from 'vitest'
import { ref } from '../reactivity'
import { useCssModule, useCssVars } from './css'
import { setCurrentInstance } from './hooks'

afterEach(() => {
  setCurrentInstance(undefined)
})

describe('SFC CSS runtime', () => {
  it('resolves default and named CSS Modules from the current component', () => {
    setCurrentInstance({
      [WEVU_CSS_MODULES_KEY]: {
        $style: { root: 'root_default' },
        theme: { active: 'active_theme' },
      },
    } as any)

    expect(useCssModule()).toEqual({ root: 'root_default' })
    expect(useCssModule('theme')).toEqual({ active: 'active_theme' })
  })

  it('reports a deterministic error for a missing CSS Module', () => {
    setCurrentInstance({ [WEVU_CSS_MODULES_KEY]: {} } as any)

    expect(() => useCssModule('missing')).toThrowError(
      'useCssModule() 找不到名为 "missing" 的 CSS Module',
    )
  })

  it('keeps CSS variables reactive and exposes them to template snapshots', () => {
    const color = ref('red')
    const state: Record<string, any> = {}
    const setupState: Record<string, any> = {}
    const instance = {
      __wevu: {
        proxy: { color },
        state,
        setupState,
      },
    }
    setCurrentInstance(instance as any)

    const style = useCssVars(context => ({ color: context.color, gap: 0 }))

    expect(style.value).toBe('--color:red;--gap:0')
    expect(state[WEVU_CSS_VARS_STYLE_KEY]).toBe(style)
    expect(setupState[WEVU_CSS_VARS_STYLE_KEY]).toBe(style)

    color.value = 'blue'
    expect(style.value).toBe('--color:blue;--gap:0')
  })

  it('requires synchronous setup context', () => {
    expect(() => useCssModule()).toThrowError('useCssModule() 必须在 setup() 的同步阶段调用')
    expect(() => useCssVars(() => ({}))).toThrowError('useCssVars() 必须在 setup() 的同步阶段调用')
  })
})
