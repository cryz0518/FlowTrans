# FlowTrans - AI 实时同声传译助手

FlowTrans 是一个面向会议、网课、直播和跨语言沟通场景的 AI 实时同声传译项目。当前版本支持麦克风/系统音频采集、英文实时识别、中文实时翻译、中文语音播报、Electron 桌面端、桌面悬浮翻译窗口、AI 会议纪要生成和本地历史记录。

## Demo视频地址
https://www.bilibili.com/video/BV1UfEt63EtE?t=17.6

## 功能概览

- 实时音频采集：支持麦克风和系统音频输入。
- 实时中英字幕：左栏显示英文原文，右栏显示中文翻译。
- 翻译自动修正：partial 字幕实时显示，final 字幕根据完整语句修正。
- 中文语音播报：可开启中文 TTS 播报，按队列播放 final 中文字幕。
- 桌面悬浮翻译：Electron 桌面端支持置顶悬浮字幕窗口。
- 悬浮窗自定义：支持只中文/中英对照、字体大小、字体颜色、透明度和窗口大小调节。
- AI 会议纪要：停止翻译后可基于 final 字幕生成 Markdown 会议纪要。
- 本地历史记录：会议纪要和对应中英翻译对照会保存到浏览器 localStorage。

## 环境配置

默认真实链路使用 DashScope/Qwen：

```powershell
$env:PROVIDER_MODE="dashscope"
$env:DASHSCOPE_API_KEY="<your-api-key>"
$env:DASHSCOPE_ASR_MODEL="qwen3-asr-flash-realtime"
$env:DASHSCOPE_TEXT_MODEL="qwen-plus"
$env:DASHSCOPE_TTS_MODEL="cosyvoice-v3-flash"
$env:DASHSCOPE_TTS_VOICE="longanyang"
```

如需离线演示，可切换到 fake provider：

```powershell
$env:PROVIDER_MODE="fake"
```

不要把 `DASHSCOPE_API_KEY` 写入代码或提交到仓库。

## 本地启动

### 1. 启动后端

```powershell
cd backend
conda run -n flowtrans python -m pip install -e ".[dev]"
conda run -n flowtrans python -m uvicorn app.main:app --reload
```

后端默认地址：

```text
http://127.0.0.1:8000
```

### 2. 启动 Web 前端

```powershell
cd frontend
npm install
npm run dev
```

打开：

```text
http://localhost:5173
```

## 桌面端启动

桌面端基于 Electron。请先启动后端，否则实时翻译、TTS 和会议纪要 API 无法工作。

### 开发模式

开发模式会连接 Vite dev server，并自动打开开发者工具：

```powershell
cd frontend
npm run dev
```

另开一个终端：

```powershell
cd frontend
npm run desktop:dev
```

### 生产模式

生产模式会先构建前端静态资源，再启动 Electron：

```powershell
cd frontend
npm run build
npm run desktop
```

### 打包桌面应用

生成 Windows 安装版和便携版：

```powershell
cd frontend
npm run dist
```

打包产物位于：

```text
frontend/release/
```

主要产物：

```text
FlowTrans Setup 0.1.0.exe  # 安装版
FlowTrans 0.1.0.exe        # 便携版，双击运行
```

当前打包只包含前端 Electron 桌面应用，后端仍需单独启动。

## 后端接口

后端使用 FastAPI，主要接口包括：

- `GET /health`：健康检查。
- `GET /config`：公开配置。
- `WS /ws/realtime`：实时音频输入和字幕输出。
- `POST /api/tts/synthesize`：中文语音合成。
- `POST /api/meeting-minutes/generate`：AI 会议纪要生成。

## 前端测试与构建

```powershell
cd frontend
npm run test
npm run build
```

## 后端测试

```powershell
cd backend
conda run -n flowtrans python -m pytest tests -v
```

## 典型使用流程

1. 启动后端。
2. 启动 Web 前端或 Electron 桌面端。
3. 选择麦克风或系统音频。
4. 点击开始，查看中英双栏字幕。
5. 可选开启中文语音播报。
6. 桌面端可开启悬浮翻译窗口。
7. 点击停止后，选择是否生成会议纪要。
8. 在会议纪要页面查看结果、保存到本地，或查看历史记录。


## 后续计划

1. 实现导出翻译结果功能
2. 增加音频导入翻译功能
3. 实现多语种互翻
