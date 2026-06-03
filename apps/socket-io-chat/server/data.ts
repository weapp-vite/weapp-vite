export interface ContactProfile {
  id: string
  name: string
  title: string
  avatarText: string
  city: string
  status: string
  signature: string
  tags: string[]
  stats: Array<{
    label: string
    value: string
  }>
  recent: Array<{
    title: string
    detail: string
  }>
}

export interface Moment {
  id: string
  author: string
  avatarText: string
  time: string
  content: string
  cover: string
  likes: number
  comments: Array<{
    user: string
    text: string
  }>
}

export interface ConversationInsight {
  summary: {
    title: string
    description: string
    health: string
  }
  metrics: Array<{
    label: string
    value: string
    trend: string
  }>
  threads: Array<{
    id: string
    name: string
    unread: number
    lastMessage: string
  }>
  actions: Array<{
    title: string
    detail: string
  }>
}

export interface ChatMessage {
  id: string
  room: string
  userId: string
  userName: string
  text: string
  platform: 'web' | 'mini' | 'server'
  createdAt: number
}

export const roomName = 'wechat-chat-demo'
export const historyLimit = 80

export const messages: ChatMessage[] = [
  {
    id: 'welcome',
    room: roomName,
    userId: 'server',
    userName: 'Socket.IO',
    text: '服务已就绪，Web 端和小程序端可以进入同一个房间聊天。',
    platform: 'server',
    createdAt: Date.now(),
  },
]

export const contactProfile: ContactProfile = {
  id: 'wx-contact-lin',
  name: '林知夏',
  title: '产品设计师',
  avatarText: '林',
  city: '杭州',
  status: '正在整理新版聊天体验',
  signature: '把复杂流程做成自然发生的对话。',
  tags: ['置顶联系人', '设计评审', '本周已同步'],
  stats: [
    { label: '共同群聊', value: '12' },
    { label: '协作事项', value: '8' },
    { label: '响应时长', value: '6m' },
  ],
  recent: [
    {
      title: '今天 09:30',
      detail: '确认了小程序端 socket.io-client 连接方案。',
    },
    {
      title: '昨天 18:12',
      detail: '发来了 Web 端聊天气泡的视觉参考。',
    },
  ],
}

export const moments: Moment[] = [
  {
    id: 'moment-1',
    author: '前端茶水间',
    avatarText: '茶',
    time: '10 分钟前',
    content: '今天把 Web 和小程序的实时聊天跑通了，下一步补齐请求客户端的真实业务页。',
    cover: 'green',
    likes: 24,
    comments: [
      { user: '林知夏', text: '这个页面终于不像测试面板了。' },
      { user: 'Socket.IO', text: '实时广播状态稳定。' },
    ],
  },
  {
    id: 'moment-2',
    author: '小程序体验组',
    avatarText: '小',
    time: '36 分钟前',
    content: '把 fetch 请求接到动态流，加载、刷新和评论区都按真实页面处理。',
    cover: 'blue',
    likes: 18,
    comments: [
      { user: 'Web 用户', text: 'Web 端也能看到同一批内容。' },
    ],
  },
]

export const conversationInsight: ConversationInsight = {
  summary: {
    title: '会话洞察',
    description: 'GraphQL 返回当前聊天室的消息健康度、未读线索和建议动作。',
    health: '稳定',
  },
  metrics: [
    { label: '今日消息', value: '128', trend: '+18%' },
    { label: '跨端在线', value: '2 端', trend: 'Web / 小程序' },
    { label: '平均响应', value: '4m', trend: '-32%' },
  ],
  threads: [
    {
      id: 'thread-design',
      name: '聊天体验评审',
      unread: 3,
      lastMessage: '请确认 GraphQL 页面是否保留底部行动建议。',
    },
    {
      id: 'thread-runtime',
      name: '小程序运行时',
      unread: 1,
      lastMessage: 'socket.io-client 与请求客户端都已进入示例。',
    },
  ],
  actions: [
    {
      title: '补充联调说明',
      detail: '在 README 里说明服务地址和三类客户端入口。',
    },
    {
      title: '邀请小程序端验证',
      detail: '使用同一个 localhost 服务检查 axios、fetch、GraphQL 页面。',
    },
  ],
}
