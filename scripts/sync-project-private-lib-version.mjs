import fs from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_WEAPP_PRIVATE_LIB_VERSION } from './project-private-config.constants.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const configRootDirs = ['apps', 'templates', 'e2e-apps', 'packages']

/**
 * @description 递归收集 project.private.config.json 文件。
 */
async function collectProjectPrivateConfigFiles(root, currentDir = '') {
  const absoluteCurrentDir = path.join(root, currentDir)
  const entries = await fs.readdir(absoluteCurrentDir, {
    withFileTypes: true,
  })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.pnpm-store') {
        continue
      }

      files.push(...await collectProjectPrivateConfigFiles(root, path.join(currentDir, entry.name)))
      continue
    }

    if (entry.isFile() && entry.name === 'project.private.config.json') {
      files.push(path.join(currentDir, entry.name))
    }
  }

  return files
}

/**
 * @description 同步仓库内所有小程序项目的 project.private.config.json libVersion。
 */
async function main() {
  const filePathGroups = await Promise.all(
    configRootDirs.map(async (dir) => {
      return await collectProjectPrivateConfigFiles(repoRoot, dir)
    }),
  )
  const filePaths = filePathGroups.flat()

  let updatedCount = 0

  for (const relativeFilePath of filePaths) {
    const absoluteFilePath = path.join(repoRoot, relativeFilePath)
    const content = await fs.readFile(absoluteFilePath, 'utf8')
    const json = JSON.parse(content)

    if (json.libVersion === DEFAULT_WEAPP_PRIVATE_LIB_VERSION) {
      continue
    }

    json.libVersion = DEFAULT_WEAPP_PRIVATE_LIB_VERSION
    await fs.writeFile(absoluteFilePath, JSON.stringify(json, null, 2), 'utf8')
    updatedCount += 1
  }

  console.log(`[sync-project-private-lib-version] updated ${updatedCount} files to ${DEFAULT_WEAPP_PRIVATE_LIB_VERSION}`)
}

await main()
