import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import distribution from '../distribution.json' with { type: 'json' }

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
export { distribution }

/** 返回会改变已发布技能的包；清单和打包逻辑改变时覆盖所有 owner。 */
export function skillPackagesForFile(file) {
  const normalized = file.replaceAll('\\', '/')
  const shared = normalized === 'skills/distribution.json'
    || normalized === 'skills/scripts/distribution.mjs'
    || normalized === 'skills/scripts/sync-package-skills.mjs'
  return Object.entries(distribution.packages)
    .filter(([, config]) => shared || config.skills.some(name => normalized.startsWith(`skills/${name}/`)))
    .map(([name]) => name)
}

/** 从单一正文源同步完整目录，仅操作当前 owner 的生成目录。 */
export async function syncPackageSkills(packageName) {
  const config = distribution.packages[packageName]
  if (!config) {
    throw new Error(`Unknown skills package: ${packageName}`)
  }
  const packageRoot = path.join(repositoryRoot, config.directory)
  const target = path.join(packageRoot, 'skills')
  const temporaryRoot = path.join(packageRoot, '.tmp')
  await fs.mkdir(temporaryRoot, { recursive: true })
  const staging = await fs.mkdtemp(path.join(temporaryRoot, 'skills-'))
  try {
    for (const name of config.skills) {
      const source = path.join(repositoryRoot, 'skills', name)
      await fs.access(path.join(source, 'SKILL.md'))
      await fs.cp(source, path.join(staging, name), { recursive: true })
    }
    await fs.rm(target, { recursive: true, force: true })
    await fs.rename(staging, target)
  }
  finally {
    await fs.rm(staging, { recursive: true, force: true })
  }
}
