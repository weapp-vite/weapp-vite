import type { OutputExtensions } from '../../../../platforms/types'
import { resolveOutputExtensions } from '../../../../utils/outputExtensions'

export function resolveBundleOutputExtensions(outputExtensions?: OutputExtensions) {
  return resolveOutputExtensions(outputExtensions)
}
