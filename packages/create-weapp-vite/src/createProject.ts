import type { PackageJson } from 'pkg-types'
import { fileURLToPath } from 'node:url'
import logger from '@weapp-core/logger'
import fs from 'fs-extra'
import path from 'pathe'
import { version } from '../../weapp-vite/package.json'
import { version as wevuVersion } from '../../wevu/package.json'
import { TemplateName } from './enums'
import { latestVersion } from './npm'
import { updateGitIgnore } from './updateGitignore'
import { writeJsonFile } from './utils/fs'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

async function ensureDotGitignore(root: string) {
  const gitignorePath = path.resolve(root, 'gitignore')
  const dotGitignorePath = path.resolve(root, '.gitignore')

  if (!await fs.pathExists(gitignorePath)) {
    return
  }

  if (await fs.pathExists(dotGitignorePath)) {
    await fs.remove(gitignorePath)
    return
  }

  await fs.move(gitignorePath, dotGitignorePath)
}

function createEmptyPackageJson(): PackageJson {
  return {
    name: 'weapp-vite-app',
    homepage: 'https://vite.icebreaker.top/',
    type: 'module',
    scripts: {},
    devDependencies: {},
  }
}

async function upsertTailwindcssVersion(pkgJson: PackageJson) {
  if (!pkgJson.devDependencies) {
    return
  }

  const resolved = await latestVersion('weapp-tailwindcss')
  if (resolved) {
    pkgJson.devDependencies['weapp-tailwindcss'] = resolved
  }
  else if (!pkgJson.devDependencies['weapp-tailwindcss']) {
    pkgJson.devDependencies['weapp-tailwindcss'] = '^4.3.3'
  }
}

function upsertExistingDependencyVersion(pkgJson: PackageJson, packageName: string, resolvedVersion: string) {
  if (pkgJson.dependencies?.[packageName]) {
    pkgJson.dependencies[packageName] = resolvedVersion
  }
  if (pkgJson.devDependencies?.[packageName]) {
    pkgJson.devDependencies[packageName] = resolvedVersion
  }
}

function toCaretVersion(version: string) {
  return version.startsWith('^') ? version : `^${version}`
}

export async function createProject(targetDir: string = '', templateName: TemplateName = TemplateName.default) {
  const targetTemplateDir = path.resolve(moduleDir, '../templates', templateName)

  if (!await fs.pathExists(targetTemplateDir)) {
    logger.warn(`没有找到 ${templateName} 模板!`)
    return
  }

  await fs.copy(targetTemplateDir, targetDir)

  const templatePackagePath = path.resolve(targetTemplateDir, 'package.json')
  const packageJsonPath = path.resolve(targetDir, 'package.json')
  await ensureDotGitignore(targetDir)
  const pkgJson = await fs.pathExists(templatePackagePath)
    ? await fs.readJSON(templatePackagePath) as PackageJson
    : createEmptyPackageJson()

  if (!pkgJson.devDependencies) {
    pkgJson.devDependencies = {}
  }

  upsertExistingDependencyVersion(pkgJson, 'weapp-vite', toCaretVersion(version))
  upsertExistingDependencyVersion(pkgJson, 'wevu', toCaretVersion(wevuVersion))

  await upsertTailwindcssVersion(pkgJson)

  await writeJsonFile(packageJsonPath, pkgJson)
  await updateGitIgnore({ root: targetDir, write: true })

  logger.log('✨ 创建模板成功!')
}

export const __internal = {
  ensureDotGitignore,
  upsertTailwindcssVersion,
}
