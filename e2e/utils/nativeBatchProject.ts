import { cp, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renameAtomicFile } from './hmrAtomicRename'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const NATIVE_BATCH_CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
export const NATIVE_BATCH_EXTENSIONS = ['js', 'wxml', 'wxss', 'json'] as const

export async function createNativeBatchProject(runtime: 'classic' | 'stateful-experimental') {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'native-batch-'))
  await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-1134-native-batch'), project, { recursive: true })
  await mkdir(path.join(project, 'node_modules'))
  await symlink(await realpath(path.join(ROOT, 'packages/weapp-vite')), path.join(project, 'node_modules/weapp-vite'), 'junction')
  const config = path.join(project, 'weapp-vite.config.ts')
  await writeFile(config, (await readFile(config, 'utf8')).replace('runtime: \'classic\'', `runtime: '${runtime}'`))
  return project
}

export async function readNativeBatchSources(project: string) {
  return Object.fromEntries(await Promise.all(NATIVE_BATCH_EXTENSIONS.map(async extension => [
    extension,
    await readFile(path.join(project, `src/pages/index/index.${extension}`), 'utf8'),
  ]))) as Record<typeof NATIVE_BATCH_EXTENSIONS[number], string>
}

export const NATIVE_BATCH_STEPS = [
  { marker: 'BATCH_BASE', color: '#112233', computed: 'rgb(17, 34, 51)' },
  { marker: 'BATCH_FIRST', color: '#223344', computed: 'rgb(34, 51, 68)' },
  { marker: 'BATCH_NEXT', color: '#334455', computed: 'rgb(51, 68, 85)' },
  { marker: 'BATCH_BASE', color: '#112233', computed: 'rgb(17, 34, 51)' },
] as const

export async function writeNativeBatch(
  project: string,
  source: Awaited<ReturnType<typeof readNativeBatchSources>>,
  step: typeof NATIVE_BATCH_STEPS[number],
  reverse: boolean,
) {
  const extensions = reverse ? [...NATIVE_BATCH_EXTENSIONS].reverse() : NATIVE_BATCH_EXTENSIONS
  // 同一轮每个文件仅保存一次，失败时不补写源码触发额外刷新。
  for (const extension of extensions) {
    const file = path.join(project, `src/pages/index/index.${extension}`)
    const pending = `${file}.tmp`
    await writeFile(pending, source[extension].replaceAll('BATCH_BASE', step.marker).replace(/color: #[\da-f]+/i, `color: ${step.color}`))
    await renameAtomicFile(pending, file)
  }
}

export async function readNativeBatchOutput(project: string, marker: string) {
  return Object.fromEntries(await Promise.all(NATIVE_BATCH_EXTENSIONS.map(async extension => [
    extension,
    (await readFile(path.join(project, `dist/pages/index/index.${extension}`), 'utf8')).includes(marker),
  ])))
}
