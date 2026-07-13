import type { ReactNode } from 'react'
import type { HostProps, MiniProgramEventLike, MiniProgramPageAdapter } from './types'
import Reconciler from 'react-reconciler'
import { DefaultEventPriority } from 'react-reconciler/constants'
import { dispatchHostEvent } from './event'
import { hasSerializedPropChanges, HostElement, HostRoot, HostText } from './hostTree'

function propsChanged(previous: HostProps, next: HostProps) {
  const previousKeys = Object.keys(previous).filter(key => key !== 'children')
  const nextKeys = Object.keys(next).filter(key => key !== 'children')
  if (previousKeys.length !== nextKeys.length) {
    return true
  }
  return nextKeys.some(key => previous[key] !== next[key])
}

interface HostUpdatePayload {
  setData: boolean
}

const hostConfig = {
  afterActiveInstanceBlur() {},
  appendChild(parent: HostElement, child: HostElement | HostText) {
    parent.append(child)
  },
  appendChildToContainer(parent: HostRoot, child: HostElement | HostText) {
    parent.append(child)
  },
  appendInitialChild(parent: HostElement, child: HostElement | HostText) {
    parent.append(child, false)
  },
  beforeActiveInstanceBlur() {},
  cancelTimeout: clearTimeout,
  clearContainer(container: HostRoot) {
    container.clear()
  },
  commitMount() {},
  commitTextUpdate(text: HostText, _previous: string, next: string) {
    text.setValue(next)
  },
  commitUpdate(
    element: HostElement,
    updatePayload: HostUpdatePayload,
    _type: string,
    _previous: HostProps,
    next: HostProps,
  ) {
    element.updateProps(next, updatePayload.setData)
  },
  createInstance(type: string, props: HostProps, root: HostRoot) {
    return new HostElement(root, root.nextSid(), type, props)
  },
  createTextInstance(text: string, root: HostRoot) {
    return new HostText(root, root.nextSid(), text)
  },
  detachDeletedInstance() {},
  finalizeInitialChildren() {
    return false
  },
  getChildHostContext(parentContext: Record<string, never>) {
    return parentContext
  },
  getCurrentEventPriority() {
    return DefaultEventPriority
  },
  getInstanceFromNode() {
    return null
  },
  getInstanceFromScope() {
    return null
  },
  getPublicInstance(instance: HostElement | HostText) {
    return instance
  },
  getRootHostContext() {
    return {}
  },
  hideInstance(instance: HostElement) {
    instance.updateProps({
      ...instance.props,
      hidden: true,
    })
  },
  hideTextInstance(instance: HostText) {
    instance.setValue('')
  },
  insertBefore(parent: HostElement, child: HostElement | HostText, before: HostElement | HostText) {
    parent.insertBefore(child, before)
  },
  insertInContainerBefore(parent: HostRoot, child: HostElement | HostText, before: HostElement | HostText) {
    parent.insertBefore(child, before)
  },
  isPrimaryRenderer: true,
  noTimeout: -1,
  prepareForCommit() {
    return null
  },
  preparePortalMount() {},
  prepareScopeUpdate() {},
  prepareUpdate(
    _instance: HostElement,
    _type: string,
    previous: HostProps,
    next: HostProps,
  ) {
    if (!propsChanged(previous, next)) {
      return null
    }
    return {
      setData: hasSerializedPropChanges(previous, next),
    }
  },
  removeChild(parent: HostElement, child: HostElement | HostText) {
    parent.remove(child)
  },
  removeChildFromContainer(parent: HostRoot, child: HostElement | HostText) {
    parent.remove(child)
  },
  resetAfterCommit(container: HostRoot) {
    container.flush()
  },
  resetTextContent() {},
  scheduleMicrotask(callback: () => void) {
    Promise.resolve().then(callback)
  },
  scheduleTimeout: setTimeout,
  shouldSetTextContent() {
    return false
  },
  supportsHydration: false,
  supportsMicrotasks: true,
  supportsMutation: true,
  supportsPersistence: false,
  unhideInstance(instance: HostElement, props: HostProps) {
    instance.updateProps(props)
  },
  unhideTextInstance(instance: HostText, text: string) {
    instance.setValue(text)
  },
  warnsIfNotActing: true,
}

const renderer = Reconciler(hostConfig as never)

export interface ReactMiniProgramRoot {
  dispatchEvent: (event: MiniProgramEventLike) => void
  flush: () => void
  getSnapshot: () => ReturnType<HostRoot['snapshot']>
  render: (element: ReactNode) => void
  unmount: () => void
}

function createContainer(root: HostRoot) {
  return renderer.createContainer(
    root,
    0,
    null,
    false,
    false,
    '',
    (error) => {
      throw error
    },
    null,
  )
}

export function createReactMiniProgramRoot(adapter: MiniProgramPageAdapter): ReactMiniProgramRoot {
  const root = new HostRoot(adapter)
  const container = createContainer(root)

  return {
    dispatchEvent(event) {
      dispatchHostEvent(root, event)
    },
    flush() {
      root.flush()
    },
    getSnapshot() {
      return root.snapshot()
    },
    render(element) {
      renderer.updateContainer(element, container, null)
      root.flush()
    },
    unmount() {
      renderer.updateContainer(null, container, null)
      root.flush()
    },
  }
}
