import type { OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { NativePublicationReceipt } from './files'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import path from 'pathe'
import { build } from 'vite'
import { expect, it, vi } from 'vitest'
import { captureNativePublication } from '.'
import { createNativePublicationObservation } from '../../../packages/weapp-vite/src/plugins/outputFinalizer/publicationObservation'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationHash } from './files'
import { nativePublicationPlugin } from './plugin'

it.each(['before', 'after'].flatMap(position => ['dist', 'output/miniapp'].map(outputRoot => ({ position, outputRoot }))))('observes production commits with publisher $position observer in $outputRoot across two writes', async ({ position, outputRoot }) => {
  // Vite 会规范化项目根，输出观察与发布者必须使用同一真实目录身份。
  const project = await realpath(await mkdtemp(path.join(tmpdir(), 'production-publication-')))
  const scopes = new Map<string, ReturnType<typeof createNativePublicationObservation>>()
  let output = ''
  let observed = false
  const stdout = process.stdout.write.bind(process.stdout)
  const capture = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array, ...args: unknown[]) => {
    if (String(chunk).startsWith(NATIVE_PUBLICATION_PREFIX)) {
      output += String(chunk)
      return true
    }
    return (stdout as (...values: unknown[]) => boolean)(chunk, ...args)
  }) as typeof process.stdout.write)
  const root = path.join(project, outputRoot)
  const publisher: Plugin = {
    name: WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME,
    enforce: 'post',
    api: {
      getEpoch: () => 1,
      captureEpoch: () => {
        observed = true
        return 1
      },
      whenCommitted: (directory: string, epoch: number) => {
        return scopes.get(directory)?.whenCommitted(epoch) ?? Promise.resolve(undefined)
      },
    },
    generateBundle: {
      order: 'post',
      handler(options) {
        const directory = path.resolve(project, options.dir!)
        let scope = scopes.get(directory)
        if (!scope) {
          scope = createNativePublicationObservation(directory, new Map())
          scopes.set(directory, scope)
        }
        // 后一轮必须取得新观察，不能借用前一份已提交字节。
        scope.invalidate()
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      handler(options, bundle) {
        scopes.get(path.resolve(project, options.dir!))!.commit(1, bundle as OutputBundle, [], observed)
      },
    },
  }
  try {
    await mkdir(path.join(project, 'src'))
    await writeFile(path.join(project, 'src/app.js'), 'console.info("PRODUCTION")')
    const dev = { getOutput: () => output, waitFor: async <T>(task: Promise<T>) => task }
    let final: NativePublicationReceipt | undefined
    for (const banner of ['/* first publication */', '/* second publication */']) {
      observed = false
      const observer = nativePublicationPlugin({ outputRoot })
      const pending = captureNativePublication(dev, project, { outputRoot })
      await build({
        root: project,
        configFile: false,
        logLevel: 'silent',
        plugins: position === 'before' ? [publisher, observer] : [observer, publisher],
        build: {
          outDir: outputRoot,
          minify: false,
          rolldownOptions: {
            input: path.join(project, 'src/app.js'),
            output: { dir: root, entryFileNames: 'app.js', banner },
          },
        },
      })
      final = await pending.wait(1_000)
    }
    const receipts = output.trim().split('\n').map(line => JSON.parse(line.slice(NATIVE_PUBLICATION_PREFIX.length)) as NativePublicationReceipt)
    expect(receipts).toHaveLength(2)
    expect(receipts.map(receipt => receipt.outputScope)).toEqual(['committed', 'committed'])
    expect(receipts[0]!.outputs['app.js']).not.toBe(receipts[1]!.outputs['app.js'])
    expect(final!.outputs['app.js']).toBe(nativePublicationHash(await readFile(path.join(root, 'app.js'))))
    expect(final!.outputs['app.js']).toBe(receipts[1]!.outputs['app.js'])
  }
  finally {
    for (const scope of scopes.values()) {
      scope.reset()
    }
    capture.mockRestore()
    await rm(project, { recursive: true, force: true })
  }
})
