import type { InternalRuntimeState } from './types'

export type RuntimeLayoutComponentMatcher = (
  componentPath: string,
  target: InternalRuntimeState,
) => boolean

const DEFAULT_LAYOUT_COMPONENT_PATH_PREFIX = 'layouts/'

let runtimeLayoutComponentMatcher: RuntimeLayoutComponentMatcher = componentPath =>
  componentPath.startsWith(DEFAULT_LAYOUT_COMPONENT_PATH_PREFIX)

/**
 * 设置运行时 layout 组件判定器，供构建侧未来接入可配置 layout 输出路径。
 *
 * @internal
 */
export function setRuntimeLayoutComponentMatcher(matcher: RuntimeLayoutComponentMatcher | undefined) {
  runtimeLayoutComponentMatcher = matcher ?? (componentPath =>
    componentPath.startsWith(DEFAULT_LAYOUT_COMPONENT_PATH_PREFIX))
}

export function isRuntimeLayoutComponentTarget(target: InternalRuntimeState): boolean {
  const componentPath = (target as any).is
  return typeof componentPath === 'string'
    && runtimeLayoutComponentMatcher(componentPath, target)
}
