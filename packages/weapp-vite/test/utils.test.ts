import { diff } from 'just-diff'
import { getProjectConfig } from '@/utils'
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
