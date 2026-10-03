import type { MiniProgramArtifact } from '@mpcore/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const packageRoot = fileURLToPath(new URL('../..', import.meta.url))
export const configEntry = pathToFileURL(path.join(packageRoot, 'dist/config.mjs'))
const testEntry = pathToFileURL(path.join(packageRoot, 'dist/index.mjs'))
const vitestEntry = import.meta.resolve('vitest')

export interface RunEvent {
  project: string
  revision?: string
  scenario?: string
  threadId: number
}

async function write(root: string, fileName: string, source: string) {
  const file = path.join(root, fileName)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, source)
}

export async function createRunnerFixture(root: string) {
  await write(root, 'package.json', JSON.stringify({ type: 'module', private: true }))
  const eventsFile = path.join(root, 'events.log')
  await writeFile(eventsFile, '')
  const artifacts: MiniProgramArtifact[] = []
  for (const revision of ['first', 'second']) {
    const projectPath = path.join(root, 'artifacts', revision)
    const miniprogramRootPath = path.join(projectPath, 'miniprogram')
    await write(projectPath, 'project.config.json', JSON.stringify({ miniprogramRoot: 'miniprogram' }))
    await write(miniprogramRootPath, 'app.json', JSON.stringify({ pages: ['pages/index/index'] }))
    await write(miniprogramRootPath, 'app.js', 'App({})')
    await write(miniprogramRootPath, 'pages/index/index.json', '{}')
    await write(miniprogramRootPath, 'pages/index/index.js', `Page({ data: { count: 1, revision: ${JSON.stringify(revision)} }, increment() { this.setData({ count: this.data.count + 1 }) } })`)
    await write(miniprogramRootPath, 'pages/index/index.wxml', '<view><text>{{revision}}</text><button bindtap="increment">add</button><text>count: {{count}}</text></view>')
    artifacts.push({ projectPath, miniprogramRootPath })
  }
  await write(root, 'owned/fixture.test.mjs', `
import { appendFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { threadId } from 'node:worker_threads'
import { inject } from ${JSON.stringify(vitestEntry)}
import { createMpcoreTest } from ${JSON.stringify(testEntry.href)}

const test = createMpcoreTest()
for (const scenario of ['mutates first runtime', 'starts another clean runtime']) {
  test(scenario, async ({ mpcore, expect }) => {
    const revision = basename(inject('mpcoreArtifact').projectPath)
    const result = await mpcore.renderPage('/pages/index/index')
    expect(result.screen.getByText(revision)).toBeInTheMiniProgram()
    expect(result.screen.getByText('count: 1')).toBeInTheMiniProgram()
    await result.user.tap(result.screen.getByRole('button', { name: 'add' }))
    expect(result.screen.getByText('count: 2')).toBeInTheMiniProgram()
    await appendFile(${JSON.stringify(eventsFile)}, JSON.stringify({ project: 'mpcore', revision, scenario, threadId }) + '\\n')
  })
}
`)
  await write(root, 'other/fixture.test.mjs', `
import { appendFile } from 'node:fs/promises'
import { threadId } from 'node:worker_threads'
import { test } from ${JSON.stringify(vitestEntry)}
test('unrelated project', async () => {
  await appendFile(${JSON.stringify(eventsFile)}, JSON.stringify({ project: 'other', threadId }) + '\\n')
})
`)
  return {
    artifacts,
    async events(): Promise<RunEvent[]> {
      return (await readFile(eventsFile, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as RunEvent)
    },
  }
}
