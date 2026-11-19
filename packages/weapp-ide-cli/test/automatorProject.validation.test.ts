import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { resolveAutomatorProjectPath } from '../src/cli/automatorProject'

const projects: string[] = []

async function project() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'automator-project-validation-'))
  projects.push(root)
  await writeFile(path.join(root, 'app.json'), '{"pages":[]}')
  return root
}

afterEach(async () => {
  await Promise.all(projects.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('explains how to open an artifact directory that lacks project.config.json', async () => {
  const root = await project()
  await expect(resolveAutomatorProjectPath(root)).rejects.toThrow(/project\.config\.json.*miniprogramRoot/s)
})

it.each(['{broken', '[]', 'null'])('reports malformed project configuration instead of passing %s to DevTools', async (source) => {
  const root = await project()
  await writeFile(path.join(root, 'project.config.json'), source)
  await expect(resolveAutomatorProjectPath(root)).rejects.toThrow(/project\.config\.json.*JSON/s)
})

it('accepts a standalone artifact with an existing project config', async () => {
  const root = await project()
  await writeFile(path.join(root, 'project.config.json'), '{"miniprogramRoot":"./"}')
  await expect(resolveAutomatorProjectPath(root)).resolves.toMatchObject({ projectPath: root })
})
