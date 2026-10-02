// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component/types'
import { html } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from '../src/runtime/component'
import { bindRuntimeEvent } from '../src/runtime/eventBinding'
import { registerApp, registerPage } from '../src/runtime/polyfill/routeRuntime'
import { createTemplate } from '../src/runtime/template'
import { registerWebWevuComponent } from '../src/runtime/wevu'
import { slugify } from '../src/shared/slugify'

type Host = ComponentPublicInstance & { updateComplete: Promise<boolean> }

afterEach(() => {
  document.body.replaceChildren()
  registerApp(undefined, { id: 'app', style: '' })
  vi.unstubAllGlobals()
})

describe('Web app, custom event and setup property boundaries', () => {
  it('propagates and replaces app styles in mounted page shadow roots', async () => {
    registerApp({}, { id: 'app', style: '.global-probe { color: red; }' })
    registerPage({}, { id: 'issues-1126-page', template: () => html`<div class="global-probe">page</div>` })
    const page = document.createElement(slugify('issues-1126-page', 'wv-page')) as Host
    document.body.append(page)
    await page.updateComplete
    expect(page.shadowRoot!.textContent).toContain('.global-probe { color: red; }')
    registerApp({}, { id: 'app', style: '.global-probe { color: blue; }' })
    await page.updateComplete
    expect(page.shadowRoot!.textContent).toContain('.global-probe { color: blue; }')
    expect(page.shadowRoot!.textContent).not.toContain('color: red')
    page.remove()
    const requestUpdate = vi.spyOn(page as Host & { requestUpdate: () => void }, 'requestUpdate')
    registerApp({}, { id: 'app', style: '.global-probe { color: green; }' })
    expect(requestUpdate).not.toHaveBeenCalled()
    document.body.append(page)
    await page.updateComplete
    expect(page.shadowRoot!.textContent).toContain('color: green')
  })

  it.each(['compiled', 'legacy'])('separates a component click emission from the same physical click bubbling out (%s)', async (mode) => {
    const handler = vi.fn()
    const childTag = `wv-issue-1127-child-${mode}`
    const parentTag = `wv-issue-1127-parent-${mode}`
    defineComponent(childTag, {
      template: () => html`<button>click</button>`,
      component: {},
    })
    const { html: staticHtml, unsafeStatic } = await import('lit/static-html.js')
    const tag = unsafeStatic(childTag)
    defineComponent(parentTag, {
      template: mode === 'legacy'
        ? createTemplate(`<${childTag} bind:click="clicked" />`)
        : (scope, ctx) => staticHtml`<${tag} ${bindRuntimeEvent('click', ctx.event('click', 'clicked', scope))}></${tag}>`,
      component: { methods: { clicked: handler } },
    })
    const parent = document.createElement(parentTag) as Host
    document.body.append(parent)
    await parent.updateComplete
    const child = parent.shadowRoot!.querySelector(childTag) as Host
    await child.updateComplete
    const button = child.shadowRoot!.querySelector('button')!
    button.addEventListener('click', () => child.triggerEvent('click', { value: 1 }))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(handler).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ detail: { value: 1 } }))
  })

  it('does not write a setup method through a Boolean property accessor', async () => {
    const back = vi.fn()
    const refresh = vi.fn()
    registerWebWevuComponent({
      props: { back: { type: Boolean, default: false } },
      setup: () => ({ back, refresh }),
    }, {
      kind: 'component',
      id: 'issue-1128-props',
      template: (scope, ctx) => html`<button ${bindRuntimeEvent('click', ctx.event('tap', 'back', scope))}>back</button>`,
    })
    const element = document.createElement(slugify('issue-1128-props', 'wv-component')) as Host
    document.body.append(element)
    await element.updateComplete
    expect(element.properties.back).toBe(false)
    const methods = element as Host & { refresh: () => void, __weappSync: (methods: object) => void }
    methods.refresh()
    expect(refresh).toHaveBeenCalledOnce()
    methods.__weappSync({})
    methods.refresh()
    expect(refresh).toHaveBeenCalledTimes(2)
    element.shadowRoot!.querySelector('button')!.click()
    expect(back).toHaveBeenCalledOnce()
    element.setAttribute('back', 'true')
    await element.updateComplete
    expect(element.properties.back).toBe(true)
    element.setAttribute('back', 'false')
    await element.updateComplete
    expect(element.properties.back).toBe(false)
    element.shadowRoot!.querySelector('button')!.click()
    expect(back).toHaveBeenCalledTimes(2)
  })
})
