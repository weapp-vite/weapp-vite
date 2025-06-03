import path from 'pathe'
import { createProject } from '@/index'

describe.skip('createProject', () => {
  it('createProject', async () => {
    await createProject(path.resolve(__dirname, './fixtures/my-app'))
  })
})
