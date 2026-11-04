import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { Transform } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { corpusHash } from '../../archive'
import { readFrameworkCatalog, selectFrameworkTarget } from '../catalog'
import { writeProjectFile } from '../files'
import { antFixtureFiles } from '../fixtures/ant'
import { createControlledProject } from '../project'
import { generateFramework } from '../run'
import { antInputRecipe, antUpstream } from './index'

interface VinylFile { contents: Buffer }
interface Providers {
  ifdef: (definitions: Record<string, string | boolean>, options: unknown) => Transform
  TransformCompiler: new (options: unknown) => { compile: (source: string) => string }
  Vinyl: new (options: VinylFile) => VinylFile
}
interface PipelineReport {
  definitions: Record<string, string | boolean>
  allowList: string[]
  excluded: Array<{ file: string, reason: string }>
  transformations: Array<{ input: { file: string, sha256: string }, preprocessed: { file: string, sha256: string }, output: { file: string, sha256: string } }>
}
const runtime = createRequire(import.meta.url)('./runtime.cjs') as {
  validateConditions: (source: string) => string[]
  supportsWechat: (markdown: string) => boolean
  selectTemplate: (file: string, target: string, allowList: string[]) => string | undefined
  preprocess: (source: string, file: string, definitions: unknown, ifdef: Providers['ifdef'], vinyl: Providers['Vinyl']) => Promise<string>
  main: (mode: string, target: string, output: string, providers: Providers, project: string) => Promise<void>
}
const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('frozen Ant Design Mini AXML pipeline', () => {
  it('pins compiler packages, original mapping, source projection and targets independently of the build result', async () => {
    const catalog = await readFrameworkCatalog()
    for (const target of ['alipay', 'weapp']) {
      const selected = selectFrameworkTarget(catalog, 'ant-design-mini', '3.4.3', target)
      expect(selected.release.upstream).toEqual({ repository: antUpstream.repository, commit: antUpstream.commit })
      const project = createControlledProject(selected.release, selected.target)
      expect(project.dependencies).toEqual({ '@diamondyuan/gulp-ifdef': '0.3.0', '@alipay/axml-transverter': '1.0.1', 'vinyl': '2.2.1' })
      expect(project.command).toEqual(['node', 'compile.cjs', '{mode}', target, '{output}'])
      expect(JSON.parse(project.files['wechat-mapping.json']!) as unknown).toMatchObject({ view: { onTouchStart: 'bindtouchstart' }, input: { onInput: 'bindinput' } })
      expect(project.files['compile.cjs']).not.toContain('eval(')
      expect(project.files['upstream-LICENSE.txt']).toContain('Copyright (c) 2022 Ant Design Team')
    }
    expect(antInputRecipe).toMatchObject({ prefix: '', include: ['{src,demo,copilot,copilot-demo}/**/*.axml', '{src,copilot}/*/index.md'], exclude: ['**/__tests__/**'] })
  })

  it('rejects mismatched frozen source identity before preparing or executing a command', async () => {
    await expect(generateFramework({
      framework: 'ant-design-mini',
      version: '3.4.3',
      target: 'alipay',
      workspace: 'unused',
      input: 'unused',
      identity: { repository: antUpstream.repository, commit: 'f'.repeat(40), licenseId: 'confirmed' },
    })).rejects.toThrow('commit does not match its frozen upstream')
  })

  it('whitelists every evaluated conditional expression and treats unsupported forms as failures', () => {
    expect(runtime.validateConditions('<!-- #if ALIPAY -->\r\n<!-- #endif -->\n <!-- #if WECHAT -->\n<!-- #endif -->\n<!-- #if ALIPAY || WECHAT -->\n<!-- #endif -->')).toEqual(['ALIPAY', 'WECHAT', 'ALIPAY || WECHAT'])
    for (const condition of ['globalThis.compromised = true', 'ALIPAY || process.exit()', 'ALIPAY/*comment*/', 'ALIPAY && WECHAT', 'ALIPAY || WECHAT; run()']) {
      expect(() => runtime.validateConditions(`<!-- #if ${condition} -->`)).toThrow('Unapproved upstream conditional expression')
    }
    expect(() => runtime.validateConditions('/// #if ALIPAY')).toThrow('Unapproved')
    expect(() => runtime.validateConditions('<!-- #ifdef ALIPAY -->')).toThrow('Unapproved')
  })

  it('uses the official supportPlatform allowlist for components and leaves demos unrestricted', () => {
    expect(runtime.supportsWechat('---\nsupportPlatform: ["alipay", \'wechat\']\n---')).toBe(true)
    expect(runtime.supportsWechat('supportPlatform: [alipay]')).toBe(false)
    expect(runtime.supportsWechat('# no declared restriction')).toBe(true)
    expect(runtime.selectTemplate('src/AliOnly/index.axml', 'weapp', ['Card'])).toBe('official-wechat-component-allowlist')
    expect(runtime.selectTemplate('copilot/Bubble/index.axml', 'weapp', ['Bubble'])).toBeUndefined()
    expect(runtime.selectTemplate('demo/pages/AliOnly/index.axml', 'weapp', [])).toBeUndefined()
    expect(runtime.selectTemplate('src/Card/__tests__/index.axml', 'alipay', [])).toBe('official-test-exclusion')
    expect(runtime.selectTemplate('scripts/anything.js', 'alipay', [])).toBe('outside-official-axml-task')
  })

  it('freezes each stage, preserves compiler output and records official platform definitions', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ant-pipeline-'))
    directories.push(directory)
    const selected = selectFrameworkTarget(await readFrameworkCatalog(), 'ant-design-mini', '3.4.3', 'weapp')
    const project = createControlledProject(selected.release, selected.target)
    for (const [file, source] of Object.entries(project.files)) {
      await writeProjectFile(directory, file, source)
    }
    const fixtures = antFixtureFiles()
    for (const [file, source] of Object.entries(fixtures)) {
      await writeProjectFile(directory, `src/${file}`, source)
    }
    const definitions: unknown[] = []
    const compilerOptions: Array<{ platform: string, customMapping: object, camelCaseProperty: boolean }> = []
    const preprocessed = '<view>官方预处理边界 😀</view>\r\n'
    const output = '<view>官方最终输出 &amp;</view>\n'
    const providers: Providers = {
      ifdef(options, configuration) {
        definitions.push(options)
        expect(configuration).toMatchObject({ insertBlanks: false, extname: expect.arrayContaining(['axml']) })
        return new Transform({ objectMode: true, transform(file: VinylFile, _encoding, callback) {
          file.contents = Buffer.from(preprocessed)
          callback(null, file)
        } })
      },
      TransformCompiler: class {
        constructor(options: unknown) {
          compilerOptions.push(options as typeof compilerOptions[number])
        }

        compile(source: string) {
          expect(source).toBe(preprocessed)
          return output
        }
      },
      Vinyl: class {
        contents: Buffer
        constructor(options: VinylFile) {
          this.contents = options.contents
        }
      },
    }
    for (const mode of ['development', 'production']) {
      await runtime.main(mode, 'weapp', `out/${mode}`, providers, directory)
      const report = JSON.parse(await readFile(path.join(directory, `out/${mode}/pipeline.json`), 'utf8')) as PipelineReport
      expect(report.definitions).toEqual({ platform: 'WECHAT', WECHAT: true, ALIPAY: false })
      expect(report.allowList).toEqual(['Bubble', 'Card'])
      expect(report.excluded).toContainEqual({ file: 'src/AliOnly/index.axml', reason: 'official-wechat-component-allowlist' })
      expect(report.transformations).toHaveLength(3)
      for (const record of report.transformations) {
        expect(record.input.sha256).toBe(corpusHash(fixtures[record.input.file]!))
        expect(record.preprocessed.sha256).toBe(corpusHash(preprocessed))
        expect(record.output.sha256).toBe(corpusHash(output))
        expect(record.preprocessed.file).toMatch(/\.axml\.txt$/)
        expect(record.output.file).toMatch(/\.wxml$/)
        expect(await readFile(path.join(directory, `out/${mode}`, record.preprocessed.file), 'utf8')).toBe(preprocessed)
        expect(await readFile(path.join(directory, `out/${mode}`, record.output.file), 'utf8')).toBe(output)
      }
    }
    await runtime.main('development', 'alipay', 'out/alipay', providers, directory)
    const alipay = JSON.parse(await readFile(path.join(directory, 'out/alipay/pipeline.json'), 'utf8')) as PipelineReport
    expect(alipay.definitions).toEqual({ platform: 'ALIPAY', WECHAT: false, ALIPAY: true })
    expect(alipay.transformations).toHaveLength(4)
    expect(alipay.transformations.every(record => record.output.file.endsWith('.axml'))).toBe(true)
    expect(definitions).toHaveLength(10)
    expect(compilerOptions[0]).toMatchObject({ platform: 'WECHAT', camelCaseProperty: true, customMapping: { view: { onTouchStart: 'bindtouchstart' } } })
    expect(compilerOptions.at(-1)).toEqual({ platform: 'ALIPAY', camelCaseProperty: true, customMapping: {} })
  })
})
