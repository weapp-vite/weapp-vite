import type { Plugin } from 'vite'
import { access, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync } from 'node:zlib'

const runtimeRoot = fileURLToPath(new URL('../fixtures/runtime/', import.meta.url))
const runtimeFiles = [
  'app.js',
  'app.wxss',
  'nsh/nsh-mp.js',
  'nsh/tree.js',
  'nsh/canvas.js',
  'pages/index/index.js',
  'pages/index/index.json',
  'pages/index/index.wxml',
  'pages/index/index.wxss',
  'components/nsh-node/index.js',
  'components/nsh-node/index.json',
  'components/nsh-node/index.wxml',
  'components/nsh-node/index.wxss',
] as const
const generatedFiles = [
  ...runtimeFiles,
  'app.json',
  'sitemap.json',
  'project.config.json',
  'nsh/app.wasm.br',
] as const

export interface NshPlatformRuntimeOptions {
  wasm: string
  appName?: string
  appId?: string
  appid?: string
  outputRoot?: string
}

function normalizeOutputRoot(outputRoot = '') {
  if (outputRoot.startsWith('/') || outputRoot.startsWith('\\')) {
    throw new Error(`[nsh-platform-playground] Invalid outputRoot: ${outputRoot}`)
  }
  const normalized = outputRoot.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (/^[a-z]:\//i.test(normalized) || normalized.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new Error(`[nsh-platform-playground] Invalid outputRoot: ${outputRoot}`)
  }
  return normalized.split('/').filter(Boolean).join('/')
}

function outputPath(root: string, file: string) {
  return root ? `${root}/${file}` : file
}

function isWithinRoot(root: string, target: string) {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function jsonAsset(fileName: string, value: unknown) {
  return { type: 'asset' as const, fileName, source: `${JSON.stringify(value, null, 2)}\n` }
}

export function nshPlatformRuntime(options: NshPlatformRuntimeOptions): Plugin {
  if (!options || typeof options.wasm !== 'string' || options.wasm.length === 0) {
    throw new Error('[nsh-platform-playground] `wasm` must be a non-empty path.')
  }
  if (options.appId !== undefined && options.appid !== undefined && options.appId !== options.appid) {
    throw new Error('[nsh-platform-playground] `appId` and `appid` must match when both are provided.')
  }

  const outputRoot = normalizeOutputRoot(options.outputRoot)
  let root = process.cwd()
  let publicDir: string | false = false
  let wasmFile = ''
  let appName = options.appName ?? 'NSH Mini Program Runtime Demo'
  let appId = options.appId ?? options.appid ?? 'touristappid'

  return {
    name: 'nsh-platform-playground:runtime',
    configResolved(config) {
      root = config.root
      publicDir = config.publicDir
      wasmFile = path.resolve(root, options.wasm)
      appName = options.appName ?? appName
      appId = options.appId ?? options.appid ?? appId
    },
    async buildStart() {
      if (!isWithinRoot(root, wasmFile)) {
        this.error(`[nsh-platform-playground] WASM path must stay within the Vite root: ${options.wasm}`)
      }
      try {
        await access(wasmFile)
      }
      catch {
        this.error(`[nsh-platform-playground] WASM file does not exist: ${path.relative(root, wasmFile).replaceAll('\\', '/')}`)
      }
      let realPaths: [string, string]
      try {
        realPaths = await Promise.all([
          realpath(root),
          realpath(wasmFile),
        ])
      }
      catch {
        throw new Error(`[nsh-platform-playground] Unable to inspect WASM input: ${options.wasm}`)
      }
      const [rootRealPath, wasmRealPath] = realPaths
      const wasmStats = await stat(wasmFile).catch(() => {
        throw new Error(`[nsh-platform-playground] Unable to inspect WASM input: ${options.wasm}`)
      })
      if (!wasmStats.isFile()) {
        this.error(`[nsh-platform-playground] WASM input is not a file: ${path.relative(root, wasmFile).replaceAll('\\', '/')}`)
      }
      if (!isWithinRoot(rootRealPath, wasmRealPath)) {
        this.error(`[nsh-platform-playground] WASM path must stay within the Vite root: ${options.wasm}`)
      }

      this.addWatchFile(wasmFile)
      const outputNames = new Set<string>()
      for (const file of runtimeFiles) {
        const outputName = outputPath(outputRoot, file)
        if (outputNames.has(outputName)) {
          this.error(`[nsh-platform-playground] Duplicate emitted project path: ${outputName}`)
        }
        outputNames.add(outputName)
        const sourceFile = path.join(runtimeRoot, file)
        try {
          await access(sourceFile)
        }
        catch {
          this.error(`[nsh-platform-playground] Runtime snapshot is missing: ${file}`)
        }
        this.addWatchFile(sourceFile)
      }

      for (const file of ['app.json', 'sitemap.json', 'project.config.json', 'nsh/app.wasm.br']) {
        const outputName = outputPath(outputRoot, file)
        if (outputNames.has(outputName)) {
          this.error(`[nsh-platform-playground] Duplicate emitted project path: ${outputName}`)
        }
        outputNames.add(outputName)
      }

      for (const file of generatedFiles) {
        const rootFile = path.resolve(root, outputPath(outputRoot, file))
        try {
          await access(rootFile)
        }
        catch {
          continue
        }
        this.error(`[nsh-platform-playground] Refusing to overwrite source file: ${path.relative(root, rootFile).replaceAll('\\', '/')}`)
      }

      if (publicDir) {
        for (const file of generatedFiles) {
          const publicFile = path.resolve(publicDir, outputPath(outputRoot, file))
          try {
            await access(publicFile)
          }
          catch {
            continue
          }
          this.error(`[nsh-platform-playground] Refusing to overwrite public asset: ${path.relative(publicDir, publicFile).replaceAll('\\', '/')}`)
        }
      }
    },
    async generateBundle(_options, bundle) {
      const reservedNames = new Set(generatedFiles.map(file => outputPath(outputRoot, file)))
      for (const item of Object.values(bundle)) {
        if (reservedNames.has(item.fileName)) {
          this.error(`[nsh-platform-playground] Output path is already emitted by another plugin: ${item.fileName}`)
        }
      }

      const emit = this.emitFile.bind(this)
      for (const file of runtimeFiles) {
        emit({
          type: 'asset',
          fileName: outputPath(outputRoot, file),
          source: await readFile(path.join(runtimeRoot, file)),
        })
      }

      emit({
        type: 'asset',
        fileName: outputPath(outputRoot, 'nsh/app.wasm.br'),
        source: wasmFile.endsWith('.br')
          ? await readFile(wasmFile)
          : brotliCompressSync(await readFile(wasmFile)),
      })
      emit(jsonAsset(outputPath(outputRoot, 'app.json'), {
        pages: ['pages/index/index'],
        window: { navigationBarTitleText: appName },
        sitemapLocation: 'sitemap.json',
        style: 'v2',
      }))
      emit(jsonAsset(outputPath(outputRoot, 'sitemap.json'), {
        rules: [{ action: 'allow', page: '*' }],
      }))
      emit(jsonAsset(outputPath(outputRoot, 'project.config.json'), {
        description: appName,
        appid: appId,
        projectname: appName,
        compileType: 'miniprogram',
        setting: { es6: false, enhance: false, minified: true, urlCheck: false },
        packOptions: { ignore: [], include: [] },
      }))
    },
  }
}

export const nshPlatformRuntimeFiles = runtimeFiles
