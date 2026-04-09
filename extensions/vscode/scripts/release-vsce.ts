import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const extensionRoot = process.cwd()
const packageJsonPath = path.join(extensionRoot, 'package.json')
const artifactDir = path.join(extensionRoot, '.artifacts')
const outputPath = path.join(artifactDir, 'weapp-vite.vsix')
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const mode = process.argv[2] ?? 'package'
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const publishManifest = {
  ...packageJson,
  name: packageJson['x-vsce']?.name ?? packageJson.name,
  displayName: packageJson['x-vsce']?.displayName ?? packageJson.displayName,
}

/**
 * 复制扩展目录到临时发布目录，并重写最终提交给 Marketplace 的 manifest。
 */
function createPublishDirectory() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-vsce-'))
  const publishRoot = path.join(tempRoot, 'extension')

  fs.cpSync(extensionRoot, publishRoot, {
    recursive: true,
    filter(source) {
      const relativePath = path.relative(extensionRoot, source)

      if (!relativePath) {
        return true
      }

      if ([
        '.artifacts',
        '.turbo',
        'node_modules',
      ].includes(relativePath)) {
        return false
      }

      return !relativePath.startsWith(`node_modules${path.sep}`)
        && !relativePath.startsWith(`.artifacts${path.sep}`)
        && !relativePath.startsWith(`.turbo${path.sep}`)
    },
  })

  fs.writeFileSync(path.join(publishRoot, 'package.json'), `${JSON.stringify(publishManifest, null, 2)}\n`)

  return {
    publishRoot,
    tempRoot,
  }
}

/**
 * @param {string[]} args
 */
function runVsce(args) {
  const { publishRoot, tempRoot } = createPublishDirectory()
  const result = spawnSync(
    npxCommand,
    ['@vscode/vsce', ...args],
    {
      cwd: publishRoot,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    },
  )

  fs.rmSync(tempRoot, { recursive: true, force: true })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

fs.mkdirSync(artifactDir, { recursive: true })

if (mode === 'package') {
  runVsce(['package', '--out', outputPath])
  console.log(`vsix created: ${outputPath}`)
  process.exit(0)
}

if (mode === 'publish') {
  if (!process.env.VSCE_PAT) {
    throw new Error('VSCE_PAT is required for publish mode')
  }

  if (typeof publishManifest.publisher !== 'string' || publishManifest.publisher.length === 0) {
    throw new Error('package.json publisher is required for publish mode')
  }

  runVsce(['publish', '--pat', process.env.VSCE_PAT])
  process.exit(0)
}

throw new Error(`unknown release mode: ${mode}`)
