import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { captureBenchmarkFailureEvidence, writeBenchmarkCleanupFailureEvidence } from './failureEvidence'

it('retains the failed edit before cleanup and redacts encoded source maps and machine paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-failure-evidence-'))
  try {
    const sourceFile = path.join(root, 'app.css')
    const artifactFile = path.join(root, 'report', 'failure.json')
    const source = `/* ${root}/app.css */\n:root { --hmr-marker: 1; }`
    await writeFile(sourceFile, source)
    const output = 'view { color: red }\n/*# sourceMappingURL=data:application/json;base64,private-map */'
    const result = await captureBenchmarkFailureEvidence({
      readSource: () => readFile(sourceFile, 'utf8'),
      readOutput: async () => output,
      marker: 'hmr-marker',
      repoRoot: root,
      artifactFile,
    })
    await writeFile(sourceFile, ':root {}')
    const artifact = await readFile(artifactFile, 'utf8')
    expect(result.source).toMatchObject({ containsMarker: true, sha256: createHash('sha256').update(source).digest('hex') })
    expect(result.output).toMatchObject({ containsMarker: false, sha256: createHash('sha256').update(output).digest('hex') })
    expect(artifact).toContain('--hmr-marker: 1')
    expect(artifact).not.toContain(root)
    expect(artifact).not.toContain('private-map')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('records source and output read failures independently instead of treating unreadable output as absent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-failure-evidence-'))
  try {
    const result = await captureBenchmarkFailureEvidence({
      readSource: async () => { throw new Error('source read failed') },
      readOutput: async () => { throw new Error('output read failed') },
      marker: 'marker',
      repoRoot: root,
      artifactFile: path.join(root, 'failure.json'),
    })
    expect(result).toEqual({ sourceError: 'source read failed', outputError: 'output read failed' })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('retains collected metadata and read errors when evidence persistence fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-failure-evidence-'))
  try {
    const blockedDirectory = path.join(root, 'report')
    await writeFile(blockedDirectory, 'a file cannot contain evidence')
    const source = 'marker'
    const error = new Error('Timed out waiting for output', { cause: new Error('request transport failed') })
    const result = await captureBenchmarkFailureEvidence({
      readSource: async () => source,
      readOutput: async () => { throw new Error('output read failed') },
      marker: 'marker',
      repoRoot: root,
      artifactFile: path.join(blockedDirectory, 'failure.json'),
      error,
    })
    expect(result.source).toMatchObject({ containsMarker: true, sha256: createHash('sha256').update(source).digest('hex') })
    expect(result.outputError).toBe('output read failed')
    expect(result.output).toBeUndefined()
    expect(result.artifactError).toBeTypeOf('string')
    expect(result.artifactError).not.toContain(root)
    expect(result.error).toMatchObject({ message: error.message, cause: { message: 'request transport failed' } })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('serializes nested Windows cleanup evidence after redacting string fields', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-cleanup-evidence-'))
  try {
    const repoRoot = 'C:\\Users\\fixture-user\\project'
    const sampleError = new Error(`source failed at ${repoRoot}\\src\\index.wxss\n"quoted diagnostic"`)
    const cleanupError = new Error('stop failed token=private-token')
    const artifactFile = path.join(root, 'cleanup.json')
    await writeBenchmarkCleanupFailureEvidence({
      artifactFile,
      repoRoot,
      template: { scenarios: [{ error: sampleError.message, diagnostics: { outputError: `unreadable ${repoRoot}\\dist\\index.wxss` } }] },
      error: new AggregateError([sampleError, cleanupError], 'sample and stop failed', { cause: sampleError }),
    })
    const text = await readFile(artifactFile, 'utf8')
    expect(text).not.toMatch(/fixture-user|private-token/)
    expect(JSON.parse(text) as unknown).toMatchObject({
      template: { scenarios: [{ diagnostics: { outputError: 'unreadable <repo>/dist/index.wxss' } }] },
      error: {
        cause: { message: 'source failed at <repo>/src/index.wxss\n"quoted diagnostic"' },
        errors: [{ message: 'source failed at <repo>/src/index.wxss\n"quoted diagnostic"' }, { message: 'stop failed <redacted>' }],
      },
    })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('preserves the failed scenario error chain before restoring source or cleaning the session', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-scenario-cause-'))
  try {
    const artifactFile = path.join(root, 'scenario.json')
    const requestError = new Error(`request failed at ${root}/src/index.ts token=private-token`)
    const stopError = new Error('transport disconnected')
    const error = new AggregateError([requestError, stopError], 'Timed out waiting for script output', { cause: requestError })
    const result = await captureBenchmarkFailureEvidence({
      readSource: async () => 'current marker',
      readOutput: async () => 'current marker',
      marker: 'marker',
      repoRoot: root,
      artifactFile,
      error,
    })
    const text = await readFile(artifactFile, 'utf8')
    expect(text).not.toContain(root)
    expect(text).not.toContain('private-token')
    const expected = {
      name: 'AggregateError',
      message: error.message,
      cause: { name: 'Error', message: 'request failed at <repo>/src/index.ts <redacted>' },
      errors: [{ message: 'request failed at <repo>/src/index.ts <redacted>' }, { message: 'transport disconnected' }],
    }
    expect(JSON.parse(text) as unknown).toMatchObject({ error: expected })
    expect(result).toMatchObject({ error: expected })
    expect(error.cause).toBe(requestError)
    expect(error.errors).toEqual([requestError, stopError])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
