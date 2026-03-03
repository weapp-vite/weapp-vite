import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { inlineScriptSetupDefineOptionsArgs } from './inline'

async function createTempProject() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'wevu-define-options-'))
}

describe('inlineScriptSetupDefineOptionsArgs', () => {
  it('returns original content when defineOptions does not exist', async () => {
    const projectDir = await createTempProject()
    const filename = path.join(projectDir, 'index.ts')
    const source = `const value = 1`

    const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')
    expect(result.code).toBe(source)
    expect(result.dependencies).toEqual([])
  })

  it('inlines defineOptions value resolved from local/imported symbols', async () => {
    const projectDir = await createTempProject()
    const filename = path.join(projectDir, 'index.ts')
    const sharedFile = path.join(projectDir, 'shared.ts')

    await fs.writeFile(sharedFile, `export const shared = { prefix: 'demo', options: { virtualHost: true } }\n`, 'utf8')

    const source = `
import { shared } from './shared'
const suffix = 'card'
defineOptions(() => ({
  name: shared.prefix + '-' + suffix,
  options: shared.options,
  enabled: true,
}))
    `.trim()

    const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')

    expect(result.code).toContain('defineOptions({')
    expect(result.code).toContain('name: "demo-card"')
    expect(result.code).toContain('virtualHost: true')
    expect(result.dependencies.some(dep => dep.includes('shared'))).toBe(true)
  })

  it('throws when defineOptions argument count is invalid', async () => {
    const projectDir = await createTempProject()
    const filename = path.join(projectDir, 'index.ts')
    const source = `defineOptions()`

    await expect(
      inlineScriptSetupDefineOptionsArgs(source, filename, 'ts'),
    ).rejects.toThrow('必须且只能传 1 个参数')
  })

  it('throws when resolved defineOptions value is not an object', async () => {
    const projectDir = await createTempProject()
    const filename = path.join(projectDir, 'index.ts')
    const source = `defineOptions(() => 1)`

    await expect(
      inlineScriptSetupDefineOptionsArgs(source, filename, 'ts'),
    ).rejects.toThrow('最终必须解析为对象')
  })
})
