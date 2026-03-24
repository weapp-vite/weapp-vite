import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { DEFAULT_WEAPP_PRIVATE_LIB_VERSION } from './project-private-config.constants.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')

/**
 * @description 同步仓库内所有小程序项目的 project.private.config.json libVersion。
 */
async function main() {
  const filePaths = await fg([
    'apps/**/project.private.config.json',
    'templates/**/project.private.config.json',
    'e2e-apps/**/project.private.config.json',
    'packages/**/project.private.config.json',
  ], {
    cwd: repoRoot,
    dot: true,
    followSymbolicLinks: false,
    onlyFiles: true,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.pnpm-store/**',
    ],
  })

  let updatedCount = 0

  for (const relativeFilePath of filePaths) {
    const absoluteFilePath = path.join(repoRoot, relativeFilePath)
    const content = await fs.readFile(absoluteFilePath, 'utf8')
    const json = JSON.parse(content)

    if (json.libVersion === DEFAULT_WEAPP_PRIVATE_LIB_VERSION) {
      continue
    }

    json.libVersion = DEFAULT_WEAPP_PRIVATE_LIB_VERSION
    await fs.writeFile(absoluteFilePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8')
    updatedCount += 1
  }

  console.log(`[sync-project-private-lib-version] updated ${updatedCount} files to ${DEFAULT_WEAPP_PRIVATE_LIB_VERSION}`)
}

await main()
