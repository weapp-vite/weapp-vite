const ICON_ITEMS = [
  { type: 'success', label: '成功' },
  { type: 'success_no_circle', label: '完成' },
  { type: 'info', label: '信息' },
  { type: 'warn', label: '警告' },
  { type: 'waiting', label: '等待' },
  { type: 'cancel', label: '取消' },
  { type: 'download', label: '下载' },
  { type: 'search', label: '搜索' },
  { type: 'clear', label: '清除' },
]

const RICH_NODES = [
  {
    name: 'div',
    attrs: {
      class: 'rich-content',
      style: 'padding: 9px; color: #25313c; background-color: #f4f7f6; border-radius: 4px;',
    },
    children: [
      {
        name: 'strong',
        children: [{ type: 'text', text: '节点数组' }],
      },
      { type: 'text', text: '保留结构、样式与文本。' },
    ],
  },
]

Page({
  data: {
    iconItems: ICON_ITEMS,
    progressValue: 72,
    progressEvent: '等待动画',
    richNodes: RICH_NODES,
    richHtml: '<p style="margin: 0; color: #50616f;"><strong style="color: #087f5b;">HTML 字符串</strong>同样经过安全节点渲染。</p>',
  },
  handleProgressActiveEnd() {
    this.setData({ progressEvent: 'activeend' })
  },
})
