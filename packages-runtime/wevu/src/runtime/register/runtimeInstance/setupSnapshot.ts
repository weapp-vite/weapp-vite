import { isRef } from '../../../reactivity'

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** 按旧初始结构恢复删除状态，同时保留新代码默认值和嵌套响应式对象身份。 */
export function restoreReactiveSetupSnapshot(
  target: unknown,
  snapshot: unknown,
  previousInitial?: unknown,
) {
  if (Array.isArray(target) && Array.isArray(snapshot)) {
    target.splice(0, target.length, ...snapshot)
    return
  }
  if (!isRecord(target) || !isRecord(snapshot)) {
    return
  }
  const initial = isRecord(previousInitial) ? previousInitial : undefined
  for (const key of Object.keys(initial ?? {})) {
    if (typeof initial?.[key] !== 'function' && typeof target[key] !== 'function' && !Object.prototype.hasOwnProperty.call(snapshot, key)) {
      delete target[key]
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof target[key] === 'function') {
      continue
    }
    if (isRef(target[key])) {
      target[key].value = value
    }
    else if ((isRecord(target[key]) && isRecord(value)) || (Array.isArray(target[key]) && Array.isArray(value))) {
      restoreReactiveSetupSnapshot(target[key], value, initial?.[key])
    }
    else {
      target[key] = value
    }
  }
}
