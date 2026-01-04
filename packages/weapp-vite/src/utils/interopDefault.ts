type DefaultInterop<T> = { default: T } | { default?: T }

export function interopDefault<T>(mod: T | DefaultInterop<T>): T {
  if (
    mod
    && (typeof mod === 'object' || typeof mod === 'function')
    && 'default' in mod
  ) {
    const candidate = (mod as DefaultInterop<T>).default
    return (candidate ?? mod) as unknown as T
  }
  return mod as T
}
