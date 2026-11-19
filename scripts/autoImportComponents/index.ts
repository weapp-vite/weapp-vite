import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import axios from 'axios'
import path from 'pathe'

interface ComponentSource {
  name: string
  owner: string
  repo: string
  directory: string
  ref: string
  ignore: string[]
}

const sources: ComponentSource[] = [
  {
    name: 'tdesign',
    owner: 'Tencent',
    repo: 'tdesign-miniprogram',
    directory: 'packages/components',
    ref: 'develop',
    ignore: ['common', 'layout', 'locale', 'mixins'],
  },
  {
    name: 'vant',
    owner: 'youzan',
    repo: 'vant-weapp',
    directory: 'packages',
    ref: 'dev',
    ignore: ['common', 'mixins', 'wxs'],
  },
  {
    name: 'weui',
    owner: 'wechat-miniprogram',
    repo: 'weui-miniprogram',
    directory: 'src/components',
    ref: 'master',
    ignore: ['static', 'utils'],
  },
]

function createGithubClient() {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim()
  if (process.env.GITHUB_ACTIONS === 'true' && !token) {
    throw new Error('GITHUB_TOKEN or GH_TOKEN is required to update components in GitHub Actions')
  }
  return axios.create({
    headers: {
      'user-agent': 'weapp-vite/auto-import-generator',
      'accept': 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 30_000,
  })
}

async function fetchDirectoryNames(client: ReturnType<typeof createGithubClient>, source: ComponentSource) {
  const url = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${source.directory}?ref=${source.ref}`
  let data: unknown
  try {
    ({ data } = await client.get<unknown>(url, { responseType: 'json' }))
  }
  catch (error) {
    // Axios 错误携带请求配置和认证头，只保留可公开的状态与固定诊断。
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const rateLimited = status === 429 || error.response?.headers['x-ratelimit-remaining'] === '0'
      const hint = rateLimited
        ? ' Rate limit exceeded; configure GITHUB_TOKEN or GH_TOKEN and retry after the quota resets.'
        : ''
      throw new Error(`GitHub API request failed for ${url} (${status ?? 'network error'}).${hint}`)
    }
    throw error
  }
  if (!Array.isArray(data)) {
    throw new TypeError(`Unexpected GitHub response for ${url}`)
  }
  const names = new Set<string>()
  for (const item of data as unknown[]) {
    if (!item || typeof item !== 'object'
      || !('name' in item) || typeof item.name !== 'string'
      || !('type' in item) || typeof item.type !== 'string') {
      throw new TypeError(`Unexpected GitHub directory entry for ${url}`)
    }
    if (item.type !== 'dir') {
      continue
    }
    const name = item.name.trim().toLowerCase()
    if (/^[a-z][a-z0-9-]*$/.test(name) && !source.ignore.includes(name)) {
      names.add(name)
    }
  }
  if (!names.size) {
    throw new Error(`No directories extracted from GitHub path ${source.directory}`)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** 只请求 GitHub API，完整获取并校验三份清单后才写入生成文件。 */
export async function updateAutoImportComponents(options: {
  outputDir: string
  log?: (message: string) => void
}) {
  const log = options.log ?? console.log
  const client = createGithubClient()
  const results = []
  for (const source of sources) {
    log(`[component-resolvers] fetching ${source.owner}/${source.repo}/${source.directory} (${source.ref})`)
    const names = await fetchDirectoryNames(client, source)
    results.push({ source, names })
  }
  await mkdir(options.outputDir, { recursive: true })
  for (const { source, names } of results) {
    const fileName = `${source.name}.json`
    await writeFile(path.join(options.outputDir, fileName), JSON.stringify(names, null, 2))
    log(`[component-resolvers] ${source.name} -> ${fileName} (${names.length} components)`)
  }
}
