import { resolveSelectorTargets } from './selectorQuery'

export interface IntersectionMargins {
  left?: number
  right?: number
  top?: number
  bottom?: number
}

export interface MiniProgramIntersectionObserverOptions {
  initialRatio?: number
  observeAll?: boolean
  thresholds?: number[]
}

type MiniProgramIntersectionCallback = (result: Record<string, any>) => void

export interface MiniProgramIntersectionObserver {
  relativeTo: (selector: string, margins?: IntersectionMargins) => MiniProgramIntersectionObserver
  relativeToViewport: (margins?: IntersectionMargins) => MiniProgramIntersectionObserver
  observe: (selector: string, callback: MiniProgramIntersectionCallback) => MiniProgramIntersectionObserver
  disconnect: () => void
}

function isObservableElement(value: unknown): value is Element {
  return Boolean(value && typeof value === 'object' && typeof (value as Element).getBoundingClientRect === 'function')
}

function normalizeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeMargins(margins: IntersectionMargins = {}) {
  return {
    left: normalizeNumber(margins.left),
    right: normalizeNumber(margins.right),
    top: normalizeNumber(margins.top),
    bottom: normalizeNumber(margins.bottom),
  }
}

function toRootMargin(margins: IntersectionMargins) {
  const normalized = normalizeMargins(margins)
  return `${normalized.top}px ${normalized.right}px ${normalized.bottom}px ${normalized.left}px`
}

function toRect(value: DOMRectReadOnly | null) {
  if (!value) {
    return null
  }
  return {
    left: value.left,
    right: value.right,
    top: value.top,
    bottom: value.bottom,
    width: value.width,
    height: value.height,
  }
}

function mapIntersectionEntry(entry: IntersectionObserverEntry) {
  const target = entry.target as HTMLElement & { getAttribute?: (name: string) => string | null }
  return {
    id: target.id ?? target.getAttribute?.('id') ?? '',
    dataset: { ...(target.dataset ?? {}) },
    intersectionRatio: entry.intersectionRatio,
    intersectionRect: toRect(entry.intersectionRect),
    boundingClientRect: toRect(entry.boundingClientRect),
    relativeRect: toRect(entry.rootBounds),
    time: entry.time,
  }
}

export function createIntersectionObserverBridge(
  scope?: unknown,
  options: MiniProgramIntersectionObserverOptions = {},
): MiniProgramIntersectionObserver {
  let relativeSelector: string | undefined
  let relativeMargins: IntersectionMargins = {}
  let viewportRelative = true
  const observers = new Set<IntersectionObserver>()

  const api = {
    relativeTo(selector: string, margins: IntersectionMargins = {}) {
      relativeSelector = selector
      relativeMargins = margins
      viewportRelative = false
      return api
    },
    relativeToViewport(margins: IntersectionMargins = {}) {
      relativeSelector = undefined
      relativeMargins = margins
      viewportRelative = true
      return api
    },
    observe(selector: string, callback: MiniProgramIntersectionCallback) {
      const targets = resolveSelectorTargets(scope, selector, Boolean(options.observeAll))
        .filter(isObservableElement)
      const relativeTarget = viewportRelative || !relativeSelector
        ? null
        : resolveSelectorTargets(scope, relativeSelector, false)[0]
      const root = isObservableElement(relativeTarget) ? relativeTarget : null
      const thresholds = Array.isArray(options.thresholds) && options.thresholds.length > 0
        ? options.thresholds.map(value => normalizeNumber(value)).filter(value => value >= 0 && value <= 1)
        : [normalizeNumber(options.initialRatio)]

      if (typeof IntersectionObserver !== 'function') {
        queueMicrotask(() => {
          for (const target of targets) {
            const rect = target.getBoundingClientRect()
            callback({
              id: (target as HTMLElement).id,
              dataset: { ...((target as HTMLElement).dataset ?? {}) },
              intersectionRatio: 1,
              intersectionRect: toRect(rect),
              boundingClientRect: toRect(rect),
              relativeRect: null,
              time: Date.now(),
            })
          }
        })
        return api
      }

      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          callback(mapIntersectionEntry(entry))
        }
      }, {
        root,
        rootMargin: toRootMargin(relativeMargins),
        threshold: thresholds.length > 0 ? thresholds : [0],
      })
      observers.add(observer)
      for (const target of targets) {
        observer.observe(target)
      }
      return api
    },
    disconnect() {
      for (const observer of observers) {
        observer.disconnect()
      }
      observers.clear()
    },
  }

  return api
}
