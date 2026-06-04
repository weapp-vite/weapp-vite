import { readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'

const BENCHMARK_RESOLVER_FILE = 'benchmark-vant-resolver.ts'
const BENCHMARK_TS_CONFIG_FILES = [
  'tsconfig.json',
  'tsconfig.node.json',
] as const

async function ensureTsconfigIncludes(projectRoot: string, fileName: string, includeEntry: string) {
  const filePath = path.join(projectRoot, fileName)
  const content = await readFile(filePath, 'utf8').catch(() => null)
  if (!content) {
    return
  }

  const parsed = JSON.parse(content) as {
    include?: unknown
  }
  const include = Array.isArray(parsed.include) ? parsed.include.filter((value): value is string => typeof value === 'string') : []
  if (include.includes(includeEntry)) {
    return
  }

  parsed.include = [...include, includeEntry]
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
}

export async function writeBenchmarkResolverFile(projectRoot: string, source: string) {
  await writeFile(path.join(projectRoot, BENCHMARK_RESOLVER_FILE), source, 'utf8')
  await Promise.all(BENCHMARK_TS_CONFIG_FILES.map(fileName => ensureTsconfigIncludes(projectRoot, fileName, BENCHMARK_RESOLVER_FILE)))
}
