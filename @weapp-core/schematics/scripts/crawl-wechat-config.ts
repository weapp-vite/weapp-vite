import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import * as cheerio from 'cheerio'
import path from 'pathe'

export interface CrawledField {
  'type': string
  'required'?: boolean
  'default'?: unknown
  'description'?: string
  'x-wechat-min-version'?: string
}

export interface CrawledConfig {
  source: string
  fields: Record<string, CrawledField>
}

export const WECHAT_CONFIG_URLS = {
  app: 'https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html',
  page: 'https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/page.html',
} as const

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function parseRequired(value: string) {
  return /^(?:是|必填|required)$/i.test(cleanText(value))
}

function parseType(value: string) {
  return cleanText(value)
    .replace(/\s*或\s*/g, ' | ')
    .replace(/Object\[\]/g, 'object[]')
    .replace(/string\[\]/g, 'string[]')
    .replace(/boolean/g, 'boolean')
    .replace(/number/g, 'number')
    .replace(/string/gi, 'string')
    .replace(/Object/g, 'object')
}

function parseVersion(value: string) {
  const match = cleanText(value).match(/(?:基础库|客户端|开发者工具|iOS\/Android|Windows\/Mac)[^'\d]*['"]?(\d+(?:\.\d+)*)/i)
    ?? cleanText(value).match(/['"](\d+(?:\.\d+)*)['"]/)
  return match?.[1]
}

function parseDefault(value: string | undefined, type: string) {
  if (!value) {
    return undefined
  }
  const clean = cleanText(value)
  if (/^(?:否|无|none)$/i.test(clean)) {
    return undefined
  }
  if (type === 'boolean' && /^(?:true|false)$/i.test(clean)) {
    return clean.toLowerCase() === 'true'
  }
  if (type === 'number' && /^\d+(?:\.\d+)?$/.test(clean)) {
    return Number(clean)
  }
  return clean
}

export function parseWechatConfigHtml(html: string, source: string): CrawledConfig {
  const $ = cheerio.load(html)
  const fields: Record<string, CrawledField> = {}
  let parsedTables = 0

  const table = $('table').filter((_, node) => {
    const headers = $(node).find('thead th').map((__, header) => cleanText($(header).text())).get()
    return headers.some(header => /属性|字段|名称/.test(header))
  }).first()
  if (!table.length) {
    throw new Error(`未能从微信配置文档解析出配置主表：${source}`)
  }

  table.each((_, tableNode) => {
    const table = $(tableNode)
    const headers = $(table).find('thead th').map((__, node) => cleanText($(node).text())).get()
    const nameIndex = headers.findIndex(header => /属性|字段|名称/.test(header))
    if (nameIndex < 0) {
      return
    }
    const typeIndex = headers.findIndex(header => /类型/.test(header))
    const requiredIndex = headers.findIndex(header => /必填/.test(header))
    const defaultIndex = headers.findIndex(header => /默认值/.test(header))
    const descriptionIndex = headers.findIndex(header => /描述|说明/.test(header))
    const versionIndex = headers.findIndex(header => /最低版本/.test(header))

    $(table).find('tbody tr').each((__, row) => {
      const cells = $(row).find('td').map((___, cell) => cleanText($(cell).text())).get()
      const name = cells[nameIndex]
      if (!name || !/^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i.test(name)) {
        return
      }
      const field: CrawledField = {
        type: parseType(cells[typeIndex] ?? 'object'),
      }
      if (requiredIndex >= 0 && parseRequired(cells[requiredIndex] ?? '')) {
        field.required = true
      }
      if (defaultIndex >= 0 && cells[defaultIndex]) {
        field.default = parseDefault(cells[defaultIndex], field.type)
      }
      if (descriptionIndex >= 0 && cells[descriptionIndex]) {
        field.description = cells[descriptionIndex]
      }
      if (versionIndex >= 0) {
        const version = parseVersion(cells[versionIndex] ?? '')
        if (version) {
          field['x-wechat-min-version'] = version
        }
      }
      fields[name] = field
    })
    parsedTables++
  })

  if (!parsedTables || !Object.keys(fields).length) {
    throw new Error(`未能从微信配置文档解析出字段：${source}`)
  }
  return { source, fields }
}

async function fetchConfig(name: keyof typeof WECHAT_CONFIG_URLS) {
  const source = WECHAT_CONFIG_URLS[name]
  const response = await fetch(source)
  if (!response.ok) {
    throw new Error(`获取微信配置文档失败：${source} (${response.status})`)
  }
  return parseWechatConfigHtml(await response.text(), source)
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  const names = process.argv.slice(2).filter(arg => !arg.startsWith('--')) as (keyof typeof WECHAT_CONFIG_URLS)[]
  const targets = names.length ? names : Object.keys(WECHAT_CONFIG_URLS) as (keyof typeof WECHAT_CONFIG_URLS)[]
  const configDir = path.resolve(import.meta.dirname, 'config')
  for (const name of targets) {
    const result = await fetchConfig(name)
    const target = path.join(configDir, `${name}.json`)
    const current = JSON.parse(await fs.readFile(target, 'utf8')) as CrawledConfig
    const missing = Object.keys(result.fields).filter(field => !current.fields[field])
    const stale = Object.keys(current.fields).filter(field => !result.fields[field])
    if (checkOnly) {
      if (missing.length || stale.length) {
        console.log(`${name}: 新增 ${missing.join(', ') || '无'}；本地独有 ${stale.join(', ') || '无'}`)
      }
      continue
    }
    await fs.outputFile(target, `${JSON.stringify({ ...current, source: result.source, fields: { ...result.fields, ...current.fields } }, null, 2)}\n`, 'utf8')
    console.log(`${name}: 已更新 ${target}`)
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
