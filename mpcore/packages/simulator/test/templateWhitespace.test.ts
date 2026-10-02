import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { templateWhitespaceFiles } from './helpers/templateWhitespace'

it.each(['node', 'browser'] as const)('%s ignores template indentation while retaining explicit dynamic whitespace', async (provider) => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), 'mpcore-template-whitespace-'))
  for (const [file, source] of templateWhitespaceFiles) {
    const target = path.join(projectPath, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  const session = provider === 'node'
    ? createHeadlessSession({ projectPath })
    : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(templateWhitespaceFiles) })
  try {
    const page = session.reLaunch('/pages/index/index')
    for (const count of [0, 1]) {
      const root = new HeadlessTestingNodeHandle(session.renderCurrentPage().root)
      expect(await (await root.$('#island'))?.text()).toBe(`dynamic island: ${count}`)
      expect(await (await root.$('#explicit'))?.text()).toBe('  spaced  ')
      page.increment()
    }
  }
  finally {
    session.close()
    await rm(projectPath, { recursive: true, force: true })
  }
})
