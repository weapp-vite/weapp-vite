const utility = 'bg-[#fce7f3]'
const marker = 'SNAPSHOT_BASE'

Page({
  data: { count: 0, utility, marker },
  increment() {
    this.setData({ count: this.data.count + 1, utility, marker })
  },
})
