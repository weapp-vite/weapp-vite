import path from 'node:path'
import fs from 'fs-extra'
import { TemplateName } from '@/enums'

describe('templates', () => {
  it('contains a folder for every template name', async () => {
    const templatesRoot = path.resolve(import.meta.dirname, '../templates')
    for (const name of Object.values(TemplateName)) {
      expect(await fs.pathExists(path.join(templatesRoot, name))).toBe(true)
    }
  })
})
