import { getProjectConfig } from '@/utils'
import { diff } from 'just-diff'
import { absDirs } from './utils'

describe('utils', () => {
  describe('getProjectConfig', () => {
    it.each(absDirs)('$name', async ({ path: p }) => {
      expect(diff(
        await getProjectConfig(p, { ignorePrivate: true }),
        await getProjectConfig(p),
      )).toMatchSnapshot()
    })
  })
})
