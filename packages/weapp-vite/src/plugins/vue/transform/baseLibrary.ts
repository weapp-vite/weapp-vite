import type { BaseLibraryHintState } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import { createBaseLibraryHintState } from 'wevu/compiler'

type ConfigServiceLike = Pick<NonNullable<CompilerContext['configService']>, 'projectConfig'>

const baseLibraryHintStates = new WeakMap<object, BaseLibraryHintState>()

/**
 * 同一次构建或开发会话共享的基础库提示状态；各功能按稳定主题独立去重。
 */
export function resolveBaseLibraryHintState(configService: ConfigServiceLike): BaseLibraryHintState {
  let state = baseLibraryHintStates.get(configService)
  if (!state) {
    state = createBaseLibraryHintState()
    baseLibraryHintStates.set(configService, state)
  }
  return state
}

/**
 * 读取项目配置的基础库版本，原样交给编译器判定；`latest` / `trial` 等别名的语义只在编译器维护。
 */
export function resolveProjectBaseLibraryVersion(configService: ConfigServiceLike): string | undefined {
  const value = configService.projectConfig?.libVersion
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
