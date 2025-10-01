import type { PackageJson } from 'pkg-types'
import { fileURLToPath } from 'node:url'
import logger from '@weapp-core/logger'
import fs from 'fs-extra'
import path from 'pathe'
import { version } from '../../../packages/weapp-vite/package.json'
import { TemplateName } from './enums'
import { latestVersion } from './npm'
import { updateGitIgnore } from './updateGitignore'
import { writeJsonFile } from './utils/fs'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

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

  if (pkgJson.devDependencies['weapp-vite']) {
    pkgJson.devDependencies['weapp-vite'] = version
  }

  await upsertTailwindcssVersion(pkgJson)

  await writeJsonFile(packageJsonPath, pkgJson)
  await updateGitIgnore({ root: targetDir, write: true })

  logger.log('✨ 创建模板成功!')
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

function createEmptyPackageJson(): PackageJson {
  return {
    name: 'weapp-vite-app',
    homepage: 'https://vite.icebreaker.top/',
    type: 'module',
    scripts: {},
    devDependencies: {},
  }
}

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
