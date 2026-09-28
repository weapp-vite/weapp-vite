# @weapp-vite/tailwindcss

基于 `weapp-tailwindcss/core` 的实验性、宿主无关 Tailwind 控制器。

`createTailwindController` 惰性创建上游编译器并管理失效与释放。`prepareTailwindRoots` 用封存的输入生成本批编译结果，预处理判定和输出排除由宿主提供。`prepareTailwindOutput` 封存宿主的最终 CSS 投影和候选集合，返回原生 CSS 与使用同一份 `CompilerSnapshot` 的 JS/模板转换。

宿主负责 Vite 预处理、CSS Modules、活跃模块图、文件监听、原生样式策略及 emit/write。控制器不创建 watcher，不启动 DevEngine，不写构建输出，也不调用 `notifyPayloadDelivered`。

Tailwind 扫描、候选删除、CSS 生成与类名转换仍由上游 core 实现。框架特定的 HTML defaults、Vue SFC、Page/layout 和传输协议不在本包中。

首期以微信双宿主运行时为验收目标；支付宝与抖音提供编译/适配契约验证，不宣称其运行时 HMR 已完成验收。

Node.js 版本要求随编译内核：`^22.18.0 || >=24.11.0`。
