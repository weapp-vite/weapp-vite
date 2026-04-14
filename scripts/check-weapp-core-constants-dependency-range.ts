import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const CONSTANTS_PACKAGE_NAME = '@weapp-core/constants'
const EXPECTED_SPEC = 'workspace:^'
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const

async function collectPackageJsonFiles(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectPackageJsonFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name === 'package.json') {
      files.push(fullPath)
    }
  }

  return files
}

async function main() {
  const packageJsonFiles = (
    await Promise.all([
      collectPackageJsonFiles('packages'),
      collectPackageJsonFiles('packages-runtime'),
      collectPackageJsonFiles('@weapp-core'),
    ])
  ).flat()

  const violations: string[] = []

  for (const file of packageJsonFiles) {
    const content = await fs.readFile(file, 'utf8')
    const packageJson = JSON.parse(content) as {
      name?: string
      private?: boolean
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }

    if (packageJson.private) {
      continue
    }

    for (const section of sections) {
      const deps = packageJson[section]
      const spec = deps?.[CONSTANTS_PACKAGE_NAME]
      if (!spec) {
        continue
      }
      if (spec !== EXPECTED_SPEC) {
        violations.push(`${path.normalize(file)} -> ${section}.${CONSTANTS_PACKAGE_NAME}=${spec}`)
      }
    }
  }

  if (violations.length > 0) {
    console.error(`Expected ${CONSTANTS_PACKAGE_NAME} to use ${EXPECTED_SPEC} in public package manifests:`)
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exitCode = 1
  }
}

await main()
