---
"weapp-vite": patch
"create-weapp-vite": patch
---

减少普通构建的启动加载：首次实际转换 WXS 时再加载 Babel 预设，首次读取及展开上传凭据时再加载环境变量处理依赖。保留 WXS 同步转换接口、各平台输出和上传环境变量的覆盖规则。
