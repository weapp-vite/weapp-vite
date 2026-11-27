import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
import { afterEach, describe, expect, it } from 'vitest'
import { TemplateName } from '@/enums'
import { main as syncTemplates } from '../scripts/shared'

const roots: string[] = []

async function isolatedTemplateSync() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-template-sync-'))
  roots.push(root)
  const options = { targetRoot: path.join(root, 'templates'), cacheRoot: path.join(root, 'cache') }
  await syncTemplates(options)
  return options
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})

describe('templates', () => {
  it('contains a folder for every template name', async () => {
    const templatesRoot = path.resolve(import.meta.dirname, '../templates')
    for (const name of Object.values(TemplateName)) {
      expect(await fs.pathExists(path.join(templatesRoot, name))).toBe(true)
    }
  })

  it('rebuilds templates for the current worktree even when a sync marker already exists', async () => {
    const options = await isolatedTemplateSync()
    expect((await fs.readdir(options.cacheRoot)).some(file => file.endsWith('.done'))).toBe(true)
    await fs.remove(options.targetRoot)
    await syncTemplates(options)

    for (const name of Object.values(TemplateName)) {
      expect(await fs.pathExists(path.join(options.targetRoot, name))).toBe(true)
    }
  })

  it('rebuilds partial templates when a sync marker already exists', async () => {
    const options = await isolatedTemplateSync()
    const defaultTemplateRoot = path.join(options.targetRoot, TemplateName.default)
    const restoredFile = path.join(defaultTemplateRoot, 'project.config.json')

    await fs.remove(restoredFile)

    expect(await fs.pathExists(restoredFile)).toBe(false)

    await syncTemplates(options)

    expect(await fs.pathExists(restoredFile)).toBe(true)
  })

  it('preserves managed TypeScript support when templates are resynced', async () => {
    const options = await isolatedTemplateSync()
    const defaultTemplateRoot = path.join(options.targetRoot, TemplateName.default)
    const managedFile = path.join(defaultTemplateRoot, '.weapp-vite', 'tsconfig.app.json')
    const restoredFile = path.join(defaultTemplateRoot, 'project.config.json')

    await fs.outputFile(managedFile, 'managed by the TypeScript preparation stage\n')
    await fs.remove(restoredFile)

    await syncTemplates(options)

    expect(await fs.readFile(managedFile, 'utf8')).toBe('managed by the TypeScript preparation stage\n')
    expect(await fs.pathExists(restoredFile)).toBe(true)
  })

  it('preserves derived templates owned by another preparation stage', async () => {
    const options = await isolatedTemplateSync()
    const preparedFile = path.join(options.targetRoot, 'vite-plus', 'manifest.json')
    const preparedContent = '{"input":"another-preparation-stage"}\n'
    await fs.outputFile(preparedFile, preparedContent)
    await fs.remove(path.join(options.targetRoot, TemplateName.default, 'project.config.json'))

    await syncTemplates(options)

    expect(await fs.readFile(preparedFile, 'utf8')).toBe(preparedContent)
  })

  it('prepares managed TypeScript support before template tests are collected', async () => {
    const templatesRoot = path.resolve(import.meta.dirname, '../templates')
    const entries = await fs.readdir(templatesRoot, { withFileTypes: true })
    for (const entry of entries.filter(entry => entry.isDirectory())) {
      const root = path.join(templatesRoot, entry.name)
      const tsconfig = await fs.readFile(path.join(root, 'tsconfig.json'), 'utf8').catch(() => '')
      if (!tsconfig.includes('.weapp-vite/tsconfig.')) {
        continue
      }
      expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.app.json')), entry.name).toBe(true)
    }
  })

  it('prepares managed TypeScript support for nested template test projects', async () => {
    const nestedTestRoots = [
      path.resolve(import.meta.dirname, '../templates/default/test'),
      path.resolve(import.meta.dirname, '../templates/vite-plus/default/test'),
    ]

    for (const root of nestedTestRoots) {
      expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.app.json')), root).toBe(true)
    }
  })
})
