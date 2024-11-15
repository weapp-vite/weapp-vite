import { addExtension, removeExtensionDeep } from '@weapp-core/shared'

export function normalizeWxsFilename(value: string) {
  return addExtension(removeExtensionDeep(value), '.wxs')
}
