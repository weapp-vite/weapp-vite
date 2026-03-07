import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../../../utils/babel'
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

  it('serializes concise object methods in defineOptions result', async () => {
    const projectDir = await createTempProject()
    const filename = path.join(projectDir, 'index.ts')
    const source = `
defineOptions(() => ({
  data() {
    return { count: 1 }
  },
  onLoad() {
    return this.data.count
  },
  methods: {
    onTap() {
      return 1
    },
  },
}))
    `.trim()

    const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')

    expect(result.code).toContain('data: (function data()')
    expect(result.code).toContain('onLoad: (function onLoad()')
    expect(result.code).toContain('onTap: (function onTap()')
    expect(() => babelParse(result.code, BABEL_TS_MODULE_PARSER_OPTIONS)).not.toThrow()
  })

  it('does not require imports referenced only inside defineOptions methods', async () => {
    const projectDir = await createTempProject()
    const filename = path.join(projectDir, 'index.ts')
    const source = `
import MissingToast from 'missing-module'

defineOptions(() => ({
  data() {
    return { count: 1 }
  },
  onLoad() {
    MissingToast.show?.()
  },
}))
    `.trim()

    const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')
    expect(result.code).toContain('defineOptions({')
    expect(result.dependencies.some(dep => dep.includes('missing-module'))).toBe(false)
  })

  it('supports serializing built-in native constructor values', async () => {
    const projectDir = await createTempProject()
    const filename = path.join(projectDir, 'index.ts')
    const source = `
defineOptions(() => ({
  properties: {
    title: { type: String },
    count: { type: Number },
    enabled: { type: Boolean },
    list: { type: Array },
    payload: { type: Object },
    onTap: { type: Function },
  },
}))
    `.trim()

    const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')

    expect(result.code).toContain('type: String')
    expect(result.code).toContain('type: Number')
    expect(result.code).toContain('type: Boolean')
    expect(result.code).toContain('type: Array')
    expect(result.code).toContain('type: Object')
    expect(result.code).toContain('type: Function')
    expect(() => babelParse(result.code, BABEL_TS_MODULE_PARSER_OPTIONS)).not.toThrow()
  })

  it('falls back to raw defineOptions when imported behavior depends on runtime Behavior()', async () => {
    const projectDir = await createTempProject()
    const filename = path.join(projectDir, 'index.ts')
    const behaviorFile = path.join(projectDir, 'behavior.ts')
    const source = `
import FooBehavior from './behavior'

defineOptions({
  behaviors: [FooBehavior],
})
    `.trim()

    await fs.writeFile(
      behaviorFile,
      `export default Behavior({ methods: { ping() { return 'ok' } } })\n`,
      'utf8',
    )

    const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')

    expect(result.code).toBe(source)
    expect(result.code).toContain('behaviors: [FooBehavior]')
    expect(result.dependencies).toEqual([])
  })
})
