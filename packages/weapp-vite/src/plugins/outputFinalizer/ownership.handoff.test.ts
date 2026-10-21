import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { resetEmittedOutputCaches } from '../../runtime/buildPlugin/outputs'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../runtime/runtimeState'
import { writeStatefulHmrOutput } from '../../runtime/statefulHmr/outputWriter'
import { prepareOutputOwnership } from './ownership'
import { createOutputPublicationPlugin } from './publication'

it.each(['same-context', 'replacement-context'] as const)('retires stateful output only after a complete native classic publication: %s', async (contextKind) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-output-handoff-'))
  const outDir = path.join(root, 'dist')
  const publicDir = path.join(root, 'public')
  const context = () => ({
    runtimeState: createRuntimeState(),
    scanService: { independentSubPackageMap: new Map() },
    configService: {
      cwd: root,
      outDir,
      isDev: true,
      platform: 'weapp',
      weappViteConfig: {},
    },
  }) as unknown as CompilerContext
  const initial = context()
  const session = getHmrRuntimeSession(initial)
  const classic = contextKind === 'same-context' ? initial : context()
  attachHmrRuntimeSession(classic, session)
  const retired = [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE, 'chunks/stateful-only.js']
  const statefulNames = [...retired, 'shared.js', 'independent/card.js', 'public.txt']
  let failGeneration = false
  const fixture: Plugin = {
    name: 'native-classic-handoff-fixture',
    resolveId: id => id === 'virtual:app' ? id : undefined,
    load: id => id === 'virtual:app' ? 'globalThis.classicNativeOutput = true' : undefined,
    generateBundle() {
      if (failGeneration) {
        throw new Error('classic generation failed')
      }
      this.emitFile({ type: 'asset', fileName: 'shared.js', source: 'classic shared output' })
    },
  }
  const publication = createOutputPublicationPlugin(classic)
  const render = (write = true) => {
    resetEmittedOutputCaches(classic.runtimeState)
    return build({
      root,
      configFile: false,
      logLevel: 'silent',
      publicDir,
      plugins: [fixture, publication],
      build: {
        outDir,
        emptyOutDir: false,
        minify: false,
        write,
        rolldownOptions: { input: 'virtual:app', output: { entryFileNames: 'app.js' } },
      },
    })
  }
  const expectRetiredPresent = async () => {
    for (const file of retired) {
      expect(await readFile(path.join(outDir, file), 'utf8')).toBe(`stateful ${file}`)
    }
  }
  try {
    await mkdir(publicDir)
    await writeFile(path.join(publicDir, 'public.txt'), 'classic public output')
    await writeStatefulHmrOutput(outDir, statefulNames.map(fileName => ({ type: 'asset', fileName, source: `stateful ${fileName}` })))
    await prepareOutputOwnership(initial, outDir, statefulNames, false, [], 'stateful-hmr')()
    await writeFile(path.join(outDir, 'user.txt'), 'unowned user output')
    session.requestClassic({ code: 'config-json', message: 'configuration changed' })
    failGeneration = true
    await expect(render()).rejects.toThrow('classic generation failed')
    await expectRetiredPresent()
    failGeneration = false
    await render(false)
    await expectRetiredPresent()

    const independent = { output: [{ type: 'asset' as const, fileName: 'independent/card.js', source: 'classic independent output', names: [], originalFileNames: [] }] }
    classic.runtimeState.build.independent.outputs.set('independent', independent)
    classic.runtimeState.build.independent.pendingOutputs.push(Promise.resolve(independent))
    classic.runtimeState.build.hmr.isRebuild = true
    classic.runtimeState.build.hmr.didEmitAllEntries = false
    await render()
    await expectRetiredPresent()
    classic.runtimeState.build.hmr.didEmitAllEntries = true
    await render()
    for (const file of retired) {
      await expect(readFile(path.join(outDir, file))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    expect(await readFile(path.join(outDir, 'app.js'), 'utf8')).toContain('classicNativeOutput')
    expect(await readFile(path.join(outDir, 'shared.js'), 'utf8')).toBe('classic shared output')
    expect(await readFile(path.join(outDir, 'independent/card.js'), 'utf8')).toBe('classic independent output')
    expect(await readFile(path.join(outDir, 'public.txt'), 'utf8')).toBe('classic public output')
    expect(await readFile(path.join(outDir, 'user.txt'), 'utf8')).toBe('unowned user output')
    await render()
    expect(session.outputOwnership.get(outDir.replaceAll('\\', '/'))?.get('stateful-hmr')?.size).toBe(0)
    expect(await readFile(path.join(outDir, 'public.txt'), 'utf8')).toBe('classic public output')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
