import { expectType } from 'tsd'
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

const pageLayout = usePageLayout()
expectType<string | false | undefined>(pageLayout.name)
expectType<Record<string, any>>(pageLayout.props)
