import { sharedLabel } from '../../shared/label'

Page({
  data: { label: 'pending' },
  onLoad() {
    this.setData({ label: sharedLabel('second') })
  },
  _runShared() {
    const label = sharedLabel('second-called')
    this.setData({ label })
    return label
  },
})
