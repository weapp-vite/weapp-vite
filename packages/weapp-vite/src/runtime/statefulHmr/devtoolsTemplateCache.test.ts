import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { devtoolsTemplateCacheSource } from './devtoolsTemplateCache'
import { statefulHmrRolldownRuntimeSource } from './runtimeSource'

describe('DevTools partial template compilation cache', () => {
  it('rehydrates a previously compiled page before rendering fresh defaults and HMR snapshots', () => {
    const cached: Record<string, unknown[]> = { nativePage: [], activePage: ['active binding'] }
    const active = cached.activePage
    const rendered: number[] = []
    const timers: Array<() => void> = []
    const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, {
      DevRuntime: class {},
      __WXML_GLOBAL__: { ops_cached: cached },
      setTimeout: (callback: () => void) => timers.push(callback),
    })
    const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
    globals.__rolldown_runtime__.currentModuleId = 'nativePage'
    bridge.installNative('Page', (definition: unknown) => definition)
    const page = bridge.Page({ data: { count: 0 } })
    bridge.beginUpdate()
    bridge.Page({ data: { count: 7 } })
    bridge.endUpdate()
    timers.splice(0).forEach(callback => callback())
    const host = {
      data: { count: 0 },
      setData(data: { count: number }) {
        // WCC 的惰性初始化会复用真值缓存；空占位数组会阻止旧编译函数恢复自身指令。
        const ops = cached.nativePage || (cached.nativePage = [['count']])
        const [key] = ops[0] as ['count']
        Object.assign(this.data, data)
        rendered.push(this.data[key])
      },
    }
    page.onLoad.call(host)
    expect(rendered).toEqual([7])
    expect(cached.activePage).toBe(active)

    cached.nativePage = []
    bridge.beginUpdate()
    bridge.endUpdate()
    expect(rendered).toEqual([7, 7])
    expect(cached.activePage).toBe(active)
  })

  it.each([undefined, {}, { ops_cached: null }])('supports hosts without the DevTools template cache (%j)', (wxml) => {
    expect(() => runInNewContext(`${devtoolsTemplateCacheSource}\ninvalidateDevtoolsTemplatePlaceholders()`, {
      ...(wxml === undefined ? {} : { __WXML_GLOBAL__: wxml }),
    })).not.toThrow()
  })
})
