import type { MiniProgramArtifact } from '@mpcore/test'
import type { VitestPluginContext } from 'vitest/node'

export const MPCORE_ARTIFACT_KEY = 'mpcoreArtifact'

export interface MpcoreArtifactWatcher {
  artifact: MiniProgramArtifact
  close: () => void | Promise<void>
}

export interface MpcoreArtifactWatchCallbacks {
  onRebuilt: (artifact: MiniProgramArtifact) => Promise<void>
  onError: (error: unknown) => void
}

export interface MpcoreArtifactFactory {
  build: () => MiniProgramArtifact | Promise<MiniProgramArtifact>
  /** watcher 负责首次构建并返回初始产物，避免 run 与 watch 重复构建。 */
  watch?: (callbacks: MpcoreArtifactWatchCallbacks) => MpcoreArtifactWatcher | Promise<MpcoreArtifactWatcher>
}

/** 每次 configureVitest 调用只持有当前 project 的 watcher 和重跑队列。 */
export async function configureArtifact(factory: MpcoreArtifactFactory, { project, vitest }: VitestPluginContext) {
  let closed = false
  let ready = false
  let earlyArtifact: MiniProgramArtifact | undefined
  let watcher: MpcoreArtifactWatcher | undefined
  let pending = Promise.resolve()
  let starting = Promise.resolve()
  let closing: Promise<void> | undefined

  const onError = (error: unknown) => {
    if (!closed) {
      vitest.state.catchError(error, 'Mpcore Artifact Error')
      vitest.logger.printError(error)
    }
  }
  const onRebuilt = (artifact: MiniProgramArtifact) => {
    if (closed) {
      return Promise.resolve()
    }
    if (!ready) {
      earlyArtifact = artifact
      return Promise.resolve()
    }
    pending = pending.then(async () => {
      if (closed) {
        return
      }
      project.provide(MPCORE_ARTIFACT_KEY, artifact)
      const specifications = await vitest.globTestSpecifications()
      if (!closed) {
        await vitest.rerunTestSpecifications(specifications.filter(specification => specification.project === project))
      }
    }).catch(onError)
    return pending
  }

  vitest.onClose(() => {
    return closing ??= (async () => {
      closed = true
      // 关闭发生在异步启动期间时，也必须接住刚创建出来的 watcher。
      await starting.catch(() => {})
      const ownedWatcher = watcher
      watcher = undefined
      const results = await Promise.allSettled([Promise.resolve().then(() => ownedWatcher?.close()), pending])
      const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
      if (errors.length) {
        throw new AggregateError(errors, 'Mpcore artifact cleanup failed')
      }
    })()
  })

  starting = (async () => {
    if (closed) {
      return
    }
    let artifact: MiniProgramArtifact
    if (vitest.config.watch && factory.watch) {
      watcher = await factory.watch({ onRebuilt, onError })
      artifact = watcher.artifact
    }
    else {
      artifact = await factory.build()
    }
    if (!closed) {
      project.provide(MPCORE_ARTIFACT_KEY, earlyArtifact ?? artifact)
      ready = true
    }
  })()
  await starting
}

declare module 'vitest' {
  interface ProvidedContext {
    mpcoreArtifact: MiniProgramArtifact
  }
}
