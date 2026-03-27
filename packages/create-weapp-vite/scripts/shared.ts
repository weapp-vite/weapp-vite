import crypto from 'node:crypto'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { Templates } from './constants'

const templates = Templates.map((x) => {
  return {
    target: `../../../templates/${x.target}`,
    dest: `../templates/${x.dest}`,
  }
})

async function ensureGitignoreForTemplate(templateRoot: string) {
  const dotGitignore = path.resolve(templateRoot, '.gitignore')
  const plainGitignore = path.resolve(templateRoot, 'gitignore')

  if (await fs.pathExists(dotGitignore)) {
    await fs.move(dotGitignore, plainGitignore, { overwrite: true })
  }
}

function shouldSkipTemplateFile(filePath: string) {
  return (
    filePath.includes('node_modules')
    || filePath.includes(`${path.sep}.weapp-vite${path.sep}`)
    || filePath.includes('vite.config.ts.timestamp')
    || filePath.includes('dist')
    || filePath.includes('CHANGELOG.md')
    || filePath.includes('.turbo')
    || filePath.includes('.DS_Store')
  )
}

async function collectTemplateFiles(root: string) {
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      if (shouldSkipTemplateFile(absolutePath)) {
        continue
      }

      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }

      if (entry.isFile()) {
        files.push(absolutePath)
      }
    }
  }

  await walk(root)
  files.sort((a, b) => a.localeCompare(b))
  return files
}

function normalizeTemplateRelativePath(filePath: string) {
  const relativePath = filePath.split(path.sep).join('/')
  return relativePath === '.gitignore' ? 'gitignore' : relativePath
}

async function isTemplateDirSynced(sourceRoot: string, destRoot: string) {
  if (!await fs.pathExists(destRoot)) {
    return false
  }

  let sourceFiles: string[]
  let destFiles: string[]
  try {
    [sourceFiles, destFiles] = await Promise.all([
      collectTemplateFiles(sourceRoot),
      collectTemplateFiles(destRoot),
    ])
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return false
    }
    throw error
  }

  if (sourceFiles.length !== destFiles.length) {
    return false
  }

  for (let i = 0; i < sourceFiles.length; i++) {
    const sourceFilePath = sourceFiles[i]
    const destFilePath = destFiles[i]
    if (!sourceFilePath || !destFilePath) {
      return false
    }

    const sourceRelativePath = normalizeTemplateRelativePath(path.relative(sourceRoot, sourceFilePath))
    const destRelativePath = normalizeTemplateRelativePath(path.relative(destRoot, destFilePath))
    if (sourceRelativePath !== destRelativePath) {
      return false
    }

    let sourceContent: Buffer
    let destContent: Buffer
    try {
      [sourceContent, destContent] = await Promise.all([
        fs.readFile(sourceFilePath),
        fs.readFile(destFilePath),
      ])
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return false
      }
      throw error
    }
    if (!sourceContent.equals(destContent)) {
      return false
    }
  }

  return true
}

async function getTemplateSyncSignature() {
  const hasher = crypto.createHash('sha256')

  for (const { target } of templates) {
    const absTarget = path.resolve(import.meta.dirname, target)
    hasher.update(target)

    if (!await fs.pathExists(absTarget)) {
      hasher.update('missing')
      continue
    }

    const files = await collectTemplateFiles(absTarget)
    for (const filePath of files) {
      hasher.update(path.relative(absTarget, filePath))
      hasher.update(await fs.readFile(filePath))
    }
  }

  return hasher.digest('hex').slice(0, 16)
}

async function hasSyncedTemplates() {
  for (const { dest, target } of templates) {
    const absTarget = path.resolve(import.meta.dirname, target)
    const absDest = path.resolve(import.meta.dirname, dest)
    if (!await isTemplateDirSynced(absTarget, absDest)) {
      return false
    }
  }

  return true
}

export async function main() {
  const signature = await getTemplateSyncSignature()
  const markerFile = path.join(os.tmpdir(), `create-weapp-vite-templates.${signature}.done`)
  if (await fs.pathExists(markerFile) && await hasSyncedTemplates()) {
    return
  }

  const lockFile = path.join(os.tmpdir(), 'create-weapp-vite-templates.lock')
  let lockHandle: fsPromises.FileHandle | undefined

  for (let i = 0; i < 200; i++) {
    try {
      lockHandle = await fsPromises.open(lockFile, 'wx')
      break
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  if (!lockHandle) {
    throw new Error('同步模板失败：等待锁超时')
  }

  try {
    if (await fs.pathExists(markerFile) && await hasSyncedTemplates()) {
      return
    }

    for (const { dest, target } of templates) {
      const absDest = path.resolve(import.meta.dirname, dest)
      await fs.emptyDir(absDest)
      await fs.copy(
        path.resolve(import.meta.dirname, target),
        absDest,
        {
          filter(src: string) {
            if (shouldSkipTemplateFile(src)) {
              return false
            }
            return true
          },
        },
      )

      await ensureGitignoreForTemplate(absDest)
    }

    await fs.outputFile(markerFile, String(Date.now()))
  }
  finally {
    await lockHandle.close()
    await fsPromises.unlink(lockFile).catch(() => {})
  }
}
