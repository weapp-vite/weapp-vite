import type { DomNodeLike, RuntimeRenderScope } from '../runtime/render/types'
import { describe, expect, it } from 'vitest'
import { collectMiniProgramEventBindings, resolveMiniProgramEventBinding } from '../index'
import { createComponentInstance } from '../runtime/componentInstance'
import { bindComponentEventHost, buildComponentTrigger, registerComponentEventNode } from './componentEvent'

function dispatchBindings(attributes: Record<string, string>, eventName: string, host: boolean) {
  const calls: string[] = []
  const scope: RuntimeRenderScope = {
    data: {},
    getMethod: method => () => calls.push(method),
    getScopeId: () => 'page:listener',
  }
  const parent: DomNodeLike = {
    attribs: { [`bind:${eventName}`]: 'outerBubble', [`capture-bind:${eventName}`]: 'outerCapture' },
  }
  const origin: DomNodeLike = { attribs: attributes }
  registerComponentEventNode(parent, scope)
  registerComponentEventNode(origin, scope, parent)
  if (host) {
    bindComponentEventHost(origin)
  }
  const componentScopes = new Map<string, RuntimeRenderScope>([
    ['component:source', { ...scope, hostNode: origin, listenerScopeId: scope.getScopeId() }],
  ])
  buildComponentTrigger('component:source', { componentScopes })(
    createComponentInstance({ definition: {} }),
    eventName,
    undefined,
    { bubbles: true, capturePhase: true },
  )
  return calls
}

describe('public mini-program event bindings', () => {
  it('returns bubble method and catch state directly from both package-root helpers', () => {
    const attributes = { 'catchtap': 'onTap', 'capture-bind:tap': 'onCapture', 'bindinput': 'onInput' }
    expect(resolveMiniProgramEventBinding(attributes, 'tap')).toEqual({ method: 'onTap', stopAfter: true })
    expect(collectMiniProgramEventBindings(attributes)).toEqual(new Map([
      ['tap', { method: 'onTap', stopAfter: true }],
      ['input', { method: 'onInput', stopAfter: false }],
    ]))
  })

  it('keeps missing results null and excludes capture-only and invalid bindings', () => {
    const attributes = { 'capture-catch:tap': 'capture', 'bind': 'emptyLegacy', 'catch:': 'emptyColon', 'id': 'node' }
    expect(collectMiniProgramEventBindings()).toEqual(new Map())
    expect(collectMiniProgramEventBindings(attributes)).toEqual(new Map())
    expect(resolveMiniProgramEventBinding(undefined, 'tap')).toBeNull()
    expect(resolveMiniProgramEventBinding(attributes, 'tap')).toBeNull()
    expect(resolveMiniProgramEventBinding({ bindtap: 'onTap' }, 'missing')).toBeNull()
    expect(resolveMiniProgramEventBinding({ catchtap: '' }, 'tap')).toEqual({ method: '', stopAfter: true })
  })
})

describe.each([false, true])('event syntax with cached host bindings: %s', (host) => {
  it('resolves legacy precedence independently for capture and bubble in either attribute order', () => {
    const attributes = [
      ['capture-bind:probe', 'captureColon'],
      ['capture-bindprobe', 'captureLegacy'],
      ['catchprobe', 'bubbleLegacy'],
      ['bind:probe', 'bubbleColon'],
    ]
    for (const entries of [attributes, [...attributes].reverse()]) {
      const input = Object.fromEntries(entries)
      const expected = { method: 'bubbleLegacy', stopAfter: true }
      expect(resolveMiniProgramEventBinding(input, 'probe')).toEqual(expected)
      expect(collectMiniProgramEventBindings(input).get('probe')).toEqual(expected)
      expect(dispatchBindings(input, 'probe', host)).toEqual(['outerCapture', 'captureLegacy', 'bubbleLegacy'])
    }
  })

  it('uses the last equal-priority binding without replacing the other phase', () => {
    const attributes = {
      'capture-catch:probe': 'captureFirst',
      'catch:probe': 'bubbleFirst',
      'capture-bind:probe': 'captureLast',
      'bind:probe': 'bubbleLast',
    }
    const expected = { method: 'bubbleLast', stopAfter: false }
    expect(resolveMiniProgramEventBinding(attributes, 'probe')).toEqual(expected)
    expect(collectMiniProgramEventBindings(attributes).get('probe')).toEqual(expected)
    expect(dispatchBindings(attributes, 'probe', host)).toEqual(['outerCapture', 'captureLast', 'bubbleLast', 'outerBubble'])
    expect(dispatchBindings(Object.fromEntries(Object.entries(attributes).reverse()), 'probe', host)).toEqual(['outerCapture', 'captureFirst'])
  })

  it('requires colon syntax for hyphenated names and keeps underscores compatible in both phases', () => {
    const attributes = {
      'capture-bind:probe-hyphen': 'captureHyphenColon',
      'capture-bindprobe-hyphen': 'captureHyphenLegacy',
      'bind:probe-hyphen': 'bubbleHyphenColon',
      'bindprobe-hyphen': 'bubbleHyphenLegacy',
      'capture-bind:probe_under': 'captureUnderscoreColon',
      'capture-bindprobe_under': 'captureUnderscoreLegacy',
      'bind:probe_under': 'bubbleUnderscoreColon',
      'bindprobe_under': 'bubbleUnderscoreLegacy',
    }
    const collected = collectMiniProgramEventBindings(attributes)
    for (const [eventName, capture, bubble] of [
      ['probe-hyphen', 'captureHyphenColon', 'bubbleHyphenColon'],
      ['probe_under', 'captureUnderscoreLegacy', 'bubbleUnderscoreLegacy'],
    ] as const) {
      const expected = { method: bubble, stopAfter: false }
      expect(resolveMiniProgramEventBinding(attributes, eventName)).toEqual(expected)
      expect(collected.get(eventName)).toEqual(expected)
      expect(dispatchBindings(attributes, eventName, host)).toEqual(['outerCapture', capture, bubble, 'outerBubble'])
    }
  })
})
