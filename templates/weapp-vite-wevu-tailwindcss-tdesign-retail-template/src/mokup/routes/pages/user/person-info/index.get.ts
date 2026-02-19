const scene = {
  route: 'pages/user/person-info/index',
  title: '个人信息',
  group: '用户分包',
  summary: '这是「个人信息」的 mokup 场景数据，用于验证页面在模板中的可访问性和交互完整性。',
  kpis: [
    {
      label: '在线会话',
      value: '148',
    },
    {
      label: '待处理任务',
      value: '3',
    },
    {
      label: '页面权重',
      value: '2.0',
    },
    {
      label: '构建状态',
      value: 'green',
    },
  ],
  actions: [
    {
      label: '个人信息',
      route: 'pages/user/person-info/index',
    },
    {
      label: '地址列表',
      route: 'pages/user/address/list/index',
    },
    {
      label: '编辑地址',
      route: 'pages/user/address/edit/index',
    },
  ],
}

export default scene
