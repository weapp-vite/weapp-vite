const scene = {
  route: 'pages/home/home',
  title: '首页',
  group: '主包',
  summary: '这是「首页」的 mokup 场景数据，用于验证页面在模板中的可访问性和交互完整性。',
  kpis: [
    {
      label: '在线会话',
      value: '135',
    },
    {
      label: '待处理任务',
      value: '4',
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
