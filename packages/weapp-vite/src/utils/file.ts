import fs from 'fs-extra'
import { recursive as mergeRecursive } from 'merge'
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
    if (await fs.pathExists(p)) {
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
    if (await fs.pathExists(p)) {
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
    if (await fs.pathExists(p)) {
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
    if (await fs.pathExists(p)) {
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
    if (await fs.pathExists(p)) {
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
 * 从 .vue 文件中提取 <json> 块的内容
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

    // 合并所有配置块（如果有多个）
    const mergedConfig: Record<string, any> = {}
    const { parse: parseJson } = await import('comment-json')

    // 1) <json> 自定义块（历史兼容）
    const jsonBlocks = descriptor.customBlocks.filter(block => block.type === 'json')
    for (const block of jsonBlocks) {
      try {
        // 默认（不写 lang）即为 json，且支持注释（comment-json）
        const lang = (block.lang || 'json').toLowerCase()
        if (lang === 'json' || lang === 'jsonc' || lang === 'json5' || lang === 'txt') {
          const config = parseJson(block.content, undefined, true)
          if (config && typeof config === 'object' && !Array.isArray(config)) {
            Object.assign(mergedConfig, config)
          }
          continue
        }
      }
      catch {
        // 忽略解析错误
      }
    }

    // 2) <script setup> JSON 宏：defineAppJson / definePageJson / defineComponentJson
    // 注意：这些宏是 build-time 的，需要在 Node.js 侧执行一次来得到配置对象。
    const setupContent = descriptor.scriptSetup?.content
    const hasMacroHint = typeof setupContent === 'string'
      && /\bdefine(?:App|Page|Component)Json\s*\(/.test(setupContent)

    if (hasMacroHint) {
      const { extractJsonMacroFromScriptSetup } = await import('../plugins/vue/transform/jsonMacros')
      try {
        const extracted = await extractJsonMacroFromScriptSetup(
          setupContent!,
          vueFilePath,
          descriptor.scriptSetup?.lang,
        )
        if (extracted.config && typeof extracted.config === 'object' && !Array.isArray(extracted.config)) {
          mergeRecursive(mergedConfig, extracted.config)
        }
      }
      catch (error) {
        // 如果这个 .vue 里确实在用宏，但解析/执行失败，优先暴露错误（否则会误报“找不到 app.json/app.vue”）
        if (jsonBlocks.length === 0) {
          throw error
        }
      }
    }

    return Object.keys(mergedConfig).length > 0 ? mergedConfig : undefined
  }
  catch {
    return undefined
  }
}
