import fs from 'fs-extra'
import path from 'pathe'
import { TemplateName } from '@/enums'
import { createProject } from '@/index'
import { scanFiles } from './utils'

describe('createProject', () => {
  async function cleanRoot(name: string) {
    const root = path.resolve(import.meta.dirname, `./fixtures/createProject/${name}`)
    await fs.remove(root)
    return root
  }

  it('createProject', async () => {
    const root = await cleanRoot('my-app')
    await createProject(root)
    expect(await scanFiles(root)).toMatchSnapshot()
  })

  it('createProject tailwindcss', async () => {
    const root = await cleanRoot('tailwindcss')
    await createProject(root, TemplateName.tailwindcss)
    expect(await scanFiles(root)).toMatchSnapshot()
  })

  it('createProject tdesign', async () => {
    const root = await cleanRoot('tdesign')
    await createProject(root, TemplateName.tdesign)
    expect(await scanFiles(root)).toMatchSnapshot()
  })

  it('createProject vant', async () => {
    const root = await cleanRoot('vant')
    await createProject(root, TemplateName.vant)
    expect(await scanFiles(root)).toMatchSnapshot()
  })
})
