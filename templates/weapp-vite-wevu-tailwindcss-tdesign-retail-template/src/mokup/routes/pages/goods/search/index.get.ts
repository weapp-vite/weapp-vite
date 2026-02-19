const scene = {
  route: 'pages/goods/search/index',
  title: '商品搜索',
  group: '商品分包',
  summary: '这是「商品搜索」的 mokup 场景数据，用于验证页面在模板中的可访问性和交互完整性。',
  kpis: [
    {
      label: '在线会话',
      value: '144',
    },
    {
      label: '待处理任务',
      value: '6',
    },
    {
      label: '页面权重',
      value: '7.0',
    },
    {
      label: '构建状态',
      value: 'green',
    },
  ],
  actions: [
    {
      label: '商品列表',
      route: 'pages/goods/list/index',
    },
    {
      label: '商品详情',
      route: 'pages/goods/details/index',
    },
    {
      label: '商品搜索',
      route: 'pages/goods/search/index',
    },
  ],
}

export default scene
