import path from 'node:path'
import { fs } from '@weapp-core/shared'
import { TemplateName } from '@/enums'
import { main as syncTemplates } from '../scripts/shared'

describe('templates', () => {
  it('contains a folder for every template name', async () => {
    const templatesRoot = path.resolve(import.meta.dirname, '../templates')
    for (const name of Object.values(TemplateName)) {
      expect(await fs.pathExists(path.join(templatesRoot, name))).toBe(true)
    }
  })

  it('rebuilds templates for the current worktree even when a sync marker already exists', async () => {
    const templatesRoot = path.resolve(import.meta.dirname, '../templates')

    await fs.remove(templatesRoot)
    await syncTemplates()

    for (const name of Object.values(TemplateName)) {
      expect(await fs.pathExists(path.join(templatesRoot, name))).toBe(true)
    }
  })

  it('rebuilds partial templates when a sync marker already exists', async () => {
    const templatesRoot = path.resolve(import.meta.dirname, '../templates')
    const defaultTemplateRoot = path.join(templatesRoot, TemplateName.default)
    const restoredFile = path.join(defaultTemplateRoot, 'project.config.json')

    await syncTemplates()
    await fs.remove(restoredFile)

    expect(await fs.pathExists(restoredFile)).toBe(false)

    await syncTemplates()

    expect(await fs.pathExists(restoredFile)).toBe(true)
  })
})
