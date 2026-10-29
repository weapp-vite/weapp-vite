import type { HmrProfileProvenance } from '../../utils/hmrProfile/provenance'
import type { HmrSourcePublicationOwner } from '../hmrRuntimeSession/sourcePublication'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion, observeCompilerInputs } from '../../plugins/utils/sourceSnapshot'

interface SourcePublicationProfile extends HmrProfileProvenance {
  eventId?: string
}

interface SourcePublicationOptions {
  inputOwner: object
  sourceOwner: HmrSourcePublicationOwner
  outputRoot: string
  outputGenerations: ReadonlyMap<string, object>
  profile: () => SourcePublicationProfile
  buildId: string
  batchId: () => string
}

/** 将命令级来源绑定到本次实际编译；成功输入证明在原生 write 前即可进入 profile。 */
export function beginClassicSourcePublication(options: SourcePublicationOptions) {
  const { sourceOwner, outputRoot, outputGenerations } = options
  const previousGeneration = outputGenerations.get(outputRoot)
  const build = sourceOwner.begin(outputRoot)
  const hasPendingSources = sourceOwner.capture(outputRoot).length > 0
  const legacyEvents = options.profile().sourceEvents?.filter(event => !sourceOwner.owns(event)) ?? []
  const startedAt = performance.now()
  let released = false
  let finished = false

  function syncProfile(includeSources = true) {
    const profile = options.profile()
    const events = [...legacyEvents, ...(includeSources ? build.sourceEvents : [])]
    profile.buildId = options.buildId
    if (events.length || hasPendingSources) {
      profile.batchId ??= options.batchId()
    }
    profile.sourceEvents = events
    profile.eventId = events.length === 1 ? events[0]?.eventId : undefined
  }

  syncProfile()
  let releaseInput: (() => void) | undefined

  function release() {
    if (!released) {
      released = true
      releaseInput?.()
    }
  }

  return {
    startedAt,
    get sourceEvents() { return build.sourceEvents },
    get canComplete() { return build.didCommit && build.sourceEvents.length > 0 },
    async run<T>(run: () => Promise<T>): Promise<T> {
      releaseInput = observeCompilerInputs(options.inputOwner, (file, source) => {
        // 原生根视图一旦提交，后置读取不能把后来保存借给旧输出代。
        if (outputGenerations.get(outputRoot) !== previousGeneration) {
          return
        }
        build.recordInput(compilerSourceId(file), compilerNativeScriptVersion(source))
        syncProfile()
      })
      try {
        const value = await run()
        const generation = outputGenerations.get(outputRoot)
        if (generation && generation !== previousGeneration) {
          build.markCommitted()
        }
        return value
      }
      finally {
        release()
      }
    },
    finish(successful: boolean) {
      if (finished) {
        return
      }
      finished = true
      release()
      syncProfile(!successful || build.didCommit)
      build.finish(successful)
    },
  }
}
