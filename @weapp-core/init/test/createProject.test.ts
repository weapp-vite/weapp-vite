import { createProject } from '@/index'
import path from 'pathe'

describe.skip('createProject', () => {
  it('createProject', async () => {
    await createProject(path.resolve(__dirname, './fixtures/my-app'))
  })
})
