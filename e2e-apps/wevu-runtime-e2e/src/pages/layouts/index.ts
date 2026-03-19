import { setPageLayout } from 'weapp-vite/runtime'

Page({
  data: {
    currentLayout: 'default',
    scriptMarker: 'LAYOUTS-PAGE-SCRIPT-BASE',
    cards: [
      {
        title: 'default layout',
        desc: 'default layout is mounted from src/layouts/default.',
      },
      {
        title: 'admin layout',
        desc: 'admin layout is mounted from src/layouts/admin.',
      },
      {
        title: 'plain page',
        desc: 'setPageLayout(false) removes wrappers.',
      },
    ],
  },
  onLoad() {
    setPageLayout('default')
  },
  applyDefaultLayout() {
    this.setData({ currentLayout: 'default' })
    setPageLayout('default')
  },
  applyAdminLayout() {
    this.setData({ currentLayout: 'admin' })
    setPageLayout('admin', {
      title: 'LAYOUTS-ADMIN-TITLE-BASE',
      subtitle: 'LAYOUTS-ADMIN-SUBTITLE-BASE',
    })
  },
  clearLayout() {
    this.setData({ currentLayout: 'none' })
    setPageLayout(false)
  },
})
