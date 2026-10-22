import { vi } from 'vitest'
import { createComponentCallerSession } from './runtime'

export function createCallerHarness() {
  const target = { nodeId: 97, pageId: 3 }
  const node = {}
  const caller: Record<string, any> = { mark: vi.fn((value: string) => `component:${value}`) }
  let currentNode = node
  let currentCaller = caller
  const listeners = new Set<(message: any, sender: unknown) => void>()
  const bridge = {
    subscribe: vi.fn(),
    addSubscribeListener: vi.fn((_name: string, callback: (message: any, sender: unknown) => void) => listeners.add(callback)),
    removeSubscribeListener: vi.fn((_name: string, callback: (message: any, sender: unknown) => void) => listeners.delete(callback)),
  }
  const exparser = { Element: { getMethodCaller: vi.fn(() => currentCaller) } }
  const virtualDOM = {
    getNodeById: vi.fn(() => currentNode),
    getNodeId: vi.fn(() => 'virtual-node'),
    getPageId: vi.fn(() => 3),
    getExparser: vi.fn(() => exparser),
  }
  const environment = { getAdapterPage: vi.fn((): object | undefined => undefined) }
  const root = { WeixinJSBridge: bridge, __glassEaselAdapter__: { getEnv: vi.fn(() => environment), getVirtualDOM: vi.fn(() => virtualDOM) } }
  function emit(message: any = { method: 'resolveComponentCaller', callbackId: 8, params: [{ nodeId: 'virtual-node', webviewId: 3 }] }, sender: unknown = 3) {
    for (const callback of listeners) {
      callback(message, sender)
    }
  }
  const create = () => createComponentCallerSession.call(root, target, 10_000)
  const session = create()
  return {
    target,
    node,
    caller,
    listeners,
    bridge,
    exparser,
    virtualDOM,
    root,
    environment,
    session,
    create,
    emit,
    replaceNode: () => { currentNode = {} },
    replaceCaller: () => { currentCaller = { mark: vi.fn() } },
  }
}
