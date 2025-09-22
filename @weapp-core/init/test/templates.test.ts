import path from 'node:path'
import { scanFiles } from './utils'

describe('templates', () => {
  it('should ', async () => {
    await (await import('../scripts/shared')).main()
    const files = await scanFiles(path.resolve(__dirname, '../templates'))
    expect(files).toMatchSnapshot()
  })
})
