import type { PageRecord, PageStackEntry } from './options'
import {
  mountEntryToDom,
  setEntryActiveInDom,
  unmountEntryFromDom,
} from './dom'
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

  push(id: string, query: Record<string, string>) {
    if (!this.pageRegistry.has(id)) {
      return false
    }
    this.#hide(this.entries[this.entries.length - 1])
    const entry: PageStackEntry = { id, query, active: true }
    this.entries.push(entry)
    this.#mount(entry)
    return true
  }

  replace(id: string, query: Record<string, string>) {
    if (!this.pageRegistry.has(id)) {
      return false
    }
    const entry: PageStackEntry = { id, query, active: true }
    if (this.entries.length) {
      const current = this.entries[this.entries.length - 1]!
      this.entries[this.entries.length - 1] = entry
      this.#destroy(current)
    }
    else {
      this.entries.push(entry)
    }
    this.#mount(entry)
    return true
  }

  relaunch(id: string, query: Record<string, string>) {
    if (!this.pageRegistry.has(id)) {
      return false
    }
    const previousEntries = this.entries.splice(0)
    for (const entry of previousEntries.reverse()) {
      this.#destroy(entry)
    }
    for (const entry of this.#tabEntries.values()) {
      this.#destroy(entry)
    }
    this.#tabEntries.clear()
    return this.push(id, query)
  }

  switchTab(id: string, query: Record<string, string>) {
    if (!this.#tabPageIds.has(id) || !this.pageRegistry.has(id)) {
      return false
    }

    const previousEntries = this.entries.splice(0)
    let target = previousEntries.find(entry => entry.id === id) ?? this.#tabEntries.get(id)
    for (const entry of previousEntries.reverse()) {
      if (entry === target) {
        continue
      }
      if (this.#tabPageIds.has(entry.id)) {
        this.#hide(entry)
        this.#tabEntries.set(entry.id, entry)
      }
      else {
        this.#destroy(entry)
      }
    }

    if (target) {
      this.#tabEntries.delete(id)
      target.query = query
      this.entries.push(target)
      this.#show(target)
      return true
    }

    target = { id, query, active: true }
    this.entries.push(target)
    this.#mount(target)
    return true
  }

  back(delta = 1) {
    if (this.entries.length <= 1) {
      return false
    }
    const normalizedDelta = Math.max(1, delta)
    const targetIndex = Math.max(0, this.entries.length - 1 - normalizedDelta)
    const removed = this.entries.splice(targetIndex + 1)
    for (const entry of removed.reverse()) {
      this.#destroy(entry)
    }
    this.#show(this.entries[targetIndex]!)
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
    captureEntryScrollPosition(entry)
    setEntryActiveInDom(entry, false)
    const record = this.#record(entry)
    if (entry.instance && record) {
      hidePageInstance(entry.instance, record)
    }
  }

  #show(entry: PageStackEntry) {
    setEntryActiveInDom(entry, true)
    restoreEntryScrollPosition(entry)
    const record = this.#record(entry)
    if (entry.instance && record) {
      showPageInstance(entry.instance, record)
    }
  }

  #destroy(entry: PageStackEntry) {
    unmountEntryFromDom(entry)
    entry.active = false
  }
}
