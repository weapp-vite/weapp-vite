import type { CopyGlobs, SubPackageMetaValue } from '@/types'
import { configExtensions, jsExtensions, templateExtensions, vueExtensions } from '@/constants'
import fs from 'fs-extra'
import path from 'pathe'

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

export async function findVueEntry(filepath: string) {
  for (const ext of vueExtensions) {
    const p = changeFileExtension(filepath, ext)
    if (await fs.exists(p)) {
      return p
    }
  }
}

export async function findJsEntry(filepath: string) {
  for (const ext of jsExtensions) {
    const p = changeFileExtension(filepath, ext)
    if (await fs.exists(p)) {
      return p
    }
  }
}

export async function findJsonEntry(filepath: string) {
  for (const ext of configExtensions) {
    const p = changeFileExtension(filepath, ext)
    if (await fs.exists(p)) {
      return p
    }
  }
}

export async function findTemplateEntry(filepath: string) {
  for (const ext of templateExtensions) {
    const p = changeFileExtension(filepath, ext)
    if (await fs.exists(p)) {
      return p
    }
  }
}

export function isTemplate(filepath: string) {
  return templateExtensions.some(ext => filepath.endsWith(`.${ext}`))
}

export function resolveGlobs(globs?: CopyGlobs, subPackageMeta?: SubPackageMetaValue | undefined): string[] {
  if (Array.isArray(globs)) {
    return globs
  }
  else if (typeof globs === 'function') {
    return globs(subPackageMeta)
  }
  return []
}

export function touch(filename: string) {
  const time = new Date()

  try {
    fs.utimesSync(filename, time, time)
  }
  catch {
    fs.closeSync(fs.openSync(filename, 'w'))
  }
}
