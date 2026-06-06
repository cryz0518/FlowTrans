# FlowTrans - AI 实时同声传译助手

FlowTrans 是一个面向实时语音理解与翻译的 AI 同声传译项目。当前 MVP 支持浏览器端麦克风/系统音频采集、后端 WebSocket 字幕流、fake provider 本地演示、字幕回改高亮和中文语音开关 UI。

## 本地演示

MVP 默认使用 fake provider，本地演示不需要配置 `DASHSCOPE_API_KEY`。

### 终端 1：启动后端

```powershell
cd backend
conda run -n flowtrans python -m pip install -e ".[dev]"
conda run -n flowtrans python -m uvicorn app.main:app --reload
```

### 终端 2：启动前端

```powershell
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`，选择“麦克风”或“系统音频”，然后点击“开始”。

## 后端

后端使用 FastAPI，当前提供：

- `/health` 健康检查接口
- `/config` 公开配置接口
- `/ws/realtime` 实时 WebSocket 字幕接口
- fake provider 字幕演示链路
- DashScope/Qwen provider 适配器骨架

### 后端测试

```powershell
cd backend
conda run -n flowtrans python -m pytest tests -v
```

## 前端

前端使用 React、Vite 和 TypeScript。

### 前端测试与构建

```powershell
cd frontend
npm run test
npm run build
```

## 环境配置

本地演示默认使用 fake provider：

```powershell
$env:PROVIDER_MODE="fake"
```

如需准备接入真实 DashScope/Qwen 能力，请配置：

```powershell
$env:PROVIDER_MODE="dashscope"
$env:DASHSCOPE_API_KEY="<your-api-key>"
$env:DASHSCOPE_ASR_MODEL="qwen3-asr-flash-realtime"
$env:DASHSCOPE_TEXT_MODEL="qwen-plus"
$env:DASHSCOPE_TTS_MODEL="CosyVoice-v3.5-flash"
```
