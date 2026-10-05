interface AttachmentBindingUpdate {
  revision: number
  update: () => void
}

const bindingUpdates = new WeakMap<object, AttachmentBindingUpdate>()
const instanceScopes = new WeakMap<object, object>()

/** 实例经渲染上下文归属页面，不扩展公开 renderer context 的参数契约。 */
export function bindAttachmentBindingScope(instance: object, scope: object) {
  instanceScopes.set(instance, instanceScopes.get(scope) ?? scope)
}

/** 仅在挂载回调内同步逻辑绑定，不接管视图提交和 setData 回调。 */
export function runWithAttachmentBindingUpdates<T, R>(
  scope: object,
  update: () => void,
  callback: (value: T) => R,
  value: T,
): R {
  const previous = bindingUpdates.get(scope)
  const state = previous ?? { revision: 0, update }
  const previousUpdate = state.update
  state.update = update
  bindingUpdates.set(scope, state)
  try {
    return callback(value)
  }
  finally {
    if (previous) {
      state.update = previousUpdate
    }
    else {
      bindingUpdates.delete(scope)
    }
  }
}

export function getAttachmentBindingRevision(instance: object): Readonly<{ revision: number }> | undefined {
  return bindingUpdates.get(instanceScopes.get(instance) ?? instance)
}

export function synchronizeAttachmentBindings(instance: object) {
  const state = bindingUpdates.get(instanceScopes.get(instance) ?? instance)
  if (state) {
    // 构造期间暂缓同步时也必须使旧遍历失效，不能把新写入回退为旧作用域的值。
    state.revision++
    state.update()
  }
}
