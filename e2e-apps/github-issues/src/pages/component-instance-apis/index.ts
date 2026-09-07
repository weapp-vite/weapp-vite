import { readTrace, recordPageLoad, relationLabels } from '../../components/component-instance-apis/trace'

Page({
  data: { showChild: true, trace: '', children: 'pending' },
  onLoad() { recordPageLoad() },
  snapshot() {
    const parent = this.selectComponent('#relation-parent')
    const children = parent?.getRelationNodes('../child/index') ?? []
    this.setData({ trace: readTrace().join('\n'), children: relationLabels(children) })
    return readTrace()
  },
  removeChild() {
    this.setData({ showChild: false }, () => this.snapshot())
  },
  restoreChild() {
    this.setData({ showChild: true }, () => this.snapshot())
  },
})
