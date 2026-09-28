import './compat'

// 所有运行时 Core 导入统一经过此入口，维持兼容初始化顺序。
export { createSpecStreamCompiler, evaluateVisibility, resolveBindings, resolveElementProps } from '@json-render/core'
