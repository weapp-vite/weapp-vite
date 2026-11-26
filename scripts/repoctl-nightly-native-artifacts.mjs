import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import { releaseNightly } from 'repoctl'
import { nativeTargets } from './nativeAddonPublication/targets.mjs'

const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** 将 workflow 下载的 native 二进制复制进 repoctl 的 Git archive，并登记逐文件哈希。 */
export async function prepareNativeArtifacts(sourceRoot, context) {
  const files = []
  for (const target of nativeTargets) {
    const relativePath = path.posix.join(target.packageDirectory, target.binaryName)
    const sourcePath = path.join(sourceRoot, ...relativePath.split('/'))
    const bytes = await readFile(sourcePath)
    const destinationPath = path.join(context.directory, ...relativePath.split('/'))
    await mkdir(path.dirname(destinationPath), { recursive: true })
    await copyFile(sourcePath, destinationPath)
    files.push({ path: relativePath, sha256: sha256(bytes) })
  }
  return {
    files,
    metadata: {
      source: 'release.yml native-addon-build artifacts',
      targets: nativeTargets.map(target => target.id).join(','),
    },
  }
}

function optionValue(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.includes('--publish')) {
    throw new Error('Nightly native artifact entry requires --publish.')
  }
  const configPath = path.join(repositoryRoot, 'repoctl.config.ts')
  const configModule = await createJiti(import.meta.url).import(configPath, { default: true })
  const config = configModule.commands?.release
  if (!config) {
    throw new Error('repoctl release configuration is missing.')
  }
  const report = await releaseNightly({
    cwd: repositoryRoot,
    config,
    publish: true,
    dryRun: args.includes('--dry-run'),
    outputDirectory: optionValue(args, '--output'),
    prepareSource: context => prepareNativeArtifacts(repositoryRoot, context),
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (report.status === 'failed') {
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
