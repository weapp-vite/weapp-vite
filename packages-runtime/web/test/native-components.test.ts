import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectCheckboxGroupValue,
  collectFormControlValues,
  collectRadioGroupValue,
  createInputEventDetail,
  createPickerChangeDetail,
  createScrollEventDetail,
  createSliderEventDetail,
  createSwiperChangeDetail,
  createSwitchEventDetail,
  createTextareaLineChangeDetail,
  ensureNativeComponentsDefined,
  normalizePickerIndexes,
  normalizePickerViewValue,
  resolveImageModeStyle,
  resolvePickerColumns,
  resolvePickerMode,
  resolveSliderConfig,
  resolveSwiperIndex,
  resolveSwiperNumber,
  resolveSwipeTarget,
} from '../src/runtime/nativeComponents'
import { connectFormControl, disconnectFormControl, resetFormControls } from '../src/runtime/nativeComponents/formControl'
import { resolveMaxLength } from '../src/runtime/nativeComponents/helpers'
import { executeNavigatorRequest, resolveNavigatorExtraData } from '../src/runtime/nativeComponents/navigator'
import { NATIVE_COMPONENT_STYLE } from '../src/runtime/nativeComponents/style'
import { SWIPER_SHADOW_STYLE } from '../src/runtime/nativeComponents/swiper/style'
import { setupRpx } from '../src/runtime/rpx'
import { resolveWebViewportConfig } from '../src/runtime/viewport'
import { createWebViewportStyle } from '../src/runtime/viewport/style'
import { resolveNativeComponentWebTag } from '../src/shared/nativeComponents'

describe('web native component contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps compiler and runtime tags in one descriptor table', () => {
    expect(resolveNativeComponentWebTag('view')).toBe('weapp-view')
    expect(resolveNativeComponentWebTag('text')).toBe('weapp-text')
    expect(resolveNativeComponentWebTag('image')).toBe('weapp-image')
    expect(resolveNativeComponentWebTag('input')).toBe('weapp-input')
    expect(resolveNativeComponentWebTag('form')).toBe('weapp-form')
    expect(resolveNativeComponentWebTag('textarea')).toBe('weapp-textarea')
    expect(resolveNativeComponentWebTag('checkbox-group')).toBe('weapp-checkbox-group')
    expect(resolveNativeComponentWebTag('radio')).toBe('weapp-radio')
    expect(resolveNativeComponentWebTag('switch')).toBe('weapp-switch')
    expect(resolveNativeComponentWebTag('picker')).toBe('weapp-picker')
    expect(resolveNativeComponentWebTag('picker-view')).toBe('weapp-picker-view')
    expect(resolveNativeComponentWebTag('picker-view-column')).toBe('weapp-picker-view-column')
    expect(resolveNativeComponentWebTag('slider')).toBe('weapp-slider')
    expect(resolveNativeComponentWebTag('scroll-view')).toBe('weapp-scroll-view')
    expect(resolveNativeComponentWebTag('navigator')).toBe('weapp-navigator')
    expect(resolveNativeComponentWebTag('swiper')).toBe('weapp-swiper')
    expect(resolveNativeComponentWebTag('swiper-item')).toBe('weapp-swiper-item')
    expect(NATIVE_COMPONENT_STYLE).toContain('weapp-view')
    expect(NATIVE_COMPONENT_STYLE).toContain('weapp-image')
    expect(NATIVE_COMPONENT_STYLE).toContain('weapp-form { display: inline; box-sizing: border-box; }')
  })

  it('routes navigator open types through the existing page stack bridge', async () => {
    const success = vi.fn()
    const fail = vi.fn()
    const complete = vi.fn()
    const bridge = {
      navigateTo: vi.fn(() => Promise.resolve()),
      redirectTo: vi.fn(() => Promise.resolve()),
      switchTab: vi.fn(() => Promise.resolve()),
      reLaunch: vi.fn(() => Promise.resolve()),
      navigateBack: vi.fn(() => Promise.resolve()),
      navigateToMiniProgram: vi.fn(() => Promise.resolve({ errMsg: 'navigateToMiniProgram:ok' })),
      exitMiniProgram: vi.fn(() => Promise.resolve({ errMsg: 'exitMiniProgram:ok' })),
    }

    await executeNavigatorRequest({
      url: '/pages/detail/index?from=navigator',
      openType: 'redirect',
      delta: 1,
      target: 'self',
      success,
      fail,
      complete,
    }, bridge as any)
    await executeNavigatorRequest({
      url: '',
      openType: 'navigateBack',
      delta: 2,
      target: 'self',
    }, bridge as any)

    expect(bridge.redirectTo).toHaveBeenCalledWith({
      url: '/pages/detail/index?from=navigator',
      success,
      fail,
      complete,
    })
    expect(bridge.navigateBack).toHaveBeenCalledWith({ delta: 2 })
  })

  it('forwards mini-program navigator callbacks through the host bridge', async () => {
    const success = vi.fn()
    const fail = vi.fn()
    const complete = vi.fn()

    await executeNavigatorRequest({
      url: '',
      openType: 'navigate',
      delta: 1,
      target: 'miniProgram',
      appId: 'wx-runtime-demo',
      path: 'pages/index/index',
      extraData: { source: 'navigator' },
      envVersion: 'trial',
      success,
      fail,
      complete,
    })

    expect(success).toHaveBeenCalledWith({ errMsg: 'navigateToMiniProgram:ok' })
    expect(fail).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledWith({ errMsg: 'navigateToMiniProgram:ok' })

    success.mockClear()
    complete.mockClear()
    await expect(executeNavigatorRequest({
      url: '',
      openType: 'navigate',
      delta: 1,
      target: 'miniProgram',
      fail,
      complete,
    })).rejects.toEqual({ errMsg: 'navigateToMiniProgram:fail invalid appId' })
    expect(success).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledWith({ errMsg: 'navigateToMiniProgram:fail invalid appId' })
    expect(complete).toHaveBeenCalledWith({ errMsg: 'navigateToMiniProgram:fail invalid appId' })
  })

  it('preserves navigator extra-data objects and static JSON attributes', () => {
    const payload = { source: 'navigator', nested: { count: 1 } }
    expect(resolveNavigatorExtraData(payload)).toBe(payload)
    expect(resolveNavigatorExtraData(undefined, '{"source":"attribute"}')).toEqual({
      source: 'attribute',
    })
    expect(resolveNavigatorExtraData('[object Object]')).toBeUndefined()
  })

  it('resolves swiper item ids, drag thresholds and mini-program event details', () => {
    expect(resolveSwiperIndex({
      current: 0,
      currentItemId: 'second',
      itemIds: ['first', 'second', 'third'],
    })).toBe(1)
    expect(resolveSwipeTarget({
      current: 1,
      delta: -80,
      itemSize: 300,
      itemCount: 3,
      circular: false,
    })).toBe(2)
    expect(resolveSwipeTarget({
      current: 0,
      delta: 80,
      itemSize: 300,
      itemCount: 3,
      circular: true,
    })).toBe(2)
    expect(createSwiperChangeDetail(2, 'third', 'touch')).toEqual({
      current: 2,
      currentItemId: 'third',
      source: 'touch',
    })
    expect(resolveSwiperNumber(null, 500)).toBe(500)
    expect(resolveSwiperNumber('', 500)).toBe(500)
    expect(resolveSwiperNumber('1200', 500)).toBe(1200)
    expect(resolveSwiperNumber('-1', 500, 16)).toBe(16)
    expect(SWIPER_SHADOW_STYLE).toContain(':host([data-vertical]) .track')
    expect(SWIPER_SHADOW_STYLE).not.toContain(':host([vertical])')
  })

  it('maps image modes to browser object fitting', () => {
    expect(resolveImageModeStyle('aspectFit')).toEqual({ fit: 'contain', position: 'center' })
    expect(resolveImageModeStyle('aspectFill')).toEqual({ fit: 'cover', position: 'center' })
    expect(resolveImageModeStyle('bottom right')).toEqual({ fit: 'none', position: 'right bottom' })
    expect(resolveImageModeStyle('unknown')).toEqual({ fit: 'fill', position: 'center' })
  })

  it('creates WeChat-compatible input and scroll event details', () => {
    expect(createInputEventDetail({ value: 'hello', selectionStart: 3 })).toEqual({
      value: 'hello',
      cursor: 3,
    })
    expect(createScrollEventDetail({
      scrollLeft: 16,
      scrollTop: 42,
      scrollWidth: 640,
      scrollHeight: 960,
    }, {
      scrollLeft: 4,
      scrollTop: 10,
    })).toEqual({
      scrollLeft: 16,
      scrollTop: 42,
      scrollWidth: 640,
      scrollHeight: 960,
      deltaX: 12,
      deltaY: 32,
    })
    expect(createTextareaLineChangeDetail({ value: 'first\nsecond', scrollHeight: 48 })).toEqual({
      height: 48,
      heightRpx: 96,
      lineCount: 2,
    })
    expect(createSwitchEventDetail(true)).toEqual({ value: true })
    expect(resolveMaxLength(null)).toBeUndefined()
    expect(resolveMaxLength('-1')).toBeUndefined()
    expect(resolveMaxLength('20')).toBe(20)
  })

  it('normalizes picker modes, ranges and event details', () => {
    expect(resolvePickerMode('multiSelector')).toBe('multiSelector')
    expect(resolvePickerMode('unsupported')).toBe('selector')
    expect(resolvePickerColumns([
      { id: 'native', title: '原生' },
      { id: 'web', title: 'Web' },
    ], 'selector', 'title')).toEqual([[
      { label: '原生', value: { id: 'native', title: '原生' } },
      { label: 'Web', value: { id: 'web', title: 'Web' } },
    ]])
    expect(resolvePickerColumns([['A', 'B'], ['1', '2', '3']], 'multiSelector')).toEqual([
      [
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
      ],
      [
        { label: '1', value: '1' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
      ],
    ])
    expect(normalizePickerIndexes([4, -1], [2, 3])).toEqual([1, 0])
    expect(createPickerChangeDetail('selector', 1)).toEqual({ value: 1 })
    expect(createPickerChangeDetail('region', ['浙江省', '杭州市'])).toEqual({
      value: ['浙江省', '杭州市'],
      code: ['', ''],
      postcode: '',
    })
  })

  it('normalizes picker-view columns and slider values', () => {
    expect(normalizePickerViewValue([2, -1, 9], [3, 4, 2])).toEqual([2, 0, 1])
    expect(normalizePickerViewValue('invalid', [2, 0])).toEqual([0, 0])
    expect(resolveSliderConfig({
      min: 10,
      max: 30,
      step: 4,
      value: 27,
      blockSize: 40,
    })).toEqual({
      min: 10,
      max: 30,
      step: 4,
      value: 26,
      blockSize: 28,
    })
    expect(resolveSliderConfig({ max: 0, step: 0, blockSize: 4 })).toEqual({
      min: 0,
      max: 100,
      step: 1,
      value: 0,
      blockSize: 12,
    })
    expect(createSliderEventDetail(42)).toEqual({ value: 42 })
  })

  it('aggregates checkbox and radio group values with disabled controls filtered', () => {
    expect(collectCheckboxGroupValue([
      { checked: true, disabled: false, value: 'native' },
      { checked: false, disabled: false, value: 'vue' },
      { checked: true, disabled: true, value: 'disabled' },
    ] as any)).toEqual(['native'])
    expect(collectRadioGroupValue([
      { checked: false, disabled: false, value: 'preview' },
      { checked: true, disabled: false, value: 'stable' },
    ] as any)).toBe('stable')
  })

  it('collects registered form controls and resets their internal state', () => {
    const form = {
      matches: (selector: string) => selector === 'weapp-form',
      parentElement: null,
    } as any
    const activeReset = vi.fn()
    const disabledReset = vi.fn()
    const active = {
      matches: () => false,
      parentElement: form,
      formControlName: 'profile',
      formControlValue: 'Ada',
      formControlDisabled: false,
      formReset: activeReset,
    } as any
    const disabled = {
      matches: () => false,
      parentElement: form,
      formControlName: 'ignored',
      formControlValue: true,
      formControlDisabled: true,
      formReset: disabledReset,
    } as any

    connectFormControl(active)
    connectFormControl(disabled)
    expect(collectFormControlValues(form)).toEqual({ profile: 'Ada' })
    resetFormControls(form)
    expect(activeReset).toHaveBeenCalledOnce()
    expect(disabledReset).toHaveBeenCalledOnce()
    disconnectFormControl(active)
    disconnectFormControl(disabled)
  })

  it('updates rpx from the device container width on resize', () => {
    const app = { clientWidth: 375 }
    const setProperty = vi.fn()
    let resizeListener: (() => void) | undefined
    vi.stubGlobal('document', {
      documentElement: {
        clientWidth: 1024,
        style: { setProperty },
      },
      querySelector: (selector: string) => selector === '#app' ? app : null,
    })
    vi.stubGlobal('window', {
      addEventListener: (name: string, listener: () => void) => {
        if (name === 'resize') {
          resizeListener = listener
        }
      },
      innerWidth: 1024,
    })

    setupRpx({ designWidth: 750 })
    expect(setProperty).toHaveBeenLastCalledWith('--rpx', '0.5px')
    app.clientWidth = 320
    resizeListener?.()
    expect(setProperty).toHaveBeenLastCalledWith('--rpx', `${320 / 750}px`)
  })

  it('does not register native custom elements twice during HMR initialization', () => {
    const defined = new Map<string, CustomElementConstructor>()
    const define = vi.fn((name: string, constructor: CustomElementConstructor) => {
      defined.set(name, constructor)
    })
    vi.stubGlobal('customElements', {
      define,
      get: (name: string) => defined.get(name),
    })

    ensureNativeComponentsDefined()
    ensureNativeComponentsDefined()
    expect(define.mock.calls.map(([name]) => name)).toEqual([
      'weapp-view',
      'weapp-text',
      'weapp-image',
      'weapp-button',
      'weapp-input',
      'weapp-textarea',
      'weapp-form',
      'weapp-label',
      'weapp-checkbox-group',
      'weapp-checkbox',
      'weapp-radio-group',
      'weapp-radio',
      'weapp-switch',
      'weapp-picker',
      'weapp-picker-view',
      'weapp-picker-view-column',
      'weapp-slider',
      'weapp-scroll-view',
      'weapp-navigator',
      'weapp-swiper',
      'weapp-swiper-item',
    ])
  })

  it('defaults to a centered mini-program viewport and supports responsive opt-out', () => {
    expect(resolveWebViewportConfig()).toEqual({
      mode: 'mini-program',
      maxWidth: 375,
      desktopBreakpoint: 600,
    })
    expect(resolveWebViewportConfig({ mode: 'responsive', maxWidth: 414, desktopBreakpoint: 720 })).toEqual({
      mode: 'responsive',
      maxWidth: 414,
      desktopBreakpoint: 720,
    })
    const css = createWebViewportStyle(resolveWebViewportConfig())
    expect(css).toContain('width: 375px')
    expect(css).toContain('@media (min-width: 600px)')
    expect(css).toContain('contain: layout paint')
  })
})
