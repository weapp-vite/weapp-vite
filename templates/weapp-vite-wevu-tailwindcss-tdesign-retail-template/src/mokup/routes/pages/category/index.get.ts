const scene = {
  route: 'pages/category/index',
  title: '分类',
  group: '主包',
  summary: '这是「分类」的 mokup 场景数据，用于验证页面在模板中的可访问性和交互完整性。',
  kpis: [
    {
      label: '在线会话',
      value: '140',
    },
    {
      label: '待处理任务',
      value: '9',
    },
    {
      label: '页面权重',
      value: '3.0',
    },
    {
      label: '构建状态',
      value: 'green',
    },
  ],
  actions: [
    {
      label: '首页',
      route: 'pages/home/home',
    },
    {
      label: '分类',
      route: 'pages/category/index',
    },
    {
      label: '购物车',
      route: 'pages/cart/index',
    },
  ],
}

export default scene
