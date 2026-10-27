import { sharedLabel } from '../../shared/label'

Page({
  data: { label: 'pending' },
  onLoad() {
    this.setData({ label: sharedLabel('first') })
  },
  _runShared() {
    const label = sharedLabel('first-called')
    this.setData({ label })
    return label
  },
})
