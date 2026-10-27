import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../../src/browser'
import { createHeadlessSession } from '../../src/runtime'
import { basicApisFiles } from './basicApis'

export function createBasicApisSession(
  provider: 'node' | 'browser',
  directories: string[],
  entries = basicApisFiles(),
  strictHostMocks = false,
) {
  if (provider === 'browser') {
    return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(entries), strictHostMocks })
  }
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-basic-apis-'))
  directories.push(projectPath)
  for (const [file, source] of entries) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  return createHeadlessSession({ projectPath, strictHostMocks })
}
