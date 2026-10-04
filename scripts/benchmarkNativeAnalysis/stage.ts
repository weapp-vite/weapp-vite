import type { Input, Options } from './contract'
import { cp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { acceptanceInputManifest } from '../benchmarkTemplatesHmr/acceptanceRunner'
import { sha256 } from './artifacts'
import { INPUTS } from './contract'

const ignored = new Set(['node_modules', 'dist', 'dist-lib', 'dist-plugin', '.git', '.weapp-vite', '.turbo', '.tmp'])

/** 两侧复用相同隔离路径，避免临时目录差异污染 sourcemap 和打包注释。 */
export async function stageInput(options: Options, input: Input) {
  const owned = path.join(options.output, '.workspace')
  const project = path.join(owned, 'input', input.id)
  await rm(owned, { recursive: true, force: true })
  await mkdir(path.dirname(project), { recursive: true })
  const source = path.join(options.root, input.source)
  await cp(source, project, { recursive: true, filter: file => !path.relative(source, file).split(path.sep).some(part => ignored.has(part)) })
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  const modules = await realpath(path.join(options.root, input.dependencies, 'node_modules'))
  await symlink(modules, path.join(project, 'node_modules'), linkType)
  // input 与 HMR 副本保持模板原有的两层目录深度，供插件继续解析根目录的 pnpm 路径。
  const rootModules = await realpath(path.join(options.root, 'node_modules'))
  await symlink(rootModules, path.join(owned, 'node_modules'), linkType)
  const require = createRequire(path.join(project, 'package.json'))
  if (await realpath(require.resolve('weapp-vite/package.json')) !== await realpath(path.join(options.root, 'packages/weapp-vite/package.json'))) {
    throw new Error('Benchmark fixture resolves weapp-vite outside its frozen checkout')
  }
  const sourceDigest = sha256(JSON.stringify(await acceptanceInputManifest(project)))
  if (sourceDigest !== options.inputIdentities?.[input.source]) {
    throw new Error('Fixture copy differs from the initially frozen source manifest')
  }
  const config = path.join(project, 'weapp-vite.config.ts')
  await writeFile(path.join(project, 'native-benchmark-original.config.ts'), await readFile(config))
  await writeFile(config, `import original from './native-benchmark-original.config.ts'
export default async (env) => {
  const config = await (typeof original === 'function' ? original(env) : original)
  return { ...config, build: { ...config.build, sourcemap: true } }
}
`)
  const manifest = await acceptanceInputManifest(project)
  return { owned, project, sourceDigest, inputDigest: sha256(JSON.stringify(manifest)), manifest }
}

/** 源码、发布入口和锁文件均冻结；构建缓存不作为源码输入。 */
export async function captureIdentity(options: Options) {
  const roots = ['packages/ast', 'packages/ast-native', 'packages/weapp-vite', 'packages-runtime/wevu-compiler', 'packages-runtime/wevu', '@weapp-core/constants']
  const identities: Record<string, string> = {}
  for (const relative of roots) {
    const root = path.join(options.root, relative)
    const manifest = await acceptanceInputManifest(path.join(root, 'src'))
    identities[relative] = sha256(JSON.stringify(manifest))
    if (!relative.endsWith('ast-native')) {
      identities[`${relative}/dist`] = sha256(JSON.stringify(await acceptanceInputManifest(path.join(root, 'dist'))))
    }
  }
  for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json']) {
    identities[file] = sha256(await readFile(path.join(options.root, file)))
  }
  identities.driver = sha256(JSON.stringify(await acceptanceInputManifest(path.join(options.root, 'scripts'))))
  identities.devUtilities = sha256(JSON.stringify(await acceptanceInputManifest(path.join(options.root, 'e2e/utils'))))
  for (const input of INPUTS) {
    identities[input.source] = sha256(JSON.stringify(await acceptanceInputManifest(path.join(options.root, input.source))))
  }
  return identities
}
