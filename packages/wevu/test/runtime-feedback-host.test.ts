import { describe, expect, it } from 'vitest'
import { resolvePageFeedbackHost, usePageFeedbackHost } from '@/runtime/feedbackHost'
import { setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'
import { callHookList } from '@/runtime/hooks/base'

describe('page feedback host runtime api', () => {
  it('registers and unregisters feedback hosts with component lifetimes', () => {
    const page = {
      route: 'pages/index/index',
      __wevuSetPageLayout: () => {},
    }
    const layoutInstance = {
      is: 'layouts/default',
    } as any

    ;(globalThis as any).getCurrentPages = () => [page]

    setCurrentInstance(layoutInstance)
    setCurrentSetupContext({ instance: layoutInstance })

    usePageFeedbackHost(['#t-toast', '#t-dialog'])

    expect(resolvePageFeedbackHost('#t-toast', page)).toBe(page)

    callHookList(layoutInstance, 'onAttached')
    expect(resolvePageFeedbackHost('#t-toast', page)).toBe(layoutInstance)
    expect(resolvePageFeedbackHost('#t-dialog', page)).toBe(layoutInstance)

    callHookList(layoutInstance, 'onDetached')
    expect(resolvePageFeedbackHost('#t-toast', page)).toBe(page)
    expect(resolvePageFeedbackHost('#t-dialog', page)).toBe(page)

    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
    delete (globalThis as any).getCurrentPages
  })
})
