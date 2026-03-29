<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-sdk/hal.html -->

# 硬件抽象层

SDK 正常工作依赖硬件设备平台提供的软硬件接口，包括麦克风、扬声器、摄像头、加密库等模块。我们设计了硬件抽象层，提供一致的接口定义，具体的接口实现需要 SDK 的接入方提供。

## 1. `Module` 抽象

> 头文件： `wmpf/module.h` 。

我们把每个模块抽象成一个 `wx_module` 类型，目前有如下几种 module:

<table><thead><tr><th>类型</th> <th>头文件</th> <th>说明</th></tr></thead> <tbody><tr><td>wx_audio_module</td> <td>wmpf/hardware/audio.h</td> <td>音频模块，用于从麦克风和扬声器输入/输出音频流</td></tr> <tr><td>wx_camera_module</td> <td>wmpf/hardware/camera.h</td> <td>摄像头模块，用于从摄像头获取视频流</td></tr> <tr><td>wx_crypto_module</td> <td>wmpf/crypto.h</td> <td>签名算法模块。SDK 依赖系统的加密库中的签名算法。</td></tr> <tr><td>wx_video_module</td> <td>wmpf/hardware/video.h</td> <td>视频模块，用于创建远端视频流</td></tr></tbody></table>

当按需实现这几种 Module 后，在调用 `wx_init()` 初始化 SDK 的时候，将使用如下函数指针把 Module 提供给 SDK 使用：

```c
typedef wx_error_t (*wx_get_module_t)(const char* id,
                                      struct wx_module** module);
```

SDK 调用实现的函数时，会传入一个 ID，需要返回此 ID 所对应的 `wx_module` 的实例。

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>id</td> <td>char*</td> <td>module ID，在后续定义</td></tr> <tr><td>module</td> <td>struct wx_module**</td> <td>对应的 module 实例</td></tr></tbody></table>

当前支持的 module ID 已经预先定义在各个头文件中：

<table><thead><tr><th>ID</th> <th>头文件</th></tr></thead> <tbody><tr><td>WX_AUDIO_MODULE_ID</td> <td>wmpf/hardware/audio.h</td></tr> <tr><td>WX_CAMERA_MODULE_ID</td> <td>wmpf/hardware/camera.h</td></tr> <tr><td>WX_CRYPTO_MODULE_ID</td> <td>wmpf/crypto.h</td></tr> <tr><td>WX_VIDEO_MODULE_ID</td> <td>wmpf/hardware/video.h</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断请求的 module 是否有效。

例如一台设备不具备摄像头，那么当 SDK 请求 WX\_CAMERA\_MODULE\_ID 时，只需返回 `WXERROR_UNIMPLEMENTED` 。

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>请求的 module 有效。</td></tr> <tr><td>WXERROR_UNIMPLEMENTED</td> <td>请求的 module 无效。</td></tr></tbody></table>

**示例代码**

```c
// 假设已经实现了如下module：
extern struct wx_audio_module audio_module;
extern struct wx_camera_module camera_module;
extern struct wx_crypto_module crypto_module;
// 现实现HAL获取Module的函数如下：
wx_error_t hal_get_module(const char* id, struct wx_module** module_out) {
  if (!strcmp(id, WX_AUDIO_MODULE_ID)) {
    *module_out = (struct wx_module*)&audio_module;
    return WXERROR_OK;
  } else if (!strcmp(id, WX_CAMERA_MODULE_ID)) {
    *module_out = (struct wx_module*)&camera_module;
    return WXERROR_OK;
  } else if (!strcmp(id, WX_CRYPTO_MODULE_ID)) {
    *module_out = (struct wx_module*)&crypto_module;
    return WXERROR_OK;
  }
  // 假设当前设备没有屏幕，因此不需提供 wx_video_module，那么就返回 WXERROR_UNIMPLEMENTED
  return WXERROR_UNIMPLEMENTED;
}
```

## 2. 音频模块

> 头文件： `wmpf/hardware/audio.h` 。

音频模块，需要配置一个 `wx_audio_module` 类型的实例。该类型主要包含如下几个函数指针，用来获取音频输入/输出设备的信息，或操作音频设备。

运行时，VoIP 将顺序调用这 4 个函数，完成对音频输入/输出设备的配置。

### 2.1 `get_number_of_devices`

获取指定类型音频输入/输出设备的数量。

```c
wx_error_t (*get_number_of_devices)(struct wx_audio_module* module,
                                    wx_audio_device_type_t device_type,
                                    size_t* num_devices_out);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>module</td> <td>struct wx_audio_module*</td> <td>context</td></tr> <tr><td>device_type</td> <td>wx_audio_device_type_t</td> <td>设备类型，可选值<br><code>WX_AUDIO_DEVICE_IN</code>（音频输入设备，如麦克风）<br><code>WX_AUDIO_DEVICE_OUT</code>（音频输出设备，如扬声器）</td></tr> <tr><td>num_devices_out</td> <td>size_t*</td> <td>返回对应类型的音频设备的数量</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断得到的设备数量是否有效

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr> <tr><td>WXERROR_INVALID_ARGUMENT</td> <td>num_devices_out 为空</td></tr></tbody></table>

### 2.2 `get_device_name`

查询指定类型（如 WX\_AUDIO\_DEVICE\_IN 表示麦克风）音频输入/输出设备列表中第 index 个设备的 ID

```c
wx_error_t (*get_device_name)(struct wx_audio_module* module,
                              size_t index,
                              wx_audio_device_type_t device_type,
                              char** device_name_out);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>module</td> <td>struct wx_audio_module*</td> <td>context</td></tr> <tr><td>index</td> <td>size_t</td> <td>设备列表中指定的设备。取值范围[0, num_devices_out)</td></tr> <tr><td>device_type</td> <td>wx_audio_device_type_t</td> <td>设备类型，同 <code>get_number_of_devices</code></td></tr> <tr><td>device_name_out</td> <td>char**</td> <td>返回对应设备的 ID</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断得到的设备 ID 是否有效

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr> <tr><td>WXERROR_INVALID_ARGUMENT</td> <td>num_devices_out 为空</td></tr> <tr><td>WXERROR_OUT_OF_RANGE</td> <td>index 超出范围</td></tr></tbody></table>

### 2.3 `get_device_info`

查询指定类型和设备 ID 的设备的详细信息。该函数用于返回一些在不用打开音频设备的情况下就能获取到的音频设备信息，如支持的音频编码格式。

```c
wx_error_t (*get_device_info)(struct wx_audio_module* module,
                              const char* id,
                              wx_audio_device_type_t device_type,
                              const struct wx_metadata** metadata_out);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>module</td> <td>struct wx_audio_module*</td> <td>context</td></tr> <tr><td>id</td> <td>const char*</td> <td><code>get_device_name</code> 查到的设备 ID，或者宏 <code>WX_AUDIO_DEVICE_PRIMARY</code> 表示任意有效的设备。</td></tr> <tr><td>device_type</td> <td>wx_audio_device_type_t</td> <td>同 <code>get_number_of_devices</code> 的 device_type</td></tr> <tr><td>metadata_out</td> <td>const struct wx_metadata**</td> <td>返回对应设备的详情。二级指针指向的对象可以是局部变量。</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断得到的设备详情是否有效

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr></tbody></table>

### 2.4 `open`

调用指定的音频输入/输出设备。

```c
wx_error_t (*open)(struct wx_audio_module* module,
                   const char* id,
                   wx_audio_device_type_t device_type,
                   struct wx_audio_device** device_out);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>module</td> <td>struct wx_audio_module*</td> <td>context</td></tr> <tr><td>id</td> <td>const char*</td> <td>同 <code>get_device_info</code> 的 <code>id</code></td></tr> <tr><td>device_type</td> <td>wx_audio_device_type_t</td> <td>同 <code>get_number_of_devices</code> 的 device_type</td></tr> <tr><td>device_out</td> <td>struct wx_audio_device**</td> <td>返回对应的设备实例。详见后续 <code>wx_audio_device</code> 类型说明</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断得到的设备实例是否有效

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr></tbody></table>

### 2.5 `wx_audio_device`

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_device</td> <td>设备类型的公共基类。</td></tr> <tr><td>metadata</td> <td>wx_metadata</td> <td>对于设备的描述信息。</td></tr></tbody></table>

`struct wx_audio_device` 本身的功能不多，主要是对于设备的描述。真正需要重点关注的是它的两个拓展类型： `wx_audio_device_in` 和 `wx_audio_device_out` 。

#### 2.5.1 `wx_audio_device_in`

对于输入设备（如：麦克风）的抽象。这个类型的关键是需要提供 `open_input_stream` 函数实现，运行时 SDK 将调用此函数，创建音频输入流对象 `wx_audio_stream_in` 。SDK 使用 `wx_audio_stream_in` 对象的实例进一步控制音频采集。

麦克风设备在 VoIP 通话拨通时被创建，VoIP 通话结束时销毁。

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>device</td> <td>wx_audio_device</td> <td>基类。</td></tr> <tr><td>open_input_stream</td> <td>函数指针</td> <td>SDK 使用这个函数指针打开/使用麦克风设备。</td></tr></tbody></table>

##### `open_input_stream` 的参数

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>dev</td> <td>wx_audio_device_in *</td> <td>context</td></tr> <tr><td>config</td> <td>wx_audio_config *</td> <td>SDK 希望的麦克风配置。</td></tr> <tr><td>listener</td> <td>wx_audio_stream_in_listener *</td> <td>SDK 监听麦克风事件的回调函数。开发者需要在合适的时机正确地调用这些函数。</td></tr> <tr><td>user_data</td> <td>void *</td> <td>SDK 所依赖的其他 context 信息。调用麦克风事件回调函数时需要带上这个指针。</td></tr> <tr><td>stream_out</td> <td>wx_audio_stream_in **</td> <td>返回新创建的音频输入流对象。定义如下。</td></tr></tbody></table>

##### `wx_audio_stream_in`

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_audio_stream *</td> <td>context</td></tr> <tr><td>pause</td> <td>函数指针</td> <td>SDK 调用此函数以暂停音频数据输入。</td></tr> <tr><td>resume</td> <td>函数指针</td> <td>SDK 调用此函数以恢复音频数据输入。</td></tr></tbody></table>

##### `wx_audio_stream_in_listener`

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_struct</td> <td>基类</td></tr> <tr><td>data</td> <td>函数指针</td> <td>系统调用此函数向 SDK 提供麦克风采集到的音频数据。</td></tr> <tr><td>error</td> <td>函数指针</td> <td>系统通过调用此函数告知 SDK 麦克风采集音频数据出错。</td></tr></tbody></table>

注意事项：

1. SDK 目前仅采集 PCM 格式的音频数据，远期可能增加其他音频格式。
2. config 目前以采样率 16000、采样长度 20ms、16bit 为默认配置，可能会动态调整。如果设备不支持这些音频配置，设备厂商应当自行对 PCM 数据进行变换。
3. data 回调可以理解为非阻塞的，即与网络无关。
4. data 回调提供的一帧音频数据，需要根据 `config` 设置的参数提供。举例来说：PCM 采样率 16000、采样格式 16Bit、采样长度 20ms 的单通道音频数据，包含 `16000 / 1000 * 20 * 1 * (16 / 8)` 字节的数据（ `采样率 / 1000 * 采样长度 * 通道数 * 采样格式 / 8Bit` ）。

#### 2.5.2 wx\_audio\_device\_out 类型

对于扬声器设备的抽象。这个类型的关键是提供 `open_output_stream` 函数实现，运行时 SDK 将调用此函数，创建音频输出流对象 `wx_audio_stream_out` 。SDK 使用 `wx_audio_stream_out` 对象的实例进一步控制音频播放。

扬声器设备在 VoIP 通话开始拨打时被创建，先播放铃声，在 VoIP 通话开始时开始播放语音，VoIP 通话结束时销毁。

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>device</td> <td>wx_audio_device</td> <td>基类。</td></tr> <tr><td>open_output_stream</td> <td>函数指针</td> <td>SDK 使用这个函数指针打开/使用扬声器设备。</td></tr></tbody></table>

##### `open_output_stream` 的参数：

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>dev</td> <td>wx_audio_device_out *</td> <td>context</td></tr> <tr><td>config</td> <td>wx_audio_config *</td> <td>SDK 希望的扬声器配置。</td></tr> <tr><td>listener</td> <td>wx_audio_stream_out_listener *</td> <td>SDK 监听扬声器事件的回调函数。应在合适的时机正确地调用这些函数。</td></tr> <tr><td>user_data</td> <td>void *</td> <td>SDK 所依赖的其他 context 信息。调用扬声器事件回调函数时需要带上这个指针。</td></tr> <tr><td>stream_out</td> <td>wx_audio_stream_out **</td> <td>返回新创建的音频输出流对象。定义如下。</td></tr></tbody></table>

###### `wx_audio_stream_out` 类型

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_audio_stream *</td> <td>context</td></tr> <tr><td>pause</td> <td>函数指针</td> <td>SDK 调用此函数以暂停音频数据播放。</td></tr> <tr><td>resume</td> <td>函数指针</td> <td>SDK 调用此函数以恢复音频数据播放。</td></tr> <tr><td>flush</td> <td>函数指针</td> <td>SDK 调用此函数要求音频播放缓存，立刻播放缓存内的音频数据。</td></tr></tbody></table>

###### `wx_audio_stream_out_listener` 类型

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_struct</td> <td>基类</td></tr> <tr><td>data</td> <td>函数指针</td> <td>系统通过调用此函数向 SDK 拉取待播放（铃声或收到的语音流）的音频数据。</td></tr> <tr><td>error</td> <td>函数指针</td> <td>系统通过调用此函数通知 SDK 音频播放出错。</td></tr></tbody></table>

注意事项：

1. SDK 目前仅提供 PCM 格式的音频数据，远期可能增加其他音频格式。
2. config 目前以采样率 16000、采样长度 20ms、16bit 为默认配置，可能会动态调整。如果设备不支持这些音频配置，设备厂商应当自行对 PCM 数据进行变换。
3. data 回调可以理解为非阻塞的，即与网络无关。
4. data 回调传入的 buffer 需要足够大，能存下 config 设置的一帧音频数据。举例来说：PCM 采样率 16000、采样格式 16Bit、采样长度 20ms 的单通道音频数据，包含 16000 / 1000 \_ 20 \_ 1 \_ (16 / 8) 字节的数据（采样率 / 1000 \_ 采样长度 \_ 通道数 \_ 采样格式 / 8Bit）。

## 3. 签名算法模块

> 头文件： `wmpf/crypto.h` 。

SDK 依赖系统内置的签名算法，我们提供了 OpenSSL、MbedTLS、WolfSSL 的 Demo 实现，存放在 example 目录中。如果使用上述 crypto 实现，通常可以直接使用 example 的代码实现，否则请参考 example 实现进行适配。

Demo 实现：

- `example/crypto_mbedtls.c`
- `example/crypto_openssl.c`
- `example/crypto_wolfssl.c`

## 4. (可选)摄像头模块

> 头文件： `wmpf/hardware/camera.h` 。

摄像头模块，需要配置一个 `wx_camera_module` 类型的实例。该类型主要是需要你提供如下几个函数指针，用来利用设备提供的摄像头设备对象生成设备发送到手机的视频流

运行时，SDK 将顺序调用这 3 个函数，完成对摄像头设备的配置。

### 4.1 `get_number_of_devices`

获取摄像头设备的数量。

```c
wx_error_t (*get_number_of_devices)(struct wx_camera_module* module,
                                    size_t* num_devices_out);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>module</td> <td>struct wx_camera_module*</td> <td>context</td></tr> <tr><td>num_devices_out</td> <td>size_t*</td> <td>返回对应类型的摄像头设备的数量</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断得到的设备数量是否有效

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr> <tr><td>WXERROR_INVALID_ARGUMENT</td> <td>num_devices_out 为空</td></tr></tbody></table>

### 4.2 `get_device_info`

查询指定摄像头设备的详细信息。

```c
wx_error_t (*get_device_info)(struct wx_camera_module* module,
                              size_t index,
                              struct wx_camera_device_info* device_info);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>module</td> <td>struct wx_camera_module*</td> <td>context</td></tr> <tr><td>index</td> <td>size_t</td> <td>设备列表中指定的设备。取值范围[0, num_devices_out)</td></tr> <tr><td>device_info</td> <td>struct wx_camera_device_info*</td> <td>SDK 会传入此 device_info，需要填充此结构体的内容。</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断得到的设备详情是否有效

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>请求到的设备详情有效。</td></tr></tbody></table>

### 4.3 `open`

调用指定的摄像头设备。

```c
wx_error_t (*open)(struct wx_camera_module* module,
                   const char* id,
                   struct wx_camera_device** device_out);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>module</td> <td>struct wx_camera_module*</td> <td>context</td></tr> <tr><td>id</td> <td>char *</td> <td><code>get_device_info</code> 查到的设备 ID，或者宏 <code>WX_CAMERA_DEVICE_PRIMARY</code> 表示任意有效的设备。</td></tr> <tr><td>device_out</td> <td>struct wx_camera_device **</td> <td>返回对应的设备实例。</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断得到的设备实例是否有效

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr></tbody></table>

### 4.4 `wx_camera_device`

对于摄像头设备的抽象。这个类型的关键是需要提供 `open_stream` 函数实现，运行时 SDK 将调用此函数，创建视频输入流对象 `wx_camera_stream` 。SDK 使用 `wx_camera_stream` 对象的实例进一步控制视频采集。

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_device</td> <td>设备类型的公共基类。</td></tr> <tr><td>metadata</td> <td>wx_metadata</td> <td>对于设备的描述信息。</td></tr> <tr><td>open_stream</td> <td>函数指针</td> <td>SDK 使用这个函数指针打开/使用摄像头设备。</td></tr></tbody></table>

`open_stream` 的参数：

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>dev</td> <td>wx_camera_device *</td> <td>context</td></tr> <tr><td>config</td> <td>wx_camera_stream_config *</td> <td>SDK 需要的摄像头配置，包括数据流类型。</td></tr> <tr><td>listener</td> <td>wx_camera_stream_listener *</td> <td>SDK 监听摄像头事件的回调函数。应在合适的时机正确地调用这些函数。</td></tr> <tr><td>user_data</td> <td>void *</td> <td>SDK 所依赖的其他 context 信息。调用摄像头事件回调函数时需要带上这个指针。</td></tr> <tr><td>stream_out</td> <td>wx_camera_stream **</td> <td>返回新创建的视频输入流对象。定义如下。</td></tr></tbody></table>

#### wx\_camera\_stream 类型

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_struct</td> <td>基类</td></tr> <tr><td>update</td> <td>函数指针</td> <td>SDK 调用此函数以更新摄像头录制参数。</td></tr> <tr><td>make_i_frame</td> <td>函数指针</td> <td>SDK 调用此函数以请求立刻收到一个 H264/H265 I 帧。</td></tr></tbody></table>

#### wx\_camera\_stream\_listener 类型

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_struct</td> <td>基类</td></tr> <tr><td>data</td> <td>函数指针</td> <td>系统调用此函数向 SDK 提供摄像头采集到的视频数据。</td></tr> <tr><td>error</td> <td>函数指针</td> <td>系统通过调用此函数告知 SDK 摄像头采集视频数据出错。</td></tr></tbody></table>

注意事项：

1. SDK 目前仅采集 H264/H265 格式的视频数据。
2. data 回调可以理解为非阻塞的，即与网络无关。
3. 设备需要定时（建议 1 秒，最长不得超过 5 秒）提供 PPS、SPS、I 帧。
4. 设备传入的 rotation 仅在 Linux SDK 0xD5000084 及以上版本、微信客户端 8.0.41 及以上版本生效，对于更旧的微信版本，需要在小程序侧调用 VoIP 插件的 `setUIConfig` 设置旋转角度。

## 5. (可选)视频模块

> 头文件： `wmpf/hardware/video.h` 。

摄像头模块，需要配置一个 `wx_video_module` 类型的实例。

运行时，SDK 将调用 `create_output_stream` 函数创建视频输出流，将接收到的远端（手机）摄像头录制的视频通过流对象输出。

### 5.1 `create_output_stream`

创建一个视频输出流。

```c
wx_error_t (*create_output_stream)(struct wx_video_module* module,
                                   const struct wx_video_stream_config* config,
                                   struct wx_video_stream** stream);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>module</td> <td>struct wx_video_module*</td> <td>context</td></tr> <tr><td>config</td> <td>const struct wx_video_stream_config*</td> <td>视频输出流参数</td></tr> <tr><td>stream</td> <td>struct wx_video_stream**</td> <td>返回视频输出流对象</td></tr></tbody></table>

**返回值**

`wx_error_t` SDK 根据此返回值，判断视频输出流是否有效

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>成功</td></tr></tbody></table>

### 5.2 `wx_video_stream`

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>common</td> <td>wx_struct</td> <td>基类</td></tr> <tr><td>write</td> <td>函数指针</td> <td>SDK 调用此函数以写入视频输出流。</td></tr> <tr><td>close</td> <td>函数指针</td> <td>SDK 调用此函数以关闭视频输出流。</td></tr></tbody></table>
