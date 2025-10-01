import type { SharedUpdateOptions } from './types'
import logger from '@weapp-core/logger'
import path from 'pathe'
import { mergeGitignore } from './gitignore'
import { readFileIfExists, writeFile } from './utils/fs'
import { resolveOutputPath } from './utils/path'

export async function updateGitIgnore(options: SharedUpdateOptions) {
  const { root, dest, write = true } = options
  const gitignorePath = path.resolve(root, '.gitignore')
  const outputPath = resolveOutputPath(root, dest, gitignorePath)

  const existing = await readFileIfExists(outputPath)
  const merged = mergeGitignore(existing)

  if (write && merged !== (existing ?? '')) {
    await writeFile(outputPath, merged)
    logger.log(`✨ 更新 ${path.relative(root, outputPath)} 成功!`)
  }

  return merged
}
