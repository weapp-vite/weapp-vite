// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import { afterEach, expect, it, vi } from 'vitest'
import { createTemplate, initializePageRoutes, registerPage } from '../src/runtime'

afterEach(() => document.body.replaceChildren())

it('initializes legacy rpx once before the first real page render and resets DOM variables with inline styles', async () => {
  const route = 'pages/inline-style-init/index'
  registerPage({ data: { styles: 'width:10rpx' } }, {
    id: route,
    template: createTemplate('<view id="probe" style="{{styles}}"/>'),
  })
  initializePageRoutes([route], {
    rpx: { designWidth: 375, varName: '--legacy-unit' },
    runtime: { viewport: { mode: 'responsive' } },
  })
  await vi.waitFor(() => expect(document.querySelector('[data-weapp-page-active="true"]')).not.toBeNull())
  const host = document.querySelector('[data-weapp-page-active="true"]') as ComponentPublicInstance & { updateComplete: Promise<boolean> }
  await host.updateComplete
  const style = () => host.shadowRoot!.querySelector('#probe')!.getAttribute('style')
  const variable = (name: string) => Number.parseFloat(document.documentElement.style.getPropertyValue(name))
  expect(style()).toBe('width:calc(var(--legacy-unit) * 10)')
  expect(variable('--legacy-unit')).toBeCloseTo(window.innerWidth / 375)

  initializePageRoutes([route], {
    rpx: { designWidth: 375, varName: '--legacy-unit' },
    styleUnits: { useVariable: true, ratio: 1, rpxVar: '--selected-unit', designWidth: 320 },
    runtime: { viewport: { mode: 'responsive' } },
  })
  await host.setData({ styles: 'width:20rpx' })
  await host.updateComplete
  expect(style()).toBe('width:calc(var(--selected-unit) * 20)')
  expect(variable('--selected-unit')).toBeCloseTo(window.innerWidth / 320)

  initializePageRoutes([route], { runtime: { viewport: { mode: 'responsive' } } })
  await host.setData({ styles: 'width:30rpx' })
  await host.updateComplete
  expect(style()).toBe('width:calc(var(--rpx) * 30)')
  expect(variable('--rpx')).toBeCloseTo(window.innerWidth / 750)
})
