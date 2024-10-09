import { getProjectConfig } from '@/utils'
import { diff } from 'just-diff'
import path from 'pathe'
import { isAppRoot, searchAppEntry } from './legacy/utils'
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

  describe('isAppRoot', () => {
    it.each(absDirs)('$name', ({ path: p, name }) => {
      if (name.includes('-ts')) {
        expect(isAppRoot(path.resolve(p, 'miniprogram'))).toBe(true)
      }
      else {
        expect(isAppRoot(p)).toBe(true)
      }
    })
  })

  describe('searchAppEntry', () => {
    it.each(absDirs)('$name', ({ path: p, name }) => {
      if (name.includes('-ts')) {
        expect(searchAppEntry({
          root: path.resolve(p, 'miniprogram'),
        })).toBeTruthy()
      }
      else {
        expect(searchAppEntry({
          root: p,
        })).toBeTruthy()
      }
    })
  })
})
