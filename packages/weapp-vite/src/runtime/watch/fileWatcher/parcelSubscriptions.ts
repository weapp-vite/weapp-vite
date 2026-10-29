import type { AsyncSubscription, Event, Options } from '@parcel/watcher'
import type { WatchPathMapping } from './scan'
import { stat } from 'node:fs/promises'
import path from 'pathe'
import { throwFileWatchFailures } from './events'
import { containsWatchPath } from './paths'
import { isMissingWatchPath, resolveWatchPhysicalPath } from './scan'

interface ParcelRootSubscription {
  signature: string
  subscription: AsyncSubscription
  allowed?: Set<string>
  closing?: Promise<void>
}

async function existingWatchParent(file: string): Promise<string> {
  let parent = path.dirname(file)
  for (;;) {
    try {
      if ((await stat(parent)).isDirectory()) {
        return await resolveWatchPhysicalPath(parent)
      }
    }
    catch (error) {
      if (!isMissingWatchPath(error)) {
        throw error
      }
    }
    const next = path.dirname(parent)
    if (next === parent) {
      throw new Error(`File watcher could not find an existing parent for ${file}`)
    }
    parent = next
  }
}

function escapeWatchPattern(file: string) {
  return file.split('/').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[/\\\\]')
}

/** 原生排除兄弟树，缺失逻辑目标的祖先链保持可见，避免递归观察整个工作区。 */
async function parcelRootScope(root: string, mappings: WatchPathMapping[]) {
  const allowed = new Set<string>(['[^/\\\\]+'])
  for (const mapping of mappings) {
    if (containsWatchPath(mapping.physical, root)) {
      return undefined
    }
    if (!containsWatchPath(root, mapping.physical)) {
      continue
    }
    const relative = path.relative(root, mapping.physical)
    let directory = true
    try {
      directory = (await stat(mapping.physical)).isDirectory()
    }
    catch (error) {
      if (!isMissingWatchPath(error)) {
        throw error
      }
    }
    if (directory) {
      allowed.add(`${escapeWatchPattern(relative)}(?:[/\\\\][\\s\\S]*)?`)
    }
    else if (path.dirname(relative) !== '.') {
      allowed.add(`${escapeWatchPattern(path.dirname(relative))}[/\\\\][^/\\\\]+`)
    }
    let ancestor = path.dirname(relative)
    while (ancestor !== '.') {
      allowed.add(escapeWatchPattern(ancestor))
      ancestor = path.dirname(ancestor)
    }
  }
  return allowed
}

function parcelRootOptions(allowed: Set<string> | undefined): Options {
  return allowed ? { ignore: [new RegExp(`^(?!(?:${[...allowed].sort().join('|')})$)[\\s\\S]+$`)] } : {}
}

export function createParcelSubscriptions(receive: (events: Event[]) => void, report: (error: unknown) => void) {
  const roots = new Map<string, ParcelRootSubscription>()
  const inflight = new Set<Promise<void>>()
  const releasing = new Set<Promise<void>>()
  let closed = false
  let closing: Promise<void> | undefined
  let parcel: Promise<typeof import('@parcel/watcher')> | undefined
  const release = (entry: ParcelRootSubscription) => {
    if (!entry.closing) {
      entry.closing = Promise.resolve().then(async () => await entry.subscription.unsubscribe())
      releasing.add(entry.closing)
      void entry.closing.then(() => releasing.delete(entry.closing!), () => releasing.delete(entry.closing!))
    }
    return entry.closing
  }
  const subscribe = async (root: string, options: Options) => {
    parcel ??= import('@parcel/watcher')
    const engine = await parcel
    return await engine.subscribe(root, (error, events) => {
      if (!closed) {
        if (error) {
          report(error)
        }
        if (events.length) {
          receive(events)
        }
      }
    }, options)
  }
  return {
    async reset() {
      const released = await Promise.allSettled([...roots.values()].map(release))
      roots.clear()
      throwFileWatchFailures(released)
    },
    async sync(mappings: WatchPathMapping[]) {
      if (closed) {
        return false
      }
      const candidates = [...new Set(await Promise.all(mappings.map(mapping => existingWatchParent(mapping.physical))))]
      const nextRoots = candidates.filter(candidate => !candidates.some(other => other !== candidate && containsWatchPath(other, candidate)))
      let changed = false
      for (const root of nextRoots) {
        if (closed) {
          return changed
        }
        const previous = roots.get(root)
        const allowed = await parcelRootScope(root, mappings)
        if (allowed && previous?.allowed) {
          previous.allowed.forEach(pattern => allowed.add(pattern))
        }
        const options = parcelRootOptions(allowed)
        const signature = (options.ignore ?? []).map(String).join('\0')
        if (previous?.signature === signature) {
          continue
        }
        const task = (async () => {
          const subscription = await subscribe(root, options)
          const entry: ParcelRootSubscription = { signature, subscription, allowed }
          if (closed) {
            await release(entry)
            return
          }
          roots.set(root, entry)
          if (previous) {
            await release(previous)
          }
        })()
        inflight.add(task)
        try {
          await task
        }
        finally {
          inflight.delete(task)
        }
        changed = true
      }
      for (const [root, entry] of roots) {
        if (!nextRoots.includes(root)) {
          await release(entry)
          roots.delete(root)
          changed = true
        }
      }
      return changed
    },
    close() {
      if (!closing) {
        closed = true
        closing = (async () => {
          const pending = await Promise.allSettled([...inflight])
          const released = await Promise.allSettled([...new Set([...releasing, ...[...roots.values()].map(release)])])
          roots.clear()
          throwFileWatchFailures([...pending, ...released])
        })()
      }
      return closing
    },
  }
}
