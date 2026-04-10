import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { configExtensions, jsExtensions, supportedCssLangs, templateExtensions, vueExtensions } from '../../constants'

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
  return request.endsWith('.wxml') || request.endsWith('.html')
}

export function normalizeFileExtension(extension: string) {
  return extension ? (extension.startsWith('.') ? extension : `.${extension}`) : ''
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

  extension = normalizeFileExtension(extension)

  const basename = path.basename(filePath, path.extname(filePath))
  return path.join(path.dirname(filePath), basename + extension)
}

export async function findVueEntry(filepath: string) {
  for (const ext of vueExtensions) {
    const targetPath = changeFileExtension(filepath, ext)
    if (await pathExistsCached(targetPath)) {
      return targetPath
    }
  }
}

export async function findJsEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = jsExtensions.map(ext => changeFileExtension(filepath, ext))
  for (const targetPath of predictions) {
    if (await pathExistsCached(targetPath)) {
      return {
        path: targetPath,
        predictions,
      }
    }
  }
  return {
    predictions,
  }
}

export async function findJsonEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = configExtensions.map(ext => changeFileExtension(filepath, ext))
  for (const targetPath of predictions) {
    if (await pathExistsCached(targetPath)) {
      return {
        predictions,
        path: targetPath,
      }
    }
  }
  return {
    predictions,
  }
}

export async function findCssEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = supportedCssLangs.map(ext => changeFileExtension(filepath, ext))
  for (const targetPath of predictions) {
    if (await pathExistsCached(targetPath)) {
      return {
        predictions,
        path: targetPath,
      }
    }
  }
  return {
    predictions,
  }
}

export async function findTemplateEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = templateExtensions.map(ext => changeFileExtension(filepath, ext))
  for (const targetPath of predictions) {
    if (await pathExistsCached(targetPath)) {
      return {
        predictions,
        path: targetPath,
      }
    }
  }
  return {
    predictions,
  }
}

export function isTemplate(filepath: string) {
  return templateExtensions.some(ext => filepath.endsWith(`.${ext}`))
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
