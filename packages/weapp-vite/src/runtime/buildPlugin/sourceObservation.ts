import type { DevModuleGraphChange, DevModuleGraphObservedChange } from '../../moduleGraph/devProvider'
import type { HmrSourcePublicationOwner } from '../hmrRuntimeSession/sourcePublication'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { readCompilerRawInput } from '../../plugins/compilerPlugin/rawInputs'
import { compilerNativeScriptVersion } from '../../plugins/utils/sourceSnapshot'
import { createHmrProfileEventId } from '../../utils/hmrProfile'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 仅由既有模块 scheduler 认领脚本来源，不接管 sidecar、配置或目录 watcher。 */
export function observeClassicSourceChange(owner: HmrSourcePublicationOwner, root: string, change: DevModuleGraphChange): DevModuleGraphObservedChange {
  if (change.sourceEvent || !/\.(?:vue|[cm]?[jt]sx?)$/.test(change.file)) {
    return change
  }
  const receivedAtMs = performance.now()
  const lexicalFile = normalizeFsResolvedId(change.file)
  try {
    const file = compilerSourceId(change.file)
    if (change.event === 'delete') {
      owner.invalidate(root, file, lexicalFile)
      return change
    }
    const input = readCompilerRawInput(change.file)
    if (!input || compilerSourceId(change.file) !== file) {
      return change
    }
    const observation = owner.observeRead({
      root,
      file,
      lexicalFile,
      version: input.digest,
      event: change.event,
      eventId: createHmrProfileEventId(),
      receivedAtMs,
    })
    const observed = observation.token ? { ...change, sourceEvent: observation.token.event } : change
    return {
      ...observed,
      settleSourceRead(source) {
        // Vite 的稳定 read 可以跨过 truncate 阶段，但不能跨过 alias 改指或后续保存。
        if (compilerSourceId(change.file) !== file) {
          return observed
        }
        const settled = observation.settle(compilerNativeScriptVersion(source))
        return settled ? { ...change, sourceEvent: settled.event } : observed
      },
    }
  }
  catch {
    // 可选来源观测不能替代 Vite 的读取与错误处理，也不能丢弃既有构建通知。
    return change
  }
}
