import type { EntryChunkLifecycle } from './entryChunkLifecycle'

const bindings = new WeakMap<object, { lifecycle: EntryChunkLifecycle }>()

/** 将当前构建的入口注册器交给同一环境中的源码编译器。 */
export function bindEntryChunkLifecycle(scope: object, lifecycle: EntryChunkLifecycle) {
  const binding = { lifecycle }
  bindings.set(scope, binding)
  return () => {
    if (bindings.get(scope) === binding) {
      bindings.delete(scope)
    }
  }
}

/** 环境身份跨 hook 保持稳定，不把临时 PluginContext 当作构建代次。 */
export function readEntryChunkLifecycle(scope: object) {
  return bindings.get(scope)?.lifecycle
}
