import process from 'node:process'
import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs-extra'
import path from 'pathe'

interface ExtractContext {
  entryUrl: string
  baseUrl: string
  html: string
  $: cheerio.CheerioAPI
}

type ExtractResult = string[] | Record<string, string>

interface ExtractorConfig {
  name: 'tdesign' | 'vant' | 'weui'
  entryUrl: string
  baseUrl: string
  outputFile: string
  extract: (ctx: ExtractContext) => Promise<ExtractResult>
}

const client = axios.create({
  headers: {
    'user-agent': 'weapp-vite/auto-import-generator',
    'accept': 'application/vnd.github+json, text/html,application/xhtml+xml,application/xml',
  },
  timeout: 30_000,
})

const jsonDir = path.resolve(
  import.meta.dirname,
  '../packages/weapp-vite/src/auto-import-components/resolvers/json',
)

function sanitizeName(input?: string | null) {
  if (!input) {
    return null
  }
  const name = input.trim().toLowerCase()
  return /^[a-z][a-z0-9-]*$/.test(name) ? name : null
}

function getPayloadSize(payload: ExtractResult) {
  return Array.isArray(payload) ? payload.length : Object.keys(payload).length
}

async function fetchGithubDirectoryNames(params: {
  owner: string
  repo: string
  path: string
  ref: string
  ignore?: Set<string>
}) {
  interface GithubContent {
    name: string
    type: 'file' | 'dir' | 'symlink' | 'submodule'
  }
  const url = `https://api.github.com/repos/${params.owner}/${params.repo}/contents/${params.path}?ref=${params.ref}`
  const { data } = await client.get<GithubContent[]>(url, { responseType: 'json' })
  if (!Array.isArray(data)) {
    throw new TypeError(`Unexpected GitHub response for ${url}`)
  }
  const names = new Set<string>()
  for (const item of data) {
    if (item.type !== 'dir') {
      continue
    }
    const name = sanitizeName(item.name)
    if (name && !params.ignore?.has(name)) {
      names.add(name)
    }
  }
  if (!names.size) {
    throw new Error(`No directories extracted from GitHub path ${params.path}`)
  }
  return names
}

async function fetchHtml(url: string) {
  const { data } = await client.get<string>(url, { responseType: 'text' })
  return data
}

function finalizeNames(names: Set<string>, entryUrl: string) {
  if (!names.size) {
    throw new Error(`Failed to locate component names from ${entryUrl}`)
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

async function writeJsonFile(file: string, payload: ExtractResult) {
  await fs.ensureDir(path.dirname(file))
  await fs.writeJSON(file, payload, { spaces: 2 })
}

const extractors: ExtractorConfig[] = [
  {
    name: 'tdesign',
    entryUrl: 'https://github.com/Tencent/tdesign-miniprogram/tree/develop/packages/components',
    baseUrl: 'https://github.com/Tencent/tdesign-miniprogram',
    outputFile: path.join(jsonDir, 'tdesign.json'),
    async extract(ctx) {
      const names = await fetchGithubDirectoryNames({
        owner: 'Tencent',
        repo: 'tdesign-miniprogram',
        path: 'packages/components',
        ref: 'develop',
        ignore: new Set(['common', 'layout', 'mixins']),
      })
      return finalizeNames(names, ctx.entryUrl)
    },
  },
  {
    name: 'vant',
    entryUrl: 'https://github.com/youzan/vant-weapp/tree/dev/packages',
    baseUrl: 'https://github.com/youzan/vant-weapp',
    outputFile: path.join(jsonDir, 'vant.json'),
    async extract(ctx) {
      const names = await fetchGithubDirectoryNames({
        owner: 'youzan',
        repo: 'vant-weapp',
        path: 'packages',
        ref: 'dev',
        ignore: new Set(['common', 'mixins', 'wxs']),
      })
      return finalizeNames(names, ctx.entryUrl)
    },
  },
  {
    name: 'weui',
    entryUrl: 'https://github.com/wechat-miniprogram/weui-miniprogram/tree/master/src/components',
    baseUrl: 'https://github.com/wechat-miniprogram/weui-miniprogram',
    outputFile: path.join(jsonDir, 'weui.json'),
    async extract(ctx) {
      const names = await fetchGithubDirectoryNames({
        owner: 'wechat-miniprogram',
        repo: 'weui-miniprogram',
        path: 'src/components',
        ref: 'master',
        ignore: new Set(['static', 'utils']),
      })
      return finalizeNames(names, ctx.entryUrl)
    },
  },
]

async function main() {
  for (const extractor of extractors) {
    console.log(`[component-resolvers] fetching ${extractor.entryUrl}`)
    const html = await fetchHtml(extractor.entryUrl)
    const $ = cheerio.load(html)
    const payload = await extractor.extract({
      entryUrl: extractor.entryUrl,
      baseUrl: extractor.baseUrl,
      html,
      $,
    })
    await writeJsonFile(extractor.outputFile, payload)
    console.log(
      `[component-resolvers] ${extractor.name} -> ${path.relative(jsonDir, extractor.outputFile)} (${getPayloadSize(payload)} components)`,
    )
  }
}

main().catch((error) => {
  console.error('[component-resolvers] generation failed')
  console.error(error)
  process.exitCode = 1
})
