import type { OutputExtensions } from '../platforms/types'

export function resolveScriptModuleExtension(
  outputExtensions?: OutputExtensions,
  options?: {
    scriptModuleExtensionFallback?: string
  },
) {
  return outputExtensions?.wxs ?? options?.scriptModuleExtensionFallback
}

export function resolveOutputExtensions(
  outputExtensions?: OutputExtensions,
  options?: {
    scriptModuleExtensionFallback?: string
  },
) {
  return {
    templateExtension: outputExtensions?.wxml ?? 'wxml',
    styleExtension: outputExtensions?.wxss ?? 'wxss',
    jsonExtension: outputExtensions?.json ?? 'json',
    scriptExtension: outputExtensions?.js ?? 'js',
    scriptModuleExtension: resolveScriptModuleExtension(outputExtensions, options),
  }
}

export function resolveCompilerOutputExtensions(outputExtensions?: OutputExtensions) {
  return resolveOutputExtensions(outputExtensions, {
    scriptModuleExtensionFallback: 'wxs',
  })
}
