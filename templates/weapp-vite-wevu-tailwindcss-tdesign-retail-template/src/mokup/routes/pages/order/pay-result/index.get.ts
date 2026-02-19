const scene = {
  route: 'pages/order/pay-result/index',
  title: '支付结果',
  group: '订单分包',
  summary: '这是「支付结果」的 mokup 场景数据，用于验证页面在模板中的可访问性和交互完整性。',
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
      label: '确认订单',
      route: 'pages/order/order-confirm/index',
    },
    {
      label: '发票抬头',
      route: 'pages/order/receipt/index',
    },
    {
      label: '支付结果',
      route: 'pages/order/pay-result/index',
    },
  ],
}

export default scene
