import type { ChokidarOptions } from 'chokidar'
import type { ViteDevServer } from 'vite'
import process from 'node:process'
import path from 'pathe'
import { throwViteAdapterErrors } from './errors'
import { createPhysicalViteWatcherGroup } from './group'
import { createViteWatcherKeepalive } from './keepalive'

export { throwViteAdapterErrors } from './errors'
export type { ViteWatcherCloseFailure } from './group'

type Readiness = 'ready' | 'closed'
type Facade = ViteDevServer['watcher']

interface Group {
  targets: string[]
  excluded: string[]
  owner: ReturnType<typeof createPhysicalViteWatcherGroup>
}

function contains(root: string, file: string) {
  const relative = path.relative(root, file)
  return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative))
}

/** 逻辑目标决定交付范围，物理目录订阅持有异步登记与恢复的公开屏障。 */
export function createViteWatcherBackend(facade: Facade, targets: string[], options: ChokidarOptions, persistent: boolean) {
  const groups: Group[] = []
  const failedOwners: Group['owner'][] = []
  const pending = new Set<Promise<Readiness>>()
  const failures = new Set<unknown>()
  const keepalive = createViteWatcherKeepalive(persistent)
  const queue: { name: string, args: unknown[], group?: Group }[] = []
  let closed = false
  let activated = false
  let publishedReady = false
  let closing: Promise<void> | undefined
  const absolute = (file: string) => path.resolve(options.cwd ?? process.cwd(), file)
  const covered = (group: Group, file: string) => group.targets.some(target => contains(target, file)
    && (options.depth === undefined || path.relative(target, file).split('/').filter(Boolean).length <= options.depth + 1))
  const accepts = (group: Group, file: string) => covered(group, file) && !group.excluded.some(target => contains(target, file))
  const owns = (group: Group, file: string) => groups.find(candidate => accepts(candidate, file) && candidate.owner.watching(file)) === group
  const publish = (name: string, ...args: unknown[]) => {
    if (closed) {
      return
    }
    if (activated) {
      facade.emit(name, ...args)
    }
    else {
      queue.push({ name, args })
    }
  }
  const report = (error: unknown) => {
    if (!failures.has(error)) {
      failures.add(error)
      publish('error', error)
    }
  }
  const track = (registration: Promise<Readiness>) => {
    pending.add(registration)
    void registration.then(() => pending.delete(registration), (error) => {
      report(error)
      pending.delete(registration)
    })
  }
  const add = (inputs: string | readonly string[]) => {
    if (closed) {
      return facade
    }
    const paths = [...new Set((typeof inputs === 'string' ? [inputs] : inputs).map(absolute))]
      .filter(file => !groups.some(group => group.targets.includes(file) && accepts(group, file)))
    if (!paths.length) {
      return facade
    }
    const group = { targets: paths, excluded: [] } as unknown as Group
    group.owner = createPhysicalViteWatcherGroup(paths, options, {
      accepts: file => accepts(group, file),
      pending: track,
      options(backing) {
        if (backing) {
          // 只回读公开后端选择；depth 与 ignored 仍保留用户的逻辑配置。
          facade.options = {
            ...facade.options,
            usePolling: backing.usePolling,
            useFsEvents: false,
            interval: backing.interval,
            binaryInterval: backing.binaryInterval,
          }
        }
      },
      event(name, file, stats) {
        const absoluteFile = absolute(file)
        if (!activated) {
          queue.push({ name, args: [file, ...stats ? [stats] : []], group })
          queue.push({ name: 'all', args: [name, file, ...stats ? [stats] : []], group })
        }
        else if (owns(group, absoluteFile)) {
          publish(name, file, ...stats ? [stats] : [])
          publish('all', name, file, ...stats ? [stats] : [])
        }
      },
      raw: (...args) => publish('raw', ...args),
    })
    groups.push(group)
    return facade
  }
  const registrationReady = async (): Promise<Readiness> => {
    while (pending.size) {
      await Promise.all([...pending])
    }
    throwViteAdapterErrors([...failures])
    return closed ? 'closed' : 'ready'
  }
  const close = () => {
    if (!closing) {
      closed = true
      queue.length = 0
      facade.removeAllListeners()
      keepalive.close()
      const retiring = groups.splice(0)
      const previousFailures = new Set(failures)
      closing = (async () => {
        const results = await Promise.allSettled(retiring.map(group => group.owner.close()))
        results.forEach((result) => {
          if (result.status === 'rejected') {
            failures.add(result.reason)
          }
        })
        retiring.forEach((group) => {
          if (group.owner.closeFailures().length) {
            failedOwners.push(group.owner)
          }
          group.targets.length = 0
          group.excluded.length = 0
        })
        while (pending.size) {
          await Promise.allSettled([...pending])
        }
        throwViteAdapterErrors([
          ...results.flatMap(result => result.status === 'rejected' ? [result.reason] : []),
          ...[...failures].filter(error => !previousFailures.has(error)),
        ])
      })()
    }
    return closing
  }
  facade.add = add
  facade.unwatch = (inputs) => {
    if (!closed) {
      const paths = (typeof inputs === 'string' ? [inputs] : [...inputs]).map(absolute)
      for (const group of groups) {
        group.excluded.push(...paths)
        group.owner.unwatch(paths)
      }
    }
    return facade
  }
  facade.getWatched = () => {
    const watched: Record<string, string[]> = Object.create(null)
    if (!closed) {
      for (const state of groups.flatMap(group => group.owner.getWatched())) {
        for (const [directory, children] of Object.entries(state)) {
          watched[directory] = [...new Set([...(watched[directory] ?? []), ...children])].sort()
        }
      }
    }
    return watched
  }
  facade.close = close
  facade.ref = () => {
    keepalive.ref()
    return facade
  }
  facade.unref = () => {
    keepalive.unref()
    return facade
  }
  add(targets)
  return {
    registrationReady,
    close,
    closeFailures: () => [...groups.map(group => group.owner), ...failedOwners].flatMap(owner => owner.closeFailures()),
    async activate() {
      const state = await registrationReady()
      if (state === 'ready') {
        activated = true
        for (const event of queue.splice(0)) {
          if (closed) {
            break
          }
          const file = event.name === 'all' ? event.args[1] : event.args[0]
          if (!event.group || (typeof file === 'string' && owns(event.group, absolute(file)))) {
            facade.emit(event.name, ...event.args)
          }
        }
        if (!publishedReady && !closed) {
          publishedReady = true
          facade.emit('ready')
        }
      }
      return state
    },
  }
}
