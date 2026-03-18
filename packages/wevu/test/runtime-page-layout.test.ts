import { describe, expect, it } from 'vitest'
import { reactive } from '@/reactivity'
import { setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'
import { setPageLayout, syncRuntimePageLayoutStateFromRuntime, usePageLayout } from '@/runtime/pageLayout'

describe('page layout runtime api', () => {
  it('usePageLayout reads current runtime state and tracks setPageLayout updates', () => {
    const runtimeState = reactive({
      __wv_page_layout_name: 'admin',
      __wv_page_layout_props: {
        sidebar: true,
      },
    })

    const instance = {
      __wevu: {
        state: runtimeState,
      },
    } as any

    instance.__wevuSetPageLayout = (layout: string | false, props?: Record<string, any>) => {
      runtimeState.__wv_page_layout_name = layout === false ? '__wv_no_layout' : layout
      runtimeState.__wv_page_layout_props = layout === false ? {} : (props ?? {})
      syncRuntimePageLayoutStateFromRuntime(instance)
    }

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance })

    const pageLayout = usePageLayout()
    expect(pageLayout.name).toBe('admin')
    expect(pageLayout.props).toEqual({
      sidebar: true,
    })

    setPageLayout('panel', {
      title: 'Dashboard',
      sidebar: false,
    })

    expect(pageLayout.name).toBe('panel')
    expect(pageLayout.props).toEqual({
      title: 'Dashboard',
      sidebar: false,
    })

    setPageLayout(false)
    expect(pageLayout.name).toBe(false)
    expect(pageLayout.props).toEqual({})

    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
  })
})
