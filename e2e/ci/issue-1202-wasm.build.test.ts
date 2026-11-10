import { access, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

describe('issue #1202: WASM asset publication', { concurrent: false }, () => {
  let project: string | undefined

  afterEach(async () => {
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
    project = undefined
  })

  async function findWasmReferences(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true })
    const references: string[] = []
    for (const entry of entries) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        references.push(...await findWasmReferences(file))
      }
      else if (entry.name.endsWith('.js')) {
        const source = await readFile(file, 'utf8')
        references.push(...[...source.matchAll(/["'](\/[^"']+\.wasm)["']/g)].map(match => match[1]!))
      }
    }
    return references
  }

  it('publishes shared main and Worker WASM once without collision warnings', async () => {
    project = await createIssueRegressionProject(1202)
    const build = await buildIssueRegressionProject(project, 'weapp')
    expect(`${build.stdout}\n${build.stderr}`).not.toContain('FILE_NAME_CONFLICT')

    const dist = path.join(project, 'dist')
    const wasmFiles = await findWasmReferences(dist)
    expect(wasmFiles.length).toBeGreaterThan(0)
    for (const reference of new Set(wasmFiles)) {
      await access(path.join(dist, reference.slice(1)))
    }
    await access(path.join(dist, 'workers/index.js'))
    const independentWasm = (await readdir(path.join(dist, 'isolated'))).filter(file => file.endsWith('.wasm'))
    expect(independentWasm).toHaveLength(1)
    await access(path.join(dist, 'isolated', independentWasm[0]!))
  }, 180_000)
})
