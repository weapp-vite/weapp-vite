import type { InternalRuntimeState, RuntimeApp } from './types'
import { WEVU_IS_APP_INSTANCE_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it } from 'vitest'
import { setCurrentInstance } from './hooks'
import {
  inject,
  provide,
} from './provide'
import {
  attachRuntimeLayoutProvideContext,
  attachRuntimeProvideContext,
  setRuntimeAppProvidedValue,
} from './provideContext'

function createRuntimeApp() {
  return {} as RuntimeApp<Record<string, never>, Record<string, never>, Record<string, never>>
}

function createRuntimeState(parent: InternalRuntimeState | undefined, runtimeApp: RuntimeApp<any, any, any>) {
  const instance = {} as InternalRuntimeState
  attachRuntimeProvideContext(instance, runtimeApp, parent)
  return instance
}

function runWithInstance<T>(instance: InternalRuntimeState, fn: () => T): T {
  setCurrentInstance(instance)
  try {
    return fn()
  }
  finally {
    setCurrentInstance(undefined)
  }
}

describe('runtime provide/inject', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
  })

  it('resolves app, layout, page and component provides through deep parent chain', () => {
    const runtimeApp = createRuntimeApp()
    const symbolKey = Symbol('symbol-provide')

    setRuntimeAppProvidedValue(runtimeApp, 'app:instance', 'app-instance-value')

    const appInstance = {
      [WEVU_IS_APP_INSTANCE_KEY]: true,
    } as InternalRuntimeState
    attachRuntimeProvideContext(appInstance, runtimeApp)
    runWithInstance(appInstance, () => {
      provide('app:setup', 'app-setup-value')
    })

    const layout = createRuntimeState(undefined, runtimeApp)
    runWithInstance(layout, () => {
      provide('layout', 'layout-value')
    })

    const page = createRuntimeState(layout, runtimeApp)
    runWithInstance(page, () => {
      provide('page', 'page-value')
      provide('shadow', 'page-shadow')
      provide(symbolKey, 'symbol-value')
    })

    let parent = page
    for (let index = 1; index <= 10; index += 1) {
      const child = createRuntimeState(parent, runtimeApp)
      if (index === 1) {
        runWithInstance(child, () => {
          provide('component', 'component-value')
          provide('shadow', 'component-shadow')
        })
      }
      parent = child
    }

    runWithInstance(parent, () => {
      expect(inject('app:instance')).toBe('app-instance-value')
      expect(inject('app:setup')).toBe('app-setup-value')
      expect(inject('layout')).toBe('layout-value')
      expect(inject('page')).toBe('page-value')
      expect(inject('component')).toBe('component-value')
      expect(inject('shadow')).toBe('component-shadow')
      expect(inject(symbolKey)).toBe('symbol-value')
      expect(inject('missing', 'fallback')).toBe('fallback')
    })
  })

  it('inserts layout provides above an already-mounted page scope', () => {
    const runtimeApp = createRuntimeApp()
    setRuntimeAppProvidedValue(runtimeApp, 'app', 'app-value')

    const page = createRuntimeState(undefined, runtimeApp)
    runWithInstance(page, () => {
      provide('page', 'page-value')
    })

    const layout = createRuntimeState(undefined, runtimeApp)
    attachRuntimeLayoutProvideContext(layout, page)
    runWithInstance(layout, () => {
      provide('layout', 'layout-value')
    })

    const child = createRuntimeState(page, runtimeApp)
    runWithInstance(child, () => {
      expect(inject('app')).toBe('app-value')
      expect(inject('layout')).toBe('layout-value')
      expect(inject('page')).toBe('page-value')
    })
  })
})
