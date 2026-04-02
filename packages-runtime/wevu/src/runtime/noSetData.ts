const NO_SETDATA: unique symbol = Symbol('wevu.noSetData')

export function markNoSetData<T extends object>(value: T): T {
  Object.defineProperty(value, NO_SETDATA, {
    value: true,
    configurable: true,
    enumerable: false,
    writable: false,
  })
  return value
}

export function isNoSetData(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as any)[NO_SETDATA] === true
}
