import fs from 'fs-extra'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'
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

/**
 * 从 .vue 文件中提取 <config> 块的内容
 * @param vueFilePath .vue 文件的路径
 * @returns 提取的配置对象，如果不存在或解析失败则返回 undefined
 */
export async function extractConfigFromVue(vueFilePath: string): Promise<Record<string, any> | undefined> {
  try {
    const content = await fs.readFile(vueFilePath, 'utf-8')
    const { descriptor, errors } = parse(content, { filename: vueFilePath })

    if (errors.length > 0) {
      return undefined
    }

    // 查找所有 <config> 块
    const configBlocks = descriptor.customBlocks.filter(block => block.type === 'config')
    if (!configBlocks.length) {
      return undefined
    }

    // 合并所有配置块（如果有多个）
    const mergedConfig: Record<string, any> = {}
    const { parse: parseJson } = await import('comment-json')

    for (const block of configBlocks) {
      try {
        // 判断配置块的语言类型
        const lang = block.lang || 'json'

        if (lang === 'json' || lang === 'json5' || lang === 'jsonc') {
          const config = parseJson(block.content, undefined, true)
          Object.assign(mergedConfig, config)
        }
        // 暂不支持 JS/TS 配置块，因为需要在正确的上下文中执行
      }
      catch {
        // 忽略解析错误
      }
    }

    return Object.keys(mergedConfig).length > 0 ? mergedConfig : undefined
  }
  catch {
    return undefined
  }
}
