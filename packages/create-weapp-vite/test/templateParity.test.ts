import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { TemplateName } from '@/enums'
import { createProject } from '@/index'

function normalizeRelativePath(value: string) {
  return value.split(path.sep).join('/')
}

function shouldSkipTemplateFile(filePath: string) {
  return (
    filePath.includes('node_modules')
    || filePath.includes(`${path.sep}.weapp-vite${path.sep}`)
    || filePath.includes('vite.config.ts.timestamp')
    || filePath.includes(`${path.sep}dist${path.sep}`)
    || filePath.endsWith(`${path.sep}CHANGELOG.md`)
    || filePath.includes(`${path.sep}.turbo${path.sep}`)
    || filePath.endsWith(`${path.sep}.DS_Store`)
  )
}

function normalizeExpectedProjectPath(relativePath: string) {
  if (relativePath === 'gitignore') {
    return '.gitignore'
  }
  return relativePath
}

async function scanFiles(root: string) {
  const out: string[] = []

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      out.push(normalizeRelativePath(path.relative(root, full)))
    }
  }

  if (await fs.pathExists(root)) {
    await walk(root)
  }

  return out.sort((a, b) => a.localeCompare(b))
}

async function collectExpectedTemplateFiles(templateName: TemplateName) {
  const templateDir = path.resolve(import.meta.dirname, '../templates', templateName)
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name)
      if (shouldSkipTemplateFile(full)) {
        continue
      }
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      files.push(normalizeExpectedProjectPath(normalizeRelativePath(path.relative(templateDir, full))))
    }
  }

  await walk(templateDir)

  return files.sort((a, b) => a.localeCompare(b))
}

describe('template parity', () => {
  async function createTmpRoot(suffix: string) {
    return await fs.mkdtemp(path.join(os.tmpdir(), `weapp-template-parity-${suffix}-`))
  }

  it.each(Object.values(TemplateName))('copies all expected files for template %s', async (templateName) => {
    const root = await createTmpRoot(templateName)

    await createProject(root, templateName)

    const [expectedFiles, actualFiles] = await Promise.all([
      collectExpectedTemplateFiles(templateName),
      scanFiles(root),
    ])
    const actualFileSet = new Set(actualFiles)
    const missingFiles = expectedFiles.filter(file => !actualFileSet.has(file))

    expect(missingFiles).toEqual([])
  })
})
