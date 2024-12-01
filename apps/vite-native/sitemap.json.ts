import type { Sitemap } from 'weapp-vite/json'

export default <Sitemap>{
  desc: '关于本文件的更多信息，请参考文档 https://developers.weixin.qq.com/miniprogram/dev/framework/sitemap.html',
  rules: [{
    action: 'allow',
    page: '*',
  }],
}
