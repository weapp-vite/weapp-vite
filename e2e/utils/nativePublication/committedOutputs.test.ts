import type { NativePublicationReceipt } from './files'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { captureNativePublication } from '.'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationGeneration, nativePublicationHash, readNativePublicationInputs } from './files'

it.each(['removed', 'missing-owned', 'changed-owned', 'stale-retired', 'unproven', 'foreign-inputs'] as const)('requires committed ownership and matching disk bytes when replacing earlier outputs: %s', async (variant) => {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-ownership-'))
  try {
    await mkdir(path.join(project, 'src'))
    await mkdir(path.join(project, 'dist'))
    const script = 'Page({})'
    const style = '.optional { color: blue; }'
    await writeFile(path.join(project, 'src/app.js'), script)
    await writeFile(path.join(project, 'dist/app.js'), variant === 'changed-owned' ? 'Page({ stale: true })' : script)
    if (variant === 'stale-retired') {
      await writeFile(path.join(project, 'dist/optional.wxss'), style)
    }
    const inputs = await readNativePublicationInputs(project)
    const finalOutputs = { 'app.js': nativePublicationHash(script) }
    const initialOutputs = { ...finalOutputs, 'optional.wxss': nativePublicationHash(style) }
    let output = ''
    const append = (receipt: NativePublicationReceipt) => {
      output += `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify(receipt)}\n`
    }
    const publication = captureNativePublication({ getOutput: () => output, waitFor: async task => task }, project)
    append({ boundary: 'native-byte-write', inputs, outputs: initialOutputs, generation: nativePublicationGeneration(initialOutputs) })
    const outputs = variant === 'missing-owned' ? initialOutputs : finalOutputs
    append({
      boundary: 'native-byte-write',
      inputs: variant === 'foreign-inputs' ? { 'src/app.js': nativePublicationHash('foreign source') } : inputs,
      outputs,
      generation: nativePublicationGeneration(outputs),
      ...(variant === 'unproven' ? {} : { outputScope: 'committed', publicationEpoch: 2 }),
    })
    if (variant === 'removed') {
      await expect(publication.wait(1_000)).resolves.toMatchObject({ outputScope: 'committed', outputs: finalOutputs })
    }
    else {
      await expect(publication.wait(100)).rejects.toThrow('final source generation')
    }
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})

it.each([undefined, -1, 1.5])('rejects complete ownership without a valid publication epoch: %s', async (publicationEpoch) => {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-epoch-'))
  try {
    await mkdir(path.join(project, 'src'))
    await writeFile(path.join(project, 'src/app.js'), 'Page({})')
    const inputs = await readNativePublicationInputs(project)
    const outputs = { 'app.js': nativePublicationHash('Page({})') }
    let output = ''
    const publication = captureNativePublication({ getOutput: () => output, waitFor: async task => task }, project)
    output = `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify({
      boundary: 'native-byte-write',
      inputs,
      outputs,
      generation: nativePublicationGeneration(outputs),
      outputScope: 'committed',
      publicationEpoch,
    })}\n`
    await expect(publication.wait(100)).rejects.toThrow('Invalid committed native publication epoch')
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})
