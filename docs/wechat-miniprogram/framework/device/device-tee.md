<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-tee.html -->

# 设备认证 TEE 规范

## 1. 背景

设备身份是微信 VOIP 业务能够正常运行的基础，开发者在接入 VOIP 业务时，会通过如下两个流程来进行身份的确定：

1. 设备注册。通过 SN + modelId 两个维度来标定这台设备。
2. 拿票据。在进行 VOIP 通话前，需要拿到这台设备所对应的票据。

对于没有 TEE 的机器，我们要求设备系统里能够操作 EMMC 存储的 RPMB 区域，并且需要将 RPMB 的归属权给到 VOIP 业务，VOIP 在设备注册时会将与设备对应的唯一密钥写入存储的 KEY 区域，用来做身份校验。

而对于有 TEE 的机器，我们信赖 TEE 的结果，但需要 TEE 里按照规范完成 TA 的开发。

## 2. TA 开发

不管是 optee，还是 trusty 或 qsee 等，TEE 的使用流程通常如下：

**打开 TEE 环境 > 开启一个会话 > 发送命令 > 获取信息 > 结束会话 > 关闭 TEE 环境**

这里我们需要定义如下标准：

1. 会话名称。
2. 命令的功能。
3. 命令的交互数据定义。
4. TA 里的运算逻辑

设备开发者需要根据规范进行如下开发：

1. TA 开发，需要开发者或 tee 提供商按照规范开发 TA。
2. HAL 开发，HAL 用于与 TA 的交互，微信的系统服务基于此 HAL。
3. 服务集成，将微信发布的 rpmbd\_tee 以系统服务方式运行起来。

TA 在 **逻辑** 上将存储分为两个区域。需要注意的是，这些数据最终应都存在于 EMMC 或 UFS 的 rpmb 分区，或其它 REE 访问不到的安全器件区域。

1. 密钥区：32个字节。TA 代码逻辑里需要将此区域实现成只能写一次，类似于硬件上的 OTP (One Time Programmable) 区域。
2. 数据区：单位为 Block，每个 Block 有 **256** 个字节，最小需要 **32** 个，开发者可根据实际情况来确定大小，若越界则返回相应错误码即可。Block 的地址从 **0** 开始。

### 2.1 会话名称

TA 的名称统一为 ta\_devauth

### 2.2 命令定义

定义三个命令，分别是读数据、写数据、写密钥。

```c
#define TA_DEVAUTH_CMD_READ   0x10
#define TA_DEVAUTH_CMD_WRITE  0x11
#define TA_DEVAUTH_CMD_PROKEY 0x12
```

详细说明：

<table><thead><tr><th></th> <th></th></tr></thead> <tbody><tr><td>命令</td> <td>TA_DEVAUTH_CMD_READ 0x10</td></tr> <tr><td>功能</td> <td>读 1 个 Block 的数据</td></tr> <tr><td>参数</td> <td>输入：Block 地址<br>输入/输出：Block 数据 BUFFER，284字节，见 2.3 数据定义。<br>输出：签名 BUFFER，=32字节</td></tr> <tr><td>返回</td> <td>0：成功读取，并返回 284 字节数据和 32 字节签名<br>-1：参数错误。<br>-2：地址越界。<br>-3：密钥区还没被写。<br>-5：其它错误。</td></tr> <tr><td>特别说明</td> <td>若密钥区还没被写（例如裸数据全是0x00，或没有TEE文件系统里的文件？），这种情况认为是一台全新的未激活设备，需要读取错误返回 -3。</td></tr></tbody></table>

<table><thead><tr><th></th> <th></th></tr></thead> <tbody><tr><td>命令</td> <td>TA_DEVAUTH_CMD_WRITE    0x11</td></tr> <tr><td>功能</td> <td>写 1 个 Block 的数据</td></tr> <tr><td>参数</td> <td>输入：Block 地址<br>输入：Block 数据 BUFFER，=284字节，见 2.3 数据定义。<br>输入：对应的签名 BUFFER，=32字节</td></tr> <tr><td>返回</td> <td>0：写入成功。<br>-1：参数错误。<br>-2：地址越界。<br>-3：密钥区还没被写。<br>-4：签名错误。<br>-5：其它错误。</td></tr> <tr><td>特别说明</td> <td>若密钥区还没被写（例如裸数据全是0x00，或没有TEE文件系统里的文件？），这种情况认为是一台全新的未激活设备，需要返回 -3。<br>此功能在写数据前，需要计算数据对应的签名，并且与参数传入的签名比对，若比对不成功返回 -4</td></tr></tbody></table>

<table><thead><tr><th></th> <th></th></tr></thead> <tbody><tr><td>命令</td> <td>TA_DEVAUTH_CMD_PROKEY    0x12</td></tr> <tr><td>功能</td> <td>写密钥</td></tr> <tr><td>参数</td> <td>密钥 BUFFER，=32字节</td></tr> <tr><td>返回</td> <td>0：写入成功。<br>-1：参数错误。<br>-3：密钥区已有数据。<br>-5：其它错误。</td></tr> <tr><td>特别说明</td> <td>若密钥区已有数据（例如裸数据不为0x00，或有文件？），则需要返回 -3。</td></tr></tbody></table>

### 2.3 数据定义

与 TA 交互时传入传出 Buffer 的大小为 **284 字节** ，它的定义如下：

```c
struct ta_data {
    uint8_t  data[256];    // 此 256 字节是 TA 写入到1个Block的内容
    uint8_t  nonce[16];    // 一般为随机字节，传入与传出的一定要一致。
    uint32_t reserve1;
    uint16_t reserve2;
    uint16_t reserve3;
    uint16_t reserve4;
    uint16_t reserve5;
};

// sizeof(struct ta_data) = 284
```

签名 Buffer 大小为 **32 字节** 。

CA 与 TA 交互消息定义：

```c
struct ta_message {
    uint32_t        cmd;        // 命令号
    uint32_t        block;      // 读写地址
    struct ta_data  data;       // 284 字节数据
    uint8_t         key[32];    // 32 字节 Key
    uint8_t         hmac[32];   // 32 字节 hmac
    int             ret;        // 返回值
};
```

CA 侧参考伪代码：

```c
static int tee_send_cmd_req(struct ta_message* ta_msg) {
    int rc = 0;

    if (ca_handle == 0) {
        printf("not connected\n");
        return -EINVAL;
    }

    if (tee_send_msg(ca_handle, ta_msg) < 0) {
        return -1;
    }

    if (tee_resp_msg(ca_handle, ta_msg) < 0) {
        return -1;
    }

    return 0;
}
```

### 2.4 运算逻辑

数据签名的算法为 HMAC\_SHA256。

读数据时，TA 的流程：

1. 若密钥区没数据，返回 -3。
2. 读地址参数对应 Block 的 256 字节数据。
3. 将读到的 256 字节与输入参数里的 16 字节 noce 以及其它 reserve，一共有 284 个字节。
4. 利用密钥区的 32 字节密钥，对 284 字节进行签名，并返回 284 字节以及签名。

写数据时，TA 的流程：

1. 若密钥区没数据，返回 -3。
2. 得到输入参数里的 284 字节，得到输入参数中的签名1。
3. 利用密钥区的 32 字节密钥，对 284 字节进行签名，得到签名2。
4. 比较签名1与签名2，如果相等则将 284 字节中的 256 字节写入对应的 Block，如果不等则返回错误 -4。

写密钥时，TA 的流程：

1. 若密钥区已有数据，返回 -3。
2. 将 32 字节的密钥写入密钥区。

一个签名的数据示例，开发者可以此为基准来验证自己的 hmac\_sha256：

```c
char *key = "AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH";
uint8_t buffer[284] = {0};

int main(int argc, char **argv) {
    uint8_t hmac[32] = {0};
    memset(buffer, 0x55, 284);

    hmac_sha256(key, 32,
      buffer, 284,
      hmac, sizeof(hmac)
    );

    for (int i=0; i < 32; i++) {
        printf("%02x ", hmac[i]);
    }
    return 0;
}
// 以上代码输出：
// 61 16 67 22 a0 93 66 74 bb 75 f8 87 0e 5e d4 59 2c d6 99 c0 14 a6 93 70 bd ff ea 3e 8e 84 52 4e
```

hmac\_sha256 为标准算法，一般 tee 里已有此类算法，如果没有，可参考 [开源实现](https://github.com/ogay/hmac/blob/master/hmac_sha2.c) 。

### 2.5 注意事项

1. **TEE 里的密钥区和数据区需保证具有 “永久存储” 特性，并且不应该被 REE 以任何方式直接访问，不会随用户的刷机、升级或其它常规行为而丢失。**
2. **密钥区域需要实现为 OTP 特性，即仅一次写入。**
3. **密钥区域无数据时，需要按规范返回错误码。**
4. **厂商需要将 CA 测试例程和代码给到微信，微信进行验收测试。**

## 3. HAL 开发

按照 HAL 规范完成 HAL 的开发，HAL 里使用 CA 代码与 TA 进行交互，完成 TEE 的使用。

HAL 路径： `android/hardware/interface/devauth`

### 3.1 HAL 规范

types.hal

```c
package android.hardware.devauth@1.0;

enum TA_CMD : uint32_t {
    TA_DEVAUTH_CMD_READ = 0x10,
    TA_DEVAUTH_CMD_WRITE = 0x11,
    TA_DEVAUTH_CMD_PROKEY = 0x12,
};

struct ta_data {
    uint8_t[256] data; // 此 256 字节是 TA 写入到1个Block的内容
    uint8_t[16]  nonce; // 一般为随机字节，传入与传出的一定要一致。
    uint32_t reserve1;
    uint16_t reserve2;
    uint16_t reserve3;
    uint16_t reserve4;
    uint16_t reserve5;
};

struct ta_message {
    uint32_t        cmd;        // 命令号
    uint32_t        block;      // 读写地址
    ta_data         data;       // 284 字节数据
    uint8_t[32]     key;        // 32 字节 Key
    HMacBuffer      hmac;       // 32 字节 hmac
    int8_t          ret;        // 返回值
};

typedef uint8_t[32] HMacBuffer;
typedef uint8_t[32] ProKeyBuffer;

typedef ta_data ta_data_t;
typedef ta_message ta_message_t;
```

IDevauth.hal

```java
package android.hardware.devauth@1.0;

interface IDevauth {

    /**
     * 读 Block 数据
     *
     * @param addr:     Block 地址
     * @param data:     输入的 struct ta_data
     * @return retval:  返回值，返回值说明请见规范
     * @return data:    返回的 struct ta_data，284 字节。
     * @return hmac:    返回的签名, 32 字节。
     *
     */
    read_block(uint16_t addr, ta_data data) generates (int8_t retval, vec<uint8_t> data, vec<uint8_t> hmac);

    /**
     * 写 Block 数据
     *
     * @param addr:     Block 地址
     * @param data:     输入输出数据，对应规范里的 struct ta_data，284 字节。
     * @param hmac:     HAL 写数据时用的签名, 32 字节
     *
     * @return retval:  返回值说明请见规范
     */
    write_block(uint16_t addr, ta_data data, HMacBuffer hmac) generates (int8_t retval);

    /**
     * 写 Key
     *
     * @param key:      32 字节key
     *
     * @return retval:  返回值说明请见规范
     */
    program_key(ProKeyBuffer key) generates(int8_t retval);
};
```

### 3.2 开发参考

`hardware/interfaces/devauth/1.0/` 下放置 `IDevauth.hal` 、 `types.hal` ，内容如上。

然后使用如下方式来生成代码：

```bash
LOC=hardware/interfaces/devauth/1.0/default
PACKAGE=android.hardware.devauth@1.0
hidl-gen -o $LOC -Lc++-impl -randroid.hardware:hardware/interfaces -randroid.hidl:system/libhidl/transport ${PACKAGE}
hidl-gen -o $LOC -Landroidbp-impl -randroid.hardware:hardware/interfaces -randroid.hidl:system/libhidl/transport ${PACKAGE}
./hardware/interfaces/update-makefiles.sh
```

此时 hal 目录应该如下：

```
root~/android> tree hardware/interfaces/devauth/
hardware/interfaces/devauth/
└── 1.0
    ├── Android.bp
    ├── default
    │   ├── Android.bp
    │   ├── Devauth.cpp
    │   └── Devauth.h
    ├── IDevauth.hal
    └── types.hal

2 directories, 6 files
```

再按照 HAL 接口定义，在相应的接口函数里完成 CA 代码的开发即可。

## 4. 验收

### 4.1 提交资料

- ✓ 芯片平台，存储类型。例：MTK81xx、EMMC 64GB
- ✓ REE 操作系统详细信息。例：Android 7 64位
- ✓ TEE 系统详细信息。例：基于 optee 的自研 tee，提供商为 xxx
- ✓ TEE 里数据存储位置。例：EMMC 里的 RPMB 分区
- ✓ TEE 侧的 TA 代码。例：ta\_devauth 模块代码
- ✓ REE 侧的 CA 代码。例：测试用例代码包及相应 TEE 功能 so。
- ✓ REE 侧的 HAL 代码。例：hardware/interface/devauth 下的代码。
- ✓ 能 adb root 的样机。

### 4.2 测试用例

开发者完成 TEE 的 TA 开发后，应该进行测试用例开发，以验证 TA 的功能与逻辑。 前置条件： **ta\_deauth 所管理的区域无任何数据** ，再按顺序进行以下测试项。

1. 读数据测试，预期返回 -3
2. 写数据测试，预期返回 -3
3. 写密钥测试，预期返回 0
4. 写密钥测试，预期返回 -3
5. 读数据测试，预期返回 0，且数据全是 0x00 且有签名。
6. 用正确的 HMAC 写数据测试，预期返回 0
7. 用错误的 HMAC 写数据测试，预期返回 -4
8. 读数据测试，预期返回 0，并且返回正确的数据和签名。

可在 [官方测试用例代码](https://git.weixin.qq.com/wxa_iot/devauth_tee_testcase/tree/master/ca_testcase) 的基础上，加上自己的 CA 实现，以快速验证 TA。

开发者完成 HAL 开发后，可用 [测试用例](https://git.weixin.qq.com/wxa_iot/devauth_tee_testcase/tree/master/hal_testcase) 进行测试，

也可以直接下载已编译好的 tee\_hal\_test 进行测试，测试方法如下

1. `tee_hal_test a` 进行一次全新的测试，需要一个 ta\_devauth 所管理的区域无任何数据。
2. `tee_hal_test` 不带任何参数，可在 1. 后运行。

### 4.3 集成

4.2 中的测试用例通过后，下载 rpmbd\_tee 并集成到系统中以服务方式运行起来即可，参考：

```sh
service rpmbd_tee /system/bin/rpmbd_tee
  class main
  user root
  group root system
```
