import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

interface SourceComponent {
  name: string
  docLink: string
  attrs?: unknown[]
  desc?: string[]
}

const platforms = ['weapp', 'alipay', 'tt'] as const
const root = new URL('../../../', import.meta.url)
const output = new URL('../src/schema/data/', import.meta.url)
const snapshotDate = '2026-10-30'
await mkdir(output, { recursive: true })

for (const platform of platforms) {
  const source = `packages-runtime/wevu/components.${platform}.json`
  const bytes = await readFile(new URL(source, root), 'utf8')
  const catalog = JSON.parse(bytes) as SourceComponent[]
  if (!Array.isArray(catalog) || catalog.some(component => typeof component.name !== 'string' || !/^https:\/\//.test(component.docLink))) {
    throw new Error(`无效的平台组件来源：${source}`)
  }
  const snapshot = {
    platform,
    availability: 'snapshot',
    version: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    source,
    snapshotDate,
    upstreamRetrievedAt: null,
    components: catalog.map(component => ({ name: component.name, docLink: component.docLink, ...(component.desc ? { desc: component.desc } : {}), attrs: component.attrs ?? [] })),
  }
  await writeFile(new URL(`${platform}.json`, output), `${JSON.stringify(snapshot, null, 2)}\n`)
  process.stdout.write(`语言组件资产：${platform}，${catalog.length} 项，${fileURLToPath(new URL(`${platform}.json`, output)).split('/').at(-1)}\n`)
}
