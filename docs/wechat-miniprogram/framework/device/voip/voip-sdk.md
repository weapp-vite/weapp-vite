<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/voip-sdk.html -->

# 小程序音视频通话 SDK (Linux 设备)

此 SDK 运行于搭载 Linux 系统的硬件设备上，为设备提供向手机微信内的小程序拨打 VoIP 通话的能力。

使用此 SDK 之前，请先参考 [《小程序音视频通话（for 硬件）》](../device-voip.md) 完成前置的接入和小程序开发流程。

## 1. 设备要求

### 1.1 硬件要求

- CPU：未定最低要求，推荐双核 500MHz CPU 或更高规格。
- 内存：推荐 64M+ RAM。SDK 本身至少需要 13M 内存。
- 磁盘
    - 空间：32M+ ROM (SDK 代码文件本身有 6.5M, 此外还需要预留文件读写空间)。
    - 规格：推荐 EMMC/UFS；若设备包含 RPMB，则必须确保 RPMB 分区未被使用。
- 麦克风
    - 采样率：需要支持 16000，不支持的需要厂商自行重采样。
    - 编码格式：必须支持 PCM；可选支持 OPUS/G711/G729（软编软解）。
- 扬声器:
    - 采样率：需要支持 16000，不支持的需要厂商自行重采样。
    - 编码格式：必须支持 PCM；可选支持 OPUS/G711/G729（软编软解）。
- 摄像头（可选）
    - 分辨率：至少 240x320。
    - 编码格式
          - H264：必须支持, 如果设备确不支持 H264, 你可以选择语音通话。
          - H265：可选支持, 仅微信 8.0.36 及以上版本支持。
          - 暂不考虑支持其它视频编码格式。

### 1.2 系统要求

- C++ 标准库: 需要附带 libstdc++.so.6, 版本最低支持 C++14。
- 时间: 需要同步当前时间，不能用假时间
    - 由于 SDK 需要建立 SSL 链接，需要本机有正常的世界时间以便 TLS 校验证书有效性。
    - SDK 还需要时间来判断本地缓存是否过期. 如果系统没有正确时间 (如 1970-01-01), 则 SDK 会认为本地缓存一致不过期, 导致缓存超时后也未刷新缓存。
- 工具链
    - arm64: gcc-linaro 7.3.1 及以上版本 (glibc 2.17, glibcxx 3.4.22).
    - arm: gcc-linaro 5.4.1 及以上版本 (glibc 2.16, glibcxx 3.4.21).
- 内核：未定最低要求

### 1.3 第三方库要求

SDK 需要以下第三方库，设备厂商可以考虑在系统内部署，与其他应用共享，以节省程序体积：

1. libcurl: 7.84.0+
2. TLS 库: 具体请参考 `wx_crypto_module` 章节。 我们强烈建议设备/芯片厂商自行定制 OpenSSL 或 MbedTLS，以便能在 SHA256、RSA、HMAC 等算法能使用芯片的硬件加速指令完成计算，加快 https 证书校验的速度，同时节能。

**libcurl**

如果系统内已经包含了 libcurl, 你可以在 SDK 内的 libcurl.so 和系统内自带的 libcurl.so 二选一，不需要携带多个 libcurl。

- 若使用 SDK 内的 libcurl，请确保替换掉系统内的 libcurl，不要同时存在两个版本，可能会有兼容问题。
- SDK 内自带的 libcurl 链接了 mbedtls。如果系统内已经有了 OpenSSL 或其他 SSL 库，且你不希望在系统内额外带一份 mbedtls，你可以自行构建一个 7.84.0 或以上版本的 libcurl 并置于系统中。这样就不需要 SDK 自带的 libcurl 和 mbedtls 了。
- 系统里自带的 libcurl 必须支持 https+TLS 证书客户端校验，版本号需要为 7.84.0 或以上版本。

## 2. 下载 SDK

请在 [此处](https://git.weixin.qq.com/wxa_iot/voipsdk/tree/master/linux) 下载 SDK。

SDK 解压之后，你将看到如下目录：

- `include` : 头文件
- `lib` : 动态库文件
- `example` : 独立可运行的 Demo 案例

**以下介绍的接口，都可以在 `include` 目录中找到， `example` 中也有对应的示例，请结合头文件和示例代码阅读此文档** 。

### 关于铃声

SDK 会在调用 `wx_voip_session_call` 函数时创建一个音频流用于输出铃声。厂商设备接入方必须要接入 [微信的拨打铃声](https://git.weixin.qq.com/wxa_iot/voipsdk/blob/master/linux/phonering.wav) ，否则将无法通过 VoIP 接入审核。

铃声目前提供的是 PCM-S16 (采样率 8000) 格式的音频。如果设备不支持该采样率，请自行重采样。

## 3. 实现硬件抽象层

SDK 正常工作依赖硬件设备平台提供的软硬件接口，请参考 [硬件抽象层](../voip-sdk/hal.md) 文档实现相关接口。

## 4. 初始化 SDK

> 头文件： `wmpf/wmpf.h` 。

每次进程启动后，调用任意 SDK 的接口之前，需要首先调用如下方法对 SDK 进行初始化。

```c
wx_operation_t wx_init(const wx_init_config_t* config,
                             wx_get_module_t get_module);
```

> 由于测试时往往使用开发版或者体验版小程序，请注意在调试的时候设置 wxa\_flavor 至合适的值。

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>config</td> <td>wx_init_config_t*</td> <td>初始化参数，后面详细说明</td></tr> <tr><td>get_module</td> <td>wx_get_module_t</td> <td><a href="./../voip-sdk/hal.html">硬件抽象层</a>配置的函数指针</td></tr></tbody></table>

**返回值**

[`wx_operation_t`](../voip-sdk/wx_operation.md) wx\_init()是异步函数，会发起网络请求。请留意异步操作完成之后的状态码。

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_INVALID_ARGUMENT</td> <td>config 中的参数有错误。</td></tr> <tr><td>WXERROR_TIMEOUT</td> <td>请求超时。</td></tr> <tr><td>WXERROR_RESOURCE_EXHAUSTED</td> <td>请检查网络状态或磁盘读写权限。</td></tr> <tr><td>WXERROR_FAILED_PRECONDITION</td> <td>config 传入的 device_id 和 device_signature 没有在 WeCooper 平台注册；或重复调用 wx_init()。</td></tr> <tr><td>WXERROR_INTERNAL</td> <td>其他内部错误。</td></tr></tbody></table>

### 4.1 `wx_init_config_t`

提供初始化 SDK 所需的一系列参数。

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_struct_t</td> <td>wx_init_config_t 类型的基类</td></tr> <tr><td>log_dir</td> <td>char *</td> <td>SDK 写日志的路径。如果设置为<code>NULL</code>则不会写入日志</td></tr> <tr><td>data_dir</td> <td>char *</td> <td>SDK 读写数据的路径。需确保进程有该目录的读写权限，需确保此目录内容不被其他代码/进程修改。</td></tr> <tr><td>product_id</td> <td>int</td> <td>固定填 <code>0</code></td></tr> <tr><td>host_appid</td> <td>char *</td> <td>固定填 <code>NULL</code></td></tr> <tr><td>device_id</td> <td>char *</td> <td>厂商自行分配的设备 ID。需确保每台设备使用唯一的 ID，并且同一设备始终使用同一 ID。</td></tr> <tr><td>device_signature</td> <td>char *</td> <td>固定填 <code>NULL</code></td></tr> <tr><td>device_signature_version</td> <td>int</td> <td>固定填 <code>0</code></td></tr> <tr><td>model_id</td> <td>char *</td> <td>通过<a href="./../device-access.html">硬件设备接入</a>获得的设备型号 ID</td></tr> <tr><td>wxa_appid</td> <td>char *</td> <td>接收通话的小程序的 AppID</td></tr> <tr><td>wxa_flavor</td> <td>wx_wxa_flavor_t</td> <td>接收通话的小程序的版本，如开发版、体验版、正式版。</td></tr> <tr><td>rpmb_device</td> <td>char *</td> <td>RPMB 设备路径。采用 EMMC 的硬件设备需要指定此路径。</td></tr> <tr><td>h265_only</td> <td>bool</td> <td>如果设备只支持 H265，可以设置此字段为 true，否则设备接收到的流以 H264 优先</td></tr> <tr><td>video_landscape</td> <td>bool</td> <td>true: SDK 收到流的宽高比 4:3, false: SDK 收到流的宽高比 3:4</td></tr> <tr><td>subscribe_video_length</td> <td>int</td> <td>开发者可以用此配置来订阅一个分辨率的长边值，目前支持 320，需要向微信提交 appid，待开通订阅机制后生效</td></tr></tbody></table>

## 5. 注册设备

> 头文件： `wmpf/wmpf.h` 。

SDK 初始化成功之后，应当首先检查设备是否已经注册过。如果没有注册过，则需对设备进行注册，然后才能发起通话。

### 5.1 检查当前设备是否已注册

```c
wx_error_t wx_device_is_registered(bool* is_registered_out);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>is_registered_out</td> <td>bool*</td> <td>传入指针，用于接收是否注册的状态，如果检查到尚未注册，需要参考流程 5.2 进行设备注册</td></tr></tbody></table>

**返回值**

`wx_error_t` 错误码

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr> <tr><td>WXERROR_FAILED_PRECONDITION</td> <td>wx_init()函数尚未调用。需要先调用 wx_init()。</td></tr></tbody></table>

### 5.2 设备注册

向微信小程序后台注册设备。

```c
wx_operation_t wx_device_register(const char* sn_ticket);
```

注意事项：

1. 设备注册后，SDK 将会保存设备的注册信息，包括小程序 AppID、Model ID、设备 ID（SN），以及其他需要保存的设备注册信息。因此设备只能给指定的小程序拨打小程序音视频通话，不能变更小程序，不能给多个小程序拨打小程序音视频通话。
2. snTicket 只有 5 分钟有效期，设备不可以存储 snTicket。
3. snTicket 需要由厂商后台传给设备，而不是设备直接访问微信后台获取 snTicket。因为 snTicket 获取需要 accessToken，该参数需要由厂商后台维护。
4. 虽然 snTicket 只有 5 分钟有效期，但 snTicket 仅为设备注册时校验使用. 因此注册信息本身是持久化的，后续也不再需要 snTicket 注册设备或者拨打音视频通话。

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>sn_ticket</td> <td>char*</td> <td>通过<a href="(hardware-device/getSnTicket)">获取设备票据</a>接口获得</td></tr></tbody></table>

**返回值**

[`wx_operation_t`](../voip-sdk/wx_operation.md) wx\_device\_register()是异步函数，会发起网络请求。请留意异步操作完成之后的状态码。

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr> <tr><td>WXERROR_INVALID_ARGUMENT</td> <td>sn_ticket 不合法或已失效。</td></tr> <tr><td>WXERROR_ALREADY_EXISTS</td> <td>设备已经注册过，无需二次注册。</td></tr> <tr><td>WXERROR_PERMISSION_DENIED</td> <td>该设备 ID 已经注册过。</td></tr> <tr><td>WXERROR_UNAVAILABLE</td> <td>网络访问失败。</td></tr> <tr><td>WXERROR_DATA_LOSS</td> <td>写入注册信息失败。需要检查文件读写权限。如果是 EMMC，需检查 RPMB 是否已经写过内容。</td></tr> <tr><td>WXERROR_FAILED_PRECONDITION</td> <td>wx_init()函数尚未调用。需要先调用 wx_init()。</td></tr></tbody></table>

## 6. 配置 Session

> 头文件： `wmpf/voip.h` 。

发起通话之前，需要首先创建一个 Session。Session 中将配置通话发起方（也就是接入此 SDK 的设备）的信息，设置通话状态回调等。

### 6.1 初始化 Session 对象

调用 `wx_voip_session_new()` 以配置 `wx_voip_session_t` 对象。此对象用于进一步发起通话或加入通话。Session 对象可以重复使用，反复发起或加入通话。

```c
wx_error_t
wx_voip_session_new(wx_voip_session_type_t,
                    wx_voip_session_scene_t,
                    const struct wx_voip_session_listener* listener,
                    void* user_data,
                    const wx_voip_member_t* self_member,
                    const wx_voip_session_config_t* config,
                    wx_voip_session_t* session);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>session_type</td> <td>wx_voip_session_type_t</td> <td>选择是纯音频通话还是音视频通话</td></tr> <tr><td>scene</td> <td>wx_voip_session_scene_t</td> <td>固定填 <code>WX_VOIP_SESSION_SCENE_IOT</code></td></tr> <tr><td>listener</td> <td>wx_voip_session_listener *</td> <td>设置监听通话状态回调</td></tr> <tr><td>user_data</td> <td>void *</td> <td>开发者按需设置 context 信息。相关内容可以在状态回调中获取到。</td></tr> <tr><td>self_member</td> <td>wx_voip_member_t *</td> <td>通话发起方（也就是接入此 SDK 的设备）的信息，详见后续「self_member 参数说明」</td></tr> <tr><td>config</td> <td>wx_voip_session_config_t *</td> <td>摄像头配置（分辨率、旋转等）。纯音频通话填入默认值{0,0,0}即可。</td></tr> <tr><td>session</td> <td>wx_voip_session_t *</td> <td>本次配置的 session 对象。<strong>注意</strong>：后续需记得调用 wx_voip_session_destroy()销毁此对象。</td></tr></tbody></table>

**返回值**

`wx_error_t` 错误码

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr> <tr><td>WXERROR_INVALID_ARGUMENT</td> <td>参数错误。</td></tr> <tr><td>WXERROR_FAILED_PRECONDITION</td> <td>wx_init()函数尚未调用。需要先调用 wx_init()。</td></tr></tbody></table>

**self\_member 参数说明**

设备端（通话发起方）的 `wx_voip_member_t` 设置如下：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>name</td> <td>char *</td> <td>固定填空字符串</td></tr> <tr><td>id</td> <td>char *</td> <td>必须传入调用 wx_init()时 config 中的 device_id</td></tr> <tr><td>camera_status</td> <td>wx_voip_member_camera_status_t</td> <td>音视频通话，此参数描述通话建立时己方摄像头是否开启。纯音频通话忽略。</td></tr></tbody></table>

### 6.2 销毁 Session 对象

当不需要发起通话之后，需要销毁之前创建的 Session 对象，防止内存泄漏。

```c
void wx_voip_session_destroy(wx_voip_session_t session);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>session</td> <td>wx_voip_session_t *</td> <td>要销毁的 session 对象。</td></tr></tbody></table>

## 7. 通话

> 头文件： `wmpf/voip.h` 。

成功创建了 `wx_voip_session_type_t` 对象，就可以进一步发起通话了。调用 `wx_voip_session_call()` 发起通话，调用 `wx_voip_session_hangup()` 主动结束通话。通话也可能被对方挂断，或者被异常挂断，相关事件通过创建 session 时设置的回调去监听。

### 7.1 发起通话

调用异步函数 `wx_voip_session_call()` 发起通话：

```c
wx_operation_t
wx_voip_session_call(wx_voip_session_t session,
                     const wx_voip_member_t* callee);
```

注意事项：

1. 调用本函数发起音视频通话前，你需要通过 `wx_device_is_registered` 函数来判断设备是否已经注册（一次性判断即可，不需要多次判断）。仅在设备已经注册成功的前提下，设备才能调用本函数拨打小程序音视频通话。
2. 要拨打的微信用户的 OpenID 来自的小程序，必须和当前设备注册时使用的小程序 AppID 一致。
3. 由于被拨打小程序音视频通话的微信用户需要预先在小程序内对该设备进行授权，设备在该函数返回 `WXERROR_PERMISSION_DENIED` 后，应当提示要拨号的用户没有权限拨打小程序音视频通话.
4. 设备侧可以通过 `wx_voip_session_can_call` 函数判断是否可以向指定用户拨打音视频通话（仅包含 SDK 接口，没有后台接口）.
5. 小程序侧可以通过 `wmpfVoip.getIotContactList` 函数判断音视频通话授权.
6. 我们推荐厂商在后台维护 OpenID 与设备 ID 的授权对应关系.
7. 厂商在调试时，应当使用体验版或者开发版小程序，因为这些版本默认包含音视频通话体验时长. 且正式版小程序需要在设备寄送审核通过后才可以上线音视频通话能力.

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>session</td> <td>wx_voip_session_t</td> <td>前面创建的 session 对象</td></tr> <tr><td>callee</td> <td>const wx_voip_member_t*</td> <td>通话接听端（小程序端）信息。详见后续「callee 参数说明」</td></tr></tbody></table>

**返回值**

[`wx_operation_t`](../voip-sdk/wx_operation.md) wx\_voip\_session\_call()是异步函数，会发起网络请求。此异步函数返回成功，表示通话正确拨出，不代表通话已接通。请留意异步操作完成之后的状态码。

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr> <tr><td>WXERROR_FAILED_PRECONDITION</td> <td>当前正在通话中，不要重复拨打电话。</td></tr> <tr><td>WXERROR_RESOURCE_EXHAUSTED</td> <td>请检查网络状态。</td></tr> <tr><td>WXERROR_PERMISSION_DENIED</td> <td>被拨打的用户未向当前设备授权拨打 VoIP 通话权限；或当前小程序开通拨打 VoIP 通话的权限。</td></tr> <tr><td>WXERROR_INVALID_ARGUMENT</td> <td>open_id 或 sn_ticket 设置错误</td></tr> <tr><td>WXERROR_UNAVAILABLE</td> <td>当前微信小程序没有开通 VoIP 通话权限，或通话时长不足，或者当前设备没有购买 LICENSE。</td></tr> <tr><td>WXERROR_INTERNAL</td> <td>内部错误</td></tr></tbody></table>

**callee 参数说明**

小程序端（通话接听方）的 `wx_voip_member_t` 设置如下：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>name</td> <td>char *</td> <td>显示在设备端 UI 上的名称。</td></tr> <tr><td>id</td> <td>char *</td> <td>传入通话接收方微信用户在小程序里的 open_id。</td></tr> <tr><td>camera_status</td> <td>wx_voip_member_camera_status_t</td> <td>音视频通话，此参数描述通话建立时手机微信小程序端摄像头是否开启。纯音频通话请忽略此参数。</td></tr></tbody></table>

### 7.2 主动结束通话

```c
wx_operation_t
wx_voip_session_hangup(wx_voip_session_t session,
                       wx_voip_hangup_reason_t reason);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>session</td> <td>wx_voip_session_t</td> <td><code>wx_voip_session_new</code> 创建的 session 对象</td></tr> <tr><td>reason</td> <td>wx_voip_hangup_reason_t</td> <td>挂断 VoIP 通话的原因</td></tr></tbody></table>

**返回值**

[`wx_operation_t`](../voip-sdk/wx_operation.md) wx\_voip\_session\_hangup()是异步函数，会发起网络请求。此异步函数返回成功，表示通话成功挂断。请留意异步操作完成之后的状态码。

### 7.3 手机微信呼叫设备 - 接听通话

```c
wx_operation_t wx_voip_listener_join(wx_voip_session_t session,
                                           const char *roomid);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>session</td> <td>wx_voip_session_t</td> <td><code>wx_voip_session_new</code> 创建的 session 对象</td></tr> <tr><td>roomid</td> <td>const char *</td> <td>小程序插件端发起通话后返回的 roomId</td></tr></tbody></table>

**返回值**

[`wx_operation_t`](../voip-sdk/wx_operation.md) wx\_voip\_listener\_join()是异步函数，会发起网络请求。此异步函数返回成功，表示通话正常加入。请留意异步操作完成之后的状态码。

### 7.4 手机微信呼叫设备 - 提前挂断

此接口仅用于在创建 session 前使用，一般用于实现忙线和拒接。创建 session 后，应使用 `wx_voip_session_hangup` 挂断。

```c
WX_API wx_operation_t wx_voip_listener_hangup(const char *roomid,
                                              wx_voip_hangup_reason_t reason);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>roomid</td> <td>const char *</td> <td>小程序插件端发起通话后返回的 roomid</td></tr> <tr><td>reason</td> <td>wx_voip_hangup_reason_t</td> <td>挂断 VoIP 通话的原因</td></tr></tbody></table>

**说明** 此接口不需要 session，在 wx\_init 后即可直接调用。 若已创建了 session，则需要使用 wx\_voip\_session\_hangup 来进行挂断。

**返回值**

[`wx_operation_t`](../voip-sdk/wx_operation.md) wx\_voip\_listener\_hangup()是异步函数，会发起网络请求。此异步函数返回成功，表示通话成功挂断。请留意异步操作完成之后的状态码。

### 7.5 获取通话房间号 roomId

开发者可以通过 roomId 关联接听和拨打双方，一般用于标识一次通话和串连上报信息使用。

```c
const char* wx_voip_session_get_roomid(wx_voip_session_t session);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>session</td> <td>wx_voip_session_t</td> <td><code>wx_voip_session_new</code> 创建的 session 对象</td></tr></tbody></table>

**返回值**

返回当前 voip 通话所在房间的标识，即 roomid。或返回空字符串。

## 8. 关闭 SDK

> 头文件： `wmpf/wmpf.h` 。

当你不再使用 SDK 所提供的功能，想要释放资源，可以调用 `wx_stop` 。

调用此函数之前，请务必确保之前的所有 `wx_operation` 、 `wx_voip_session` 等对象已经释放，否则可能造成未知的后果。

成功调用此函数之后，如何你还想再次使用 SDK，那么需要重新走一遍从初始化开始的各个流程。

```c
wx_error_t wx_stop();
```

#### 返回值

`wx_error_t` 错误码

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>SDK 正常关闭</td></tr></tbody></table>

## 9. 常见问题

### 9.1 SDK 链接失败

如果你的设备芯片是 RV1109 等系列芯片时，这个芯片提供的工具链的 libstdc++.so 缺少版本信息，导致链接我们提供的 SDK 时，出现找不到 C++ 标准库相关符号的问题。微信这边不了解这个工具链对 libstdc++.so 有什么改动，出现此情况时，你应该寻求芯片厂商的技术支持。比如替换工具链中的 libstdc++.so（请你记得同时替换系统的 libstdc++.so）。

### 9.2 device/key/get fail: 10008

这说明你在调用 `wx_device_register` 函数时传入的 SNTicket 不正确或者已经过期。

### 9.3 device/call fail: 9

如果 SDK 日志中报该错误，意味着 SDK 检测到你要拨打的微信用户未对这个设备授权音视频拨打权限。你需要作如下检查：

1. 小程序在通过 `wx.requestDeviceVoIP` 为这个微信用户授权设备音视频权限时：

- 小程序提供的 OpenID 是否和设备侧拨打时传入给 `wx_voip_session_call` 的 id 一致
- 小程序生成 SNTicket 时使用的 SN 是否和设备侧初始化 SDK 时传入的设备 ID 一致。 为了检查小程序是否正确获得了微信用户的音视频拨打授权，小程序开发者可以在小程序内通过调用 `wx.getDeviceVoIPList` 函数获取当前微信用户的授权设备列表（设备 ID/SN），以此来检查微信用户是否对指定的设备（通过设备 ID/SN 来标识）授权了音视频权限。

1. 设备调用 `wx_voip_session_new()` 时，是否在 ID 处传入了设备 ID
2. 微信用户取消了对该设备的音视频权限授权

- 微信用户在微信的“最近”页面中将小程序删除
- 微信用户在小程序的设置页面中取消了订阅 以上两种情况均会导致微信用户取消对该设备的音视频授权。SDK 需要遇到该错误后（通过判断 `wx_voip_session_call` 返回值是否是 `WXERROR_PERMISSION_DENIED` ），应当正确处理这种情况，并向设备用户提示该情况。如提醒设备用户“由于微信用户取消了对该设备的授权，您将无法拨打电话给该微信用户”等。

### 9.4 device/call fail: 12

如果 SDK 日志中报该错误，有两种情况：

#### 小程序未开通音视频权限

如果你的小程序在小程序后台未开通音视频权限，则需要先开通。

由于小程序正式版的音视频权限的开通需要寄送设备审核，对于设备端开发人员，可以将 init\_config->wxa\_flavor = WX\_WXA\_FLAVOR\_DEMO 即体验版或者 WX\_WXA\_FLAVOR\_DEBUG 即小程序开发版。至于使用哪种版本，请咨询你们的小程序端开发人员。

如果需要使用小程序开发版，那么设备端开发人员需要取得小程序的开发者权限，而且扫描小程序端开发人员的微信开发者工具的真机调试二维码下载小程序的开发版。

如果需要使用小程序体验版，那么设备端开发人员需要取得小程序的体验权限，具体请咨询你们的小程序端开发人员。

#### SDK 校验设备安全失败

首先，你需要检查 SDK 日志中是否包含如下内容：

```
CallerTicket gained, you now can create voip session for IoT scene
```

如果不包含上述日志，说明 SDK 确实校验设备安全失败。

此时你应该注意查看你传递给 SDK 的 data 目录下是否存在 cert 文件、rpmb\_key 文件和 rpmb\_data 文件。你需要保证 data 目录的磁盘空间足以保存这些文件，而且这些文件需要持久化，不可以在固件升级时被覆盖或删除，不能给篡改。如果这些文件被篡改，您可能会在遇到 OperateWxData fail: 12 之前遇到别的错误。

### 9.5 device/call fail: 13

如果 SDK 日志中报该错误，意味着你在该设备已经初始化过一次 SDK 之后，更换了设备 ID。

需要注意，设备 ID 必须和设备为一一映射关系，而且一台设备上的设备 ID 不应该变更。如果你遇到了该错误，你应该使用最初初始化过设备的设备 ID 初始化 SDK，而不是更换设备 ID。

### 9.6 device/call fail: 20

传入的 OpenID 不正确，不是合法的 OpenID。请确保传入的 OpenID 由小程序 wx.login 获得。

### 9.7 device/register: HTTP 0 XX

这表示 SDK 在注册设备时遇到了 HTTPS 错误，这里 XX 应当是一个数字，比如 device/register: HTTP 0 77，表示错误码 77，请你对照 CURL 的错误码表查看该错误码对应错误是什么，如果该错误你能自行解决，如网络连接故障，请你自行解决。

确保系统网络环境能访问如下域名：servicewechat.com、ae.weixin.qq.com

### 9.8 device/register: errcode: 9800011 errmsg: sn\_ticke 不合法

这表示传入的 SNTicket 不正确。

SNTicket 格式为数字和字母的组合，长度 32 个字符，不会包含其他符号。请注意不要误传其他参数，比如误传 access\_token。同时，为了避免设备或者小程序获取 accesstoken 造成安全隐患，你应该在服务端提供生成 snticket 的接口给小程序和设备。

### 9.9 device/register: errcode: 9 errmsg: device \`xxx\` not registered

这表示给定的设备 ID 已经和某台设备绑定过了。需要注意，设备 ID 必须和设备为一一映射关系，设备 ID 不能被多台设备共用，也不能从某个设备迁移到另一个设备。也不允许一台设备更换设备 ID。如果你做了上述操作，比如在另一台设备上继续使用已经注册过的设备 ID，你应该在这个“另一台设备”上换用其他的设备 ID。

### 9.10 [CheckMemoryLeak]: Detected memory leak: wx\_operation, leak objects: 1

这个错误日志表示你在调用 wx\_voip\_xxx 系列函数，或其他返回 wx\_operation 对象的函数时，未处理其返回值。在调用返回 wx\_operation 对象的函数时，你必须要对其返回值调用 wx\_operation\_await, wx\_operation\_wait 或者 wx\_operation\_destroy 以异步等待操作完成、同步等待操作完成、或者不等待操作完成，以释放 wx\_operation 对象。

### 9.11 Found local timestamp incorrect, expected XXX, actual XXX

这个错误说明你的系统的时间戳不正确，请确保设备系统的时间戳和当前时间差距不要超过 5 秒钟.

SDK 通过 `time(NULL)` 函数获得系统时间戳, 由于时间戳是不带时区的, 请确保通过这种方式获得时间戳和 UTC 时间匹配.

### 9.12 小程序内显示设备端采集的摄像头图像被旋转了 90 度/画面拉伸变形

小程序 VoIP 插件提供了 [`setUIConfig`](../voip-plugin/api/setUIConfig.md) 接口允许厂商解决旋转 90 度的问题（cameraRotation）以及画面拉伸变形问题（aspectRatio）。

```js
if (/* 微信版本 <= 8.0.40 */) {
  wmpfVoip.setUIConfig({
    // 设置视频通话时 caller 画面
    callerUI: {
      cameraRotation: 0,  // caller的视频画面旋转角度，有效值为 0, 90, 180, 270。默认 0
      aspectRatio: 4/3, // 纵横比，caller的视频画面会进行适配比例，有效值 数字。默认 4/3
      horMirror: false, // 横向镜像，boolean 值，默认 false
      vertMirror: false, // 竖直镜像，同上
      enableToggleCamera: true, // 是否支持切换摄像头，false 则不显示「摄像头开关」按钮。默认false 【该配置项在wmpf无效，wmpf默认开摄像头，且不显示开关按钮】
    },
  })
}
```

### 9.13 [wx\_operation\_validate]: invalid address: wx\_operation 0xXXXXXXXXX

说明你在调用 `wx_operation_wait` 、 `wx_operation_await` 、 `wx_operation_destroy` 等函数时传入的 `wx_operation` 对象地址不正确，或者对象已经被释放. 请检查代码的正确性。

### 9.14 Call wx\_camera\_stream\_listener::data with stream 0xXXXXXXXX, user\_data 0xXXXXXXXX. But it's released.

说明你在错误的时机调用 wx\_camera\_stream\_listener::data 函数。需要注意 wx\_camera\_stream open 之后才能开始调用 listener::data 函数；在 wx\_camera\_stream close 之后就不能调用 listener::data 函数。同时还需要注意线程安全问题。如果你通过一个列表来维护 wx\_camera\_stream，那么在遍历列表的时候，需要与 open、close 一起加锁避免数据竞争。
