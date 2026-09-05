// @vitest-environment happy-dom

import type { ComponentPublicInstance, NormalizedComponentOptions } from '../src/runtime/component/types'
import { html } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, onError, onErrorCaptured, ref } from 'wevu'
import { defineComponent } from '../src/runtime/component'
import {
  createScopedSelectorQuery,
  resolveQueryRoot,
  resolveRenderRoot,
  selectRuntimeComponent,
  selectRuntimeComponents,
} from '../src/runtime/component/dom'
import { bindRuntimeEvents } from '../src/runtime/component/events'
import { runComponentObservers } from '../src/runtime/component/observers'
import { resolveRelationNodes } from '../src/runtime/component/relations'
import { registerWebWevuComponent } from '../src/runtime/wevu'
import { slugify } from '../src/shared/slugify'

describe('component infrastructure contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('resolves every supported render and query root fallback', () => {
    const instance = document.createElement('section') as ComponentPublicInstance & {
      renderRoot?: HTMLElement | ShadowRoot
    }
    const shadowRoot = instance.attachShadow({ mode: 'open' })
    const renderRoot = document.createElement('main')

    instance.renderRoot = renderRoot
    expect(resolveQueryRoot(instance)).toBe(renderRoot)
    expect(resolveRenderRoot(instance)).toBe(renderRoot)

    delete instance.renderRoot
    expect(resolveQueryRoot(instance)).toBe(shadowRoot)
    expect(resolveRenderRoot(instance)).toBe(shadowRoot)

    const plainInstance = document.createElement('section') as ComponentPublicInstance
    expect(resolveQueryRoot(plainInstance)).toBe(plainInstance)
    expect(resolveRenderRoot(plainInstance)).toBe(plainInstance)
  })

  it('handles scoped selector query host capability variants', () => {
    const instance = document.createElement('section') as ComponentPublicInstance
    const unscopedQuery = { select: vi.fn() }

    vi.stubGlobal('wx', {
      createSelectorQuery: vi.fn(() => unscopedQuery),
    })
    expect(createScopedSelectorQuery(instance)).toBe(unscopedQuery)

    vi.stubGlobal('wx', {
      createSelectorQuery: vi.fn(() => undefined),
    })
    expect(createScopedSelectorQuery(instance)).toBeUndefined()
  })

  it('returns stable empty selector results for unusable query roots', () => {
    const target = document.createElement('span') as ComponentPublicInstance
    const root = document.createElement('section')
    root.append(target)
    const instance = { renderRoot: root } as unknown as ComponentPublicInstance & { renderRoot: ParentNode }

    expect(selectRuntimeComponent(instance, 'span')).toBe(target)
    expect(selectRuntimeComponents(instance, 'span')).toEqual([target])
    expect(selectRuntimeComponent(instance, '')).toBeNull()
    expect(selectRuntimeComponents(instance, '')).toEqual([])

    const unusable = { renderRoot: {} as ParentNode } as ComponentPublicInstance & { renderRoot: ParentNode }
    expect(selectRuntimeComponent(unusable, 'span')).toBeNull()
    expect(selectRuntimeComponents(unusable, 'span')).toEqual([])
  })

  it('does not bind events without a document host', () => {
    const root = document.createElement('section')
    vi.stubGlobal('document', undefined)
    expect(bindRuntimeEvents(root, {}, root as ComponentPublicInstance)).toBeUndefined()
  })

  it('ignores empty and unknown runtime event handlers', () => {
    const root = document.createElement('section')
    const emptyHandler = document.createElement('button')
    const missingHandler = document.createElement('button')
    emptyHandler.setAttribute('data-mp-on-tap', '')
    missingHandler.setAttribute('data-mp-on-tap', 'missing')
    root.append(emptyHandler, missingHandler)

    const addEmptyListener = vi.spyOn(emptyHandler, 'addEventListener')
    const addMissingListener = vi.spyOn(missingHandler, 'addEventListener')
    bindRuntimeEvents(root, {}, root as ComponentPublicInstance)

    expect(addEmptyListener).not.toHaveBeenCalled()
    expect(addMissingListener).not.toHaveBeenCalled()
  })

  it('runs wildcard, nested and property observers for matching changes', () => {
    const propertyObserver = vi.fn()
    const wildcardObserver = vi.fn()
    const nestedObserver = vi.fn()
    const invalidObserver = vi.fn()
    const component = {
      properties: {
        title: { observer: propertyObserver },
      },
      observers: {
        '**': wildcardObserver,
        'profile.items[0].name, missing.value': nestedObserver,
        '**, missing.value': nestedObserver,
        '': invalidObserver,
        'ignored': 'not-a-function',
      },
    } as unknown as NormalizedComponentOptions
    const instance = {
      properties: { title: 'after', profile: { items: [{ name: 'Ada' }] } },
      data: { count: 1 },
    } as unknown as ComponentPublicInstance

    runComponentObservers(component, instance, ['title', 'profile.items[0].name'], { title: 'before' })

    expect(propertyObserver).toHaveBeenCalledWith('after', 'before')
    expect(wildcardObserver).toHaveBeenCalledWith({
      title: 'after',
      profile: { items: [{ name: 'Ada' }] },
      count: 1,
    })
    expect(nestedObserver).toHaveBeenNthCalledWith(1, 'Ada', undefined)
    expect(nestedObserver).toHaveBeenNthCalledWith(2, {
      title: 'after',
      profile: { items: [{ name: 'Ada' }] },
      count: 1,
    }, undefined)
    expect(invalidObserver).not.toHaveBeenCalled()
  })

  it('skips observers when there are no changed keys', () => {
    const observer = vi.fn()
    const instance = { properties: {}, data: {} } as ComponentPublicInstance
    runComponentObservers({ properties: {}, observers: { '**': observer } }, instance, [])
    expect(observer).not.toHaveBeenCalled()
  })

  it('resolves slotted, shadow-hosted and exhausted ancestor relations', () => {
    const parentTag = slugify('components/parent/index', 'wv-component')
    const parent = document.createElement(parentTag) as ComponentPublicInstance
    const slot = document.createElement('slot')
    const child = document.createElement('div') as unknown as ComponentPublicInstance
    Object.defineProperty(child, 'assignedSlot', { configurable: true, value: slot })
    parent.append(slot)

    expect(resolveRelationNodes(child, 'components/child/index', '../parent/index', 'parent')).toEqual([])

    const host = document.createElement(parentTag) as ComponentPublicInstance
    const shadowRoot = host.attachShadow({ mode: 'open' })
    const detached = {
      getRootNode: () => shadowRoot,
    } as unknown as ComponentPublicInstance
    expect(resolveRelationNodes(detached, 'components/child/index', '../parent/index', 'ancestor')).toEqual([host])

    const orphan = document.createElement('div') as unknown as ComponentPublicInstance
    expect(resolveRelationNodes(orphan, 'components/child/index', '../parent/index', 'ancestor')).toEqual([])
  })

  it('runs the Lit component lifecycle and asynchronous data callbacks', async () => {
    const calls: string[] = []
    const titleObserver = vi.fn()
    const tap = vi.fn()
    defineComponent('wv-lit-lifecycle-contract', {
      id: 'components/lit-lifecycle/index',
      style: '.label { color: red; }',
      observerInit: true,
      template: state => `<button class="label" data-mp-on-click="tap">${state.title}</button>`,
      component: {
        data: () => ({ count: 0 }),
        properties: {
          title: { type: String, value: 'initial', observer: titleObserver },
        },
        methods: {
          tap,
          invalid: null as unknown as () => void,
        },
        lifetimes: {
          created: () => calls.push('created'),
          attached: () => calls.push('attached'),
          ready: () => calls.push('ready'),
          detached: () => calls.push('detached'),
        },
      },
    })

    const element = document.createElement('wv-lit-lifecycle-contract') as ComponentPublicInstance & {
      updateComplete: Promise<boolean>
      invalid?: unknown
      attributeChangedCallback: (name: string, oldValue: string | null, newValue: string | null) => void
      connectedCallback: () => void
      selectOwnerComponent: () => unknown
      tap?: (...args: unknown[]) => unknown
      __weappSync: (methods: undefined) => void
      __weappInvokePageLifetime: (type: 'resize') => void
    }
    element.title = 'before-connect'
    expect(element.title).toBe('before-connect')
    document.body.append(element)
    await element.updateComplete

    expect(calls).toEqual(['created', 'attached', 'ready'])
    expect(titleObserver).toHaveBeenCalledWith('before-connect', 'initial')
    expect(element.invalid).toBeUndefined()
    expect(element.getRelationNodes('../missing/index')).toEqual([])
    expect(element.selectOwnerComponent()).toBeUndefined()

    const button = element.shadowRoot!.querySelector('button')!
    button.dispatchEvent(new Event('click'))
    expect(tap).toHaveBeenCalledOnce()

    const slotFacade = element.data.$slots
    await expect(element.setData({ ...element.data, count: 1 })).resolves.toBeUndefined()
    expect(element.data.$slots).toBe(slotFacade)

    const callback = vi.fn()
    await element.setData({ count: 1 }, callback)
    expect(callback).toHaveBeenCalledOnce()
    await element.setData({ title: 'patched' })
    expect(element.properties.title).toBe('patched')
    element.title = 'patched'
    expect(element.setData(null as unknown as Record<string, unknown>)).toBeUndefined()
    const unchangedCallback = vi.fn()
    expect(element.setData({ count: 1 }, unchangedCallback)).toBeUndefined()
    expect(unchangedCallback).toHaveBeenCalledOnce()

    let rejectUpdate: ((cause: unknown) => void) | undefined
    const rejectedUpdate = new Promise<boolean>((_resolve, reject) => {
      rejectUpdate = reject
    })
    Object.defineProperty(element, 'updateComplete', {
      configurable: true,
      value: rejectedUpdate,
    })
    const failedUpdate = element.setData({ count: 2 })
    const renderFailure = new Error('render failed')
    rejectUpdate?.(renderFailure)
    await expect(failedUpdate).rejects.toBe(renderFailure)
    delete (element as any).updateComplete

    let rejectRecovery: ((cause: unknown) => void) | undefined
    const pendingRecovery = new Promise<boolean>((_resolve, reject) => {
      rejectRecovery = reject
    })
    Object.defineProperty(element, 'updateComplete', {
      configurable: true,
      value: pendingRecovery,
    })
    const recoveryCallback = vi.fn()
    const concurrentCallback = vi.fn()
    const recoveryUpdate = element.setData({ count: 2 }, recoveryCallback)
    const concurrentUpdate = element.setData({ count: 2 }, concurrentCallback)
    expect(concurrentUpdate).toBeInstanceOf(Promise)
    expect(recoveryCallback).not.toHaveBeenCalled()
    expect(concurrentCallback).not.toHaveBeenCalled()

    const recoveryFailure = new Error('recovery render failed')
    rejectRecovery?.(recoveryFailure)
    await expect(recoveryUpdate).rejects.toBe(recoveryFailure)
    await expect(concurrentUpdate).rejects.toBe(recoveryFailure)
    expect(recoveryCallback).not.toHaveBeenCalled()
    expect(concurrentCallback).not.toHaveBeenCalled()
    delete (element as any).updateComplete

    const successfulRecoveryCallback = vi.fn()
    await expect(element.setData({ count: 2 }, successfulRecoveryCallback)).resolves.toBeUndefined()
    expect(successfulRecoveryCallback).toHaveBeenCalledOnce()

    element.setAttribute('title', 'from-attribute')
    expect(element.properties.title).toBe('from-attribute')
    element.attributeChangedCallback('unknown', null, 'value')
    const observerCalls = titleObserver.mock.calls.length
    element.connectedCallback()
    expect(titleObserver).toHaveBeenCalledTimes(observerCalls)
    const userTap = vi.fn()
    element.tap = userTap
    element.__weappSync(undefined)
    expect(element.tap).toBe(userTap)
    element.__weappInvokePageLifetime('resize')

    element.remove()
    expect(calls).toEqual(['created', 'attached', 'ready', 'attached', 'detached'])
  })

  it('reports rejected Lit updateComplete through the real Wevu Web adapter', async () => {
    const errors: unknown[] = []
    const capturedErrors: unknown[] = []
    let increment: (() => void) | undefined
    const id = 'components/wevu-web-commit/index'
    registerWebWevuComponent({
      setup() {
        const count = ref(0)
        increment = () => {
          count.value += 1
        }
        onError(error => errors.push(error))
        onErrorCaptured(error => capturedErrors.push(error))
        return { count }
      },
    }, {
      kind: 'component',
      id,
      template: state => html`<span>${state.count}</span>`,
    })
    const element = document.createElement(slugify(id, 'wv-component')) as ComponentPublicInstance & {
      updateComplete: Promise<boolean>
    }
    document.body.append(element)
    await element.updateComplete
    let rejectUpdate: ((cause: unknown) => void) | undefined
    const updateComplete = new Promise<boolean>((_resolve, reject) => {
      rejectUpdate = reject
    })
    Object.defineProperty(element, 'updateComplete', {
      configurable: true,
      value: updateComplete,
    })
    increment?.()

    await nextTick()
    const cause = new Error('web render failed')
    rejectUpdate?.(cause)
    await Promise.resolve()
    await Promise.resolve()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(Error)
    expect((errors[0] as Error & { cause?: unknown }).cause).toBe(cause)
    expect(capturedErrors).toEqual(errors)
    element.remove()
  })

  it('finds an owner through assigned slots and shadow roots', async () => {
    defineComponent('wv-owner-contract-parent', {
      template: () => html`<slot></slot>`,
      component: {},
    })
    defineComponent('wv-owner-contract-child', {
      template: () => html`<span>child</span>`,
      component: {},
    })

    const parent = document.createElement('wv-owner-contract-parent') as HTMLElement & {
      updateComplete: Promise<boolean>
    }
    const child = document.createElement('wv-owner-contract-child') as HTMLElement & {
      selectOwnerComponent: () => unknown
    }
    document.body.append(parent)
    await parent.updateComplete
    const slot = parent.shadowRoot!.querySelector('slot')!
    Object.defineProperty(child, 'assignedSlot', { configurable: true, value: slot })

    expect(child.selectOwnerComponent()).toBe(parent)
  })

  it('renders Lit template values with and without component styles', async () => {
    defineComponent('wv-lit-template-style-contract', {
      style: ':host { display: block; }',
      template: state => html`<span>${state.label}</span>`,
      component: {
        data: { label: 'styled' },
      },
    })
    defineComponent('wv-lit-template-plain-contract', {
      template: state => html`<span>${state.label}</span>`,
      component: {
        data: { label: 'plain' },
      },
    })
    defineComponent('wv-lit-template-null-contract', {
      template: () => null as any,
      component: {},
    })

    const styled = document.createElement('wv-lit-template-style-contract') as HTMLElement & {
      updateComplete: Promise<boolean>
    }
    const plain = document.createElement('wv-lit-template-plain-contract') as HTMLElement & {
      updateComplete: Promise<boolean>
    }
    const empty = document.createElement('wv-lit-template-null-contract') as HTMLElement & {
      updateComplete: Promise<boolean>
    }
    document.body.append(styled, plain, empty)
    await Promise.all([styled.updateComplete, plain.updateComplete, empty.updateComplete])

    expect(styled.shadowRoot?.textContent).toContain('styled')
    expect(styled.shadowRoot?.querySelector('style')?.textContent).toContain('display: block')
    expect(plain.shadowRoot?.textContent).toContain('plain')
    expect(empty.shadowRoot?.textContent).toBe('')
  })
})
