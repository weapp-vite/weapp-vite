import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installWebModuleRegistration,
  registerWebWevuApp,
  registerWebWevuComponent,
} from '../src/runtime/wevu'

const createAppMock = vi.hoisted(() => vi.fn((options: Record<string, any>) => {
  return (globalThis as any).App(options)
}))
const createWevuComponentMock = vi.hoisted(() => vi.fn((options: Record<string, any>) => {
  return (globalThis as any).Component(options)
}))
const takePendingRuntimeAppRegistrationMock = vi.hoisted(() => vi.fn())
const registerAppMock = vi.hoisted(() => vi.fn())
const registerComponentMock = vi.hoisted(() => vi.fn())
const registerPageMock = vi.hoisted(() => vi.fn())

vi.mock('wevu/internal-runtime', () => ({
  createApp: createAppMock,
  createWevuComponent: createWevuComponentMock,
  takePendingRuntimeAppRegistration: takePendingRuntimeAppRegistrationMock,
}))

vi.mock('../src/runtime/polyfill/routeRuntime', () => ({
  registerApp: registerAppMock,
  registerComponent: registerComponentMock,
  registerPage: registerPageMock,
}))

describe('wevu web registration bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    takePendingRuntimeAppRegistrationMock.mockReturnValue(undefined)
  })

  afterEach(() => {
    delete (globalThis as any).App
    delete (globalThis as any).Component
    delete (globalThis as any).Page
  })

  it('registers direct and pending Wevu apps while restoring host constructors', () => {
    const previousApp = vi.fn()
    ;(globalThis as any).App = previousApp
    const meta = { kind: 'app', id: 'app' } as any
    const options = { onLaunch: vi.fn() }

    registerWebWevuApp(options, meta)
    expect(createAppMock).toHaveBeenCalledWith(options)
    expect(registerAppMock).toHaveBeenCalledWith(options, meta)
    expect((globalThis as any).App).toBe(previousApp)

    const pending = {
      app: { onShow: vi.fn() },
      register: vi.fn(() => (globalThis as any).App({ pending: true })),
    }
    takePendingRuntimeAppRegistrationMock.mockReturnValueOnce(pending)
    registerWebWevuApp({}, meta)
    expect(pending.register).toHaveBeenCalledTimes(1)
    expect(createAppMock).toHaveBeenCalledTimes(1)
    expect(registerAppMock).toHaveBeenCalledWith({ pending: true }, meta)
    expect((globalThis as any).App).toBe(previousApp)
  })

  it('routes Wevu pages and components through their matching registries', () => {
    registerWebWevuComponent({ data: { page: true } }, { kind: 'page', id: 'pages/home' } as any)
    expect(registerPageMock).toHaveBeenCalledWith(
      { data: { page: true } },
      { kind: 'page', id: 'pages/home' },
    )

    registerWebWevuComponent({ data: { component: true } }, { kind: 'component', id: 'card' } as any)
    expect(registerComponentMock).toHaveBeenCalledWith(
      { data: { component: true } },
      { kind: 'component', id: 'card' },
    )
    expect((globalThis as any).Component).toBeUndefined()
  })

  it('installs app, page and component constructors and restores owned values', () => {
    const target: Record<string, any> = {
      App: 'previous-app',
      Component: 'previous-component',
    }

    const restoreApp = installWebModuleRegistration({ kind: 'app', id: 'app' } as any, target)
    const appDefinition = { onLaunch: vi.fn() }
    expect(target.App(appDefinition)).toBe(appDefinition)
    expect(registerAppMock).toHaveBeenCalledWith(appDefinition, { kind: 'app', id: 'app' })
    restoreApp()
    expect(target.App).toBe('previous-app')

    const restorePage = installWebModuleRegistration({ kind: 'page', id: 'pages/home' } as any, target)
    expect(target.Page({ page: true })).toEqual({ page: true })
    expect(target.Component({ componentPage: true })).toEqual({ componentPage: true })
    expect(registerPageMock).toHaveBeenCalledTimes(2)
    restorePage()
    expect(target.Page).toBeUndefined()
    expect(target.Component).toBe('previous-component')

    const restoreComponent = installWebModuleRegistration({ kind: 'component', id: 'card' } as any, target)
    expect(target.Component({ component: true })).toEqual({ component: true })
    expect(registerComponentMock).toHaveBeenCalledWith(
      { component: true },
      { kind: 'component', id: 'card' },
    )
    restoreComponent()
    expect(target.Component).toBe('previous-component')
  })

  it('does not overwrite a constructor replaced after installation', () => {
    const target: Record<string, any> = {}
    const restore = installWebModuleRegistration({ kind: 'component', id: 'card' } as any, target)
    const replacement = vi.fn()
    target.Component = replacement

    restore()

    expect(target.Component).toBe(replacement)
  })
})
