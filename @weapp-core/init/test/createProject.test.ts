import path from 'pathe'
import { TemplateName } from '@/enums'
import { createProject } from '@/index'
import { scanFiles } from './utils'

describe('createProject', () => {
  it('createProject', async () => {
    const root = path.resolve(import.meta.dirname, './fixtures/createProject/my-app')
    await createProject(root)
    expect(await scanFiles(root)).toMatchSnapshot()
  })

  it('createProject tailwindcss', async () => {
    const root = path.resolve(import.meta.dirname, './fixtures/createProject/tailwindcss')
    await createProject(root, TemplateName.tailwindcss)
    expect(await scanFiles(root)).toMatchSnapshot()
  })

  it('createProject tdesign', async () => {
    const root = path.resolve(import.meta.dirname, './fixtures/createProject/tdesign')
    await createProject(root, TemplateName.tdesign)
    expect(await scanFiles(root)).toMatchSnapshot()
  })

  it('createProject vant', async () => {
    const root = path.resolve(import.meta.dirname, './fixtures/createProject/vant')
    await createProject(root, TemplateName.vant)
    expect(await scanFiles(root)).toMatchSnapshot()
  })
})
