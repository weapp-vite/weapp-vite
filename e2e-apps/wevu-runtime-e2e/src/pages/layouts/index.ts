import { setPageLayout } from 'weapp-vite/runtime'

const layoutPageScriptMarker = 'LAYOUTS-PAGE-SCRIPT-BASE'
const LAYOUT_SCRIPT_PROBE_STORAGE_KEY = '__weapp_vite_core_hmr_layout_script_probe__'

function writeLayoutScriptProbe(marker: string) {
  if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
    return
  }
  wx.setStorageSync(LAYOUT_SCRIPT_PROBE_STORAGE_KEY, {
    marker,
    updatedAt: Date.now(),
  })
}

Page({
  data: {
    currentLayout: 'default',
    scriptMarker: layoutPageScriptMarker,
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
    writeLayoutScriptProbe(layoutPageScriptMarker)
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
