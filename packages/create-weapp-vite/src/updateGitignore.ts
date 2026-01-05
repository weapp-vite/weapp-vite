import logger from '@weapp-core/logger'
import path from 'pathe'
import { mergeGitignore } from './gitignore'
import { readFileIfExists, writeFile } from './utils/fs'

export async function updateGitIgnore(options: { root: string, write?: boolean }) {
  const { root, write = true } = options
  const gitignorePath = path.resolve(root, '.gitignore')

  const existing = await readFileIfExists(gitignorePath)
  const merged = mergeGitignore(existing)

  if (write && merged !== (existing ?? '')) {
    await writeFile(gitignorePath, merged)
    logger.log(`✨ 更新 ${path.relative(root, gitignorePath)} 成功!`)
  }

  return merged
}
