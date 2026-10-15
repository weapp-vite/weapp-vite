import type { ProfileCase } from './types'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { freezeProjectSupportArtifacts } from './identity'

const roots: string[] = []
const fixture: ProfileCase = { id: 'fixture', cohort: 'wevu', project: 'apps/example', config: 'vite.config.ts', file: 'src/index.vue', isPage: true, expectCompilerBatch: true }

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createSupportFiles() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'compiler-profile-identity-'))
  roots.push(root)
  const support = path.join(root, fixture.project, '.weapp-vite')
  await mkdir(path.join(support, 'routes'), { recursive: true })
  await writeFile(path.join(support, 'tsconfig.app.json'), '{}')
  await writeFile(path.join(support, 'routes/index.d.ts'), 'export {}')
  await writeFile(path.join(root, fixture.project, 'tsconfig.json'), '{"references":[]}')
  return { root, support }
}

describe('prepared project support identity', () => {
  it('freezes ignored support closure and generated root config, and detects later changes', async () => {
    const { root, support } = await createSupportFiles()
    const frozen = await freezeProjectSupportArtifacts(root, [fixture, { ...fixture, id: 'same-project' }])
    expect(Object.keys(frozen)).toEqual([
      'apps/example/.weapp-vite/routes/index.d.ts',
      'apps/example/.weapp-vite/tsconfig.app.json',
      'apps/example/tsconfig.json',
    ])
    await writeFile(path.join(support, 'routes/index.d.ts'), 'export const changed: true')
    expect(await freezeProjectSupportArtifacts(root, [fixture])).not.toEqual(frozen)
    await writeFile(path.join(support, 'routes/index.d.ts'), 'export {}')
    await writeFile(path.join(root, fixture.project, 'tsconfig.json'), '{"references":[{"path":"changed"}]}')
    expect(await freezeProjectSupportArtifacts(root, [fixture])).not.toEqual(frozen)
  })

  it('rejects partial support files even when other declarations exist', async () => {
    const { root, support } = await createSupportFiles()
    await rm(path.join(support, 'tsconfig.app.json'))
    await expect(freezeProjectSupportArtifacts(root, [fixture])).rejects.toThrow('Project support files are required')
  })
})
