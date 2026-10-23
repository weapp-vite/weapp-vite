import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { WxmlValidationContext } from '../../types'
import { realpath } from 'node:fs/promises'
import os from 'node:os'
import { setImmediate } from 'node:timers/promises'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { build } from 'vite'
import { expect, it, vi } from 'vitest'
import { classicIdeConfigLeasePath, ideAssetWatchLeasePath } from '../../runtime/classicIdeConfig/leases'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../runtime/runtimeState'
import { installIdeAssetWatch } from '../../runtime/statefulHmr/assetWatch'
import { writeStatefulHmrOutput } from '../../runtime/statefulHmr/outputWriter'
import { beginWxmlDependencies, deferWxmlDependencyCommit, getWxmlWatchFiles } from '../../wxml/processing/dependencies'
import { prepareOutputOwnership } from './ownership'
import { createOutputPublicationPlugin } from './publication'

async function fixture() {
  const root = await realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'classic-handoff-epoch-')))
  const outDir = path.join(root, 'dist')
  const configPath = path.join(root, 'project.private.config.json')
  const original = '{"setting":{"compileHotReLoad":true}}\n'
  const configService = {
    cwd: root,
    outDir,
    isDev: true,
    platform: 'weapp',
    multiPlatform: { enabled: false },
    projectPrivateConfigPath: configPath as string | undefined,
    weappViteConfig: {
      wxml: {
        validate: (_code: string, options: WxmlValidationContext) => {
          options.addWatchFile('next-validate.json')
        },
      },
    },
  }
  const ctx = {
    runtimeState: createRuntimeState(),
    scanService: { independentSubPackageMap: new Map() },
    configService,
  } as unknown as CompilerContext
  for (const stage of ['transform', 'validate'] as const) {
    const baseline = beginWxmlDependencies(ctx, 'main', false, stage)
    baseline.template('page.wxml')(`old-${stage}.json`)
    baseline.commit()
  }
  const runtime = getHmrRuntimeSession(ctx)
  await fs.writeFile(configPath, original)
  await writeStatefulHmrOutput(outDir, [{ type: 'asset', fileName: 'app.js', source: 'stateful app' }])
  await prepareOutputOwnership(ctx, outDir, ['app.js'], false, [], 'stateful-hmr')()
  const restore = await installIdeAssetWatch({ configPath, outDir })
  runtime.requestClassic({ code: 'runtime-contract', message: 'unsupported update' })
  await restore(runtime.classicIdeConfig)
  const installed = await fs.readFile(configPath, 'utf8')
  const publication = createOutputPublicationPlugin(ctx)
  const source: Plugin = {
    name: 'classic-epoch-fixture',
    resolveId: id => id === 'virtual:app' ? id : undefined,
    load: id => id === 'virtual:app' ? 'globalThis.classicEpochPublication = true' : undefined,
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'page.wxml', source: '<view/>' })
      const transform = beginWxmlDependencies(ctx, 'main', false)
      transform.template('page.wxml')('next-transform.json')
      deferWxmlDependencyCommit(ctx, transform.publish)
    },
  }
  const render = () => build({
    root,
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: [source, publication],
    build: {
      outDir,
      emptyOutDir: false,
      minify: false,
      rolldownOptions: { input: 'virtual:app', output: { entryFileNames: 'app.js' } },
    },
  })
  const boundary = (name: 'buildStart' | 'closeBundle') => {
    const hook = publication[name]
    const handler = typeof hook === 'function' ? hook : hook?.handler
    if (!handler) {
      throw new Error(`Missing publication hook ${name}`)
    }
    return (handler as () => unknown).call({ meta: { watchMode: false } })
  }
  const dependencyGraph = () => Object.fromEntries([...ctx.runtimeState.wxmlProcessing.dependencies].map(([key, templates]) => [
    key,
    Object.fromEntries([...templates].map(([name, files]) => [name, [...files].map(file => path.basename(file)).sort()])),
  ]))
  return { root, outDir, configPath, original, installed, ctx, configService, runtime, render, boundary, dependencyGraph }
}

it.each(['changed', 'missing'] as const)('rejects %s private config paths before publishing to a pending output root', async (replacement) => {
  const project = await fixture()
  const owner = project.runtime.classicIdeConfig
  const nextFile = path.join(project.root, 'next.private.config.json')
  const nextOriginal = '{"setting":{"compileHotReLoad":true},"description":"next config"}'
  const oldDependencies = project.dependencyGraph()
  try {
    await fs.writeFile(nextFile, nextOriginal)
    project.configService.projectPrivateConfigPath = replacement === 'changed' ? nextFile : undefined
    await expect(project.render()).rejects.toThrow('待交接 IDE 配置路径不匹配')
    expect(await fs.readFile(path.join(project.outDir, 'app.js'), 'utf8')).toBe('stateful app')
    expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.installed)
    expect(await fs.readFile(nextFile, 'utf8')).toBe(nextOriginal)
    expect(project.runtime.outputGenerations.size).toBe(0)
    expect(project.dependencyGraph()).toEqual(oldDependencies)
    expect(project.ctx.runtimeState.wxmlProcessing.pending.size).toBe(0)
    expect(owner.hasPendingAssetHandoff(project.configPath, project.outDir)).toBe(true)
    expect(await fs.pathExists(ideAssetWatchLeasePath(project.configPath))).toBe(true)
    expect(await fs.pathExists(classicIdeConfigLeasePath(project.configPath))).toBe(false)
    expect(await fs.pathExists(classicIdeConfigLeasePath(nextFile))).toBe(false)
    project.configService.projectPrivateConfigPath = project.configPath
    await project.render()
    expect(await fs.readFile(path.join(project.outDir, 'app.js'), 'utf8')).toContain('classicEpochPublication')
    await owner.close()
    expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.original)
    expect(await fs.readFile(nextFile, 'utf8')).toBe(nextOriginal)
  }
  finally {
    await owner.close()
    await fs.remove(project.root)
  }
})

it.each([
  { boundary: 'buildStart', block: 'asset-check' },
  { boundary: 'closeBundle', block: 'asset-check' },
  { boundary: 'closeBundle', block: 'config-write' },
] as const)('keeps native bytes and dependency ownership when $boundary interrupts $block', async ({ boundary, block }) => {
  const project = await fixture()
  const owner = project.runtime.classicIdeConfig
  const assetJournal = ideAssetWatchLeasePath(project.configPath)
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const oldDependencies = project.dependencyGraph()
  let reads = 0
  const read = fs.readJSON.bind(fs)
  vi.spyOn(fs, 'readJSON').mockImplementation(async (file, ...args) => {
    const value = await read(file, ...args)
    if (block === 'asset-check' && file === assetJournal && ++reads === 3) {
      entered.resolve()
      await release.promise
    }
    return value
  })
  const write = fs.writeFile.bind(fs)
  vi.spyOn(fs, 'writeFile').mockImplementation(async (file, ...args) => {
    if (block === 'config-write' && file === project.configPath && String(args[0]).includes('false')) {
      entered.resolve()
      await release.promise
    }
    return write(file, ...args)
  })
  const rendering = project.render()
  const outcome = rendering.then(() => undefined, (error: unknown) => error)
  let closing: Promise<unknown> | undefined
  try {
    await entered.promise
    expect(project.dependencyGraph()).toEqual(oldDependencies)
    expect(project.ctx.runtimeState.wxmlProcessing.pending.size).toBe(2)
    expect(project.runtime.outputGenerations.size).toBe(0)
    if (boundary === 'buildStart') {
      await project.boundary('buildStart')
    }
    else {
      let closed = false
      closing = Promise.resolve(project.boundary('closeBundle')).then(() => {
        closed = true
      })
      await setImmediate()
      expect(closed).toBe(false)
      expect(await fs.pathExists(assetJournal)).toBe(true)
    }
    release.resolve()
    expect(await outcome).toBeInstanceOf(Error)
    await closing
    expect(await fs.readFile(path.join(project.outDir, 'app.js'), 'utf8')).toBe('stateful app')
    expect(project.runtime.outputGenerations.size).toBe(0)
    expect(project.dependencyGraph()).toEqual(oldDependencies)
    expect(project.ctx.runtimeState.wxmlProcessing.pending.size).toBe(0)
    expect([...project.ctx.runtimeState.wxmlProcessing.failed.keys()].sort()).toEqual(['transform:main', 'validate:main'])
    expect(getWxmlWatchFiles(project.ctx).map(file => path.basename(file)).sort()).toEqual([
      'next-transform.json',
      'next-validate.json',
      'old-transform.json',
      'old-validate.json',
    ])
    if (block === 'asset-check') {
      expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.installed)
      expect(owner.hasPendingAssetHandoff(project.configPath)).toBe(true)
      await project.render()
      expect(await fs.readFile(path.join(project.outDir, 'app.js'), 'utf8')).toContain('classicEpochPublication')
      expect(getWxmlWatchFiles(project.ctx).map(file => path.basename(file)).sort()).toEqual(['next-transform.json', 'next-validate.json'])
    }
    else {
      expect(await fs.readJSON(project.configPath)).toEqual({ setting: { compileHotReLoad: false } })
      expect(owner.hasPendingAssetHandoff(project.configPath)).toBe(false)
    }
    await owner.close()
    expect(await fs.readFile(project.configPath, 'utf8')).toBe(project.original)
  }
  finally {
    release.resolve()
    await outcome
    await closing
    vi.restoreAllMocks()
    await owner.close()
    await fs.remove(project.root)
  }
})
