import type { WevuPageLayoutMap as RootLayoutMap } from 'wevu'
import type { WevuPageLayoutMap as PureLayoutMap } from 'wevu/types'
import { expectError, expectType } from 'tsd'
import { setPageLayout, usePageLayout } from 'wevu'

declare module 'wevu' {
  interface WevuPageLayoutMap {
    'admin': {
      sidebar?: boolean
      title?: string
    }
    'native-shell': {
      sidebar?: boolean
      title?: string
    }
  }
}

setPageLayout('admin', {
  sidebar: true,
  title: 'Dashboard',
})

setPageLayout('native-shell', {
  title: 'Native Dashboard',
})

setPageLayout(false)
expectError(setPageLayout('missing'))
expectError(setPageLayout('admin', { sidebar: 'yes' }))

declare const rootMap: RootLayoutMap
declare const pureMap: PureLayoutMap
expectType<RootLayoutMap>(pureMap)
expectType<PureLayoutMap>(rootMap)
expectType<'admin' | 'native-shell'>(null as unknown as keyof PureLayoutMap)

const pageLayout = usePageLayout()
expectType<'admin' | 'native-shell' | false | undefined>(pageLayout.name)

if (pageLayout.name === 'admin') {
  expectType<boolean | undefined>(pageLayout.props.sidebar)
  expectType<string | undefined>(pageLayout.props.title)
}

if (pageLayout.name === 'native-shell') {
  expectType<boolean | undefined>(pageLayout.props.sidebar)
  expectType<string | undefined>(pageLayout.props.title)
}
