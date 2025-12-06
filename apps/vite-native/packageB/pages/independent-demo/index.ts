import { describeIndependentSubpackage } from '@/subpackage-demos/independent-subpackage'

Page({
  data: {
    title: 'packageB 独立分包示例',
    note: describeIndependentSubpackage('packageB'),
    highlights: [
      '不共享 node_modules 依赖，便于对比体积',
      '独立分包的构建日志与其他分包分开',
    ],
  },
})
