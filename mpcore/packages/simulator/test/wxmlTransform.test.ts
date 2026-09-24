import { readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildWxmlTransformProject, createWxmlTransformProject } from '../../../../e2e/utils/wxmlTransformProject'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'

let project: string
let files: Array<[string, string]>

beforeAll(async () => {
  project = await createWxmlTransformProject()
  await buildWxmlTransformProject(project)
  const output = path.join(project, 'dist')
  const names = await readdir(output, { recursive: true, withFileTypes: true })
  files = await Promise.all(names.filter(entry => entry.isFile()).map(async (entry): Promise<[string, string]> => {
    const file = path.join(entry.parentPath, entry.name)
    return [path.relative(output, file).replaceAll('\\', '/'), await readFile(file, 'utf8')]
  }))
}, 120_000)

afterAll(async () => {
  if (project) {
    await rm(project, { recursive: true, force: true })
  }
})

describe.each(['node', 'browser'] as const)('%s final template transform parity', (provider) => {
  it.each(['native', 'vue'])('renders typed attributes and preserves events for %s', async (kind) => {
    const template = files.find(([file]) => file === `pages/${kind}/index.wxml`)?.[1]
    expect(template).not.toContain('data-clean=')
    expect(template).not.toContain('data-use-view')
    expect(template).toContain('data-analytics=')
    const session = provider === 'browser'
      ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      : createHeadlessSession({ projectPath: project })
    const render = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
    try {
      session.reLaunch(`/pages/${kind}/index`)
      const renamed = await render().$('view#renamed')
      expect(await renamed?.text()).toBe('renamed')
      expect(await renamed?.attr('data-literal')).toBe('中文 & "单\'双" \\ {{literal}}')
      expect(await renamed?.attr('data-number')).toBe('42')
      expect(await renamed?.attr('data-bool')).toBe('false')
      expect(await renamed?.attr('data-expression')).toBe('dynamic')
      expect(await (await render().$('#retained'))?.attr('data-testid')).toBe('keep')
      await (await render().$('#tap'))?.tap()
      await expect.poll(async () => (await render().$('#result'))?.text()).toBe('1:track')
    }
    finally {
      session.close()
    }
  })
})
