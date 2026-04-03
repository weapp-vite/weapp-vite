import { setPageLayout } from 'weapp-vite/runtime'

Page({
  data: {
    title: 'issue-389 native runtime export should stay native-only',
  },
  onLoad() {
    setPageLayout('default')
  },
  _runE2E() {
    return {
      layoutName: this.data.__wv_page_layout_name ?? null,
      title: this.data.title,
    }
  },
})
