import type { WatcherService } from '../watcherPlugin'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion, observeCompilerInputs } from '../../plugins/utils/sourceSnapshot'
import { readRequestedIdeConfig } from '../classicIdeConfig/reader'
import { onWatcherServiceDrained } from '../watcherPlugin'

export interface InitialBuildRouteEvidence {
  signature: string | undefined
}

interface StartupChange {
  file?: string
  event?: string
  verifyInitialInput?: boolean
  verifyInitialSidecarCreation?: () => boolean
  initialRoute?: InitialBuildRouteEvidence
}

const observations = new WeakMap<object, {
  observation: ReturnType<typeof observeInitialBuildInputs>
  release: () => void
}>()

/** 扫描与首构共用实际读取摘要；只剔除已发布版本的迟到更新通知。 */
function observeInitialBuildInputs(owner: object) {
  const latest = new Map<string, string>()
  const unstable = new Set<string>()
  let collecting: Map<string, string> | undefined
  let published: ReadonlyMap<string, string> | undefined
  let publishedRouteSignature: string | undefined
  const release = observeCompilerInputs(owner, (file, source) => {
    const id = compilerSourceId(file)
    const version = compilerNativeScriptVersion(source)
    if (latest.has(id) && latest.get(id) !== version) {
      unstable.add(id)
    }
    latest.set(id, version)
    if (collecting) {
      if (unstable.has(id)) {
        collecting.delete(id)
      }
      else {
        collecting.set(id, version)
      }
    }
  })
  return {
    begin() {
      collecting = new Map([...latest].filter(([file]) => !unstable.has(file)))
    },
    commit(routeSignature?: string) {
      published = collecting
      publishedRouteSignature = routeSignature
      collecting = undefined
      latest.clear()
      unstable.clear()
      release()
    },
    async filter<T extends StartupChange>(changes: T[]): Promise<T[]> {
      const baseline = published
      if (!baseline?.size) {
        return changes
      }
      const retained: T[] = []
      for (const change of changes) {
        // 路由 owner 的所有通知都须证明同一已发布拓扑；未知签名不能借用普通模块的更新语义。
        const samePublishedRoutes = publishedRouteSignature !== undefined
          && change.initialRoute?.signature === publishedRouteSignature
        const consumedSourceUpdate = change.event === 'update' && (!change.initialRoute || samePublishedRoutes)
        const consumedRouteCreation = change.event === 'create' && samePublishedRoutes
        const consumedSidecarCreation = change.event === 'create' && !change.initialRoute && change.verifyInitialSidecarCreation?.()
        const version = change.verifyInitialInput && (consumedSourceUpdate || consumedRouteCreation || consumedSidecarCreation) && change.file
          ? baseline.get(compilerSourceId(change.file))
          : undefined
        let current: string | undefined
        if (version && change.file) {
          try {
            current = compilerNativeScriptVersion(await readRequestedIdeConfig(owner, change.file))
          }
          catch (error) {
            if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
              throw error
            }
          }
        }
        if (!version || version !== current || (consumedSidecarCreation && !change.verifyInitialSidecarCreation?.())) {
          retained.push(change)
        }
      }
      // 第一个真实后续批次开始后不再借用启动版本，源码恢复必须重新发布。
      if (retained.length) {
        published = undefined
        publishedRouteSignature = undefined
      }
      return retained
    },
    close() {
      release()
      latest.clear()
      unstable.clear()
      collecting = published = undefined
      publishedRouteSignature = undefined
    },
  }
}

/** 编译会话拥有观察期，保证预扫描失败和构建尚未开始时也能释放。 */
export function startInitialBuildInputObservation(owner: object, watcherService?: WatcherService): () => void {
  observations.get(owner)?.release()
  const observation = observeInitialBuildInputs(owner)
  let unregisterDrain: (() => void) | undefined
  const release = () => {
    unregisterDrain?.()
    unregisterDrain = undefined
    observation.close()
    if (observations.get(owner)?.observation === observation) {
      observations.delete(owner)
    }
  }
  observations.set(owner, { observation, release })
  if (watcherService) {
    unregisterDrain = onWatcherServiceDrained(watcherService, release)
  }
  return release
}

/** 初始化失败或尚未构建就关闭时，也释放当前输入代次的 drain 回调。 */
export function closeInitialBuildInputObservation(owner: object): void {
  observations.get(owner)?.release()
}

export function getInitialBuildInputObservation(owner: object) {
  return observations.get(owner)?.observation
}
