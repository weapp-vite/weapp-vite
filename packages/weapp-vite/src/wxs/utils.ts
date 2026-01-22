import { addExtension } from '@weapp-core/shared'

export function normalizeWxsFilename(value: string, extension = 'wxs') {
  const normalized = extension.startsWith('.') ? extension.slice(1) : extension
  let filename = value
  filename = filename.replace(/\.[jt]s$/i, '')
  filename = filename.replace(/\.(wxs|sjs)$/i, '')
  return addExtension(filename, `.${normalized}`)
}
