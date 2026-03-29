<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/changelog.html -->

# Skyline 更新日志

Skyline 渲染引擎的版本号可通过 [wx.getSkylineInfo](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSkylineInfo.html) 获取。

## 1.4.17 (2026-03-23)

1. 优化 引擎内存占用，提升整体性能
2. 优化 大图加载时的内存消耗
3. 修复 文本布局丢失或错位的问题
4. 修复 swiper 组件在 circular 模式下开启 cache-extent 后渲染错误的问题
5. 修复 IntersectionObserver 在特定条件下不触发回调的问题
6. 修复 scroll-view 的 scroll-top / scroll-left 属性，保证在之前提交的节点操作完成后才进行滚动

## 1.4.16 (2026-02-09)

1. 新增 CSS 支持 currentColor
2. 新增 text 组件支持自定义选区弹出菜单
3. 新增 iOS 端支持系统“粗体文本”配置
4. 修复 自定义路由卡死问题
5. 修复 IntersectionObserver 未设置 thresholds 无法触发回调的问题
6. 修复 map custom callout id 溢出问题
7. 修复 open-container 返回页面无法快速点击的问题
8. 修复 文本意外换行问题
9. 修复 scroll-view 滑动首次加载跳动的问题
10. 修复 input 光标选区颜色显示错误的问题
11. 修复 文本 text overflow 无法去除省略号的问题

## 1.4.15 (2026-01-09)

1. 新增 image 组件的 preload 属性，用于图片预加载
2. 优化 当页面被遮挡时自动停止动画，减少资源消耗
3. 修复 iOS 上某个导致崩溃的问题
4. 修复 鸿蒙平台无障碍功能导致的闪退
5. 修复 fixed 定位元素移动后未重新计算层级的问题
6. 修复 box-shadow 在 CSS 动画中不生效及导致的闪退问题
7. 修复 gif/apng 动图帧率错误的问题
8. 修复 swiper 组件在某些情况下未触发 change 事件的问题
9. 修复 在 font 和 animation 简写属性中无法使用 CSS 变量的问题
10. 修复 安卓平台无障碍功能导致的闪退
11. 修复 图片预加载配置项不生效的问题
12. 修复 scroll-view 组件在首次加载时出现跳动的问题

## 1.4.14 (2025-12-18)

1. 新增 text 组件支持行内显示
2. 新增 image 组件支持 loadstart 事件
3. 优化 scroll-view 的滚动锚定行为，提升内容变化时的稳定性
4. 优化 HTTP 客户端，移除并发限制以提升网络请求性能
5. 修复 image 组件在特定模式下图片不显示的问题
6. 修复 组件事件回调中潜在的崩溃问题
7. 修复 iOS 上 JavaScript 回调导致的崩溃
8. 修复 文本节点更新时可能引发的死锁问题
9. 修复 键盘高度变化事件输出错误值的问题
10. 修复 IntersectionObserver 在未设置 thresholds 时无法触发回调的问题
11. 修复 移除子组件操作时可能发生的崩溃
12. 修复 布局节点访问父节点时可能导致的崩溃
13. 修复 无障碍功能在鸿蒙系统上的崩溃问题
14. 修复 swiper 组件应始终触发 change 事件
15. 修复 scroll-view 滑动时首次加载内容跳动的问题

## 1.4.13 (2025-11-25)

1. 新增 支持 CSS :host 选择器
2. 优化 scroll-view 滚动性能，提升渲染效率
3. 修复 gap 属性与 CSS 变量结合时失效的问题
4. 修复 flex 布局中使用 gap 导致元素展示不全的问题
5. 修复 snapshot 组件 pointer-events 属性不生效的问题
6. 修复 图片在尺寸为零时渲染错误的问题
7. 修复 em 单位计算中基准 fontSize 错误的问题
8. 修复 Intersection Observer 在某些情况下崩溃的问题
9. 修复 svg 图片加载时可能出现的死循环问题
10. 修复 使用 mask-image 展示 svg 图片时出现灰色边框的问题
11. 修复 open-container 组件纵向测量不准确的问题
12. 修复 图片闪烁问题
13. 修复 动图设置目标尺寸后显示异常的问题
14. 修复 伪元素节点连接问题导致交互失效

## 1.4.12 (2025-10-31)

1. 新增 layout paragraph 支持无障碍功能
2. 优化 文本空白字符处理流程
3. 修复 grid-view 布局异常
4. 修复 IntersectionObserver attached 时机失效
5. 修复 scroll-view 下拉刷新动画异常
6. 修复 iOS 平台原生视图异常消失
7. 修复 横向手势返回操作异常
8. 修复 IntersectionObserver target 节点异常时的崩溃

## 1.4.11 (2025-09-15)

1. 修复 文本末行换行符溢出仍出省略号
2. 修复 input 取消 composite 后草稿字符丢失
3. 修复 scrol-view scroll-anchoring 偶现意外跳动
4. 修复 swiper 开启循环显示后 animateTo 动画错误
5. 修复 scroll-view 自动撑高问题
6. 修复 自定义路由 barrierDismissible 两次返回
7. 修复 伪元素节点消失仍在播放 css animation
8. 修复 文本中 span 意外换行
9. 修复 scroll-view 不足一屏时不触发 lower / upper 事件
10. 修复 input / textarea maxlength 输入 emoji 闪退

## 1.4.10 (2025-08-28)

1. 新增 text 增加 trailing-spaces 属性支持多行文本末行末尾预留空间
2. 新增 IntersectionObserver 支持多次监听
3. 新增 open-container 支持通过接口方式触发打开
4. 优化 css animation 在节点不可见时停止动画
5. 优化 scroll-view scroll-anchoring 支持度优化
6. 优化 open-container 手势返回时支持上下拖动页面
7. 修复 swiper 开启自动播放后，隐藏 & 显示会失效
8. 修复 image gif 动画修改 src 后动画速度异常
9. 修复 word-break: break-all 需要断开数字、英文、符号
10. 更新 grid-view 增加子节点后白屏
11. 修复 swiper 更新高度后动画失效
12. 修复 scroll-view 嵌套 swiper 时可能导致切换无动画
13. 修复 图片渲染变形
14. 修复 open-container 手势返回动画消失
15. 修复 键盘上推后无法恢复

## 1.4.9 (2025-08-06)

1. 新增 large-image 支持大图渲染
2. 优化 css animation 无限循环动画自动开启 repaint boundary 避免大面积重绘
3. 优化 text 绘制性能
4. 优化 image 对 svg 格式的判断
5. 优化 渲染树结构优化
6. 修复 span 丢失问题
7. 修复 sticky-header 动态增加内容崩溃
8. 修复 gif 动画消失
9. 修复 swiper animation 被打断时 bind:change 和 bind:animationfinished 没有回调
10. 修复 grid-view 删除并交换元素后布局错位
11. 修复 css 文本 baseline shortcut 问题
12. 修复 line-height 无法更新回 normal 值
13. 修复 swiper current 更新问题
14. 修复 picker-view indicator-style 闪退
15. 修复 iOS input 失焦的同时无法 focus
16. 修复 某些白屏及 crash 问题

## 1.4.8 (2025-05-27)

1. 优化 文本测量优化
2. 修复 listView 直接子节点带 margin 时 getBoundingClientRect 获取错误
3. 修复 input 失焦后无 blur 事件
4. 修复 intersection observer 添加对 list-view 处理
5. 修复 gif 动画频率错误
6. 修复 list-builder 偶现无法回滚
7. 修复 input selection style 不符合预期

## 1.4.7 (2025-04-29)

1. 新增 text 组件支持 space / decode 属性
2. 新增 HarmonyOS 下支持暗黑模式
3. 修复 textarea 在键盘收起来时都没有给 onKeyboardHeightChange 事件
4. 修复 attached 时机创建 intersecton observer root 失效
5. 修复 intersection observer target 离开视窗后 root-margin 未生效
6. 修复 swiper next-margin 空出的区域无法点击
7. 修复 swiper 嵌套 grid-view 无法恢复滚动位置
8. 修复 切换底部 tab 页面闪退
9. 修复 设置 word-break 无法点击
10. 修复 text max-lines 字符串解析失败会导致闪退
11. 修复 input / text keyboardHeight blur 时不触发
12. 修复 图片解码死循环
13. 修复 touch 偶现 crash

## 1.4.6 (2025-04-08)

1. 新增 HarmonyOS 支持
2. 优化 自定义字体隔离
3. 优化 开发者工具内核升级
4. 修复 两个 sticky-section 滚动速度不一致
5. 修复 调整文字选区的默认背景色
6. 修复 若干 IntersectionListener 相关接口表现异常及 crash
7. 修复 picker-view 设置非法值出现滚动
8. 修复 swiper animationfinish 返回 current 参数不正确
9. 修复 input 字体样式错误
10. 修复 picker-view-column 无子项时崩溃
11. 修复 循环动画时无法触发 scroll-into-view
12. 修复 swiper 更新高度后动画失效

## 1.4.5 (2025-03-19)

1. 新增 css 支持 word-break: break-all
2. 新增 IntersectionObserver 支持同一个节点多个监听、指定 margins、relativeTo 特定 scroll-view 节点
3. 新增 @keyframes 样式可全局共享（由 rendererOptions.skyline.keyframeStyleIsolation 控制）
4. 优化 swiper 组件切换动画曲线，改进与 scroll-view 组合使用的体验
5. 优化 卡顿率计算
6. 优化 worklet 键盘跟随动画不贴合键盘
7. 修复 image 内存泄漏
8. 修复 input placeholder-style 使用 var 会导致 crash
9. 修复 swiper 设置 current 失效
10. 修复 swiper 开启 circular 之后首次可能会访问到最后一个元素，并且 circular 特性失效
11. 修复 swiper current / bindchange 失效
12. 修复 有 overflow hidden 时可能导致 IntersectionObserver 失效
13. 修复 键盘上推未恢复到原位
14. 修复 节点的 inline style 更新时会覆盖通过 applyAnimatedStyle 绑定的动画
15. 修复 安卓原生组件存在内存泄漏
16. 修复 sticky-header 仅第一个元素支持 offset-top 且不支持负值
17. 修复 css transition box-shadow 闪退
18. 修复 image 组件切换 src 后，长按识别二维码不生效，且 bind:load 未触发
19. 修复 css variable 处理未定义的变量
20. 修复 ios input focus 失败
21. 修复 iOS 图片可能存在模糊
22. 修复 scroll-view 组件的 scroll-into-view 在某些情况下失效

## 1.4.4 (2024-12-23)

1. 新增 rich-text 支持 mode=web-static 模式，优化渲染性能（基础库 3.7.7）
2. 优化 伪元素文本布局优化
3. 修复 scroll-view 组件 scroll-anchoring 引发额外动画
4. 修复 scroll-view 组件 nested scroll 下 bind:refresherpulling 不断触发
5. 修复 文本在某些情况下未能正确换行
6. 修复 在手势操作过程中改变 opacity 会使手势会被打断
7. 修复 IntersectionObserver 重新绑定无法触发回调
8. 修复 文本点击引起的 tap 失效问题
9. 修复 image 组件支持 padding / border
10. 修复 地图在手势过程中，可能出现只能放大无法拖动的情况
11. 修复 键盘上推异常
12. 修复 若干 crash

## 1.4.3 (2024-12-02)

1. 新增 WXML 真机调试选择节点时支持 overlay 展示
2. 新增 swiper 组件 previous-margin 和 next-margin 添加 rpx 支持（基础库 3.7.6）
3. 新增 scroll-view 返回触顶速度及设置初速度（scroll 事件返回 boundaryVelocity 字段及 [worklet.scrollViewContext.scrollTo](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/base/worklet.scrollViewContext.scrollTo.html) ）
4. 优化 样式匹配流程性能优化
5. 优化 样式应用流程性能优化
6. 优化 文本布局性能优化
7. 修复 picker-view 组件 bind:change / bind:pickstart / bind:pickend 多次触发
8. 修复 swiper 组件 display-multiple-items 滑动元素问题
9. 修复 scroll-view 组件去掉 overscroll indicator
10. 修复 css mask none 导致背景图无法绘制
11. 修复 scroll-view 组件 nested scroll 滚动衔接问题
12. 修复 css background gradient 渲染异常问题
13. 修复 离屏删除节点存在内存泄漏
14. 修复 webview 页面跳 skyline 页面再返回存在内存泄漏
15. 修复 text 节点设置 pointer events 仍可点击
16. 修复 若干 crash

## 1.4.2 (2024-11-19)

1. 新增 scroll-view 组件支持由子节点撑开（在 rendererOptions 配置中指定 enableScrollViewAutoSize）（基础库 3.7.1）
2. 新增 首屏图片缓存优化
3. 修复 nested scroll-view 外层未实际发生滚动而引起内层滚动
4. 修复 设置 box-shadow inset + border 时，周围有一圈留白
5. 修复 图片 crash

## 1.4.1 (2024-10-16)

1. 新增 flex 布局支持 gap
2. 新增 worklet 中 scroll-view scrollTo 支持传递 velocity 参数，以指定初速度滚动（基础库 3.7.0）
3. 优化 jsbinding 调用耗时
4. 优化 swiper 内嵌 scroll-view 滚动切换体验问题
5. 修复 css transition delay 动画闪烁问题
6. 修复 swiper 设置 next margin / snap-to-edge 后，隐藏再显示时会消失
7. 修复 swiper 开启自动播放后，隐藏再显示会失效
8. 修复 picker-view 样式设置失败
9. 修复 键盘上推无法恢复
10. 修复 z-index 容器删除子节点的同时，将祖先节点的 opacity 设置为 0，会导致删除的子节点仍可点击
11. 修复 调试面板闪烁
12. 修复 安卓下 map 组件宽高变化后展示异常
13. 修复 list-view、swiper 点停滚动时会触发点按事件
14. 修复 scroll-view 自定义下拉刷新的 bind:refresherpulling 事件在上滑时也会触发
15. 修复 input 组件在键盘失焦时变更 value 可能无法更新
16. 修复 因精度问题导致 flex 布局出现换行
17. 修复 swiper 组件 previous-margin + snap-to-edge 搭配使用时，滑动到最后一个还可以继续滑动，看到空白卡片
18. 修复 父节点有 border 时，absolute 子节点的 size 不对
19. 修复 手势协商导致无法滚动
20. 修复 空白 text 组件高度应为 0
21. 修复 图片、picker-view、IntersectionObserver 若干 crash

## 1.4.0 (2024-09-06)

1. 新增 sticky-header 支持吸顶与否的状态回调 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/sticky-header.html)
2. 新增 scroll-view 支持 scroll-anchoring，增删列表项时保持滚动位置稳定
3. 新增 list-view / \*-builder 支持设置 background-color
4. 新增 swiper 支持 snap-to-edge
5. 优化 图片的布局尺寸发生变化时，使用布局尺寸而非图片原始尺寸渲染
6. 优化 图片在弱网/不稳定网络无法正常显示
7. 优化 内存释放优化
8. 优化 布局节点内存大小、提高缓存性能
9. 优化 布局精度
10. 修复 iOS 在无网络环境下，图片无法加载磁盘缓存
11. 修复 swiper 组件只有 1 个 item 时，滑动跳动不止
12. 修复 swiper 组件设置 display-multiple-items 后，最右侧 item 动画终止时没有右对齐
13. 修复 image 组件 src 无法更新
14. 修复 map 组件 custom callout 偶现不可见
15. 修复 open-container 组件动画首帧闪白
16. 修复 svg image 解码存在死循环
17. 修复 background-image 里使用 base64 svg 引起 mask-image 闪烁
18. 修复 兄弟节点选择器无法标脏
19. 修复 block 布局 margin 相关行为对齐 webview
20. 修复 inline-block 布局 padding 与 margin 行为对齐 webview
21. 修复 特殊定位节点布局大小异常问题
22. 修复 webview 跳 skyline 有少量内存泄漏
23. 修复 iOS 从 WebView 跳 Skyline 多次往返可能出现 crash
24. 修复 图片回调 crash
25. 修复 取消图片请求时引发的 crash
26. 修复 v8 jsbinding crash

## 1.3.4 (2024-07-11)

1. 新增 tag 选择器增加 legacy 选项以兼容 WebView（不受组件隔离限制） [详情](./wxss.md#%E5%BC%80%E5%90%AFtag%E9%80%89%E6%8B%A9%E5%99%A8%E5%85%A8%E5%B1%80%E5%8C%B9%E9%85%8D)
2. 新增 grid-view 支持设置背景色
3. 优化 图片在快速滚动场景加载阻塞
4. 优化 内存占用优化
5. 优化 css var() 性能优化
6. 修复 单页路由后退偶现白屏
7. 修复 text 组件 user-select 异常 [详情](https://developers.weixin.qq.com/community/develop/doc/00026a7bf60e40ad00b1ce6336b800)
8. 修复 scroll-view 组件 scroll-top 没有过滤非法值
9. 修复 scroll-view 组件中 wx:if + scroll-into-view 不生效
10. 修复 picker-view wx:key 更新渲染错误
11. 修复 键盘上推后页面无法恢复
12. 修复 fixed 节点里的 input 无法上推页面
13. 修复 css transition 中使用 calc() 失效
14. 修复 偶现 svg 模糊
15. 修复 GetBoundingClientRect crash
16. 修复 list-builder 回收导致 crash

## 1.3.3 (2024-06-14)

1. 新增 支持 css background conic-gradient
2. 新增 支持 css :nth-child 伪类
3. 新增 scroll-view 组件 nested 模式的 nested-scroll-body 支持 offset-top 属性 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/nested-scroll-body.html)
4. 新增 swiper 组件支持 next-margin
5. 新增 组件样式隔离选项支持从 Component options 传入，与 WebView 完全兼容（基础库 3.6.2）
6. 优化 gif 图片加上 willChangeHint 避免生成 raster cache
7. 优化 图片提前加载
8. 优化 scroll-view 组件不再限制 type 必填（默认性能较差）
9. 修复 image 组件相关 crash
10. 修复 image 组件渲染 gif 时，通过 setData 更新后，渲染异常，页面白屏
11. 修复 scroll-view 组件 builder 模式下 gif 背景图片闪烁
12. 修复 scroll-view 组件 lazy mount 机制导致节点不渲染
13. 修复 textarea 组件设置不了行间距
14. 修复 input 组件 bindfocus 不触发
15. 修复 input 组件 placeholder 不居中
16. 修复 input 组件应用 text-align center 时未完全居中
17. 修复 picker-view 组件滑动几次之后不能触发 bindtap
18. 修复 css transition / animation background-position 动画失效
19. 修复 开启 defaultContentBox 选项后，image 带有 padding 时尺寸计算错误
20. 修复 css line-height 细节对齐
21. 修复 rpx 精度问题
22. 修复 root-font-size 变化后子节点 calc rem 不更新
23. 修复 后代选择器 + :not 解析失效
24. 修复 css animation keyframes 无法使用 var
25. 修复 从 webview 页面跳转 skyline 页面时，图片无法加载，需等待
26. 修复 css mask-image 渲染闪烁
27. 修复 css short hand variable 不生效
28. 修复 列表滚动卡死
29. 修复 若干 crash 及优化

## 1.3.0 (2024-04-19)

1. 新增 支持一般兄弟节点选择器（a ~ b {}）
2. 新增 支持紧邻兄弟节点选择器（a + b {}）
3. 新增 支持 css :not() 伪类
4. 新增 支持 css :only-child() 伪类
5. 新增 支持 css :empty() 伪类
6. 新增 支持 css inline-flex 布局
7. 新增 开发者工具支持 DarkMode 调试
8. 优化 position 布局增加 cache
9. 优化 wxss 解析耗时
10. 优化 transform paint 耗时
11. 优化 transition / animation 事件派发机制
12. 优化 字体模块预热
13. 优化 内存占用
14. 修复 样式在特殊情况下无法更新
15. 修复 transition 属性 var 支持问题
16. 修复 先设置 transform-origin 再设置 transform 无效
17. 修复 flex align-items 不居中
18. 修复 font-size calc 支持 bug
19. 修复 fixed 节点 z-index 相同时节点层级不对
20. 修复 input 长按不出菜单栏
21. 修复 input bindfocus 返回值 height 始终为 0
22. 修复 map Custom Callout 更新不及时
23. 修复 scroll-view 横向滚动时触边事件不触发
24. 修复 canvas touch event 返回 x / y 属性
25. 修复 若干 crash

## 1.2.5 (2024-03-18)

1. 新增 支持 css border-style
2. 新增 支持 css font-feature-settings，用于中文标点符号宽度调整
3. 新增 支持 css letter-spacing
4. 新增 页面返回手势机制
5. 新增 容器转场动画
6. 新增 list-builder 组件支持不定高模式
7. 新增 支持 grid-builder 组件
8. 新增 input 组件的 placeholder-style 支持传样式字样串
9. 优化 worklet function 执行耗时
10. 优化 布局阶段性能
11. 优化 节点占用内存
12. 修复 地图组件双指操作异常
13. 修复 position fixed z-index 小于 0 不生效
14. 修复 单边 border-width + border-radius 不生效
15. 修复 inline 布局下 text-align 属性不生效
16. 修复 linear-gradient transparent 渲染出灰色
17. 修复 page 节点 font-size 使用 var() crash 问题
18. 修复 backdrop-filter var() 失效
19. 修复 align-items baseline 对齐时 margin 偏移问题
20. 修复 外层 tranform: scale 无法作用到 mask-image 所在节点上
21. 修复 text 中 view 节点设置 margin 会导致后续文本被截断
22. 修复 input 组件 value 和 placeholder 重叠问题
23. 修复 input 组件长按不出菜单栏
24. 更新 input 组件键盘高度 worklet 回调缺少页面上推高度
25. 修复 scroll-view 组件的 refresher-background 默认值不生效
26. 修复 grid-view 组件 aligned 模式下点击 navigator 子节点重排消失
27. 修复 iOS 自定义 tabbar 首次扫码进入白屏
28. 修复 apng 动图渲染不了
29. 修复 安卓 shared value crash 问题
30. 修复 开发者工具上 input 默认字体是斜体
31. 修复 开发者工具 WXML 伪元素选中样式不匹配
32. 修复 偶现白屏现象
33. 修复 HTTP 资源请求若干 crash
34. 修复 若干内存泄漏、crash

## 1.2.0（2024-01-08）

1. 新增 开发者工具支持真机调试
2. 新增 CSS 支持 flex order [详情](./wxss.md)
3. 新增 CSS 支持 will-change: contents，用于声明绘制边界 [详情](./wxss.md)
4. 新增 支持全局跨页面组件 [详情](./appbar.md)
5. 新增 支持 apng 动图
6. 新增 scroll-view 组件支持 builder 模式，用于按需构建在屏节点 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html##%E5%88%97%E8%A1%A8%E6%9E%84%E9%80%A0%E5%99%A8%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95)
7. 新增 picker-view 组件支持 indicator-style 属性
8. 新增 input 键盘动画提供 worklet 回调，用于实现键盘跟随动画 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/input.html#:~:text=worklet:onkeyboardheightchange)
9. 新增 textare 组件支持 linechange 事件
10. 新增 worklet 增加 ref 机制，用于在 ui 线程操作节点 [详情](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.ref.html)
11. 新增 worklet 支持 scrollTo 接口 [详情](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/base/worklet.scrollViewContext.scrollTo.html)
12. 优化 渲染性能
13. 优化 事件派发内部出现异常导致的性能损耗
14. 优化 CSS background linear-gradient 支持 px 单位
15. 优化 CSS line-height calc 混合单位支持
16. 修复 position fixed 若干稳定性问题
17. 修复 background-image png 图片模糊
18. 修复 热启动到不同 path 时会先出现上一页面内容
19. 修复 id / class 传入非 ascii 编码字符串闪退
20. 修复 动态插入的 list-view / grid-view 无法开启 prelayout
21. 修复 nested-scroll-header / nested-scroll-body 的直接子节点无法更新
22. 修复 input 光标不居中
23. 修复 暗黑模式可能显示不对的问题
24. 修复 tab 页 handlePreviousPageAnimation 无效
25. 修复 图片偶现渲染异常
26. 修复 共享元素动画失效
27. 修复 touchend 触发可能早于 touchmove
28. 修复 CSS background linear-gradient 在宽高为 0 时异常
29. 修复 picker-view 初始背景色错误
30. 修复 swiper 单个子节点下滚动对齐 webview
31. 修复 mask-image 与 image 搭配使用时闪烁问题
32. 修复 box-shadow none + boder-radius 会出现边缘黑线
33. 修复 line-through 无法去掉
34. 修复 inline 布局下 text-align 属性失效
35. 修复 absolute 节点 top 未指定时表现异常
36. 修复 input 的 value 与 placeholder 重叠
37. 修复 地图组件双指操作失效
38. 修复 snapshot 某些情况下渲染异常问题
39. 修复 开发者工具若干 crash
40. 修复 若干闪退、白屏、内存泄漏问题

## 1.1.0（2023-11-06）

1. 新增 CSS 支持 position fixed
2. 新增 span/text 组件里的布局节点支持 display inline-block
3. 新增 [draggable-sheet](https://developers.weixin.qq.com/miniprogram/dev/component/draggable-sheet.html) 滚动容器组件，用于快速实现半屏交互
4. 新增 [swiper](https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html#:~:text=layout%2Dtype) 组件支持一批新的交互动画类型，用于实现常见的原生交互效果
5. 新增 scroll-view 组件支持 [type="nested"](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html#:~:text=type) ，用于处理 scroll-view 嵌套的场景
6. 新增 input 组件支持 [cursor-color](https://developers.weixin.qq.com/miniprogram/dev/component/input.html#:~:text=cursor%2Dcolor) 属性，可自定义光标颜色
7. 新增 input 组件支持 [compositionstart](https://developers.weixin.qq.com/miniprogram/dev/component/input.html#:~:text=bind:keyboardcompositionstart) / compositionupdate / compositionend 事件，用于感知输入草稿状态
8. 新增 input 组件支持 [selectionchange](https://developers.weixin.qq.com/miniprogram/dev/component/input.html#:~:text=bind:selectionchange) 事件，用于感知光标位置变化
9. 新增 input 组件支持 hold-keyboard 属性，对齐 WebView
10. 新增 textarea 组件支持 confirm-hold 属性，对齐 WebView
11. 新增 [wx.preloadAssets](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.preloadAssets.html) 接口，对齐 WebView
12. 新增 自定义路由增加 [fullscreenDrag](./custom-route.md#:~:text=fullscreenDrag) 配置项，使得全屏范围内都可以右滑返回
13. 新增 支持页面级别配置 rendererOptions
14. 优化 自定义组件节点 display 默认值调整为 inline，解决布局错乱问题
15. 优化 scroll-view 组件 type="list" 来回滚动时会频繁发生重布局导致滚动掉帧
16. 优化 CSS animation 在节点移除之后还会不断刷新，造成不必要的性能消耗
17. 优化 webp 动图播放卡顿
18. 优化 iOS video 组件渲染卡顿、发热问题
19. 优化 文本测量加上缓存
20. 优化 底层 JSBinding 通信机制若干性能优化
21. 修复 video 组件反复点击静音按钮导致视频比例异常
22. 修复 sticky-header 点击会透传到背后文字
23. 修复 多个 input 切换时 keyboardheightchang 事件返回的 detail.height 为 0
24. 修复 input 键盘高度变化后导致输入框上推异常
25. 修复 input 组件在失去焦点后不能再次输入
26. 修复 input 输入框上推偶现失败
27. 修复 input / textarea 未进行 measure 导致设置 font-size 时无法撑开布局
28. 修复 textarea 未进行 measure 导致 auto-height 失效
29. 修复 textarea 组件不能换行（换行失焦）
30. 修复 textarea 组件光标不能移动
31. 修复 sticky-section 嵌套 template 视图无法更新
32. 修复 video object-fit 属性不生效，竖屏视频会填充容器
33. 修复 伪元素上的 css animation 不生效
34. 修复 图片渲染重复
35. 修复 component placeholder 渲染异常
36. 修复 picker view 若干更新异常
37. 修复 在某些情况下改变 padding 后布局错误
38. 修复 swiper 设置 current 之后 change 事件未对齐 webview
39. 修复 sticky-header 下 scroll-into-view 失效
40. 修复 加载 302 跳转的网络图片失败
41. 修复 安卓下 svg 图片加上 mode="widthFix" 出现图片模糊现象
42. 修复 min/max-height/width auto 设置失效
43. 修复 inline style 动态设置 custom property 失败
44. 修复 在 transition 和 worklet 动画使用 border-width & border-color 失效
45. 修复 calc() 嵌套用法出现卡死
46. 修复 非法 utf16 字符导致 ui 异常卡死
47. 修复 text 组件 overflow 属性未传值时导致 crash
48. 修复 text/span 套 image 时某些情况下会 crash
49. 修复 若干闪退问题

## 1.0.12（2023-09-06）

1. 新增 支持 box-sizing: content-box
2. 新增 支持 [NodesRef.scrollOffset](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.scrollOffset.html)
3. 新增 支持 scroll-view 组件 scroll-into-view-offset 属性（基础库 3.1.0）
4. 新增 支持 text rich-text 组件 user-select 属性
5. 新增 支持 map 组件 custom callout 特性
6. 优化 Skyline 首次渲染性能
7. 优化 [snapshot](https://developers.weixin.qq.com/miniprogram/dev/component/snapshot.html) 组件支持导出长图
8. 优化 利用 snapshot 优化 scale 动画性能（基础库 3.1.0）
9. 优化 安卓下图片请求缓存机制
10. 优化 事件派发性能
11. 优化 font-face 字体未加载时显示为空，避免出现乱码
12. 修复 图片请求带上 UA 和 referrer
13. 修复 横向 scorll-view 直接子节点 margin 失效
14. 修复 filter & backdrop-filter transition 动画不生效
15. 修复 background: url(//xxxxx) 写法不生效
16. 更新 background-image 采用 svg UrlData 格式时无法渲染
17. 修复 scroll-view scroll-x scroll-y 置为 false 无效
18. 修复 span 子节点同时更新闪退
19. 修复 scroll-view 动态增加子节点，子节点百分比尺寸失效
20. 修复 css var shorthand 不生效问题
21. 修复 flex item margin 塌陷问题
22. 修复 svg 使用 utf8 格式（正常是 charset=utf8）无法显示
23. 修复 calc 表达式使用 em 引起 crash
24. 修复 backdrop-filter 节点做 opacity 动画卡死
25. 修复 scroll-view refresher restore 之后不应该触发 pulling 事件
26. 修复 CSS flex-basis 某些情况下导致界面卡死
27. 修复 swiper 只有一个 swiper-item 时，autoplay 动画应关闭
28. 修复 scroll-into-view 跳转至 virtualHost 节点会 crash
29. 修复 scroll-view 下嵌套 swiper 时，scroll-view 滚动会影响 swiper 状态
30. 修复 更新 list-view 里的数据后，页面高度过高且出现灰色块
31. 修复 background-image repeat 在滚动时因精度计算问题出现抖动
32. 修复 intersectionObserver 接口对齐
33. 修复 getBoundingClientRect 未计入 transform
34. 修复 小程序横屏时 scroll-view 滚动条位置异常
35. 修复 地图改变高度时发生形变
36. 修复 开发者工具在 windows 平台下若干 crash
37. 修复 若干闪退、线程安全问题

## 1.0.5（2023-06-30）

1. 新增 CSS 支持 animation 属性 [详情](./wxss.md)
2. 新增 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html#:~:text=refresher%2Dtwo%2Dlevel%2Denabled) 组件支持下拉二楼交互
3. 新增 [snapshot](https://developers.weixin.qq.com/miniprogram/dev/component/snapshot.html) 截图组件，用于将组件内的 WXML 内容导出图片
4. 新增 [sticky-header](https://developers.weixin.qq.com/miniprogram/dev/component/sticky-header.html) 组件支持 offset-top 属性，用于设置顶部偏移
5. 新增 [text](https://developers.weixin.qq.com/miniprogram/dev/component/text.html#:~:text=overflow) 组件支持 overflow 属性，用于对齐文本省略特性
6. 新增 scroll-view 组件下的直接子节点 height 支持 % 单位
7. 新增 开发者工具上支持 backgroundColorContent 配置项 [详情](./custom-route.md#%E8%AE%BE%E7%BD%AE%E9%A1%B5%E9%9D%A2%E9%80%8F%E6%98%8E)
8. 新增 开发者工具上支持 getSkylineInfo 接口
9. 优化 自定义路由中频繁修改 opacity / transform 的性能问题
10. 优化 进行渲染预热以降低 iOS 首次光栅化的耗时
11. 优化 优化字符串创建减少 JSBinding 通信开销
12. 优化 路由动画时长改为默认 400 ms
13. 优化 调整 image 组件 onload 的触发时机，并保证动画中缓存不会失效
14. 修复 block 布局下 scroll-view 子元素 margin 偏移问题
15. 修复 block 布局下图片 margin 不生效
16. 修复 block 布局下 scroll-view 子节点在某些情况下无法撑满父节点的宽度
17. 修复 block 布局下若父子节点之间有 border、padding 时 margin 将不做合并
18. 修复 position absolute 下 margin 定位不准确
19. 修复 picker-view 组件在 value 越界时不显示最后一个 value
20. 修复 多个节点手势协商失效
21. 修复 伪元素事件响应问题
22. 修复 伪类选择器优先级错误
23. 修复 scroll-view 触底加载更多回弹动画问题
24. 修复 swiper-item 中包含较多图片时无法及时被释放
25. 修复 text 节点内容从无到有时，无法点击
26. 修复 text 节点在点击后移动时，事件无法再派发
27. 修复 css 动画过程中移除 transtion 属性应中断动画
28. 修复 sticky 设置 padding 后 scroll-into-view 失效
29. 修复 root-portal 内的元素无法改变高度
30. 修复 list-view 子节点在某些情况下无法正常渲染出来
31. 修复 地图组件初始化时闪黑
32. 修复 scroll-view 组件 enable-back-to-top 滚动动画失效
33. 修复 带有伪类选择器时 style sharing 匹配错误
34. 修复 scroll-view 或 root-portal 组件的子节点在某些情况下无法重新布局
35. 修复 image 组件 mode=heightFix 失效
36. 修复 文本复用时，未能重新布局导致渲染问题
37. 修复 开发者工具 safe-area-inset-\* 不生效
38. 修复 开发者工具 mac 端默认变为斜体
39. 修复 开发者工具页面切换时若操作上一页面会出现 crash
40. 修复 若干闪退、ANR 问题

## 1.0.0（2023-05-11）

1. 新增 CSS 支持 calc 函数 [详情](./wxss.md)
2. 新增 CSS 支持伪元素 before 和 after [详情](./wxss.md)
3. 新增 CSS 支持 var 函数 [详情](./wxss.md)
4. 新增 CSS 支持 mask-image 属性 [详情](./wxss.md)
5. 新增 支持 [picker-view](https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html) 组件
6. 新增 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html#:~:text=clip) 组件支持 clip 属性，可显示溢出内容
7. 新增 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html#:~:text=padding) / [grid-view](https://developers.weixin.qq.com/miniprogram/dev/component/grid-view.html) / [list-view](https://developers.weixin.qq.com/miniprogram/dev/component/list-view.html) / [sticky-header](https://developers.weixin.qq.com/miniprogram/dev/component/sticky-header.html) / [sticky-section](https://developers.weixin.qq.com/miniprogram/dev/component/sticky-section.html) 组件支持 padding 属性，设置组件内部的内边距
8. 新增 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view) 组件直接子节点支持 CSS margin
9. 新增 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html#:~:text=min-drag-distance) 组件支持 min-drag-distance 属性，设置起始滚动阈值
10. 新增 text / span 组件支持内联 view 等普通节点
11. 新增 支持新版本组件框架 glass-easel [详情](../../custom-component/glass-easel/migration.md)
12. 优化 完善 SVG 支持度
13. 优化 自定义路由接口设计，以及启动页无法绑定自定义路由 [详情](./custom-route.md)
14. 优化 图片渲染性能、CSS 动画时的性能、动图刷新率问题
15. 优化 首屏渲染性能
16. 优化 [share-element](https://developers.weixin.qq.com/miniprogram/dev/component/share-element.html) key 重复时给予提示
17. 修复 连续调用 didPop 页面白屏
18. 修复 background-image 在某些路径下消失问题
19. 修复 图片 UrlData 格式不标准时解析 crash
20. 修复 text (span) 嵌套 text (navigator) 无法点击
21. 修复 block 布局下 margin 合并正负值 bug
22. 修复 iOS input 组件 digit 键盘样式错误
23. 修复 设置 border-style 并指定其中一边宽时，剩余其他边宽应为默认值
24. 修复 sticky-section 子节点不会重计算样式
25. 修复 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 组件 bounces 和 refresher 冲突
26. 修复 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 组件触底加载更多回弹动画曲线异常
27. 修复 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 组件快速滚动时无法加载更多节点
28. 修复 [grid-view](https://developers.weixin.qq.com/miniprogram/dev/component/grid-view.html) 部分属性更新失效
29. 修复 iOS 暗黑模式从后台切前台会突变一下的问题
30. 修复 [swiper](https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html) 组件 circular & autoplay 动态切换时表现异常
31. 修复 [swiper](https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html) 组件循环模式下 cache-extent 异常
32. 修复 line-height 数值类型直接继承
33. 修复 [video](https://developers.weixin.qq.com/miniprogram/dev/component/video.html) 组件在 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 下滚动出去再回来时消失
34. 修复 超出 [share-element](https://developers.weixin.qq.com/miniprogram/dev/component/share-element.html) 的节点无法响应点击
35. 修复 页面背景色默认透明
36. 修复 若干闪退、ANR 问题

## 0.10.1（2023-03-23）

1. 新增 CSS 支持 block 布局 [详情](./wxss.md)
2. 新增 [share-element](https://developers.weixin.qq.com/miniprogram/dev/component/share-element?property=skyline) on-frame 支持返回自定义 rect
3. 新增 开发者工具支持 CSS env safe-area-inset-\*
4. 优化 使 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 组件在内容未溢出时也能够滚动
5. 优化 对字体模块预热，减少字体测量的耗时
6. 优化 image 本地缓存读取性能
7. 优化 对 JS 线程部分任务提高优先级
8. 修复 文本字号不受系统字体配置影响
9. 修复 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 组件下使用 image 组件的 fade-in 属性时布局异常的问题
10. 修复 自定义路由连续调用 didPop 接口页面白屏问题
11. 修复 [share-element](https://developers.weixin.qq.com/miniprogram/dev/component/share-element?property=skyline) 组件能够根据子节点自动撑高
12. 修复 [share-element](https://developers.weixin.qq.com/miniprogram/dev/component/share-element?property=skyline) on-frame 回调在动画完成时未触发的问题
13. 修复 开发者工具下自定义字体不生效的问题
14. 修复 CSS transition 在 bottom 变化时未触发动画
15. 修复 CSS background-image 无法移除
16. 修复 image 组件在某些情况下出现闪烁的问题
17. 修复 在自定义路由下，页面的 input 组件聚集时上推距离过小
18. 修复 input 组件上推页面后输入抖动的问题
19. 修复 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 组件 custom 模式下无法下拉刷新
20. 修复 [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 组件 bindscrolltolower 和 bindscrolltoupper 多次触发问题
21. 修复 darkmode 偶现不生效的问题
22. 修复 text 组件设置 max-lines="2" 闪退问题
23. 修复 在 ui 线程 setTimeout 闪退问题
24. 修复 开发者工具 JS 线程死锁的问题
25. 修复 若干闪退、线程安全、内存泄漏问题

## 0.9.15（2023-01-16）

1. 新增 支持 grid-view 以实现网络布局、瀑布流布局等 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/grid-view.html)
2. 新增 支持 share-element 更多自定义特性 [详情](./share-element.md)
3. 新增 完善 swiper 特性支持（bindtransition、bindanimationfinish、display-multiple-items） [详情](https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html?property=skyline)
4. 新增 swiper 组件支持手势协商 [详情](./gesture.md)
5. 新增 swiper 支持 scroll-with-animation 及 cache-extent 属性 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html?property=skyline)
6. 新增 支持解析 CSS text-shadow
7. 新增 与 applyAnimatedStyle 配套使用的 clearAnimatedStyle 接口
8. 新增 doubletap 手势返回坐标信息 [详情](./gesture.md)
9. 优化 统一 skyline 的释放流程
10. 优化 font-face 增加本地缓存
11. 优化 image 组件重新渲染相关逻辑
12. 优化 样式解析和计算的性能
13. 优化 input 输入框弹起键盘时上推到可视区域
14. 优化 background-image 渲染图片的性能
15. 修复 背景渐变失效
16. 修复 自定义路由偶现 crash
17. 修复 share-element/scroll-view 的子节点通过 absolute 超出父容器时能够响应事件
18. 修复 worklet 在某些条件下出现死锁问题
19. 修复 css env 常量的取值正确性
20. 修复 嵌套 scroll-view 事件不应传递到最外层 scroll-view
21. 修复 开发者工具 v8 engine 初始化问题
22. 修复 scroll-view 插入子节点重复 layout & paint 问题
23. 修复 applyAnimatedStyle 释放逻辑
24. 修复 较早时机修改 sharedValue 无法同步到 animatedStyle
25. 修复 shared value 保证同步写完后能同步读取到
26. 修复 自定义路由 secondaryAnimation 不生效
27. 修复 share-element 在 tab 页下 tag 重复导致动效失效的问题
28. 修复 scroll-view 初始 scroll-left 无效
29. 修复 swiper 纵向滚动时指示条位置错误
30. 修复 worklet animatedStyle 优先级应比 WXSS 高
31. 修复 tab 页切换后 swiper 滚动位置被重置的问题
32. 修复 嵌套 scroll-view lazy mount 异常问题
33. 修复 sticky-header 嵌套关系异常时出现的 crash
34. 修复 启动立即 redirectTo 到新页面可能出现白屏的问题
35. 修复 若干闪退、线程安全、内存漏洞、ANR 等问题

## 0.9.10（2022-11-23）

1. 新增 支持 sticky 吸顶机制 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/sticky-header.html)
2. 新增 支持无障碍访问 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/aria-component.html)
3. 新增 支持 rem 单位
4. 新增 scroll-view 支持 custom type [详情](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html?property=skyline)
5. 新增 scroll-view 下拉刷新增加 willRefresh 事件和 bounce 优化 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html?property=skyline)
6. 新增 scroll-view 支持 scrollend 事件和 scrolling reason [详情](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html?property=skyline)
7. 新增 scroll-view 增加 scroll-into-view-alignment / scroll-into-view-within-extent 属性 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html?property=skyline)
8. 新增 scroll-view 增加 cache-extent 属性 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html?property=skyline)
9. 新增 小程序页面背景颜色支持
10. 优化 图片缓存内存占用
11. 优化 skyline 释放流程
12. 优化 抛出 worklet 函数异常信息
13. 优化 简化页面栈结构
14. 优化 若干项稳定性改造
15. 修复 键盘上推 input 失效
16. 修复 tap 手势丢失坐标信息
17. 修复 scroll-view 子节点使用 wx:key 时更新错误
18. 修复 input maxlength 参数初始化时不生效
19. 修复 自定义路由点击遮罩层返回页面栈错乱
20. 修复 自定义路由跳转页面部分异常报错问题
21. 修复 安卓 router push crash
22. 修复 某些情况下应用样式导致 crash
23. 修复 文本节点无法标脏
24. 修复 字体缩放比例不统一
25. 修复 worklet 模块存在 UAF 问题
26. 修复 canvas 布局完成回调未触发
27. 修复 路由过程中手势返回后事件不响应
28. 修复 image onload 类型转换异常
29. 修复 在某些情况下手势出现报错
30. 修复 部分线程安全问题
31. 修复 viewport 信息同步时序问题
32. 修复 background 相关属性 crash
33. 修复 darkmode 首次进入页面闪白屏后变黑
34. 修复 input 选区样式区分平台及支持国际化
35. 修复 若干项 crash 问题

## 0.9.8（2022-10-11）

1. 新增 darkmode 支持 [详情](../../ability/darkmode.md)
2. 新增 span 组件，用于图片与文本内联布局 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/text?property=skyline)
3. 新增 scroll-view reverse 属性，支持反向滚动 [详情](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline)
4. 新增 CSS 支持 first-child / last-child 伪类 [skyline wxss 样式支持与差异](./wxss.md)
5. 新增 scale 手势回调返回更多信息
6. 新增 background-image 支持混合图片和渐变
7. 优化 filter / backdrop-filter none 时的渲染性能
8. 优化 图片内存占用回收不及时
9. 优化 手势节点按需插入
10. 优化 图片预解码
11. 修复 更新 opacity 后 z-index 失效
12. 修复 scroll-view 动态更新时手势绑定失败
13. 修复 JSCore 用法错误导致 iOS 下闪退
14. 修复 inline style 被 worklet 设置的样式所覆盖
15. 修复 scrollIntoView 失效与报错
16. 修复 SelectorQuery 查找 display none 的 Canvas Node 未触发回调
17. 修复 嵌套 text 组件闪退
18. 修复 共享页面元素和单页面路由黑屏
19. 修复 iOS 下偶现 crash
20. 修复 页面手势返回通知时机错误
21. 修复 页面推入过程中 getBoundingClientRect 读取错误
22. 修复 Touch 事件存在内存泄漏
23. 修复 手势返回页面后，短暂时间无法响应点击
24. 修复 iOS 系统输入法无法输入中文
25. 修复 CSS Length 单位计算错误
26. 修复 image / video / canvas 等叶子结点插入节点会闪退
27. 修复 小程序跳小程序 worklet 闪退
28. 修复 input 无法垂直居中
29. 修复 input 光标错位 & focus 为 false 不收键盘 & 点击空白处未失焦收键盘
30. 修复 textarea 长文本出现半截字
31. 修复 iOS main JSContext 内存泄漏
