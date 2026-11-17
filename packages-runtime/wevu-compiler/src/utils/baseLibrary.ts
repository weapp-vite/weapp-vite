const BASE_LIBRARY_VERSION_PATTERN = /^\d+(?:\.\d+)*$/

/**
 * 跨文件共享的基础库提示状态，同一次构建中每个主题只提示一次。
 * 不同功能使用各自稳定的主题键，互不抑制。
 */
export interface BaseLibraryHintState {
  reported: Set<string>
}

/**
 * 编译上下文中的基础库信息：项目配置版本、跨文件提示状态与当前文件已提示主题。
 */
export interface BaseLibraryCompileContext {
  /** 项目配置的基础库版本；缺省或 `latest` / `trial` 等别名视为无法确认。 */
  version?: string
  /** 跨文件共享的提示状态；独立调用编译器时可为空。 */
  hintState?: BaseLibraryHintState
  /** 当前文件已提示过的主题，避免同一文件重复告警。 */
  reported: Set<string>
}

/**
 * 创建一次构建或开发会话共享的基础库提示状态。
 */
export function createBaseLibraryHintState(): BaseLibraryHintState {
  return { reported: new Set() }
}

/**
 * 创建单个编译文件使用的基础库上下文；共享状态由调用方注入。
 */
export function createBaseLibraryCompileContext(options?: {
  version?: string
  hintState?: BaseLibraryHintState
}): BaseLibraryCompileContext {
  return {
    version: options?.version,
    hintState: options?.hintState,
    reported: new Set(),
  }
}

function parseBaseLibraryVersion(version: string): number[] | undefined {
  const normalized = version.trim().replace(/^v/i, '')
  if (!BASE_LIBRARY_VERSION_PATTERN.test(normalized)) {
    return undefined
  }
  return normalized.split('.').map(segment => Number(segment))
}

/**
 * 判断给定基础库版本是否满足最低版本要求。
 * `latest` / `trial` 等无法静态判断的别名一律视为不满足。
 */
export function isBaseLibraryVersionSatisfied(version: string | undefined, minimum: string): boolean {
  if (!version) {
    return false
  }
  const current = parseBaseLibraryVersion(version)
  const required = parseBaseLibraryVersion(minimum)
  if (!current || !required) {
    return false
  }
  for (let index = 0; index < Math.max(current.length, required.length); index += 1) {
    const diff = (current[index] ?? 0) - (required[index] ?? 0)
    if (diff !== 0) {
      return diff > 0
    }
  }
  return true
}

/**
 * 判断本次编译是否输出某个功能的基础库门槛提示，并消费共享的“已提示”标记。
 * 版本满足要求时不提示；同一主题在当前文件和共享状态中都只提示一次。
 */
export function consumeBaseLibraryHint(
  context: BaseLibraryCompileContext,
  request: { topic: string, minimum: string },
): boolean {
  if (isBaseLibraryVersionSatisfied(context.version, request.minimum)) {
    return false
  }
  if (context.reported.has(request.topic) || context.hintState?.reported.has(request.topic)) {
    return false
  }
  context.reported.add(request.topic)
  context.hintState?.reported.add(request.topic)
  return true
}
