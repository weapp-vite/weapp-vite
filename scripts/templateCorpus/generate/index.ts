import type { SnapshotFormat } from './expected'
import type { FreezeFrameworkInputOptions } from './input'
import type { FrameworkFamily, GenerationIdentity, GenerationMode } from './types'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { corpusHash, corpusJson } from '../archive'
import { readFrameworkCatalog } from './catalog'
import { expectedSnapshotsToDocuments, extractStaticSnapshots } from './expected'
import { writeProjectFile } from './files'
import { prepareMatrixFixture } from './fixtures'
import { freezeFrameworkInput } from './input'
import { generateFramework } from './run'

export { antInputRecipe, antUpstream } from './ant'
export { readFrameworkCatalog, selectFrameworkTarget } from './catalog'
export { expectedSnapshotsToDocuments, extractStaticSnapshots } from './expected'
export { prepareMatrixFixture } from './fixtures'
export { freezeFrameworkInput } from './input'
export { generateFramework } from './run'
export type * from './types'

export async function generateMain(args = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({ args, options: {
    'framework': { type: 'string' },
    'version': { type: 'string' },
    'target': { type: 'string' },
    'workspace': { type: 'string' },
    'input': { type: 'string' },
    'identity': { type: 'string' },
    'dependencies': { type: 'string' },
    'mode': { type: 'string', multiple: true },
    'execute': { type: 'boolean', default: false },
    'retry': { type: 'boolean', default: false },
    'matrix': { type: 'boolean', default: false },
    'freeze-input': { type: 'string' },
    'cache-dir': { type: 'string' },
    'output-dir': { type: 'string' },
    'extract-expected': { type: 'string' },
    'source-path': { type: 'string' },
    'profile': { type: 'string' },
    'snapshot-format': { type: 'string', default: 'jest' },
    'snapshot-key': { type: 'string', multiple: true },
    'snapshot-file': { type: 'string', multiple: true },
    'prepare-fixture': { type: 'boolean', default: false },
    'fixture-id': { type: 'string' },
  } })
  if (values.matrix) {
    process.stdout.write(`${corpusJson(await readFrameworkCatalog())}\n`)
    return
  }
  if (values['prepare-fixture']) {
    assert.ok(values.framework && values.version && values['output-dir'], 'Controlled fixture preparation requires --framework --version --output-dir')
    const fixture = await prepareMatrixFixture(values.framework as FrameworkFamily, values.version, values['output-dir'], values.target)
    process.stdout.write(`${corpusJson(fixture.provenance)}\n`)
    return
  }
  if (values['freeze-input']) {
    assert.ok(values['cache-dir'] && values['output-dir'], 'Freezing input requires --cache-dir and --output-dir')
    const recipe: unknown = JSON.parse(await readFile(values['freeze-input'], 'utf8'))
    assert.ok(recipe && typeof recipe === 'object' && 'source' in recipe && 'prefix' in recipe, 'Invalid frozen input recipe')
    const result = await freezeFrameworkInput({
      ...(recipe as Pick<FreezeFrameworkInputOptions, 'source' | 'prefix' | 'include' | 'exclude'>),
      cacheDir: values['cache-dir'],
      outputDir: values['output-dir'],
    })
    process.stdout.write(`${corpusJson({ id: result.id, identity: result.identity, treeFiles: result.treeFiles, selectedFiles: result.selectedFiles })}\n`)
    return
  }
  if (values['extract-expected']) {
    assert.ok(values.identity && values.profile && values['source-path'] && values['output-dir'], 'Expected snapshots require --identity --profile --source-path --output-dir')
    assert.ok(['jest', 'literal', 'jest-files'].includes(values['snapshot-format']!), 'Unknown static snapshot format')
    const parsedIdentity: unknown = JSON.parse(await readFile(values.identity, 'utf8'))
    assert.ok(parsedIdentity && typeof parsedIdentity === 'object', 'Invalid expected snapshot source identity')
    const original = await readFile(values['extract-expected'])
    const format = values['snapshot-format'] as SnapshotFormat
    const extraction = extractStaticSnapshots(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(original), format, values['snapshot-file'])
    const documents = expectedSnapshotsToDocuments(extraction, parsedIdentity as GenerationIdentity, values['source-path'], values.profile, format, values['snapshot-key'])
    await writeProjectFile(values['output-dir'], `upstream/${values['source-path']}`, original)
    await writeProjectFile(values['output-dir'], 'expected-documents.jsonl', documents.map(corpusJson).join('\n') + (documents.length ? '\n' : ''))
    await writeProjectFile(values['output-dir'], 'expected-extraction.json', `${corpusJson(extraction)}\n`)
    await writeProjectFile(values['output-dir'], 'expected-source.json', `${corpusJson({ schemaVersion: 1, identity: parsedIdentity, profileId: values.profile, format, keys: values['snapshot-key'], files: values['snapshot-file'], original: { file: values['source-path'], sha256: corpusHash(original), bytes: original.length } })}\n`)
    process.stdout.write(`${corpusJson({ extracted: documents.length, rejected: extraction.rejected.length })}\n`)
    return
  }
  assert.ok(values.framework && values.version && values.target && values.workspace && values.input && values.identity, 'Required: --framework --version --target --workspace --input --identity; use --execute to install and compile')
  const parsed: unknown = JSON.parse(await readFile(values.identity, 'utf8'))
  assert.ok(parsed && typeof parsed === 'object', 'Invalid generation source identity')
  const dependencies: unknown = values.dependencies ? JSON.parse(await readFile(values.dependencies, 'utf8')) : {}
  assert.ok(dependencies && typeof dependencies === 'object' && !Array.isArray(dependencies), 'Invalid pinned input dependencies')
  const result = await generateFramework({
    framework: values.framework as FrameworkFamily,
    version: values.version,
    target: values.target,
    workspace: path.resolve(values.workspace),
    input: path.resolve(values.input),
    identity: parsed as GenerationIdentity,
    inputDependencies: dependencies as Record<string, string>,
    controlledFixtureId: values['fixture-id'],
    modes: values.mode as GenerationMode[] | undefined,
    execute: values.execute,
    retry: values.retry,
  })
  process.stdout.write(`${corpusJson({ generations: result.generations, documents: result.documents.length, matrixTemplates: result.matrixTemplates.length })}\n`)
  if (result.generations.some(generation => generation.status === 'failed')) {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await generateMain()
}
