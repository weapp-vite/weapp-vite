import { access, copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getNativeTarget, getNativeTargetForRuntime } from './targets.mjs'

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))

export async function stageNativeAddon(targetId, sourcePath) {
  const target = targetId ? getNativeTarget(targetId) : getNativeTargetForRuntime()
  const source = sourcePath
    ? path.resolve(sourcePath)
    : path.join(repositoryRoot, 'packages/ast-native', target.binaryName)
  const destination = path.join(repositoryRoot, target.packageDirectory, target.binaryName)
  await access(source)
  await mkdir(path.dirname(destination), { recursive: true })
  await copyFile(source, destination)
  return destination
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const targetArg = process.argv.slice(2).find(argument => argument.startsWith('--target='))
  const sourceArg = process.argv.slice(2).find(argument => argument.startsWith('--source='))
  const destination = await stageNativeAddon(targetArg?.slice('--target='.length), sourceArg?.slice('--source='.length))
  process.stdout.write(`Staged native addon: ${path.relative(repositoryRoot, destination)}\n`)
}
