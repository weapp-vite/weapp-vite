import { setPageLayout } from 'weapp-vite/runtime'
import { getIssue385AttachCount, resetIssue385AttachCount } from '../../shared/issue385AttachCounter'

Page({
  data: {
    title: 'issue-385 native setPageLayout duplicate attach',
  },
  onLoad() {
    resetIssue385AttachCount()
    setPageLayout('default')
  },
  _runE2E() {
    const attachProbe = this.selectComponent?.('#attach-probe')
    return {
      attachCount: getIssue385AttachCount(),
      componentAttachCount: attachProbe?.data?.attachCount ?? null,
      layoutName: this.data.__wv_page_layout_name ?? null,
    }
  },
})
