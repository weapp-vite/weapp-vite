import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationGeneration, nativePublicationHash, readNativePublicationInputs } from './files'
import { captureNativePublication } from './index'

const roots: string[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-publication-inputs-'))
  roots.push(root)
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  return root
}

it('preserves ordinary source hashes including a real source directory named dist', async () => {
  const root = await fixture({ 'src/app.ts': 'app', 'src/dist/keep.ts': 'source', 'src/save.tmp': 'temporary', 'weapp-vite.config.ts': 'config', 'dist/app.js': 'output' })
  expect(await readNativePublicationInputs(root)).toEqual({
    'src/app.ts': nativePublicationHash('app'),
    'src/dist/keep.ts': nativePublicationHash('source'),
    'weapp-vite.config.ts': nativePublicationHash('config'),
  })
})

it('excludes the exact custom output and generated tools while preserving same-name source directories', async () => {
  const root = await fixture({
    'app.ts': 'app',
    'output/miniapp/app.js': 'output',
    'packages/output/miniapp/source.ts': 'same-name source',
    'dist/source.ts': 'dist source',
    '.weapp-vite/hmr-profile.jsonl': 'profile',
    '.weapp-vite-e2e-12345678-1234-1234-1234-123456789abc.config.mjs': 'wrapper',
    '.weapp-vite-e2e-source.config.mjs': 'source config',
    'node_modules/pkg/index.js': 'dependency',
    '.tmp/report.json': 'report',
    '.git/config': 'repository',
  })
  const options = { sourceRoot: '.', outputRoot: 'output/miniapp' }
  const inputs = await readNativePublicationInputs(root, options)
  expect(inputs).toEqual({
    '.weapp-vite-e2e-source.config.mjs': nativePublicationHash('source config'),
    'app.ts': nativePublicationHash('app'),
    'dist/source.ts': nativePublicationHash('dist source'),
    'packages/output/miniapp/source.ts': nativePublicationHash('same-name source'),
  })
  await writeFile(path.join(root, 'output/miniapp/app.js'), 'next output')
  expect(await readNativePublicationInputs(root, options)).toEqual(inputs)
  await writeFile(path.join(root, 'dist/source.ts'), 'next source')
  expect(nativePublicationGeneration(await readNativePublicationInputs(root, options))).not.toBe(nativePublicationGeneration(inputs))
})

it.each([undefined, 'output/miniapp'])('validates native receipt bytes against %s output without consulting another dist', async (outputRoot) => {
  const output = outputRoot ?? 'dist'
  const root = await fixture({ 'src/app.ts': 'app', [`${output}/app.js`]: 'actual publication' })
  if (outputRoot) {
    await mkdir(path.join(root, 'dist'))
    await writeFile(path.join(root, 'dist/app.js'), 'stale unrelated output')
  }
  let log = ''
  const dev = { getOutput: () => log, waitFor: async <T>(task: Promise<T>) => task }
  const observation = captureNativePublication(dev, root, { outputRoot })
  const outputs = { 'app.js': nativePublicationHash('actual publication') }
  log = `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify({
    boundary: 'native-byte-write',
    generation: nativePublicationGeneration(outputs),
    inputs: await readNativePublicationInputs(root, { outputRoot }),
    outputs,
  })}\n`
  await expect(observation.wait(1_000)).resolves.toMatchObject({ outputs, outputOffset: log.length })
})
