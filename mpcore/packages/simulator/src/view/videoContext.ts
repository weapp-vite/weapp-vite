import type { HeadlessWxVideoContext } from '../host'
import { resolveMiniProgramEventBinding } from './eventBinding'
import { collectNodeDataset } from './nodeDataset'
import { resolveSelectorQueryScopeRoot } from './selectorQuery'
import { querySelectorAll } from './selectors'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  dataset?: Record<string, unknown>
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

interface HeadlessVideoContextState {
  currentTime: number
  fullScreen: boolean
  paused: boolean
}

export interface HeadlessVideoContextScopeResolution {
  kind: 'component' | 'missing' | 'page'
  scopeId?: string
}

export interface HeadlessVideoContextDriver {
  callScopeMethod: (scopeId: string | null, methodName: string, event: Record<string, any>) => unknown
  renderCurrentPage: () => { root: DomNodeLike }
  resolveScope: (scope?: Record<string, any>) => HeadlessVideoContextScopeResolution
}

function createEventPayload(node: DomNodeLike, eventName: string, detail: Record<string, unknown>) {
  const dataset = collectNodeDataset(node)
  const nodeId = node.attribs?.id ?? ''
  return {
    bubbles: false,
    capturePhase: false,
    composed: false,
    currentTarget: {
      dataset,
      id: nodeId,
    },
    detail,
    mark: undefined,
    target: {
      dataset,
      id: nodeId,
    },
    type: eventName,
  }
}

export function createHeadlessVideoContext(
  driver: HeadlessVideoContextDriver,
  videoId: string,
  scope?: Record<string, any>,
): HeadlessWxVideoContext {
  const state: HeadlessVideoContextState = {
    currentTime: 0,
    fullScreen: false,
    paused: true,
  }

  const resolveNode = () => {
    const scopeResolution = driver.resolveScope(scope)
    if (scopeResolution.kind === 'missing') {
      return null
    }
    const rendered = driver.renderCurrentPage()
    const scopedRoot = scopeResolution.kind === 'component'
      ? resolveSelectorQueryScopeRoot(rendered.root, scopeResolution.scopeId)
      : rendered.root
    return querySelectorAll(scopedRoot, `#${videoId}`)[0] ?? null
  }

  const dispatch = (eventName: string, detail: Record<string, unknown>) => {
    const node = resolveNode()
    if (!node) {
      return
    }
    const binding = resolveMiniProgramEventBinding(node.attribs, eventName)
    if (!binding?.method) {
      return
    }
    driver.callScopeMethod(node.attribs?.['data-sim-scope'] ?? null, binding.method, createEventPayload(node, eventName, detail))
  }

  return {
    exitFullScreen() {
      state.fullScreen = false
      dispatch('fullscreenchange', {
        currentTime: state.currentTime,
        fullScreen: false,
      })
    },
    pause() {
      state.paused = true
      dispatch('pause', {
        currentTime: state.currentTime,
      })
    },
    play() {
      state.paused = false
      dispatch('play', {
        currentTime: state.currentTime,
      })
    },
    requestFullScreen() {
      state.fullScreen = true
      dispatch('fullscreenchange', {
        currentTime: state.currentTime,
        fullScreen: true,
      })
    },
    seek(position: number) {
      state.currentTime = Number.isFinite(position) ? Number(position) : 0
    },
    stop() {
      state.currentTime = 0
      state.paused = true
      dispatch('pause', {
        currentTime: state.currentTime,
      })
    },
  }
}
