import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createSqliteWasmFiles } from '../test/helpers/sqliteWasmFiles'
import { createTestProject } from './project'

const projectPaths: string[] = []

afterEach(() => {
  for (const projectPath of projectPaths.splice(0)) {
    fs.rmSync(projectPath, { force: true, recursive: true })
  }
})

it('executes a real SQLite WASM query through the public artifact test API', async () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-test-sqlite-'))
  projectPaths.push(projectPath)
  fs.writeFileSync(path.join(projectPath, 'project.config.json'), JSON.stringify({
    appid: 'wx123',
    miniprogramRoot: '.',
  }))

  for (const [file, content] of await createSqliteWasmFiles()) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === 'string' ? content : new Uint8Array(content))
  }

  const project = createTestProject({ artifact: { projectPath } })
  try {
    const result = await project.renderPage('/pages/index')

    await expect(result.page.callMethod('run')).resolves.toEqual({
      value: 1303,
      text: '数据库',
      snapshot: true,
    })
    expect(result.diagnostics()).toEqual([])
  }
  finally {
    await project.close()
  }
})
