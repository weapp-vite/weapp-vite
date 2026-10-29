import type { DevModuleGraphChange } from '../../moduleGraph/devProvider'
import type { HmrSourcePublicationOwner } from '../hmrRuntimeSession/sourcePublication'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { readCompilerRawInput } from '../../plugins/compilerPlugin/rawInputs'
import { createHmrProfileEventId } from '../../utils/hmrProfile'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 仅由既有模块 scheduler 认领脚本来源，不接管 sidecar、配置或目录 watcher。 */
export function observeClassicSourceChange(owner: HmrSourcePublicationOwner, root: string, change: DevModuleGraphChange): DevModuleGraphChange {
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
    const source = owner.observe({
      root,
      file,
      lexicalFile,
      version: input.digest,
      event: change.event,
      eventId: createHmrProfileEventId(),
      receivedAtMs,
    })
    return source ? { ...change, sourceEvent: source.event } : change
  }
  catch {
    // 可选来源观测不能替代 Vite 的读取与错误处理，也不能丢弃既有构建通知。
    return change
  }
}
