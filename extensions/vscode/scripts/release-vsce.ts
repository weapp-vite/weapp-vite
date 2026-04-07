import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const extensionRoot = process.cwd()
const packageJsonPath = path.join(extensionRoot, 'package.json')
const artifactDir = path.join(extensionRoot, '.artifacts')
const outputPath = path.join(artifactDir, 'weapp-vite.vsix')
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const mode = process.argv[2] ?? 'package'
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

/**
 * @param {string[]} args
 */
function runVsce(args) {
  const result = spawnSync(
    npxCommand,
    ['@vscode/vsce', ...args],
    {
      cwd: extensionRoot,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    },
  )

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

  if (typeof packageJson.publisher !== 'string' || packageJson.publisher.length === 0) {
    throw new Error('package.json publisher is required for publish mode')
  }

  runVsce(['publish', '--pat', process.env.VSCE_PAT])
  process.exit(0)
}

throw new Error(`unknown release mode: ${mode}`)
