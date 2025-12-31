import fs from 'fs-extra'
import path from 'pathe'
import { buildSchemas } from '../scripts/utils'

describe('schema', () => {
  it('should generate deterministic schema JSON', async () => {
    const schemaPath = path.resolve(__dirname, '../schemas/app.json')

    await buildSchemas()
    const first = await fs.readFile(schemaPath, 'utf8')

    await buildSchemas()
    const second = await fs.readFile(schemaPath, 'utf8')

    expect(second).toBe(first)
  })
})
