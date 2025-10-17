import type { MiniProgramPlatformAdapter } from './types'

export const MINI_PROGRAM_PLATFORM_ADAPTERS: readonly MiniProgramPlatformAdapter[] = [
  {
    id: 'weapp',
    displayName: 'WeChat Mini Program',
    aliases: ['weapp', 'wechat', 'weixin', 'wx'],
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'wxml',
      wxss: 'wxss',
      wxs: 'wxs',
    },
  },
  {
    id: 'alipay',
    displayName: 'Alipay Mini Program',
    aliases: ['alipay', 'ali', 'my'],
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'axml',
      wxss: 'acss',
      wxs: 'sjs',
    },
  },
  {
    id: 'swan',
    displayName: 'Baidu Smart Program',
    aliases: ['swan', 'baidu', 'bd'],
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'swan',
      wxss: 'css',
      wxs: 'sjs',
    },
  },
  {
    id: 'tt',
    displayName: 'ByteDance / Douyin Mini Program',
    aliases: ['tt', 'toutiao', 'bytedance', 'douyin'],
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'ttml',
      wxss: 'ttss',
    },
  },
  {
    id: 'jd',
    displayName: 'JD Mini Program',
    aliases: ['jd', 'jingdong'],
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'jxml',
      wxss: 'jxss',
      wxs: 'wxs',
    },
  },
  {
    id: 'xhs',
    displayName: 'Xiaohongshu Mini Program',
    aliases: ['xhs', 'xiaohongshu', 'little-red-book', 'red'],
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'xhsml',
      wxss: 'css',
      wxs: 'wxs',
    },
  },
] as const
