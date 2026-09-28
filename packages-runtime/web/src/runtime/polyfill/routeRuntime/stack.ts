import type { AppRouteEvent, AppRouteOpenType } from './events'
import type { PageRecord, PageStackEntry } from './options'
import {
  mountEntryToDom,
  setEntryActiveInDom,
  unmountEntryFromDom,
} from './dom'
import { beginAppRoute, cancelEntryRoute, emitBeforePageUnload, finishAppRoute } from './events'
import { hidePageInstance, showPageInstance } from './lifecycle'
import { captureEntryScrollPosition, restoreEntryScrollPosition } from './scroll'

export class PageStackRuntime {
  readonly entries: PageStackEntry[] = []
  readonly #tabEntries = new Map<string, PageStackEntry>()
  #tabPageIds = new Set<string>()

  constructor(
    private readonly pageRegistry: Map<string, PageRecord>,
    private readonly onBeforeMount: (entry: PageStackEntry) => void,
  ) {}

  configureTabPages(ids: Iterable<string>) {
    this.#tabPageIds = new Set(ids)
    for (const [id, entry] of this.#tabEntries) {
      if (this.#tabPageIds.has(id)) {
        continue
      }
      this.#tabEntries.delete(id)
      this.#destroy(entry)
    }
  }

  push(id: string, query: Record<string, string>, openType: AppRouteOpenType = 'navigateTo') {
    if (!this.pageRegistry.has(id)) {
      return false
    }
    const entry: PageStackEntry = { id, query, active: true }
    const event = beginAppRoute(entry, openType)
    this.#hide(this.entries[this.entries.length - 1])
    this.entries.push(entry)
    this.#mount(entry)
    finishAppRoute(entry, event)
    return true
  }

  /** 浏览器一次前进可恢复多个栈层，但只对应一个可观察路由操作。 */
  forward(targets: ReadonlyArray<Pick<PageStackEntry, 'id' | 'query'>>) {
    if (!targets.length || targets.some(target => !this.pageRegistry.has(target.id))) {
      return false
    }
    const restored = targets.map(target => ({ id: target.id, query: { ...target.query }, active: true }))
    const last = restored[restored.length - 1]!
    const event = beginAppRoute(last, 'navigateTo')
    for (const entry of restored) {
      this.#hide(this.entries[this.entries.length - 1])
      this.entries.push(entry)
      this.#mount(entry)
    }
    finishAppRoute(last, event)
    return true
  }

  replace(id: string, query: Record<string, string>) {
    if (!this.pageRegistry.has(id)) {
      return false
    }
    const entry: PageStackEntry = { id, query, active: true }
    const event = beginAppRoute(entry, 'redirectTo')
    if (this.entries.length) {
      const current = this.entries[this.entries.length - 1]!
      this.entries[this.entries.length - 1] = entry
      this.#destroy(current, event)
    }
    else {
      this.entries.push(entry)
    }
    this.#mount(entry)
    finishAppRoute(entry, event)
    return true
  }

  relaunch(id: string, query: Record<string, string>) {
    if (!this.pageRegistry.has(id)) {
      return false
    }
    const target: PageStackEntry = { id, query, active: true }
    const event = beginAppRoute(target, 'reLaunch')
    const previousEntries = this.entries.splice(0)
    for (const entry of previousEntries.reverse()) {
      this.#destroy(entry, event)
    }
    for (const entry of this.#tabEntries.values()) {
      this.#destroy(entry, event)
    }
    this.#tabEntries.clear()
    this.entries.push(target)
    this.#mount(target)
    finishAppRoute(target, event)
    return true
  }

  switchTab(id: string, query: Record<string, string>) {
    if (!this.#tabPageIds.has(id) || !this.pageRegistry.has(id)) {
      return false
    }

    const retained = this.entries.find(entry => entry.id === id) ?? this.#tabEntries.get(id)
    if (retained?.active && this.entries.length === 1 && this.entries[0] === retained) {
      return true
    }
    const target = retained ?? { id, query, active: true }
    target.query = query
    const event = beginAppRoute(target, 'switchTab')
    const previousEntries = this.entries.splice(0)
    for (const entry of previousEntries.reverse()) {
      if (entry === target) {
        continue
      }
      if (this.#tabPageIds.has(entry.id)) {
        this.#hide(entry)
        this.#tabEntries.set(entry.id, entry)
      }
      else {
        this.#destroy(entry, event)
      }
    }

    if (retained) {
      this.#tabEntries.delete(id)
      this.entries.push(target)
      this.#show(target)
      finishAppRoute(target, event)
      return true
    }

    this.entries.push(target)
    this.#mount(target)
    finishAppRoute(target, event)
    return true
  }

  back(delta = 1) {
    if (this.entries.length <= 1) {
      return false
    }
    const normalizedDelta = Math.max(1, delta)
    const targetIndex = Math.max(0, this.entries.length - 1 - normalizedDelta)
    const target = this.entries[targetIndex]!
    const event = beginAppRoute(target, 'navigateBack')
    const removed = this.entries.splice(targetIndex + 1)
    for (const entry of removed.reverse()) {
      this.#destroy(entry, event)
    }
    this.#show(target)
    finishAppRoute(target, event)
    return true
  }

  #mount(entry: PageStackEntry) {
    mountEntryToDom(entry, this.pageRegistry, this.onBeforeMount)
  }

  #record(entry: PageStackEntry) {
    return this.pageRegistry.get(entry.id)
  }

  #hide(entry: PageStackEntry | undefined) {
    if (!entry) {
      return
    }
    cancelEntryRoute(entry)
    captureEntryScrollPosition(entry)
    setEntryActiveInDom(entry, false)
    const record = this.#record(entry)
    if (entry.instance && record) {
      hidePageInstance(entry.instance, record)
    }
  }

  #show(entry: PageStackEntry) {
    setEntryActiveInDom(entry, true)
    restoreEntryScrollPosition(entry, true)
    const record = this.#record(entry)
    if (entry.instance && record) {
      showPageInstance(entry.instance, record)
    }
  }

  #destroy(entry: PageStackEntry, event?: AppRouteEvent) {
    if (event) {
      emitBeforePageUnload(entry, event)
    }
    unmountEntryFromDom(entry)
    entry.active = false
  }
}
