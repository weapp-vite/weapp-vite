import fs from 'fs-extra'
import path from 'pathe'
import { jsExtensions } from '../constants'

export * from './json'
export * from './projectConfig'
export * from './scan'

export function isJsOrTs(name?: string) {
  if (typeof name === 'string') {
    return jsExtensions.some(x => name.endsWith(`.${x}`))
  }
  return false
}

export function changeFileExtension(filePath: string, extension: string) {
  if (typeof filePath !== 'string') {
    throw new TypeError(`Expected \`filePath\` to be a string, got \`${typeof filePath}\`.`)
  }

  if (typeof extension !== 'string') {
    throw new TypeError(`Expected \`extension\` to be a string, got \`${typeof extension}\`.`)
  }

  if (filePath === '') {
    return ''
  }

  extension = extension ? (extension.startsWith('.') ? extension : `.${extension}`) : ''

  const basename = path.basename(filePath, path.extname(filePath))
  return path.join(path.dirname(filePath), basename + extension)
}

export async function findJsEntry(filepath: string) {
  for (const ext of jsExtensions) {
    const p = changeFileExtension(filepath, ext)
    if (await fs.exists(p)) {
      return p
    }
  }
}
