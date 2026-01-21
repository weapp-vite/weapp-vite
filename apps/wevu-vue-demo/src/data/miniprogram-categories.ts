export interface CategoryMeta {
  key: string
  title: string
  description: string
  order: number
  demoPath?: string
}

const categoryMeta: Record<string, Omit<CategoryMeta, 'key'>> = {
  'base': {
    title: '基础',
    description: '系统、运行环境、基础能力与通用工具。',
    order: 1,
    demoPath: '/pages/api-demos/base/index',
  },
  'device': {
    title: '设备',
    description: '网络、电量、振动、硬件能力。',
    order: 2,
    demoPath: '/pages/api-demos/device/index',
  },
  'media': {
    title: '媒体',
    description: '图片、音视频与媒体资源。',
    order: 3,
    demoPath: '/pages/api-demos/media/index',
  },
  'network': {
    title: '网络',
    description: '请求、下载、上传与实时连接。',
    order: 4,
    demoPath: '/pages/api-demos/network/index',
  },
  'ui': {
    title: '界面',
    description: '交互提示、导航条、窗口控制。',
    order: 5,
    demoPath: '/pages/api-demos/ui/index',
  },
  'storage': {
    title: '存储',
    description: '本地缓存与数据持久化。',
    order: 6,
    demoPath: '/pages/api-demos/storage/index',
  },
  'file': {
    title: '文件',
    description: '文件系统管理与读取写入。',
    order: 7,
    demoPath: '/pages/api-demos/file/index',
  },
  'location': {
    title: '位置',
    description: '地理定位与坐标信息。',
    order: 8,
    demoPath: '/pages/api-demos/location/index',
  },
  'canvas': {
    title: '画布',
    description: 'Canvas 绘制与上下文。',
    order: 9,
    demoPath: '/pages/api-demos/canvas/index',
  },
  'wxml': {
    title: 'WXML',
    description: '节点查询、布局与渲染相关能力。',
    order: 10,
    demoPath: '/pages/api-demos/wxml/index',
  },
  'route': {
    title: '路由',
    description: '页面栈与路由控制能力。',
    order: 11,
    demoPath: '/pages/api-demos/route/index',
  },
  'navigate': {
    title: '导航',
    description: '打开/跳转小程序与外部页面。',
    order: 12,
    demoPath: '/pages/api-demos/navigate/index',
  },
  'open-api': {
    title: '开放接口',
    description: '登录、账号信息与平台能力。',
    order: 13,
    demoPath: '/pages/api-demos/open-api/index',
  },
  'share': {
    title: '分享',
    description: '分享菜单与分享能力。',
    order: 14,
    demoPath: '/pages/api-demos/share/index',
  },
  'payment': {
    title: '支付',
    description: '支付与交易相关能力。',
    order: 15,
    demoPath: '/pages/api-demos/payment/index',
  },
  'ad': {
    title: '广告',
    description: '激励视频与插屏广告。',
    order: 16,
    demoPath: '/pages/api-demos/ad/index',
  },
  'data-analysis': {
    title: '数据分析',
    description: '埋点统计与事件上报。',
    order: 17,
    demoPath: '/pages/api-demos/data-analysis/index',
  },
  'chattool': {
    title: '客服',
    description: '客服会话与聊天工具。',
    order: 18,
    demoPath: '/pages/api-demos/chattool/index',
  },
  'worker': {
    title: 'Worker',
    description: '多线程 Worker 能力。',
    order: 19,
    demoPath: '/pages/api-demos/worker/index',
  },
  'ai': {
    title: 'AI',
    description: '视觉/推理等 AI 能力。',
    order: 20,
    demoPath: '/pages/api-demos/ai/index',
  },
  'ext': {
    title: 'Ext',
    description: '第三方平台扩展配置。',
    order: 21,
    demoPath: '/pages/api-demos/ext/index',
  },
  'cloud': {
    title: '云开发',
    description: '云函数、数据库与存储。',
    order: 22,
    demoPath: '/pages/api-demos/cloud/index',
  },
  'misc': {
    title: '未分类',
    description: '文档未归类或缺少链接的 API。',
    order: 23,
    demoPath: '/pages/api-demos/misc/index',
  },
}

export function getCategoryMeta(key: string): CategoryMeta {
  const meta = categoryMeta[key]
  if (meta) {
    return { key, ...meta }
  }
  return {
    key,
    title: key,
    description: '未映射分类',
    order: 999,
  }
}

export function getAllCategoryKeys() {
  return Object.keys(categoryMeta)
}
