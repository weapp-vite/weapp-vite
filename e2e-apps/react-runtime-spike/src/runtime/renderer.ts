import type { ReactNode } from 'react'
import type { HostRenderMode } from './hostTree'
import type { HostProps, MiniProgramEventLike, MiniProgramPageAdapter } from './types'
import { createContext } from 'react'
import Reconciler from 'react-reconciler'
import { DefaultEventPriority, NoEventPriority } from 'react-reconciler/constants'
import { dispatchHostEvent } from './event'
import { HostElement, HostRoot, HostText } from './hostTree'

function propsChanged(previous: HostProps, next: HostProps) {
  const previousKeys = Object.keys(previous).filter(key => key !== 'children')
  const nextKeys = Object.keys(next).filter(key => key !== 'children')
  if (previousKeys.length !== nextKeys.length) {
    return true
  }
  return nextKeys.some(key => previous[key] !== next[key])
}

type HostContext = Record<string, never>
type HostNode = HostElement | HostText
type MiniProgramHostConfig = Reconciler.HostConfig<
  string,
  HostProps,
  HostRoot,
  HostElement,
  HostText,
  never,
  never,
  never,
  HostNode,
  HostContext,
  never,
  ReturnType<typeof setTimeout>,
  -1,
  null
>

interface React19HostConfigExtensions {
  getSuspendedCommitReason: () => null
  maySuspendCommitInSyncRender: () => false
  maySuspendCommitOnUpdate: () => false
}

let currentUpdatePriority = NoEventPriority
const hostContext: HostContext = {}

const hostConfig: MiniProgramHostConfig & React19HostConfigExtensions = {
  HostTransitionContext: createContext(null) as never,
  NotPendingTransition: null,
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
    _type: string,
    previous: HostProps,
    next: HostProps,
  ) {
    if (!propsChanged(previous, next)) {
      return
    }
    element.updateProps(next, element.root.shouldNotifyPropUpdate(previous, next))
  },
  createInstance(type: string, props: HostProps, root: HostRoot) {
    return new HostElement(root, root.createElementSid(props), type, props)
  },
  createTextInstance(text: string, root: HostRoot) {
    return new HostText(root, root.nextSid(), text)
  },
  detachDeletedInstance() {},
  finalizeInitialChildren() {
    return false
  },
  getChildHostContext(parentContext: HostContext) {
    return parentContext
  },
  getCurrentUpdatePriority() {
    return currentUpdatePriority
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
  getRootHostContext(): HostContext {
    return hostContext
  },
  getSuspendedCommitReason() {
    return null
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
  maySuspendCommit() {
    return false
  },
  maySuspendCommitInSyncRender() {
    return false
  },
  maySuspendCommitOnUpdate() {
    return false
  },
  noTimeout: -1,
  preloadInstance() {
    return true
  },
  prepareForCommit() {
    return null
  },
  preparePortalMount() {},
  prepareScopeUpdate() {},
  requestPostPaintCallback(callback: (time: number) => void) {
    setTimeout(() => callback(Date.now()), 0)
  },
  resetFormInstance() {},
  resolveEventTimeStamp() {
    return -1.1
  },
  resolveEventType() {
    return null
  },
  resolveUpdatePriority() {
    return currentUpdatePriority === NoEventPriority ? DefaultEventPriority : currentUpdatePriority
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
  setCurrentUpdatePriority(priority: number) {
    currentUpdatePriority = priority
  },
  shouldAttemptEagerTransition() {
    return false
  },
  shouldSetTextContent() {
    return false
  },
  supportsHydration: false,
  supportsMicrotasks: true,
  supportsMutation: true,
  supportsPersistence: false,
  suspendInstance() {},
  startSuspendingCommit() {},
  trackSchedulerEvent() {},
  unhideInstance(instance: HostElement, props: HostProps) {
    instance.updateProps(props)
  },
  unhideTextInstance(instance: HostText, text: string) {
    instance.setValue(text)
  },
  waitForCommitToBeReady() {
    return null
  },
  warnsIfNotActing: true,
}

const renderer = Reconciler(hostConfig)

export interface ReactMiniProgramRoot {
  dispatchEvent: (event: MiniProgramEventLike) => void
  flush: () => void
  getSnapshot: () => ReturnType<HostRoot['snapshot']>
  render: (element: ReactNode) => void
  unmount: () => void
}

export interface ReactMiniProgramRootOptions {
  renderMode?: HostRenderMode
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
    () => {},
    (error) => {
      throw error
    },
    () => {},
  )
}

export function createReactMiniProgramRoot(
  adapter: MiniProgramPageAdapter,
  options: ReactMiniProgramRootOptions = {},
): ReactMiniProgramRoot {
  const root = new HostRoot(adapter, options.renderMode)
  const container = createContainer(root)

  return {
    dispatchEvent(event) {
      renderer.flushSyncFromReconciler(() => dispatchHostEvent(root, event))
      root.assertStaticTemplateValid()
      root.flush()
    },
    flush() {
      renderer.flushSyncFromReconciler()
      root.flush()
    },
    getSnapshot() {
      return root.snapshot()
    },
    render(element) {
      renderer.updateContainerSync(element, container, null)
      renderer.flushSyncWork()
      root.assertStaticTemplateValid()
      root.flush()
    },
    unmount() {
      root.beginUnmount()
      renderer.updateContainerSync(null, container, null)
      renderer.flushSyncWork()
      root.flush()
    },
  }
}
