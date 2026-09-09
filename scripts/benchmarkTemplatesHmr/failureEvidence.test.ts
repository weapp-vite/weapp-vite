import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { captureBenchmarkFailureEvidence } from './failureEvidence'

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
    const result = await captureBenchmarkFailureEvidence({
      readSource: async () => source,
      readOutput: async () => { throw new Error('output read failed') },
      marker: 'marker',
      repoRoot: root,
      artifactFile: path.join(blockedDirectory, 'failure.json'),
    })
    expect(result.source).toMatchObject({ containsMarker: true, sha256: createHash('sha256').update(source).digest('hex') })
    expect(result.outputError).toBe('output read failed')
    expect(result.output).toBeUndefined()
    expect(result.artifactError).toBeTypeOf('string')
    expect(result.artifactError).not.toContain(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
