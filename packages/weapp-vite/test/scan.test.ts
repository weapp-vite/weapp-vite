import { isComponent } from '@/utils/scan'
import CI from 'ci-info'
import { fdir as Fdir } from 'fdir'
import path from 'pathe'
import { appsDir } from './utils'

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
