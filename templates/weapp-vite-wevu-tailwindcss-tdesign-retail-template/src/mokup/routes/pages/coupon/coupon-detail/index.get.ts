const scene = {
  route: 'pages/coupon/coupon-detail/index',
  title: '优惠券详情',
  group: '优惠券分包',
  summary: '这是「优惠券详情」的 mokup 场景数据，用于验证页面在模板中的可访问性和交互完整性。',
  kpis: [
    {
      label: '在线会话',
      value: '152',
    },
    {
      label: '待处理任务',
      value: '7',
    },
    {
      label: '页面权重',
      value: '6.0',
    },
    {
      label: '构建状态',
      value: 'green',
    },
  ],
  actions: [
    {
      label: '优惠券列表',
      route: 'pages/coupon/coupon-list/index',
    },
    {
      label: '优惠券详情',
      route: 'pages/coupon/coupon-detail/index',
    },
    {
      label: '券活动商品',
      route: 'pages/coupon/coupon-activity-goods/index',
    },
  ],
}

export default scene
