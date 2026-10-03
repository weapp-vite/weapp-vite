import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { asset } from '../asset'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from '../outputFinalizer'

it('keeps compiled outputs authoritative over public files across partial native writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-public-publication-'))
  const src = path.join(root, 'src')
  const publicDir = path.join(root, 'public')
  const outDir = path.join(root, 'dist')
  await mkdir(src)
  await mkdir(path.join(publicDir, 'components'), { recursive: true })
  await mkdir(path.join(publicDir, 'independent'), { recursive: true })
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
    configService: {
      isDev: true,
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: src,
      outDir,
      outputExtensions: { wxss: 'wxss' },
      relativeOutputPath: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
    },
  } as unknown as CompilerContext
  const independentOutput = { output: [{ type: 'asset' as const, fileName: 'independent/card.js', source: 'compiled independent', names: [], originalFileNames: [] }] }
  runtimeState.build.independent.outputs.set('independent', independentOutput)
  runtimeState.build.independent.pendingOutputs.push(Promise.resolve(independentOutput))
  let initial = true
  const plugins = [
    {
      name: 'fixture',
      resolveId: (id: string) => id === 'virtual:entry' ? id : undefined,
      load: (id: string) => id === 'virtual:entry' ? 'globalThis.compiledApp = true' : undefined,
      generateBundle(this: { emitFile: (asset: object) => void }) {
        if (initial) {
          this.emitFile({ type: 'asset', fileName: 'components/card.js', source: 'compiled component' })
        }
      },
    },
    ...asset(ctx),
    createOutputFinalizerPlugin(ctx),
    createOutputPublicationPlugin(ctx),
  ]
  const run = () => build({ root, configFile: false, logLevel: 'silent', publicDir, plugins, build: {
    emptyOutDir: false,
    outDir,
    minify: false,
    rolldownOptions: { input: 'virtual:entry', output: { entryFileNames: 'app.js' } },
  } })
  try {
    await writeFile(path.join(publicDir, 'app.js'), 'PUBLIC APP')
    await writeFile(path.join(publicDir, 'components/card.js'), 'PUBLIC COMPONENT')
    await writeFile(path.join(publicDir, 'extra.txt'), 'public original')
    await writeFile(path.join(publicDir, 'independent/card.js'), 'PUBLIC INDEPENDENT')
    await writeFile(path.join(publicDir, 'standalone.wxml'), '<view>{{ rawPublicCall() }}</view>')
    await run()
    expect(await readFile(path.join(outDir, 'app.js'), 'utf8')).toContain('compiledApp')
    expect(await readFile(path.join(outDir, 'components/card.js'), 'utf8')).toBe('compiled component')
    initial = false
    runtimeState.build.hmr.isRebuild = true
    await writeFile(path.join(publicDir, 'app.js'), 'PUBLIC APP EDIT')
    await writeFile(path.join(publicDir, 'components/card.js'), 'PUBLIC COMPONENT EDIT')
    await writeFile(path.join(publicDir, 'extra.txt'), 'public update')
    await run()
    expect(await readFile(path.join(outDir, 'app.js'), 'utf8')).toContain('compiledApp')
    expect(await readFile(path.join(outDir, 'components/card.js'), 'utf8')).toBe('compiled component')
    expect(await readFile(path.join(outDir, 'extra.txt'), 'utf8')).toBe('public update')
    expect(await readFile(path.join(outDir, 'independent/card.js'), 'utf8')).toBe('compiled independent')
    expect(await readFile(path.join(outDir, 'standalone.wxml'), 'utf8')).toBe('<view>{{ rawPublicCall() }}</view>')
    await rm(path.join(publicDir, 'extra.txt'))
    await run()
    await expect(readFile(path.join(outDir, 'extra.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
    await writeFile(path.join(publicDir, 'extra.txt'), 'public update')
    await run()
    expect(await readFile(path.join(outDir, 'extra.txt'), 'utf8')).toBe('public update')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
