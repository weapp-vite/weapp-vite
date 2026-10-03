import type { ScenarioCase, TemplateCase } from '../benchmark-templates-hmr'
import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { mutateJsonMarker } from './jsonMutation'

type Mutation = 'script' | 'template' | 'style' | 'title' | 'component' | 'route' | 'tailwind'
interface DeclaredScenario {
  id: string
  source: string
  output: string
  mutation: Mutation
  target?: string
}

const mutations = new Set<Mutation>(['script', 'template', 'style', 'title', 'component', 'route', 'tailwind'])

function relativeFile(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.includes('\\') && !/^[a-z]:/i.test(value) && !value.split('/').some(part => ['', '.', '..'].includes(part))
}

/** 显式清单只声明可复现的输入类别，不允许执行任意回调或越出隔离工程。 */
export function parseDeclaredScenarios(value: unknown): DeclaredScenario[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('HMR benchmark manifest must contain scenarios')
  }
  const ids = new Set<string>()
  for (const item of value as unknown[]) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid HMR benchmark scenario')
    }
    const row = item as Partial<DeclaredScenario>
    if (typeof row.id !== 'string' || !/^[\w-]+$/.test(row.id) || ids.has(row.id) || !relativeFile(row.source) || !relativeFile(row.output) || !mutations.has(row.mutation as Mutation)) {
      throw new Error('Invalid or duplicate HMR benchmark scenario')
    }
    if ((row.mutation === 'route' || row.mutation === 'component') && !relativeFile(row.target)) {
      throw new Error('Topology scenarios require a relative target')
    }
    ids.add(row.id)
  }
  return value as DeclaredScenario[]
}

function width(marker: string) {
  return 10_000 + Number.parseInt(createHash('sha256').update(marker).digest('hex').slice(0, 5), 16)
}

export function mutateDeclaredSource(row: DeclaredScenario, source: string, marker: string): string {
  if (row.mutation === 'script') {
    return `${source}\nconsole.log('${marker}')\n`
  }
  if (row.mutation === 'template') {
    return `${source}\n<view hidden>${marker}</view>\n`
  }
  if (row.mutation === 'tailwind') {
    return `${source}\n<view class="w-[${width(marker)}px]">${marker}</view>\n`
  }
  if (row.mutation === 'style') {
    return `${source}\n.hmr-${marker} { color: #0f766e; }\n`
  }
  if (row.mutation === 'title') {
    return mutateJsonMarker(source, marker)
  }
  const config = JSON.parse(source) as { pages?: string[], usingComponents?: Record<string, string> }
  if (row.mutation === 'route') {
    config.pages = [...(config.pages ?? []), row.target!]
  }
  else {
    config.usingComponents = { ...config.usingComponents, [marker]: `/${row.target}` }
  }
  return `${JSON.stringify(config, null, 2)}\n`
}

/** 拓扑产物必须整组可达；恢复也须撤销本轮引入的文件，不把首个 JSON 写入视为完成。 */
async function readTopologyOutput(row: DeclaredScenario, outputFile: string, outDir: string) {
  const source = await readFile(outputFile, 'utf8')
  const active = source.includes(row.target!)
  for (const extension of ['js', 'json', 'wxml']) {
    const present = await access(path.join(outDir, `${row.target}.${extension}`)).then(() => true, (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return false
      }
      throw error
    })
    if (present !== active) {
      throw new Error(`Topology output has not settled: ${row.target}.${extension}`)
    }
  }
  return source
}

export async function readDeclaredScenarios(template: TemplateCase): Promise<ScenarioCase[] | undefined> {
  const manifest = await readFile(path.join(template.workspaceRoot, 'hmr-benchmark.json'), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  })
  if (manifest === undefined) {
    return
  }
  const rows = parseDeclaredScenarios(JSON.parse(manifest) as unknown)
  return rows.map((row) => {
    const outputFile = path.join(template.workspaceRoot, 'dist', row.output)
    const topology = row.mutation === 'component' || row.mutation === 'route'
    return {
      id: row.id,
      group: row.mutation === 'script' ? 'native-script' : row.mutation === 'template' ? 'native-template' : row.mutation === 'style' || row.mutation === 'tailwind' ? 'native-style' : 'json',
      label: `${row.id}: ${row.source}`,
      sourceFile: path.join(template.sourceRoot, row.source),
      outputFile,
      outputMarker: row.mutation === 'tailwind' ? marker => `${width(marker)}px` : row.mutation === 'route' ? () => row.target! : undefined,
      mutate: (source, marker) => mutateDeclaredSource(row, source, marker),
      readOutput: topology ? () => readTopologyOutput(row, outputFile, path.join(template.workspaceRoot, 'dist')) : undefined,
    }
  })
}
