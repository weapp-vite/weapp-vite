import type { HeadlessWxVideoContext } from '../host'
import { resolveSelectorQueryScopeRoot } from './selectorQuery'
import { querySelectorAll } from './selectors'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
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

const DATASET_NAME_RE = /-([a-z])/g

function toDatasetKey(attributeName: string) {
  return attributeName
    .slice('data-'.length)
    .replace(DATASET_NAME_RE, (_match, char: string) => char.toUpperCase())
}

function collectDataset(node: DomNodeLike) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.attribs ?? {})) {
    if (!key.startsWith('data-') || key.startsWith('data-sim-')) {
      continue
    }
    dataset[toDatasetKey(key)] = value
  }
  return dataset
}

function resolveEventBinding(node: DomNodeLike, eventName: string) {
  const normalizedEventName = eventName.trim()
  if (!normalizedEventName) {
    return null
  }

  const bindingAttrs = [
    `bind${normalizedEventName}`,
    `bind:${normalizedEventName}`,
    `catch${normalizedEventName}`,
    `catch:${normalizedEventName}`,
  ]
  for (const attributeName of bindingAttrs) {
    const methodName = node.attribs?.[attributeName]?.trim()
    if (methodName) {
      return methodName
    }
  }
  return null
}

function createEventPayload(node: DomNodeLike, eventName: string, detail: Record<string, unknown>) {
  const dataset = collectDataset(node)
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
    const methodName = resolveEventBinding(node, eventName)
    if (!methodName) {
      return
    }
    driver.callScopeMethod(node.attribs?.['data-sim-scope'] ?? null, methodName, createEventPayload(node, eventName, detail))
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
