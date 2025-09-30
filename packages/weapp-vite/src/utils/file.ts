import fs from 'fs-extra'
import path from 'pathe'
import { configExtensions, jsExtensions, supportedCssLangs, templateExtensions, vueExtensions } from '../constants'

export function isJsOrTs(name?: string) {
  if (typeof name === 'string') {
    return /\.[jt]s$/.test(name)
  }
  return false
}

export function isTemplateRequest(request: string) {
  return request.endsWith('.wxml') || request.endsWith('.html')
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

export async function findJsEntry(filepath: string): Promise<{
  predictions: string[]
  path?: string
}> {
  const predictions = jsExtensions.map((ext) => {
    return changeFileExtension(filepath, ext)
  })
  for (const p of predictions) {
    if (await fs.exists(p)) {
      return {
        path: p,
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
  const predictions = configExtensions.map((ext) => {
    return changeFileExtension(filepath, ext)
  })
  for (const p of predictions) {
    if (await fs.exists(p)) {
      return {
        predictions,
        path: p,
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
  const predictions = supportedCssLangs.map((ext) => {
    return changeFileExtension(filepath, ext)
  })
  for (const p of predictions) {
    if (await fs.exists(p)) {
      return {
        predictions,
        path: p,
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
  const predictions = templateExtensions.map((ext) => {
    return changeFileExtension(filepath, ext)
  })
  for (const p of predictions) {
    if (await fs.exists(p)) {
      return {
        predictions,
        path: p,
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
