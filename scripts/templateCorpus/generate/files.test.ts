import type { GenerationEvidence } from './types'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { corpusHash } from '../archive'
import { listOutputFiles, listProjectFiles, outputFileIdentity, readOutputFile, writeProjectFile } from './files'
import { collectGeneratedDocuments } from './output'

const directories: string[] = []

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'template-generation-output-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

function evidence(): GenerationEvidence {
  return {
    schemaVersion: 1,
    id: 'taro-quickapp-development',
    framework: 'taro',
    version: '2.2.22',
    target: 'quickapp',
    mode: 'development',
    source: { repository: 'owner/project', commit: 'a'.repeat(40), licenseId: 'confirmed' },
    inputDependencies: {},
    runtime: { node: 'v22.0.0', packageManager: 'pnpm@10.0.0' },
    input: [],
    configuration: [],
    dependencies: [],
    outputs: [],
    logs: [],
    commands: [],
    status: 'built',
  }
}

describe('compiler-owned generation output inventory', () => {
  it('retains emitted package templates without reading the real dependency installation', async () => {
    const project = await temporaryDirectory()
    const emitted = 'out/development/src/npm/.pnpm/@tarojs+components-qa@2.2.22/node_modules/@tarojs/components-qa/src/components/view.ux'
    const source = '<template><div>😀 {{text}}</div></template><script>export default {}</script><style>div{color:red}</style>'
    await writeProjectFile(project, emitted, source)
    await writeProjectFile(project, 'out/development/src/app.js', 'export default {}')
    await writeProjectFile(project, 'out/production/src/page.ux', '<template><div>production</div></template>')
    await writeProjectFile(project, 'node_modules/not-an-output/src/poison.ux', '<template><div>must not collect</div></template>')
    expect(await listOutputFiles(project, 'development')).toEqual(['out/development/src/app.js', emitted])
    expect(await outputFileIdentity(project, emitted, 'development')).toEqual({ file: emitted, sha256: corpusHash(source), bytes: Buffer.byteLength(source) })
    const documents = await collectGeneratedDocuments(project, 'out/development', {
      target: 'quickapp',
      platform: 'quickapp',
      profileId: 'quickapp-container',
      extensions: ['.ux'],
      container: 'template',
      support: 'candidate',
      evidence: 'official compiler emits a template container',
    }, evidence())
    expect(documents).toHaveLength(1)
    expect(documents[0]!.source).toBe('<div>😀 {{text}}</div>')
    expect(documents[0]!.origins[0]!.path).toBe(emitted)
    await expect(listProjectFiles(path.join(project, 'out/development'))).rejects.toThrow('Generation input must contain source files only')
    await expect(listProjectFiles(project)).rejects.toThrow('Generation input must contain source files only')
  })

  it('keeps every output identity confined to the selected mode root', async () => {
    const project = await temporaryDirectory()
    await writeProjectFile(project, 'out/development/page.ux', '<template><div/></template>')
    await writeProjectFile(project, 'out/production/page.ux', '<template><div/></template>')
    await writeProjectFile(project, 'node_modules/package/page.ux', '<template><div/></template>')
    for (const file of ['node_modules/package/page.ux', 'out/production/page.ux', 'out/development', 'out/development/../production/page.ux', 'out/development/./page.ux', 'out\\development\\page.ux', 'out/development/C:page.ux']) {
      await expect(readOutputFile(project, file, 'development')).rejects.toThrow(/output (?:path|must stay)/)
    }
    await expect(collectGeneratedDocuments(project, 'node_modules', {
      target: 'quickapp',
      platform: 'quickapp',
      profileId: 'quickapp-container',
      extensions: ['.ux'],
      support: 'candidate',
      evidence: 'test',
    }, evidence())).rejects.toThrow('Generation output must stay within its mode root')
  })

  it('rejects linked mode roots and nested output packages instead of following installed dependencies', async () => {
    const project = await temporaryDirectory()
    const dependency = await temporaryDirectory()
    await writeProjectFile(dependency, 'page.ux', '<template><div/></template>')
    await mkdir(path.join(project, 'out/development'), { recursive: true })
    await symlink(dependency, path.join(project, 'out/development/node_modules'), 'junction')
    await expect(listOutputFiles(project, 'development')).rejects.toThrow('Symlink not allowed in generation output')
    await expect(readOutputFile(project, 'out/development/node_modules/page.ux', 'development')).rejects.toThrow('Symlink not allowed in generation output')
    await symlink(dependency, path.join(project, 'out/production'), 'junction')
    await expect(listOutputFiles(project, 'production')).rejects.toThrow('Symlink not allowed in generation output')
    await rm(path.join(project, 'out/development'), { recursive: true })
    await rm(path.join(project, 'out/production'))
    await rm(path.join(project, 'out'), { recursive: true })
    await symlink(dependency, path.join(project, 'out'), 'junction')
    await expect(listOutputFiles(project, 'development')).rejects.toThrow('Symlink not allowed in generation output')
  })
})
