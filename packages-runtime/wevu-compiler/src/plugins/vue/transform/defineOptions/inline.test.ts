import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../../../utils/babel'
import * as fs from '../../../../utils/fs'
import { inlineScriptSetupDefineOptionsArgs } from './inline'

async function withTempProject<T>(run: (projectDir: string) => Promise<T>) {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wevu-define-options-'))
  try {
    return await run(projectDir)
  }
  finally {
    await rm(projectDir, { recursive: true, force: true })
  }
}

describe('inlineScriptSetupDefineOptionsArgs', { timeout: 180_000 }, () => {
  it('returns original content when defineOptions does not exist', async () => {
    await withTempProject(async (projectDir) => {
      const filename = path.join(projectDir, 'index.ts')
      const source = `const value = 1`

      const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')
      expect(result.code).toBe(source)
      expect(result.dependencies).toEqual([])
    })
  })

  it('inlines defineOptions value resolved from local/imported symbols', async () => {
    await withTempProject(async (projectDir) => {
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
  })

  it('throws when defineOptions argument count is invalid', async () => {
    await withTempProject(async (projectDir) => {
      const filename = path.join(projectDir, 'index.ts')
      const source = `defineOptions()`

      await expect(
        inlineScriptSetupDefineOptionsArgs(source, filename, 'ts'),
      ).rejects.toThrow('必须且只能传 1 个参数')
    })
  })

  it('throws when resolved defineOptions value is not an object', async () => {
    await withTempProject(async (projectDir) => {
      const filename = path.join(projectDir, 'index.ts')
      const source = `defineOptions(() => 1)`

      await expect(
        inlineScriptSetupDefineOptionsArgs(source, filename, 'ts'),
      ).rejects.toThrow('最终必须解析为对象')
    })
  })

  it('serializes concise object methods in defineOptions result', async () => {
    await withTempProject(async (projectDir) => {
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
  })

  it('does not require imports referenced only inside defineOptions methods', async () => {
    await withTempProject(async (projectDir) => {
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
  })

  it('supports serializing built-in native constructor values', async () => {
    await withTempProject(async (projectDir) => {
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
  })

  it('inlines captured local constants referenced inside defineOptions methods', async () => {
    await withTempProject(async (projectDir) => {
      const filename = path.join(projectDir, 'index.ts')
      const source = `
const amountInputRe = /\\d+(\\.\\d*)?/
const amountLabel = 'refund'

defineOptions(() => ({
  methods: {
    onInput(value: string) {
      const matched = value.match(amountInputRe)
      return matched ? amountLabel : ''
    },
  },
}))
    `.trim()

      const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')

      expect(result.code).toContain('value.match(/\\d+(\\.\\d*)?/)')
      expect(result.code).toContain('? "refund" : ""')
      expect(result.code).toContain('defineOptions({ methods:')
    })
  })

  it('falls back to raw defineOptions when imported behavior depends on runtime Behavior()', async () => {
    await withTempProject(async (projectDir) => {
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

  it('ignores type-only imports when collecting defineOptions scope values', async () => {
    await withTempProject(async (projectDir) => {
      const filename = path.join(projectDir, 'app.ts')
      const typesFile = path.join(projectDir, 'types.ts')

      await fs.writeFile(typesFile, 'export interface AppGlobalData { title: string }\n', 'utf8')

      const source = `
import type { AppGlobalData } from './types'

const globalData: AppGlobalData = {
  title: 'demo',
}

defineOptions({
  globalData,
})
    `.trim()

      const result = await inlineScriptSetupDefineOptionsArgs(source, filename, 'ts')

      expect(result.code).toContain('globalData: { title: "demo" }')
      expect(result.code).toContain(`import type { AppGlobalData } from './types'`)
    })
  })
})
