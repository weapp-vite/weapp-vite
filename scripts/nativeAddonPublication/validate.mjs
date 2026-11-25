import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getNativeTarget, getNativeTargetForRuntime, nativeTargets } from './targets.mjs'

const defaultRepositoryRoot = fileURLToPath(new URL('../../', import.meta.url))

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function validateTarget(repositoryRoot, target, version, requireBinary) {
  const packagePath = path.join(repositoryRoot, target.packageDirectory, 'package.json')
  const manifest = await readJson(packagePath)
  if (manifest.name !== target.packageName || manifest.version !== version) {
    throw new Error(`Platform package ${target.id} must match root version ${version}`)
  }
  if (manifest.main !== `./${target.binaryName}`
    || JSON.stringify(manifest.files) !== JSON.stringify([target.binaryName])
    || JSON.stringify(manifest.os) !== JSON.stringify([target.platform])
    || JSON.stringify(manifest.cpu) !== JSON.stringify([target.arch])) {
    throw new Error(`Platform package ${target.id} has invalid target metadata`)
  }
  if (target.libc && JSON.stringify(manifest.libc) !== JSON.stringify([target.libc])) {
    throw new Error(`Platform package ${target.id} must declare ${target.libc} libc metadata`)
  }
  if (!target.libc && Object.hasOwn(manifest, 'libc')) {
    throw new Error(`Platform package ${target.id} must not declare libc metadata`)
  }
  if (requireBinary) {
    await access(path.join(repositoryRoot, target.packageDirectory, target.binaryName))
  }
}

export async function validateNativePublication({ requireBinaries = false, targetId, assertRuntime = false, root } = {}) {
  const repositoryRoot = path.resolve(root ?? defaultRepositoryRoot)
  const rootPackagePath = path.join(repositoryRoot, 'packages/ast-native/package.json')
  const rootPackage = await readJson(rootPackagePath)
  const version = rootPackage.version
  const expectedDependencies = Object.fromEntries(nativeTargets.map(target => [target.packageName, 'workspace:*']))
  if (JSON.stringify(rootPackage.optionalDependencies) !== JSON.stringify(expectedDependencies)) {
    throw new Error('Root ast-native optionalDependencies do not match the supported targets')
  }
  if (rootPackage.files?.includes('*.node')) {
    throw new Error('Root ast-native package must not publish native binaries')
  }
  const targets = targetId ? [getNativeTarget(targetId)] : nativeTargets
  if (assertRuntime) {
    const runtimeTarget = getNativeTargetForRuntime()
    if (targets.length !== 1 || targets[0].id !== runtimeTarget.id) {
      throw new Error(`Native target ${targets[0]?.id ?? 'all'} does not match executing runtime ${runtimeTarget.id}`)
    }
  }
  for (const target of targets) {
    await validateTarget(repositoryRoot, target, version, requireBinaries)
  }
  return { version, targets: targets.map(target => target.id) }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = new Set(process.argv.slice(2))
  const targetArg = process.argv.slice(2).find(argument => argument.startsWith('--target='))
  const rootArg = process.argv.slice(2).find(argument => argument.startsWith('--root='))
  const result = await validateNativePublication({
    requireBinaries: args.has('--require-binaries'),
    assertRuntime: args.has('--assert-runtime'),
    targetId: targetArg?.slice('--target='.length),
    root: rootArg?.slice('--root='.length),
  })
  process.stdout.write(`Validated native publication targets: ${result.targets.join(', ')}\n`)
}
