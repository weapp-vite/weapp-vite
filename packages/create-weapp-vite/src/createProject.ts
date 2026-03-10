import type { PackageJson } from 'pkg-types'
import { fileURLToPath } from 'node:url'
import logger from '@weapp-core/logger'
import fs from 'fs-extra'
import path from 'pathe'
import { version } from '../../weapp-vite/package.json'
import { version as wevuVersion } from '../../wevu/package.json'
import { TemplateName } from './enums'
import { TEMPLATE_CATALOG, TEMPLATE_NAMED_CATALOG } from './generated/catalog'
import { latestVersion } from './npm'
import { updateGitIgnore } from './updateGitignore'
import { writeJsonFile } from './utils/fs'

const DIGIT_RE = /\d/
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const templateCatalogMap: Record<string, string> = { ...TEMPLATE_CATALOG }
const templateNamedCatalogMap: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(TEMPLATE_NAMED_CATALOG).map(([name, deps]) => [name, { ...deps }]),
)

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

function resolveCatalogSpec(packageName: string, spec: string): string {
  if (!spec.startsWith('catalog:')) {
    return spec
  }

  const catalogName = spec.slice('catalog:'.length)

  if (!catalogName) {
    return templateCatalogMap[packageName] ?? spec
  }

  const fromNamedCatalog = templateNamedCatalogMap[catalogName]?.[packageName]
  if (fromNamedCatalog) {
    if (fromNamedCatalog === 'latest') {
      return templateCatalogMap[packageName] ?? fromNamedCatalog
    }
    return fromNamedCatalog
  }

  return templateCatalogMap[packageName] ?? spec
}

function normalizeTemplateDependencySpecs(pkgJson: PackageJson) {
  const fields: Array<keyof PackageJson> = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]

  for (const field of fields) {
    const deps = pkgJson[field] as Record<string, unknown> | undefined
    if (!deps) {
      continue
    }

    for (const [name, rawSpec] of Object.entries(deps)) {
      if (typeof rawSpec !== 'string' || !rawSpec) {
        continue
      }
      const spec = rawSpec
      if (spec.startsWith('catalog:')) {
        deps[name] = resolveCatalogSpec(name, spec)
      }
      else if (spec.startsWith('workspace:')) {
        const workspaceSpec = spec.slice('workspace:'.length)
        if (workspaceSpec && DIGIT_RE.test(workspaceSpec)) {
          deps[name] = workspaceSpec
          continue
        }
        const fromCatalog = templateCatalogMap[name]
        if (fromCatalog) {
          deps[name] = fromCatalog
        }
      }
    }
  }
}

/**
 * @description 根据模板创建项目
 */
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
  normalizeTemplateDependencySpecs(pkgJson)

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
