import type { PackageJson } from 'pkg-types'
import { createHash } from 'node:crypto'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import { recommended } from '@weapp-vite/oxfmt'
import { prepareProjectFormatting } from '@weapp-vite/oxfmt/project'
// eslint-disable-next-line e18e/ban-dependencies -- 保持发布脚本的 Windows 命令解析与进程退出契约。
import { execa } from 'execa'
import path from 'pathe'
import { createAgentsGuidelines } from '../src/agents'
import { __internal } from '../src/createProject'
import { resolveDependencyVersions } from '../src/dependencyVersions'
import { ensureManagedTypeScriptDevDependencies, normalizeTemplateDependencySpecs } from '../src/templateDependencies'
import { TEMPLATE_DEFINITIONS } from '../src/templates'
import { digestDirectory } from '../src/templates/prepared'
import { applyToolchain } from '../src/toolchain'
import { prepareVitePlusQuality } from '../src/toolchain/quality'
import { writeJsonFile } from '../src/utils/fs'
import { publishPreparedTemplates, withPreparationLock } from './templatePreparation'

const packageRoot = path.resolve(import.meta.dirname, '..')
const templatesRoot = path.join(packageRoot, 'templates')
const destination = path.join(templatesRoot, 'vite-plus')

async function inputSignature() {
  const hash = createHash('sha256')
  hash.update(JSON.stringify(recommended))
  for (const template of TEMPLATE_DEFINITIONS) {
    hash.update(template.id)
    hash.update(await digestDirectory(path.join(templatesRoot, template.id)))
  }
  hash.update(await digestDirectory(path.join(packageRoot, 'src')))
  hash.update(await digestDirectory(path.join(packageRoot, '../oxfmt/dist')))
  hash.update(await digestDirectory(path.join(packageRoot, '../language-service/dist')))
  hash.update(await digestDirectory(path.join(packageRoot, '../../@weapp-core/shared/dist/platforms')))
  hash.update(await fs.readFile(path.join(import.meta.dirname, 'vitePlusTemplates.ts')))
  hash.update(await digestDirectory(path.join(import.meta.dirname, 'templatePreparation')))
  for (const manifest of ['../oxfmt/package.json', '../oxlint/package.json', '../eslint/package.json', 'node_modules/oxfmt/package.json']) {
    hash.update(await fs.readFile(path.join(packageRoot, manifest)))
  }
  return hash.digest('hex')
}

interface PreparedManifest {
  input: string
  templates: Record<string, string>
}

async function isPrepared(signature: string) {
  try {
    const manifest = await fs.readJSON(path.join(destination, 'manifest.json')) as PreparedManifest
    if (manifest.input !== signature) {
      return false
    }
    for (const template of TEMPLATE_DEFINITIONS) {
      if (manifest.templates[template.id] !== await digestDirectory(path.join(destination, template.id))) {
        return false
      }
    }
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/** 从唯一业务源码派生发布副本；检查成功后才发布完整目录和缓存凭据。 */
export async function prepareVitePlusTemplates() {
  const signature = await inputSignature()
  if (await isPrepared(signature)) {
    return
  }
  return withPreparationLock(templatesRoot, async () => {
    let staging: string | undefined
    try {
      if (await isPrepared(signature)) {
        return
      }
      // 独立临时目录隔离仓库的 templates/gitignore，按消费者视角执行真实格式检查。
      staging = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-plus-templates-'))
      const configFile = path.join(staging, 'format-config.json')
      await writeJsonFile(configFile, recommended)
      const manifest: PreparedManifest = { input: signature, templates: {} }
      for (const template of TEMPLATE_DEFINITIONS) {
        const root = path.join(staging, template.id)
        await fs.copy(path.join(templatesRoot, template.id), root)
        const pkg = await fs.readJSON(path.join(root, 'package.json')) as PackageJson
        await applyToolchain(root, pkg, 'vite-plus', { framework: template.framework })
        await prepareVitePlusQuality(root, pkg, template.id)
        normalizeTemplateDependencySpecs(pkg)
        ensureManagedTypeScriptDevDependencies(pkg)
        await resolveDependencyVersions(pkg, 'bundled')
        await writeJsonFile(path.join(root, 'package.json'), pkg)
        await __internal.rewriteProjectConfigAppId(root)
        await fs.writeFile(path.join(root, 'AGENTS.md'), createAgentsGuidelines(template.id, 'vite-plus'))
        const options = { cwd: root, preferLocal: true, localDir: packageRoot }
        const candidates = await prepareProjectFormatting(root, ['.'], recommended, { defaultPlatform: 'weapp' })
        for (const candidate of candidates) {
          await fs.writeFile(candidate.file, candidate.formatted)
        }
        const checked = await prepareProjectFormatting(root, ['.'], recommended, { defaultPlatform: 'weapp' })
        if (checked.some(candidate => candidate.source !== candidate.formatted)) {
          throw new Error(`模板格式化不幂等：${template.id}`)
        }
        await execa('oxfmt', ['--config', configFile, '--check', '.'], options)
        manifest.templates[template.id] = await digestDirectory(root)
      }
      await fs.remove(configFile)
      await writeJsonFile(path.join(staging, 'manifest.json'), manifest)
      await publishPreparedTemplates(staging, destination)
    }
    finally {
      if (staging) {
        await fs.remove(staging)
      }
    }
  })
}
