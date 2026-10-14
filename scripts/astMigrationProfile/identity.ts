import type { ProfileCase } from './types'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { exec } from 'tinyexec'
import { uniqueProfileProjects } from './preparationPlan'
import { sha256 } from './results'

const nativeNames: Record<string, string> = {
  'darwin:arm64': 'darwin-arm64',
  'darwin:x64': 'darwin-x64',
  'linux:x64': 'linux-x64-gnu',
  'linux:arm64': 'linux-arm64-gnu',
  'win32:x64': 'win32-x64-msvc',
  'win32:arm64': 'win32-arm64-msvc',
}

export function defaultAddonPath(root: string) {
  const platform = nativeNames[`${process.platform}:${process.arch}`]
  if (!platform) {
    throw new Error('Unsupported native platform; supply --addon=<release.node>.')
  }
  return path.join(root, 'packages/ast-native', `weapp_vite_ast_native.${platform}.node`)
}

export async function hashFile(filename: string) {
  return sha256(await readFile(filename))
}

async function listFiles(root: string, relative: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (['node_modules', '.tmp', '.git', '.weapp-vite', 'target', '.turbo'].includes(entry.name)) {
      continue
    }
    const name = path.posix.join(relative.replaceAll('\\', '/'), entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, name))
    }
    else if (entry.isFile()) {
      files.push(name)
    }
  }
  return files
}

export async function freezeSourceIdentity(root: string, cases: readonly ProfileCase[]) {
  const tracked = (await exec('git', ['ls-files', '-z'], { nodeOptions: { cwd: root }, throwOnError: true })).stdout.split('\0').filter(Boolean)
  const inputs = tracked.filter(file => ['packages-runtime/wevu-compiler/', 'packages/ast/', 'packages/weapp-vite/src/', 'packages/ast-native/', '@weapp-core/'].some(prefix => file.startsWith(prefix))
    || cases.some(fixture => file.startsWith(`${fixture.project}/`)))
  inputs.push('pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'scripts/ast-migration-profile.ts', ...await listFiles(root, 'scripts/astMigrationProfile'))
  const sourceHashes: Record<string, string> = {}
  for (const file of [...new Set(inputs)].sort()) {
    sourceHashes[file] = await hashFile(path.join(root, file))
  }
  return {
    commit: (await exec('git', ['rev-parse', 'HEAD'], { nodeOptions: { cwd: root }, throwOnError: true })).stdout.trim(),
    sourceHashes,
    sourceDigest: sha256(JSON.stringify(sourceHashes)),
  }
}

/** 冻结真实配置读取的生成支持文件；缺少 app tsconfig 时不接受旧回执。 */
export async function freezeProjectSupportArtifacts(root: string, cases: readonly ProfileCase[]) {
  const hashes: Record<string, string> = {}
  for (const { project } of uniqueProfileProjects(cases)) {
    const directory = `${project}/.weapp-vite`
    const files = await listFiles(root, directory)
    if (!files.includes(`${directory}/tsconfig.app.json`)) {
      throw new Error(`Project support files are required; run built CLI prepare: ${project}`)
    }
    for (const file of files.sort()) {
      hashes[file] = await hashFile(path.join(root, file))
    }
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      const file = `${project}/${name}`
      try {
        hashes[file] = await hashFile(path.join(root, file))
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    }
  }
  return hashes
}

export async function freezeIdentity(root: string, cases: readonly ProfileCase[], addon: string) {
  const source = await freezeSourceIdentity(root, cases)
  const artifactHashes: Record<string, string> = await freezeProjectSupportArtifacts(root, cases)
  for (const top of ['packages', 'packages-runtime', '@weapp-core']) {
    for (const entry of await readdir(path.join(root, top), { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }
      try {
        for (const file of await listFiles(root, `${top}/${entry.name}/dist`)) {
          artifactHashes[file] = await hashFile(path.join(root, file))
        }
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    }
  }
  const compilerEntry = 'packages-runtime/wevu-compiler/dist/index.mjs'
  if (!artifactHashes[compilerEntry] || !artifactHashes['packages/ast/dist/index.mjs'] || !artifactHashes['packages/weapp-vite/dist/config.mjs']) {
    throw new Error('Fresh package artifacts are required; run the documented prepare command first.')
  }
  artifactHashes['<release-addon>'] = await hashFile(addon)
  return {
    ...source,
    artifactHashes,
    artifactDigest: sha256(JSON.stringify(artifactHashes)),
  }
}

export type FrozenIdentity = Awaited<ReturnType<typeof freezeIdentity>>

export async function assertFrozenIdentity(root: string, cases: readonly ProfileCase[], addon: string, frozen: FrozenIdentity) {
  const current = await freezeIdentity(root, cases, addon)
  if (JSON.stringify(current) !== JSON.stringify(frozen)) {
    throw new Error('Profile source, dependency, built entry, addon or commit identity changed; collection rejected.')
  }
}
