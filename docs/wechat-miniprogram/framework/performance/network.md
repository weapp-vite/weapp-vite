<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/performance/network.html -->

# 网络调优

小程序和小游戏网络相关 API 使用方式相同, 所以我们用网络接口来统称

## 网络接口的构成

网络接口主要包括四个类型

- request
- download
- upload
- websocket

## 不同平台的实现

### Android

- request 接口从客户端 7.0.10 版本开始使用 Chromium 内网络相关部分封装的底层组件 (cronet), 之前版本使用 HttpURLConnection 系统组件 (系统组件依赖系统实现会有平台兼容性问题, 我们建议用新版本微信来进行调试)
- download 接口从客户端 7.0.12 版本开始使用 cronet 组件, 之前版本使用 HttpURLConnection 组件
- upload 接口目前仍在使用 HttpURLConnection 组件
- websocket 接口从客户端 7.0.4 版本开始使用微信底层组件 wcwss, 并在 7.0.10 版本优化了调用性能

### iOS

- request/download 接口从客户端 8.0.3 版本开始使用 cronet 组件, 之前版本使用 NSURLSession 系统组件
- upload 接口目前仍在使用 NSURLSession 组件
- websocket 接口从客户端 7.0.20 版本开始使用微信底层组件 wcwss, 之前版本使用 SRWebSocket 组件

## 易误解的概念

### success/fail/complete 回调

- 对于 request/download/upload 接口, 回调代表网络请求的最终结果
- 对于 websocket 接口, 回调仅代表接口调用结果, 应当监听其具体事件来获取真实的网络连接/请求状态

### wx.sendSocketMessage/SocketTask.send

早期单个小程序只允许同时存在一条 WebSocket 连接, 所以老版本基础库 WebSocket 相关接口都直接设计在了 wx 上:

- wx.connectSocket
- wx.onSocketOpen
- wx.sendSocketMessage
- wx.onSocketMessage
- wx.closeSocket
- wx.onSocketClose
- wx.onSocketError

现在单个小程序允许同时存在多个 WebSocket 连接, 原有接口设计并不能满足需求, 于是基础库在 1.7.0 版本之后增加了 SocketTask 的概念, 通过不同的实例来管理多条连接:

- wx.connectSocket
- SocketTask.onOpen
- SocketTask.send
- SocketTask.onMessage
- SocketTask.close
- SocketTask.onClose
- SocketTask.onError

原有的 wx.connectSocket 接口在新版本设计中承载了创建实例 `new SocketTask` 的用途, 所以除了 wx.connectSocket 以外, **不应该** 使用其它任何挂在 wx 上的 WebSocket 接口; 在 wx.connectSocket 调用后, **请立即同步监听** SocketTask.onOpen, 否则可能会漏掉 onOpen 通知

## 性能分析

### Android

- request/download 接口从客户端 7.0.12 版本开始, 回调中提供了 profile 信息, 给出了网络连接过程中关键时间点的耗时信息, 具体含义如下

<table><thead><tr><th>名称</th> <th>含义</th></tr></thead> <tbody><tr><td>redirectStart</td> <td>第一个 HTTP 重定向发生时的时间. 有跳转且是同域名内的重定向才算, 否则值为 0</td></tr> <tr><td>redirectEnd</td> <td>最后一个 HTTP 重定向完成时的时间. 有跳转且是同域名内部的重定向才算, 否则值为 0</td></tr> <tr><td>fetchStart</td> <td>组件准备好使用 HTTP 请求抓取资源的时间, 这发生在检查本地缓存之前</td></tr> <tr><td>domainLookUpStart</td> <td>DNS 域名查询开始的时间, 如果使用了本地缓存 (即无 DNS 查询) 或持久连接, 则与 fetchStart 值相等</td></tr> <tr><td>domainLookUpEnd</td> <td>DNS 域名查询完成的时间, 如果使用了本地缓存 (即无 DNS 查询) 或持久连接, 则与 fetchStart 值相等</td></tr> <tr><td>connectStart</td> <td>TCP 开始建立连接的时间, 如果是持久连接, 则与 fetchStart 值相等. 注意如果在传输层发生了错误且重新建立连接, 则这里显示的是新建立的连接开始的时间</td></tr> <tr><td>connectEnd</td> <td>TCP 完成建立连接的时间 (完成握手), 如果是持久连接, 则与 fetchStart 值相等. 注意如果在传输层发生了错误且重新建立连接, 则这里显示的是新建立的连接完成的时间. 注意这里握手结束, 包括安全连接建立完成、SOCKS 授权通过</td></tr> <tr><td>SSLconnectionStart</td> <td>SSL 建立连接的时间, 如果不是安全连接, 则值为 0</td></tr> <tr><td>SSLconnectionEnd</td> <td>SSL 建立完成的时间, 如果不是安全连接, 则值为 0</td></tr> <tr><td>requestStart</td> <td>HTTP 请求读取真实文档开始的时间 (完成建立连接), 包括从本地读取缓存. 连接错误重连时, 这里显示的也是新建立连接的时间</td></tr> <tr><td>requestEnd</td> <td>HTTP 请求读取真实文档结束的时间</td></tr> <tr><td>responseStart</td> <td>HTTP 开始接收响应的时间 (获取到第一个字节), 包括从本地读取缓存</td></tr> <tr><td>responseEnd</td> <td>HTTP 响应全部接收完成的时间 (获取到最后一个字节), 包括从本地读取缓存</td></tr> <tr><td>rtt</td> <td>当次请求连接过程中实时 rtt</td></tr> <tr><td>estimate_nettype</td> <td>评估的网络状态 unknown, offline, slow 2g, 2g, 3g, 4g, last/0, 1, 2, 3, 4, 5, 6</td></tr> <tr><td>httpRttEstimate</td> <td>协议层根据多个请求评估当前网络的 rtt (仅供参考)</td></tr> <tr><td>transportRttEstimate</td> <td>传输层根据多个请求评估的当前网络的 rtt (仅供参考)</td></tr> <tr><td>downstreamThroughputKbpsEstimate</td> <td>评估当前网络下载的kbps, 根据最近的几次请求的rtt, 回包情况, 结合当前的网络情况, 进行的一个网络评估结果</td></tr> <tr><td>throughputKbps</td> <td>当前网络的实际下载kbps, 根据本次请求实际计算的一个下载值, 从开始请求到 请求结束收到的 字节数 * 8/请求耗时</td></tr> <tr><td>peerIP</td> <td>当前请求的目标IP</td></tr> <tr><td>port</td> <td>当前请求的目标端口</td></tr> <tr><td>protocol</td> <td>当前请求使用的协议</td></tr> <tr><td>socketReused</td> <td>是否复用连接</td></tr> <tr><td>sendBytesCount</td> <td>发送的字节数</td></tr> <tr><td>receivedBytedCount</td> <td>收到字节数</td></tr></tbody></table>

整个请求链路为 DNS -> Connect -> SSL -> request -> response; 表中 rtt 是连接过程中实时的 rtt, 每个阶段都会更新, 而 httpRttEstimate 和 transportRttEstimate 是结合前序请求计算的综合值

- websocket 接口从客户端 7.0.12 版本开始, 在 onOpen 回调中提供了 profile 信息, 给出了网络连接过程中关键时间点的耗时信息, 具体含义如下

<table><thead><tr><th>名称</th> <th>含义</th></tr></thead> <tbody><tr><td>fetchStart</td> <td>组件准备好使用 SOCKET 建立请求的时间, 这发生在检查本地缓存之前</td></tr> <tr><td>domainLookUpStart</td> <td>DNS 域名查询开始的时间, 如果使用了本地缓存 (即无 DNS 查询) 或持久连接, 则与 fetchStart 值相等</td></tr> <tr><td>domainLookUpEnd</td> <td>DNS 域名查询完成的时间, 如果使用了本地缓存 (即无 DNS 查询) 或持久连接, 则与 fetchStart 值相等</td></tr> <tr><td>connectStart</td> <td>开始建立连接的时间, 如果是持久连接, 则与 fetchStart 值相等. 注意如果在传输层发生了错误且重新建立连接, 则这里显示的是新建立的连接开始的时间</td></tr> <tr><td>connectEnd</td> <td>完成建立连接的时间 (完成握手), 如果是持久连接, 则与 fetchStart 值相等. 注意如果在传输层发生了错误且重新建立连接, 则这里显示的是新建立的连接完成的时间. 注意这里握手结束, 包括安全连接建立完成、SOCKS 授权通过</td></tr> <tr><td>rtt</td> <td>单次连接的耗时, 包括 connect, tls</td></tr> <tr><td>handshakeCost</td> <td>握手耗时</td></tr> <tr><td>cost</td> <td>上层请求到返回的耗时</td></tr></tbody></table>

整个请求链路为 DNS -> Connect; 表中 `connectEnd - connectStart` 代表纯 tcp 连接耗时, `domainEnd - domainStart` 代表域名解析耗时; 上述两步耗时加上 handshakeCost 代表单次连接请求的耗时

### iOS

- request/download 接口从客户端 8.0.3 版本开始提供 profile 能力
- websocket 接口从客户端 7.0.20 版本开始提供 profile 能力

### 提示

- 当遇到网络问题时, 除了判断网络状态是否连通外, 还可以通过 rtt 来分析用户当前网络状况, 用以动态调整超时参数
- 网络请求提供 enableProfile 参数, 默认值为 true, 可以通过传入 false 关闭

## 优化建议

### 前后台切换

小程序切后台 5s 后, 会中断网络请求, 开发者会收到 interrupted 的回调, 此时需要做好兼容逻辑

### 网络状态变化

当用户网络状态变化时会通过事件 wx.onNetworkStatusChange 进行通知, 不少网络问题是断网引起的, 可以通过此事件给用户更好的提示

### 弱网状态变化

基础库从 2.19.0 版本开始, 提供 wx.onNetworkWeakChange 弱网变化通知, 很多超时类的问题都是用户处于弱网引起的, 可以通过此事件给用户更好的提示

在最近的八次网络请求中, 出现下列三个现象之一则判定弱网

- 出现三次以上连接超时
- 出现三次 rtt 超过 400
- 出现三次以上的丢包

弱网事件通知规则是: 弱网状态变化时立即通知, 状态不变时 30s 内最多通知一次

### request/download 新协议

从 Android 7.0.12 / iOS 8.0.3 开始, 提供下面三个新参数

<table><thead><tr><th>名称</th> <th>含义</th></tr></thead> <tbody><tr><td>enableHttp2</td> <td>如果后台支持, 尝试使用 Http2 协议</td></tr> <tr><td>enableQuic</td> <td>如果后台支持, 尝试使用 Quic 协议</td></tr> <tr><td>enableCache</td> <td>缓存内容, 相同请求优先读取本地内容</td></tr></tbody></table>

h2 连接速度更快, 建议支持, 这里需要注意 h2 的 header 是需要为全小写, 打开 enableHttp2 开关前需要注意代码逻辑

### perMessageDeflate

压缩参数目前已在 Android 和 iOS 上全量支持

## 问题排查

### 不同平台的错误返回规则

#### Android

cronet 的错误返回可以参考: https://chromium.googlesource.com/chromium/src/+/master/net/base/net\_error\_list.h

WebSocket 接口常见错误

<table><thead><tr><th>名称</th> <th>含义</th></tr></thead> <tbody><tr><td>Underlying Transport Error</td> <td>异常, 大概率无网络引起</td></tr> <tr><td>Timer Expired</td> <td>超时, 弱网或无网</td></tr> <tr><td>The total timed out</td> <td>超时, 弱网或无网</td></tr> <tr><td>TLS handshake failed</td> <td>tls 协商失败</td></tr> <tr><td>TLS handshake timed</td> <td>tls 协商超时, 可以考虑重试</td></tr> <tr><td>Invalid HttpCode</td> <td>服务器配置有误</td></tr></tbody></table>

#### iOS

cronet 的错误返回参考同 Android

upload 一般返回汉语信息加上 kcferrordomaincfnetwork 可以直接在苹果开发者官网上搜索到具体的对应错误信息, 协助分析解决

### ipv6 慢的问题

Android HttpURLConnection 是按照 RFC 3484 顺序尝试每个 ip 地址, 这里应该是 v6 优先, 但是系统尝试 v6 连接时超时就会按顺序再去尝试 v4, 虽然最后也有可能在设置的 60s 超时时间内完成, 但是整体耗时还是变长了, 现象就是 request 接口的请求时间很长. 在客户端 7.0.10 版本切换 cronet 后已经解决此问题

### 证书问题

证书的注意事项已有文档说明: https://developers.weixin.qq.com/minigame/dev/guide/base-ability/network.html

1. 证书过期或无效

可以通过 https://myssl.com/ssl.html 或其他在线工具验证, 因为 Android 手机的兼容性问题, 验证结果并不保证对所有 Android 机器都有效

1. 证书链不完整

Android 的根证书不全, 如果服务器是使用中间证书, 而 Android 手机上又找不到相应的根证书, 就会出现相关的 SSL 错误, 此时需要服务器配置完整证书链

1. wss 协议走 80 端口不成功

80 端口对应 http 默认不做证书校验, wss 应当选用 443 端口

### not in domain url

请求 url 不在域名列表中, 遇到这个问题有几种可能

1. 请求 url 不在 mp 配置的域名列表里
2. 重定向后的 url 不在域名列表里
3. websocket 请求的端口没有配置
4. 配置的域名未生效 (极低概率)

### network is down

iOS 14 系统新增了本地网络开关, 如果关闭则局域网不通, 系统接口报错 network is down, 目前系统未提供检测开关方法, 开发者需要根据错误信息提示用户打开权限
