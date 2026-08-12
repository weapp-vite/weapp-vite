import type { MpPlatform } from '../../types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { configExtensions, scriptExtensions, supportedCssLangs, templateExtensions, vueExtensions } from '../../constants'
import { getSourceStyleExtensions, getSourceTemplateExtensions, isSourceTemplateExtension } from '../../platforms/sourceAssets'

const pathExistsInFlight = new Map<string, Promise<boolean>>()
const JS_OR_TS_RE = /\.[jt]s$/

function pathExistsCached(filePath: string) {
  const pending = pathExistsInFlight.get(filePath)
  if (pending) {
    return pending
  }
  const next = fs.pathExists(filePath).finally(() => {
    pathExistsInFlight.delete(filePath)
  })
  pathExistsInFlight.set(filePath, next)
  return next
}

export function isJsOrTs(name?: string) {
  if (typeof name === 'string') {
    return JS_OR_TS_RE.test(name)
  }
  return false
}

export function isTemplateRequest(request: string) {
  return isSourceTemplateExtension(path.extname(request))
}

export function normalizeFileExtension(extension: string) {
  return extension ? (extension.startsWith('.') ? extension : `.${extension}`) : ''
}

const knownEntryExtensions = new Set([
  ...configExtensions,
  ...scriptExtensions,
  ...supportedCssLangs,
  ...templateExtensions,
  ...vueExtensions,
].map(normalizeFileExtension))

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

  extension = normalizeFileExtension(extension)

  const basename = path.basename(filePath, path.extname(filePath))
  return path.join(path.dirname(filePath), basename + extension)
}

async function findEntryByExtensions(filepath: string, extensions: readonly string[]) {
  const normalizedExtensions = extensions.map(normalizeFileExtension)
  const currentExtension = path.extname(filepath)
  const shouldReplaceExtension = currentExtension
    ? knownEntryExtensions.has(currentExtension)
    : false
  const predictions = normalizedExtensions.map((ext) => {
    return shouldReplaceExtension
      ? changeFileExtension(filepath, ext)
      : `${filepath}${ext}`
  })
  const exists = await Promise.all(predictions.map(targetPath => pathExistsCached(targetPath)))
  const matchedIndex = exists.findIndex(Boolean)
  return {
    predictions,
    path: matchedIndex >= 0 ? predictions[matchedIndex] : undefined,
  }
}

export async function findVueEntry(filepath: string) {
  return (await findEntryByExtensions(filepath, vueExtensions)).path
}

export async function findJsEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  return findEntryByExtensions(filepath, scriptExtensions)
}

export async function findJsonEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  return findEntryByExtensions(filepath, configExtensions)
}

export async function findCssEntry(filepath: string, platform?: MpPlatform): Promise<{
  predictions: string[]
  path?: string
}> {
  return findEntryByExtensions(filepath, getSourceStyleExtensions(platform))
}

export async function findTemplateEntry(filepath: string, platform?: MpPlatform): Promise<{
  predictions: string[]
  path?: string
}> {
  return findEntryByExtensions(filepath, getSourceTemplateExtensions(platform))
}

export function isTemplate(filepath: string) {
  return isSourceTemplateExtension(path.extname(filepath))
}

export function touchSync(filename: string) {
  const time = new Date()

  try {
    fs.utimesSync(filename, time, time)
  }
  catch {
    fs.closeSync(fs.openSync(filename, 'w'))
  }
}

export async function touch(filename: string) {
  const time = new Date()

  try {
    await fs.utimes(filename, time, time)
  }
  catch {
    await fs.close(await fs.open(filename, 'w'))
  }
}
