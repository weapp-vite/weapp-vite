import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseDocument } from 'htmlparser2'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { renderPageTree } from '../src/view/render'
import { templateWhitespaceChecks, templateWhitespaceFiles, templateWhitespaceStates } from './helpers/templateWhitespace'

async function createWhitespaceProject() {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), 'mpcore-template-whitespace-'))
  for (const [file, source] of templateWhitespaceFiles) {
    const target = path.join(projectPath, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  return projectPath
}

it.each(['node', 'browser'] as const)('%s ignores template indentation while retaining explicit dynamic whitespace', async (provider) => {
  const projectPath = await createWhitespaceProject()
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

it.each(['node', 'browser', 'testing-fallback'] as const)('%s removes static-only whitespace while preserving binding updates and nonempty text', async (provider) => {
  const projectPath = await createWhitespaceProject()
  const session = provider === 'browser'
    ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(templateWhitespaceFiles) })
    : createHeadlessSession({ projectPath })
  try {
    const page = session.reLaunch('/pages/whitespace/index')
    for (const space of templateWhitespaceStates) {
      page.setData({ space })
      const rendered = provider === 'testing-fallback'
        ? renderPageTree(session.project, page)
        : session.renderCurrentPage()
      for (const root of [rendered.root, parseDocument(rendered.wxml)]) {
        const handle = new HeadlessTestingNodeHandle(root)
        for (const [selector, text] of templateWhitespaceChecks(space)) {
          expect(await (await handle.$(selector))?.text(), `${provider}/${selector}/${JSON.stringify(space)}`).toBe(text)
        }
      }
    }
  }
  finally {
    session.close()
    await rm(projectPath, { recursive: true, force: true })
  }
})
