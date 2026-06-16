type PluginHook<T extends (...args: any[]) => any> = T | { handler: T }

export function getPluginHookHandler<T extends (...args: any[]) => any>(hook: PluginHook<T> | undefined): T {
  if (!hook) {
    throw new Error('plugin hook is missing')
  }
  return typeof hook === 'function' ? hook : hook.handler
}

export function callPluginHook<T extends (...args: any[]) => any>(
  hook: PluginHook<T> | undefined,
  ctx: unknown,
  ...args: Parameters<T>
): ReturnType<T> {
  return getPluginHookHandler(hook).call(ctx, ...args) as ReturnType<T>
}
