import type { NormalizedOutputOptions, OutputBundle } from 'rolldown'
import type { PluginOption } from 'vite'

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

export async function callWriteBundleHooks(plugins: PluginOption[], outDir: string, bundle: OutputBundle) {
  for (const option of plugins) {
    const plugin = await option
    if (Array.isArray(plugin)) {
      await callWriteBundleHooks(plugin, outDir, bundle)
    }
    else if (plugin && plugin.writeBundle) {
      await callPluginHook(plugin.writeBundle, {}, { dir: outDir } as NormalizedOutputOptions, bundle)
    }
  }
}
