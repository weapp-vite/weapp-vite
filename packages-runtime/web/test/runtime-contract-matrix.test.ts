// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveRelationNodes } from '../src/runtime/component/relations'
import { createWebSlotsProxy } from '../src/runtime/component/slots'
import {
  cloneValue,
  coerceValue,
  hyphenate,
  toCamelCase,
} from '../src/runtime/component/utils'
import { createAnimation } from '../src/runtime/polyfill/animation'
import { createNavigationBarRuntimeBridge } from '../src/runtime/polyfill/navigationBarRuntime'
import { configureWebSeo, resetWebDocumentHead } from '../src/runtime/seo'
import { slugify } from '../src/shared/slugify'

describe('web runtime contract matrices', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.replaceChildren()
    document.title = ''
    resetWebDocumentHead()
  })

  it('exports every animation operation and consumes steps once', () => {
    const animation = createAnimation({ duration: 300, timingFunction: 'linear' })
    const result = animation
      .backgroundColor('#ffffff')
      .bottom(1)
      .height('10px')
      .left(2)
      .matrix(1, 0, 0, 1, 0, 0)
      .matrix3d(...Array.from({ length: 16 }, (_, index) => index))
      .opacity(0.5)
      .right('2px')
      .rotate(45)
      .rotate3d(1, 0, 0, 90)
      .rotateX(10)
      .rotateY(20)
      .rotateZ(30)
      .scale(2)
      .scale(2, 3)
      .scale3d(1, 2, 3)
      .scaleX(2)
      .scaleY(3)
      .scaleZ(4)
      .skew(10, 20)
      .skewX(5)
      .skewY(6)
      .top(3)
      .translate(4)
      .translate(4, 5)
      .translate3d(1, 2, 3)
      .translateX(7)
      .translateY(8)
      .translateZ(9)
      .width('20px')
      .step({ delay: 10 })
      .opacity(1)
      .step()
      .export()

    expect(result.actions).toHaveLength(2)
    expect(result.actions[0]!.animates.map(operation => operation.type)).toEqual([
      'backgroundColor',
      'bottom',
      'height',
      'left',
      'matrix',
      'matrix3d',
      'opacity',
      'right',
      'rotate',
      'rotate3d',
      'rotateX',
      'rotateY',
      'rotateZ',
      'scale',
      'scale',
      'scale3d',
      'scaleX',
      'scaleY',
      'scaleZ',
      'skew',
      'skewX',
      'skewY',
      'top',
      'translate',
      'translate',
      'translate3d',
      'translateX',
      'translateY',
      'translateZ',
      'width',
    ])
    expect(result.actions[0]!.option).toEqual({ duration: 300, timingFunction: 'linear', delay: 10 })
    expect(result.actions[1]!.option).toEqual({ duration: 300, timingFunction: 'linear' })
    expect(animation.export()).toEqual({ actions: [] })
  })

  it('updates the active navigation bar in render roots and page roots', async () => {
    const warning = vi.fn()
    const page = document.createElement('section') as HTMLElement & { renderRoot?: HTMLElement }
    const renderRoot = document.createElement('div')
    const bar = document.createElement('weapp-navigation-bar')
    renderRoot.append(bar)
    page.renderRoot = renderRoot
    const pages = [page]
    const bridge = createNavigationBarRuntimeBridge(() => pages, warning)
    configureWebSeo({ enabled: true })

    await bridge.setNavigationBarTitle({ title: 'Details' })
    expect(bar.getAttribute('title')).toBe('Details')
    expect(document.title).toBe('Details')
    await bridge.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: '#000000',
      animation: { duration: 120, timingFunction: 'ease-in' },
    })
    expect(bar.getAttribute('front-color')).toBe('#ffffff')
    expect(bar.getAttribute('background-color')).toBe('#000000')
    expect(bar.style.getPropertyValue('--weapp-nav-transition-duration')).toBe('120ms')
    expect(bar.style.getPropertyValue('--weapp-nav-transition-easing')).toBe('ease-in')
    await bridge.showNavigationBarLoading()
    expect(bar.getAttribute('loading')).toBe('true')
    await bridge.hideNavigationBarLoading()
    expect(bar.hasAttribute('loading')).toBe(false)

    await bridge.setNavigationBarTitle({} as any)
    await bridge.setNavigationBarColor({ animation: {} })
    expect(warning).not.toHaveBeenCalled()

    delete page.renderRoot
    page.append(bar)
    await bridge.setNavigationBarColor({ frontColor: '#111111' })
    expect(bar.getAttribute('front-color')).toBe('#111111')
  })

  it('warns for every navigation bar action when no usable bar exists', async () => {
    const warning = vi.fn()
    const pages: any[] = []
    const bridge = createNavigationBarRuntimeBridge(() => pages, warning)
    await bridge.setNavigationBarTitle({ title: 'Missing' })
    await bridge.setNavigationBarColor({})
    await bridge.showNavigationBarLoading()
    await bridge.hideNavigationBarLoading()
    expect(warning).toHaveBeenCalledTimes(4)
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('miniProgram.setNavigationBarTitle'), {
      key: 'navigation-bar-missing',
      context: 'runtime:navigation',
    })

    pages.push({ renderRoot: {} })
    await bridge.setNavigationBarTitle({ title: 'Invalid root' })
    expect(warning).toHaveBeenCalledTimes(5)
  })

  it('normalizes component property names, values and JSON coercion', () => {
    expect(hyphenate('fooBarURL')).toBe('foo-bar-u-r-l')
    expect(toCamelCase('foo-bar-baz')).toBe('fooBarBaz')
    const array = [1, 2]
    const object = { value: 1 }
    expect(cloneValue(array)).toEqual(array)
    expect(cloneValue(array)).not.toBe(array)
    expect(cloneValue(object)).toEqual(object)
    expect(cloneValue(object)).not.toBe(object)
    expect(cloneValue('value')).toBe('value')

    expect(coerceValue('', Boolean)).toBe(true)
    expect(coerceValue(true, Boolean)).toBe(true)
    expect(coerceValue(undefined, Boolean)).toBe(false)
    expect(coerceValue(null, Boolean)).toBe(false)
    expect(coerceValue(false, Boolean)).toBe(false)
    expect(coerceValue('false', Boolean)).toBe(false)
    expect(coerceValue('0', Boolean)).toBe(true)
    expect(coerceValue(1, Boolean)).toBe(true)
    expect(coerceValue(undefined, Number)).toBeUndefined()
    expect(coerceValue(null, Number)).toBeNull()
    expect(coerceValue('2', Number)).toBe(2)
    expect(coerceValue('bad', Number)).toBe('bad')
    expect(coerceValue(undefined, Object)).toBeUndefined()
    expect(coerceValue(null, Array)).toBeNull()
    expect(coerceValue('{"value":1}', Object)).toEqual({ value: 1 })
    expect(coerceValue('[1,2]', Array)).toEqual([1, 2])
    expect(coerceValue('{bad', Object)).toBe('{bad')
    expect(coerceValue(object, Object)).toBe(object)
    expect(coerceValue('value', String)).toBe('value')
  })

  it('reflects dynamic slot values through every proxy trap', () => {
    let value: unknown = ['header', '', 1, 'footer']
    const slots = createWebSlotsProxy(() => value)
    expect(slots.header).toBe(true)
    expect(slots.missing).toBeUndefined()
    expect('footer' in slots).toBe(true)
    expect(Reflect.ownKeys(slots)).toEqual(['header', 'footer'])
    expect(Object.getOwnPropertyDescriptor(slots, 'header')).toMatchObject({ enumerable: true, value: true })
    expect(Object.getOwnPropertyDescriptor(slots, 'missing')).toBeUndefined()
    expect(Reflect.set(slots, 'header', false)).toBe(false)

    value = { header: false, content: 1 }
    expect(Reflect.ownKeys(slots)).toEqual(['content'])
    value = null
    expect(Reflect.ownKeys(slots)).toEqual([])
    value = 'header'
    expect(Reflect.ownKeys(slots)).toEqual([])
  })

  it('resolves child, descendant, parent and ancestor relations', () => {
    const componentId = 'components/parent/index'
    const relativePath = '../child/index'
    const childTag = slugify('components/child/index', 'wv-component')
    const parentTag = slugify(componentId, 'wv-component')
    const instance = document.createElement(parentTag) as any
    const direct = document.createElement(childTag) as any
    const wrapper = document.createElement('div')
    const nested = document.createElement(childTag) as any
    instance.append(direct, wrapper)
    wrapper.append(nested)

    expect(resolveRelationNodes(instance, componentId, relativePath, 'descendant')).toEqual([direct, nested])
    expect(resolveRelationNodes(instance, componentId, relativePath, 'child')).toEqual([direct])
    expect(resolveRelationNodes(direct, 'components/child/index', '../parent/index', 'parent')).toEqual([instance])
    expect(resolveRelationNodes(nested, 'components/child/index', '../parent/index', 'ancestor')).toEqual([instance])
    expect(resolveRelationNodes(nested, 'components/child/index', 'parent/index', 'ancestor')).toEqual([])
    expect(resolveRelationNodes(nested, undefined, '../parent/index', 'ancestor')).toEqual([])

    const unrelated = document.createElement('div') as any
    instance.append(unrelated)
    expect(resolveRelationNodes(unrelated, 'components/child/index', '../missing/index', 'parent')).toEqual([])
  })
})
