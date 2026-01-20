import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const pkgDir = path.resolve(scriptDir, '..')
const cacheDir = path.join(pkgDir, '.cache', 'vue-types')
const require = createRequire(import.meta.url)

function resolveDistFile(pkgName, fileName) {
  const pkgJson = require.resolve(`${pkgName}/package.json`)
  return path.resolve(path.dirname(pkgJson), 'dist', fileName)
}

const sourceFiles = [
  {
    name: 'shared.d.ts',
    path: resolveDistFile('@vue/shared', 'shared.d.ts'),
  },
  {
    name: 'reactivity.d.ts',
    path: resolveDistFile('@vue/reactivity', 'reactivity.d.ts'),
  },
  {
    name: 'runtime-core.d.ts',
    path: resolveDistFile('@vue/runtime-core', 'runtime-core.d.ts'),
  },
]

const entryFile = path.join(cacheDir, 'entry.ts')

const replacements = [
  ['@vue/shared', './shared'],
  ['@vue/reactivity', './reactivity'],
]

await mkdir(cacheDir, { recursive: true })

for (const file of sourceFiles) {
  const content = await readFile(file.path, 'utf8')
  let next = content
  for (const [from, to] of replacements) {
    next = next.replaceAll(from, to)
  }
  await writeFile(path.join(cacheDir, file.name), next)
}

const entryContent = `export type { Ref, ShallowRef } from './reactivity'
export type {
  AllowedComponentProps,
  ComponentCustomProps,
  ComponentOptionsMixin,
  DefineComponent,
  ObjectDirective,
  PublicProps,
  ShallowUnwrapRef,
  VNode,
  VNodeProps,
} from './runtime-core'
`

await writeFile(entryFile, entryContent)
