import type { OutputExtensions } from '../../../../platforms/types'

export function resolveBundleOutputExtensions(outputExtensions?: OutputExtensions) {
  return {
    templateExtension: outputExtensions?.wxml ?? 'wxml',
    styleExtension: outputExtensions?.wxss ?? 'wxss',
    jsonExtension: outputExtensions?.json ?? 'json',
    scriptExtension: outputExtensions?.js ?? 'js',
    scriptModuleExtension: outputExtensions?.wxs,
  }
}
