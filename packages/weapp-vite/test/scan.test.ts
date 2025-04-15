// import { jsExtensions } from '../constants'
import { findJsEntry, findJsonEntry } from '@/utils'
import CI from 'ci-info'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import path from 'pathe'
import { appsDir } from './utils'

async function isComponent(baseName: string) {
  const { path: jsEntry } = await findJsEntry(baseName)
  if (jsEntry) {
    const { path: jsonEntry } = await findJsonEntry(baseName)
    if (jsonEntry) {
      const json = await fs.readJson(jsonEntry, { throws: false })
      if (json?.component) {
        return true
      }
    }
  }
  return false
}

describe.skipIf(CI.isCI)('scan', () => {
  describe('isComponent', () => {
    it('vite-native components', async () => {
      const cwd = path.resolve(appsDir, 'vite-native')
      const dir = path.resolve(cwd, 'components')
      const relFiles = await new Fdir()
        .withRelativePaths()
        .globWithOptions(
          ['**/*.{wxml,html}'],
          {
            cwd: dir,
            ignore: [],
            posixSlashes: true,
            windows: true,
          },
        )
        .crawl(dir)
        .withPromise()
      expect(relFiles.sort()).toMatchSnapshot()
      expect(
        (await Promise.all(relFiles.map(async (x) => {
          return {
            isComponent: await isComponent(path.join(dir, x)),
            result: x,
          }
        }))).filter(x => x.isComponent).map(x => x.result),
      ).toMatchSnapshot()
    })
  })
})
