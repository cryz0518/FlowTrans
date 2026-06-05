# FlowTrans AI 同声传译助手设计文档

## 1. 背景与目标

FlowTrans 是一款面向英语及其他外语演讲、技术分享、国际会议和网课观看场景的 AI 同声传译助手。第一版聚焦桌面/网页助手：用户打开网页后选择麦克风或系统音频输入，系统实时将单向音频流识别、翻译并呈现为中文字幕，帮助用户跟上内容节奏。

MVP 的核心目标：

- 实时、流畅地将外语音频翻译为中文。
- 优先以字幕形式呈现，中文语音合成作为可选增强。
- 支持自动修正之前识别或翻译错误，通过字幕回改提升准确度。
- 产品第一屏就是可用的同传工作台，不做营销页。
- 架构清晰，便于按小 PR 逐步实现，并保证主分支始终可运行。

## 2. MVP 范围

第一版选择 Web 实时字幕助手方案：

- 前端使用浏览器采集麦克风或系统音频。
- 后端使用 Python FastAPI 管理实时音频、ASR、翻译、纠错、字幕事件和 TTS。
- AI 能力优先使用 DashScope/Qwen 云端 API。
- 前后端通过 WebSocket 传输实时音频与字幕事件。
- REST API 只处理健康检查、配置读取、历史导出等非实时功能。

暂不在 MVP 中实现完整桌面端打包、会议软件深度集成、说话人分离、长期数据库持久化和复杂学习复盘视图。这些能力通过接口和模块边界预留。

## 3. 技术选型

后端：

- Python 3.11+
- FastAPI
- Uvicorn
- Pydantic v2
- httpx
- websockets
- pytest

前端：

- React
- Vite
- TypeScript
- Tailwind CSS
- lucide-react
- Vitest

AI 能力：

- ASR：DashScope 实时语音识别能力。
- 翻译：Qwen 文本模型，例如 qwen-plus 或同系列低延迟模型。
- 纠错：Qwen 文本模型，结合最近上下文、术语表和字幕历史生成修订。
- TTS：DashScope CosyVoice/TTS 类能力，作为可选输出。

配置：

- 使用 `.env` 管理 `DASHSCOPE_API_KEY`、模型名称、延迟模式默认值和服务端口。
- Provider 层统一封装云端模型调用，业务模块不直接依赖具体 API 名称。

## 4. 系统架构

系统分为前端工作台和后端实时处理网关。

前端职责：

- 音频输入源选择。
- 麦克风采集。
- 系统音频采集，优先使用浏览器屏幕共享音频能力。
- 音频分片上传。
- 字幕、修订、连接状态和模型状态展示。
- TTS 开关、延迟模式、术语表入口等控制。

后端职责：

- 接收音频分片并维护会话。
- 对接 ASR、翻译、纠错和 TTS provider。
- 管理字幕事件流。
- 保存当前会话状态、字幕历史、术语表和导出数据。
- 提供 mock/fake provider，保证没有 API Key 时也能跑通主流程演示。

核心后端模块：

- `audio_ingest`：接收浏览器音频分片，做格式校验、缓冲和会话归属。
- `asr_service`：把音频流转成带时间戳的源语言文本。
- `translation_service`：把源语言片段翻译成中文，区分临时稿和稳定稿。
- `revision_engine`：基于上下文回看前 1-3 句，生成修订字幕。
- `subtitle_stream`：向前端推送 `partial`、`final`、`revision` 等事件。
- `tts_service`：只对稳定字幕进行中文语音合成。
- `session_store`：保存当前会话字幕、修订记录、术语表和导出数据。
- `dashscope_provider`：封装 DashScope/Qwen API 调用。

## 5. 项目结构

```text
FlowTrans/
  backend/
    app/
      main.py
      core/config.py
      api/health.py
      ws/realtime.py
      models/events.py
      services/audio_ingest.py
      services/asr_service.py
      services/translation_service.py
      services/revision_engine.py
      services/tts_service.py
      services/session_store.py
      providers/dashscope_provider.py
      providers/fake_provider.py
    tests/
  frontend/
    src/
      app/
      components/
      hooks/
      services/
      types/
    tests/
  docs/
    superpowers/specs/
  README.md
```

## 6. 交互设计

第一屏为同传工作台。用户无需进入介绍页即可开始使用。

主要区域：

- 输入源控制：麦克风、系统音频、输入状态。
- 字幕区：稳定字幕为主，临时字幕轻量显示。
- 状态区：监听中、无声音、网络延迟、模型处理中、连接异常等。
- 控制区：开始、暂停、停止、目标语言、TTS 开关、延迟/准确度模式。
- 术语表入口：允许用户添加技术词和专有名词规则。

字幕体验：

- 临时字幕用较轻样式，帮助用户快速跟上语义。
- 稳定字幕更醒目，作为主要阅读内容。
- 修订发生时，前端用短暂高亮提示被回改的字幕，然后自然融入正文。
- 默认模式为中文紧凑字幕；双语字幕和学习模式作为可扩展布局预留。

系统音频降级：

- 优先使用浏览器屏幕共享并勾选系统音频。
- 如浏览器或系统不支持，提示用户使用虚拟声卡或系统混音设备作为输入源。

## 7. 实时数据流

1. 前端通过 `MediaRecorder` 或 Web Audio API 将音频切成 250-500ms 分片。
2. 每个音频分片附带 `session_id`、`chunk_index`、采集时间戳和输入源类型。
3. 前端通过 WebSocket 将分片发送给后端。
4. 后端 `audio_ingest` 校验分片并写入会话缓冲。
5. `asr_service` 将音频流送入 DashScope 实时 ASR，接收 `partial` 和 `final` 源文。
6. `translation_service` 对 `partial` 源文生成临时中文字幕，对 `final` 源文生成稳定中文字幕。
7. `subtitle_stream` 将字幕事件推回前端。
8. `revision_engine` 在新稳定句出现时检查最近 1-3 条字幕是否需要修正。
9. 如需修正，后端推送 `revision` 事件，前端替换对应字幕文本。
10. TTS 开启时，`tts_service` 只处理稳定字幕。

## 8. 纠错机制

纠错采用字幕回改，而不是旁注或复杂版本轨迹。

触发时机：

- 每次出现新的稳定字幕后触发。
- 每次术语表发生变化后，可对最近若干稳定字幕重新评估。

输入上下文：

- 最近 1-3 条稳定源文。
- 最近 1-3 条稳定译文。
- 当前源文与当前译文。
- 用户术语表。
- 当前会话的短上下文摘要。

输出：

- 无需修正时，不生成回改事件。
- 需要修正时，生成 `revision` 事件，包含字幕 ID、旧文本、新文本和简短修正原因。

约束：

- 纠错是旁路增强，不能阻塞 ASR 和主翻译链路。
- 纠错超时或失败时跳过本次修正。
- 前端只展示修订结果，不强制展示详细原因，避免打断观看节奏。

## 9. TTS 策略

TTS 默认关闭，用户可手动开启。

规则：

- 只播放稳定字幕，不播放临时字幕。
- 如果字幕已经播出后又被修正，不追溯重播。
- 如果字幕尚未进入 TTS 队列且发生修正，则使用修正后的文本。
- TTS 失败只影响中文语音输出，不影响字幕链路。

## 10. 异常处理与降级

- ASR 连接失败：停止实时流并提示重新连接。
- 翻译模型超时：保留源文或上一版临时译文，并标记翻译延迟。
- 纠错模型超时：跳过本次纠错。
- TTS 失败：自动关闭本次语音输出，不影响字幕。
- WebSocket 断开：前端尝试自动重连，并提示当前会话可能丢失部分实时字幕。
- 系统音频不可用：提示改用麦克风、虚拟声卡或浏览器屏幕共享音频。

## 11. 测试设计

测试按 PR 粒度推进。

后端：

- 健康检查：验证 `/health` 和配置加载。
- 音频分片接收：模拟 WebSocket 客户端发送 chunk，验证 session 状态。
- ASR/翻译：provider 层使用 mock，不让单元测试依赖真实云 API。
- 字幕事件流：验证事件顺序为 `partial -> final -> revision`，并保证 revision 不阻塞 final。
- TTS：验证仅稳定字幕进入队列，修订时替换未播放内容。

前端：

- 音频采集：mock `MediaDevices` 和 `MediaRecorder`。
- WebSocket 客户端：验证重连、发送分片和接收事件。
- 字幕展示：验证 `partial`、`final`、`revision` 的 UI 状态变化。
- 控制区：验证开始、暂停、停止、TTS 开关、输入源切换。

端到端演示：

- 提供 fake provider，输入模拟源文，输出模拟字幕。
- 没有 API Key 时仍可运行主流程演示。
- 有 API Key 时可切换真实 DashScope/Qwen provider。

## 12. PR 实施规范

后续代码实现必须严格基于 PR 规范推进。

原则：

- 每个 PR 只做一件事。
- 鼓励尽可能小、粒度尽可能细的 PR。
- 大功能拆分为多个独立 PR 分步提交。
- 每个 PR 合并后主分支必须保持可运行。
- 优先从后端能力开始，再逐步接入前端。

PR 描述必须包含：

- 标题：一句话说明本 PR 新增或修改了什么。
- 功能描述：说明该功能的作用与使用方式。
- 实现思路：简要说明技术选型或核心实现逻辑。
- 测试方式：说明如何验证该功能正常运行。

建议 PR 顺序：

1. 初始化后端 FastAPI 项目、健康检查和配置读取。
2. 添加后端 WebSocket 会话和音频分片接收。
3. 添加 fake ASR provider，实现模拟音频转文字链路。
4. 接入 DashScope 实时 ASR provider。
5. 添加翻译服务和 fake/Qwen provider。
6. 添加字幕事件模型和事件流。
7. 初始化前端 React/Vite 工作台。
8. 添加前端音频采集和输入源选择。
9. 接入前端 WebSocket 客户端。
10. 添加字幕展示区，支持 partial/final 状态。
11. 添加 revision_engine 和前端字幕回改效果。
12. 添加 TTS 服务和前端开关。
13. 添加术语表和导出能力。
14. 补充端到端演示与文档。

## 13. 成功标准

MVP 完成后应满足：

- 用户可以打开网页，选择麦克风或系统音频输入。
- 系统可以实时显示中文字幕。
- 字幕能区分临时稿和稳定稿。
- 系统能自动回改最近字幕中的识别或翻译错误。
- TTS 可作为开关增强，不影响字幕主链路。
- 没有 API Key 时可通过 fake provider 跑通演示。
- 有 DashScope API Key 时可接入真实 Qwen 云端能力。
- 每一步实现都通过小 PR 推进，主分支保持可运行。
