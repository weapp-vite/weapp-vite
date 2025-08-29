import { add as add0 } from 'lodash'
import { add as add1 } from 'lodash-es'
import ActionSheet, { ActionSheetTheme } from 'tdesign-miniprogram/action-sheet/index'
// import Cos from '@/utils/cos-wx-sdk-v5'
import globalStore from '@/stores/index'
import { formatTime } from '@/utils/util'
import { getPackageName } from '../utils'

const firstGrid = [
  {
    label: '微信',
    image: 'https://tdesign.gtimg.com/mobile/demos/wechat.png',
  },
  {
    label: '朋友圈',
    image: 'https://tdesign.gtimg.com/mobile/demos/times.png',
  },
  {
    label: 'QQ',
    image: 'https://tdesign.gtimg.com/mobile/demos/qq.png',
  },
  {
    label: '企业微信',
    image: 'https://tdesign.gtimg.com/mobile/demos/wecom.png',
  },
  {
    label: '收藏',
    icon: 'star',
  },
  {
    label: '刷新',
    icon: 'refresh',
  },
  {
    label: '下载',
    icon: 'download',
  },
  {
    label: '复制',
    icon: 'queue',
  },
]

Page({
  data: {
    num0: add0(1, 1),
    num1: add1(2, 2),
    now: formatTime(new Date()),
    // Cos
  },
  onLoad(query) {
    getPackageName()
    globalStore.bind(this, '$data')
  },
  handleChangeTitle() {
    globalStore.data.title = '新标题'
    globalStore.update()
  },
  handleAction() {
    ActionSheet.show({
      theme: ActionSheetTheme.Grid,
      selector: '#t-action-sheet',
      context: this,
      items: firstGrid,
    })
  },
  handleMultiAction() {
    ActionSheet.show({
      theme: ActionSheetTheme.Grid,
      selector: '#t-action-sheet',
      context: this,
      items: firstGrid.concat(
        Array.from({ length: 8 }).fill({
          label: '标题文字',
          icon: 'image',
        }),
      ),
    })
  },
  handleSelected(e) {
    console.log(e.detail)
  },
})

console.log('cat')
