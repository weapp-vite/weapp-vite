import type { PageRecord, PageStackEntry } from './options'
import {
  captureEntryScrollPosition,
  mountEntryToDom,
  restoreEntryScrollPosition,
  setEntryActiveInDom,
  unmountEntryFromDom,
} from './dom'
import { hidePageInstance, showPageInstance } from './lifecycle'

export class PageStackRuntime {
  readonly entries: PageStackEntry[] = []

  constructor(
    private readonly pageRegistry: Map<string, PageRecord>,
    private readonly onMounted: (entry: PageStackEntry) => void,
  ) {}

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
    return this.push(id, query)
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
    this.#show(this.entries[targetIndex])
    return true
  }

  #mount(entry: PageStackEntry) {
    mountEntryToDom(entry, this.pageRegistry, this.onMounted)
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

  #show(entry: PageStackEntry | undefined) {
    if (!entry) {
      return
    }
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
