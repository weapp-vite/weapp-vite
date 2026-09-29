import type { StatefulHmrOutputFile } from './outputWriter'
import { expect, it } from 'vitest'
import { retainStylesUntilScriptApplied } from './styleDelivery'

it('preserves old and removed styles while publishing new templates, then exposes the complete next batch', () => {
  const asset = (fileName: string, source: string): StatefulHmrOutputFile => ({ type: 'asset', fileName, source })
  const previous = [asset('page.wxss', '.old {}'), asset('removed.wxss', '.removed {}'), asset('page.wxml', '<view/>')]
  const next = [asset('page.wxss', '.new {}'), asset('added.wxss', '.added {}'), asset('page.wxml', '<text/>')]
  expect(retainStylesUntilScriptApplied(previous, next, 'wxss')).toEqual([
    next[2],
    previous[0],
    previous[1],
  ])
  expect(next).toEqual([asset('page.wxss', '.new {}'), asset('added.wxss', '.added {}'), asset('page.wxml', '<text/>')])
})
