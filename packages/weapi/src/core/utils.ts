export interface CallbackOptions {
  success?: (res: any) => void
  fail?: (err: any) => void
  complete?: (res: any) => void
}

export function isPlainObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

export function hasCallbacks(value: unknown): value is CallbackOptions {
  if (!isPlainObject(value)) {
    return false
  }
  return typeof value.success === 'function'
    || typeof value.fail === 'function'
    || typeof value.complete === 'function'
}

export function isSyncMethod(name: string) {
  return name.endsWith('Sync')
}

export function isEventMethod(name: string) {
  return /^on[A-Z]/.test(name) || /^off[A-Z]/.test(name)
}

export function shouldSkipPromise(name: string) {
  return isSyncMethod(name) || isEventMethod(name)
}

export function createNotSupportedError(methodName: string, platform?: string) {
  const prefix = platform ? `${platform}.${methodName}` : methodName
  return {
    errMsg: `${prefix}:fail method not supported`,
  }
}
