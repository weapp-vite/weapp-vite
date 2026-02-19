const scene = {
  route: 'pages/user/address/edit/index',
  title: '编辑地址',
  group: '用户分包',
  summary: '这是「编辑地址」的 mokup 场景数据，用于验证页面在模板中的可访问性和交互完整性。',
  kpis: [
    {
      label: '在线会话',
      value: '149',
    },
    {
      label: '待处理任务',
      value: '4',
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
