import { expect, it } from 'vitest'
import { runModuleLoadingProcess } from '../../../test/utils/moduleLoadingProcess'

it('keeps upload parsers unloaded until real file credentials need parsing and expansion', async () => {
  const moduleUrl = new URL('./env.ts', import.meta.url).href
  const result = await runModuleLoadingProcess<{ initial: string[], disabled: string[], missing: string[], overridden: string[], expanded: string[], value: string }>(`
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const path = await import('node:path')
    const directory = await mkdtemp(path.join(tmpdir(), 'weapp-env-loading-'))
    const parsers = () => loadedModules().filter(url => url.includes('/node_modules/dotenv/') || url.includes('/node_modules/dotenv-expand/'))
    try {
      const { loadUploadEnv } = await import(${JSON.stringify(moduleUrl)})
      const initial = parsers()
      await loadUploadEnv(directory, 'production', undefined, false)
      const disabled = parsers()
      await loadUploadEnv(directory, 'production')
      const missing = parsers()
      process.env.UPLOAD_LOADING_OVERRIDE = ''
      await writeFile(path.join(directory, '.env'), 'UPLOAD_LOADING_OVERRIDE=unused')
      await loadUploadEnv(directory, 'production')
      const overridden = parsers()
      await writeFile(path.join(directory, '.env'), 'UPLOAD_LOADING_VALUE=$UPLOAD_LOADING_SOURCE\\nUPLOAD_LOADING_SOURCE=expanded')
      const env = await loadUploadEnv(directory, 'production')
      process.stdout.write(JSON.stringify({ initial, disabled, missing, overridden, expanded: parsers(), value: env.UPLOAD_LOADING_VALUE }))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  `)
  expect(result.initial).toEqual([])
  expect(result.disabled).toEqual([])
  expect(result.missing).toEqual([])
  expect(result.overridden.some(url => url.includes('/node_modules/dotenv/'))).toBe(true)
  expect(result.overridden.some(url => url.includes('/node_modules/dotenv-expand/'))).toBe(false)
  expect(result.expanded.some(url => url.includes('/node_modules/dotenv-expand/'))).toBe(true)
  expect(result.value).toBe('expanded')
}, 20_000)

it('creates a real dry-run upload target without reading environment files or loading the expander', async () => {
  const moduleUrl = new URL('./builtProject.ts', import.meta.url).href
  const envUrl = new URL('./env.ts', import.meta.url).href
  const result = await runModuleLoadingProcess<{ before: boolean, after: boolean, platform: string }>(`
    const { mkdtemp, mkdir, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const path = await import('node:path')
    const directory = await mkdtemp(path.join(tmpdir(), 'weapp-upload-dry-loading-'))
    const expander = pathToFileURL(createRequire(${JSON.stringify(envUrl)}).resolve('dotenv-expand')).href
    try {
      const { createUploadTarget } = await import(${JSON.stringify(moduleUrl)})
      const before = loadedModules().includes(expander)
      // 如果 dry-run 误读凭据目录，真实 readFile 会失败。
      await mkdir(path.join(directory, '.env'))
      const target = await createUploadTarget({
        cwd: directory, mode: 'production', platform: 'weapp', outDir: path.join(directory, 'dist'),
        weappViteConfig: {}, packageJson: { name: 'dry-run-fixture', version: '1.0.0' },
        projectConfig: {}, multiPlatform: { enabled: false }, inlineConfig: {},
      }, { dryRun: true }, 'upload')
      process.stdout.write(JSON.stringify({ before, after: loadedModules().includes(expander), platform: target.platform }))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  `)
  expect(result.before).toBe(false)
  expect(result.after).toBe(false)
  expect(result.platform).toBe('weapp')
}, 20_000)
