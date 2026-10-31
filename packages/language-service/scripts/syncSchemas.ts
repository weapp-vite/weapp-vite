import type { ComponentEntry } from '../src/schema/types.ts'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { jdSources } from './schema/jd.ts'
import { baiduSources, download, kuaishouSources, qqSources, tuyaSources, xhsSources } from './schema/sources.ts'

const platform = process.argv[2]
if (platform !== 'swan' && platform !== 'xhs' && platform !== 'ks' && platform !== 'ty' && platform !== 'qq' && platform !== 'jd') {
  throw new Error('用法：node scripts/syncSchemas.ts <swan|xhs|ks|ty|qq|jd>')
}
const loaders = { swan: baiduSources, xhs: xhsSources, ks: kuaishouSources, ty: tuyaSources, qq: qqSources, jd: () => jdSources(download) }
const sources = await loaders[platform]()
const components: ComponentEntry[] = []
const hash = createHash('sha256')
const cacheDirectory = process.argv[3] === '--cache-dir' ? process.argv[4] : undefined
if (cacheDirectory) {
  await mkdir(cacheDirectory, { recursive: true })
}
async function load(source: typeof sources[number]) {
  const cacheFile = cacheDirectory ? path.join(cacheDirectory, `${createHash('sha256').update(source.url).digest('hex')}.json`) : undefined
  if (cacheFile) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as { component: ComponentEntry, versionInput: string }
      if (cached.component.docLink !== source.url || typeof cached.versionInput !== 'string') {
        throw new Error('组件缓存与官方文档 URL 不匹配')
      }
      return cached
    }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }
  }
  if (platform === 'ks') {
    await setTimeout(1000)
  }
  const result = await source.load()
  if (cacheFile) {
    await writeFile(cacheFile, JSON.stringify(result))
  }
  return result
}
const batchSize = platform === 'ks' ? 1 : 4
for (let cursor = 0; cursor < sources.length; cursor += batchSize) {
  const results = await Promise.all(sources.slice(cursor, cursor + batchSize).map(load))
  for (const result of results) {
    components.push(result.component)
    hash.update(result.versionInput)
  }
  process.stdout.write(`官方组件文档：${platform} ${Math.min(cursor + batchSize, sources.length)}/${sources.length}\n`)
}
components.sort((left, right) => left.name.localeCompare(right.name, 'en'))
const date = new Date().toISOString().slice(0, 10)
const origins = { swan: 'https://smartprogram.baidu.com/docs/develop/component/component/', xhs: 'https://miniapp.xiaohongshu.com/doc/DC563786', ks: 'https://mp.kuaishou.com/docs/develop/frame/buildInComponent.html', ty: 'https://developer.tuya.com/cn/miniapp/develop/miniapp/component/view-container/view', qq: 'https://q.qq.com/wiki/develop/miniprogram/component/', jd: 'https://mp-docs.jd.com/doc/miniapp/dev/component/-1' }
const snapshot = { platform, availability: 'snapshot', version: `sha256:${hash.digest('hex')}`, source: origins[platform], snapshotDate: date, upstreamRetrievedAt: date, components }
await writeFile(new URL(`../src/schema/data/${platform}.json`, import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`)
