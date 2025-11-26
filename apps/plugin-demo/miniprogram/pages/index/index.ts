import { getSharedLoadMessage } from '@/shared/shared-data'

const plugin = requirePlugin('hello-plugin')
Page({
  data: {
    items: [],
    currentItem: 0,
  },
  onLoad() {
    plugin.sayHello()
    const world = plugin.answer
    console.log(world)
    console.log(getSharedLoadMessage('miniprogram'))
  },
  addItem() {
    this.data.items.push(this.data.currentItem++)
    this.setData({
      items: this.data.items,
      currentItem: this.data.currentItem,
    })
  },
})
