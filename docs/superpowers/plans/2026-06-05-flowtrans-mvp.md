# FlowTrans MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Web MVP for FlowTrans that captures browser audio, streams it to a Python backend, produces simulated or real-time Chinese subtitles, and supports later Qwen/DashScope integration.

**Architecture:** The backend is a FastAPI app with focused service modules for configuration, sessions, audio chunks, subtitle events, fake AI providers, and WebSocket streaming. The frontend is a React/Vite/TypeScript workbench that captures microphone or system audio, sends chunks over WebSocket, and renders partial, final, and revision subtitle events.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest, React, Vite, TypeScript, Tailwind CSS, lucide-react, Vitest.

---

## File Structure

Backend files:

- `backend/pyproject.toml`: Python package metadata, dependencies, pytest settings.
- `backend/app/main.py`: FastAPI application factory and router registration.
- `backend/app/core/config.py`: Environment-driven settings.
- `backend/app/api/health.py`: Health and runtime config endpoints.
- `backend/app/models/events.py`: Shared Pydantic models for chunks, sessions, and subtitle events.
- `backend/app/services/session_store.py`: In-memory session state.
- `backend/app/services/audio_ingest.py`: Audio chunk validation and storage.
- `backend/app/providers/fake_provider.py`: Deterministic ASR, translation, revision, and TTS provider for local demos.
- `backend/app/services/subtitle_pipeline.py`: Converts audio chunks into subtitle events.
- `backend/app/ws/realtime.py`: WebSocket endpoint for audio chunks and subtitle events.
- `backend/tests/`: Focused pytest coverage for each backend feature.

Frontend files:

- `frontend/package.json`: Frontend dependencies and scripts.
- `frontend/vite.config.ts`: Vite and Vitest configuration.
- `frontend/src/main.tsx`: React entrypoint.
- `frontend/src/App.tsx`: Workbench layout composition.
- `frontend/src/types/events.ts`: Client-side event types matching backend models.
- `frontend/src/services/realtimeClient.ts`: WebSocket client wrapper.
- `frontend/src/hooks/useAudioCapture.ts`: Browser audio capture hook.
- `frontend/src/hooks/useRealtimeSession.ts`: Session state and WebSocket orchestration.
- `frontend/src/components/ControlPanel.tsx`: Input and playback controls.
- `frontend/src/components/SubtitlePanel.tsx`: Partial, final, and revision subtitle rendering.
- `frontend/src/components/StatusBar.tsx`: Connection and processing status.
- `frontend/src/styles.css`: Tailwind imports and small app-specific styles.
- `frontend/src/**/*.test.tsx`: Vitest coverage for hooks and UI behavior.

Documentation files:

- `README.md`: Local setup, environment variables, and PR workflow.

---

## PR Requirements For Every Task

Every implementation task below maps to one small PR. Use this PR description format:

```markdown
## Title
<one sentence describing this PR>

## Feature Description
<what the feature does and how to use it>

## Implementation Approach
<core files, key decisions, and data flow>

## Test Method
<commands run and expected result>
```

Each PR must leave the main branch runnable. Prefer fake providers in tests and local demos so the project works without `DASHSCOPE_API_KEY`.

---

### Task 1: Backend FastAPI Skeleton

**Files:**

- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/health.py`
- Create: `backend/tests/test_health.py`
- Modify: `README.md`

- [ ] **Step 1: Write the failing health tests**

Create `backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_service_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "flowtrans-backend",
        "status": "ok",
        "provider_mode": "fake",
    }


def test_config_endpoint_hides_api_key() -> None:
    client = TestClient(create_app())

    response = client.get("/config")

    assert response.status_code == 200
    body = response.json()
    assert body["provider_mode"] == "fake"
    assert body["target_language"] == "zh-CN"
    assert "dashscope_api_key" not in body
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
cd backend
python -m pytest tests/test_health.py -v
```

Expected: failure because `app.main` does not exist.

- [ ] **Step 3: Add backend project metadata**

Create `backend/pyproject.toml`:

```toml
[project]
name = "flowtrans-backend"
version = "0.1.0"
description = "FastAPI backend for FlowTrans real-time interpretation"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.111.0",
  "uvicorn[standard]>=0.30.0",
  "pydantic>=2.7.0",
  "pydantic-settings>=2.3.0",
  "httpx>=0.27.0",
  "websockets>=12.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.2.0",
  "pytest-asyncio>=0.23.0",
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
asyncio_mode = "auto"
```

- [ ] **Step 4: Add configuration module**

Create `backend/app/core/config.py`:

```python
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    service_name: str = "flowtrans-backend"
    provider_mode: Literal["fake", "dashscope"] = "fake"
    target_language: str = "zh-CN"
    dashscope_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

Create empty package markers:

```python
# backend/app/__init__.py
```

```python
# backend/app/core/__init__.py
```

```python
# backend/app/api/__init__.py
```

- [ ] **Step 5: Add health routes and app factory**

Create `backend/app/api/health.py`:

```python
from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {
        "service": settings.service_name,
        "status": "ok",
        "provider_mode": settings.provider_mode,
    }


@router.get("/config")
def public_config() -> dict[str, str]:
    settings = get_settings()
    return {
        "provider_mode": settings.provider_mode,
        "target_language": settings.target_language,
    }
```

Create `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title="FlowTrans API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    return app


app = create_app()
```

- [ ] **Step 6: Update README with backend run command**

Modify `README.md`:

```markdown
# FlowTrans

AI 实时同声传译助手。

## Backend

```powershell
cd backend
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```
```

- [ ] **Step 7: Run tests and server smoke check**

Run:

```powershell
cd backend
python -m pytest tests/test_health.py -v
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Expected: tests pass; server starts and `/health` returns status `ok`.

- [ ] **Step 8: Commit**

```powershell
git add README.md backend
git commit -m "feat: initialize backend health API"
```

---

### Task 2: Backend Session Store And Audio Chunk Intake

**Files:**

- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/events.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/session_store.py`
- Create: `backend/app/services/audio_ingest.py`
- Create: `backend/tests/test_audio_ingest.py`

- [ ] **Step 1: Write failing audio ingest tests**

Create `backend/tests/test_audio_ingest.py`:

```python
import base64

import pytest
from pydantic import ValidationError

from app.models.events import AudioChunkIn
from app.services.audio_ingest import AudioIngestService
from app.services.session_store import SessionStore


def test_audio_chunk_requires_monotonic_chunk_index() -> None:
    store = SessionStore()
    service = AudioIngestService(store)
    first = AudioChunkIn(
        session_id="session-a",
        chunk_index=0,
        captured_at_ms=100,
        input_source="microphone",
        mime_type="audio/webm",
        payload_b64=base64.b64encode(b"abc").decode("ascii"),
    )
    second = first.model_copy(update={"chunk_index": 0, "captured_at_ms": 200})

    accepted = service.accept_chunk(first)

    assert accepted.chunk_index == 0
    with pytest.raises(ValueError, match="chunk_index must increase"):
        service.accept_chunk(second)


def test_audio_chunk_rejects_empty_payload() -> None:
    with pytest.raises(ValidationError):
        AudioChunkIn(
            session_id="session-a",
            chunk_index=0,
            captured_at_ms=100,
            input_source="microphone",
            mime_type="audio/webm",
            payload_b64="",
        )


def test_session_store_tracks_chunk_count() -> None:
    store = SessionStore()
    service = AudioIngestService(store)
    chunk = AudioChunkIn(
        session_id="session-a",
        chunk_index=0,
        captured_at_ms=100,
        input_source="system",
        mime_type="audio/webm",
        payload_b64=base64.b64encode(b"abc").decode("ascii"),
    )

    service.accept_chunk(chunk)
    session = store.get_session("session-a")

    assert session.session_id == "session-a"
    assert session.input_source == "system"
    assert session.chunk_count == 1
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
cd backend
python -m pytest tests/test_audio_ingest.py -v
```

Expected: failure because event and service modules do not exist.

- [ ] **Step 3: Add shared event models**

Create `backend/app/models/__init__.py`:

```python
```

Create `backend/app/models/events.py`:

```python
from typing import Literal

from pydantic import BaseModel, Field, field_validator

InputSource = Literal["microphone", "system"]


class AudioChunkIn(BaseModel):
    session_id: str = Field(min_length=1)
    chunk_index: int = Field(ge=0)
    captured_at_ms: int = Field(ge=0)
    input_source: InputSource
    mime_type: str = Field(min_length=1)
    payload_b64: str = Field(min_length=1)

    @field_validator("payload_b64")
    @classmethod
    def payload_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("payload_b64 must not be blank")
        return value


class AcceptedAudioChunk(BaseModel):
    session_id: str
    chunk_index: int
    byte_length: int
```

- [ ] **Step 4: Add session store**

Create `backend/app/services/__init__.py`:

```python
```

Create `backend/app/services/session_store.py`:

```python
from dataclasses import dataclass, field

from app.models.events import InputSource


@dataclass
class SessionState:
    session_id: str
    input_source: InputSource
    last_chunk_index: int = -1
    chunk_count: int = 0
    audio_bytes: list[bytes] = field(default_factory=list)


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def get_or_create(self, session_id: str, input_source: InputSource) -> SessionState:
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionState(
                session_id=session_id,
                input_source=input_source,
            )
        return self._sessions[session_id]

    def get_session(self, session_id: str) -> SessionState:
        return self._sessions[session_id]

    def append_audio(self, session_id: str, input_source: InputSource, chunk_index: int, payload: bytes) -> SessionState:
        session = self.get_or_create(session_id, input_source)
        if chunk_index <= session.last_chunk_index:
            raise ValueError("chunk_index must increase")
        session.last_chunk_index = chunk_index
        session.chunk_count += 1
        session.audio_bytes.append(payload)
        return session
```

- [ ] **Step 5: Add audio ingest service**

Create `backend/app/services/audio_ingest.py`:

```python
import base64
import binascii

from app.models.events import AcceptedAudioChunk, AudioChunkIn
from app.services.session_store import SessionStore


class AudioIngestService:
    def __init__(self, store: SessionStore) -> None:
        self._store = store

    def accept_chunk(self, chunk: AudioChunkIn) -> AcceptedAudioChunk:
        try:
            payload = base64.b64decode(chunk.payload_b64, validate=True)
        except binascii.Error as exc:
            raise ValueError("payload_b64 must be valid base64") from exc

        if not payload:
            raise ValueError("decoded payload must not be empty")

        self._store.append_audio(
            session_id=chunk.session_id,
            input_source=chunk.input_source,
            chunk_index=chunk.chunk_index,
            payload=payload,
        )
        return AcceptedAudioChunk(
            session_id=chunk.session_id,
            chunk_index=chunk.chunk_index,
            byte_length=len(payload),
        )
```

- [ ] **Step 6: Run tests**

Run:

```powershell
cd backend
python -m pytest tests/test_audio_ingest.py tests/test_health.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add backend/app backend/tests
git commit -m "feat: add backend audio chunk intake"
```

---

### Task 3: Fake AI Provider And Subtitle Pipeline

**Files:**

- Create: `backend/app/providers/__init__.py`
- Create: `backend/app/providers/fake_provider.py`
- Create: `backend/app/services/subtitle_pipeline.py`
- Modify: `backend/app/models/events.py`
- Create: `backend/tests/test_subtitle_pipeline.py`

- [ ] **Step 1: Write failing subtitle pipeline tests**

Create `backend/tests/test_subtitle_pipeline.py`:

```python
import base64

from app.models.events import AudioChunkIn
from app.providers.fake_provider import FakeProvider
from app.services.subtitle_pipeline import SubtitlePipeline


def make_chunk(index: int) -> AudioChunkIn:
    return AudioChunkIn(
        session_id="session-a",
        chunk_index=index,
        captured_at_ms=index * 500,
        input_source="microphone",
        mime_type="audio/webm",
        payload_b64=base64.b64encode(f"chunk-{index}".encode()).decode("ascii"),
    )


def test_pipeline_emits_partial_for_first_chunk() -> None:
    pipeline = SubtitlePipeline(FakeProvider())

    events = pipeline.process_chunk(make_chunk(0))

    assert len(events) == 1
    assert events[0].event_type == "partial"
    assert events[0].source_text == "Welcome to FlowTrans."
    assert events[0].translated_text == "欢迎使用 FlowTrans。"


def test_pipeline_emits_final_and_revision_for_later_chunks() -> None:
    pipeline = SubtitlePipeline(FakeProvider())

    pipeline.process_chunk(make_chunk(0))
    events = pipeline.process_chunk(make_chunk(1))

    assert [event.event_type for event in events] == ["final", "revision"]
    assert events[0].translated_text == "我们正在测试实时字幕。"
    assert events[1].replaces_event_id == "session-a-0"
    assert events[1].translated_text == "欢迎使用 FlowTrans AI 同传助手。"
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
cd backend
python -m pytest tests/test_subtitle_pipeline.py -v
```

Expected: failure because fake provider and pipeline do not exist.

- [ ] **Step 3: Extend event models**

Modify `backend/app/models/events.py` by adding these models below `AcceptedAudioChunk`:

```python
SubtitleEventType = Literal["partial", "final", "revision"]


class SubtitleEvent(BaseModel):
    event_id: str
    session_id: str
    event_type: SubtitleEventType
    source_text: str = ""
    translated_text: str
    replaces_event_id: str | None = None
    reason: str | None = None
```

- [ ] **Step 4: Add fake provider**

Create `backend/app/providers/__init__.py`:

```python
```

Create `backend/app/providers/fake_provider.py`:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class FakeProviderResult:
    source_text: str
    translated_text: str
    is_final: bool


class FakeProvider:
    _script = [
        FakeProviderResult("Welcome to FlowTrans.", "欢迎使用 FlowTrans。", False),
        FakeProviderResult("We are testing real-time captions.", "我们正在测试实时字幕。", True),
        FakeProviderResult("The system can revise earlier mistakes.", "系统可以修正之前的错误。", True),
    ]

    def transcribe_and_translate(self, chunk_index: int) -> FakeProviderResult:
        position = min(chunk_index, len(self._script) - 1)
        return self._script[position]

    def revise_previous(self, chunk_index: int) -> str | None:
        if chunk_index == 1:
            return "欢迎使用 FlowTrans AI 同传助手。"
        return None
```

- [ ] **Step 5: Add subtitle pipeline**

Create `backend/app/services/subtitle_pipeline.py`:

```python
from app.models.events import AudioChunkIn, SubtitleEvent
from app.providers.fake_provider import FakeProvider


class SubtitlePipeline:
    def __init__(self, provider: FakeProvider) -> None:
        self._provider = provider

    def process_chunk(self, chunk: AudioChunkIn) -> list[SubtitleEvent]:
        result = self._provider.transcribe_and_translate(chunk.chunk_index)
        event_type = "final" if result.is_final else "partial"
        events = [
            SubtitleEvent(
                event_id=f"{chunk.session_id}-{chunk.chunk_index}",
                session_id=chunk.session_id,
                event_type=event_type,
                source_text=result.source_text,
                translated_text=result.translated_text,
            )
        ]

        revised_text = self._provider.revise_previous(chunk.chunk_index)
        if revised_text is not None:
            events.append(
                SubtitleEvent(
                    event_id=f"{chunk.session_id}-{chunk.chunk_index}-revision",
                    session_id=chunk.session_id,
                    event_type="revision",
                    translated_text=revised_text,
                    replaces_event_id=f"{chunk.session_id}-0",
                    reason="上下文补全后修正欢迎语。",
                )
            )
        return events
```

- [ ] **Step 6: Run tests**

Run:

```powershell
cd backend
python -m pytest tests/test_subtitle_pipeline.py tests/test_audio_ingest.py tests/test_health.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add backend/app backend/tests
git commit -m "feat: add fake subtitle pipeline"
```

---

### Task 4: Realtime WebSocket Endpoint

**Files:**

- Create: `backend/app/ws/__init__.py`
- Create: `backend/app/ws/realtime.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_realtime_ws.py`

- [ ] **Step 1: Write failing WebSocket test**

Create `backend/tests/test_realtime_ws.py`:

```python
import base64

from fastapi.testclient import TestClient

from app.main import create_app


def test_realtime_websocket_accepts_chunk_and_returns_subtitle_event() -> None:
    client = TestClient(create_app())
    payload = {
        "session_id": "session-a",
        "chunk_index": 0,
        "captured_at_ms": 0,
        "input_source": "microphone",
        "mime_type": "audio/webm",
        "payload_b64": base64.b64encode(b"abc").decode("ascii"),
    }

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(payload)
        response = websocket.receive_json()

    assert response["type"] == "subtitle_events"
    assert response["events"][0]["event_type"] == "partial"
    assert response["events"][0]["translated_text"] == "欢迎使用 FlowTrans。"
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
cd backend
python -m pytest tests/test_realtime_ws.py -v
```

Expected: failure because `/ws/realtime` is not registered.

- [ ] **Step 3: Add WebSocket route**

Create `backend/app/ws/__init__.py`:

```python
```

Create `backend/app/ws/realtime.py`:

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.models.events import AudioChunkIn
from app.providers.fake_provider import FakeProvider
from app.services.audio_ingest import AudioIngestService
from app.services.session_store import SessionStore
from app.services.subtitle_pipeline import SubtitlePipeline

router = APIRouter()


@router.websocket("/ws/realtime")
async def realtime(websocket: WebSocket) -> None:
    await websocket.accept()
    store = SessionStore()
    ingest = AudioIngestService(store)
    pipeline = SubtitlePipeline(FakeProvider())

    try:
        while True:
            raw = await websocket.receive_json()
            try:
                chunk = AudioChunkIn.model_validate(raw)
                ingest.accept_chunk(chunk)
                events = pipeline.process_chunk(chunk)
            except (ValidationError, ValueError) as exc:
                await websocket.send_json({"type": "error", "message": str(exc)})
                continue

            await websocket.send_json(
                {
                    "type": "subtitle_events",
                    "events": [event.model_dump() for event in events],
                }
            )
    except WebSocketDisconnect:
        return
```

- [ ] **Step 4: Register WebSocket router**

Modify `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.ws.realtime import router as realtime_router


def create_app() -> FastAPI:
    app = FastAPI(title="FlowTrans API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(realtime_router)
    return app


app = create_app()
```

- [ ] **Step 5: Run tests**

Run:

```powershell
cd backend
python -m pytest tests -v
```

Expected: all backend tests pass.

- [ ] **Step 6: Commit**

```powershell
git add backend/app backend/tests
git commit -m "feat: add realtime websocket endpoint"
```

---

### Task 5: Frontend Vite Workbench Skeleton

**Files:**

- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/components/ControlPanel.tsx`
- Create: `frontend/src/components/StatusBar.tsx`
- Create: `frontend/src/components/SubtitlePanel.tsx`
- Create: `frontend/src/App.test.tsx`
- Modify: `README.md`

- [ ] **Step 1: Add frontend dependencies**

Create `frontend/package.json`:

```json
{
  "name": "flowtrans-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "build": "tsc && vite build"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^15.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Add TypeScript and Vite config**

Create `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}
```

Create `frontend/vite.config.ts`:

```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
  },
});
```

Create `frontend/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FlowTrans</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Write failing app test**

Create `frontend/src/App.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the interpretation workbench", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "FlowTrans" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始" })).toBeInTheDocument();
    expect(screen.getByText("等待音频输入")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Add app components**

Create `frontend/src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `frontend/src/components/ControlPanel.tsx`:

```typescript
import { Mic, MonitorUp, Play } from "lucide-react";

export function ControlPanel() {
  return (
    <section className="panel controls" aria-label="同传控制">
      <div className="source-row">
        <button type="button" className="source-button active">
          <Mic size={18} />
          麦克风
        </button>
        <button type="button" className="source-button">
          <MonitorUp size={18} />
          系统音频
        </button>
      </div>
      <button type="button" className="primary-button">
        <Play size={18} />
        开始
      </button>
    </section>
  );
}
```

Create `frontend/src/components/StatusBar.tsx`:

```typescript
export function StatusBar() {
  return (
    <section className="status-bar" aria-label="状态">
      <span className="status-dot" />
      等待音频输入
    </section>
  );
}
```

Create `frontend/src/components/SubtitlePanel.tsx`:

```typescript
export function SubtitlePanel() {
  return (
    <section className="panel subtitle-panel" aria-label="字幕">
      <p className="subtitle-empty">中文字幕将在这里实时显示</p>
    </section>
  );
}
```

Create `frontend/src/App.tsx`:

```typescript
import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>FlowTrans</h1>
          <p>AI 实时同声传译助手</p>
        </div>
      </header>
      <StatusBar />
      <div className="workbench">
        <ControlPanel />
        <SubtitlePanel />
      </div>
    </main>
  );
}
```

Create `frontend/src/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #f5f7fb;
  color: #18202f;
  font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
}

button {
  font: inherit;
}

.app-shell {
  width: min(1120px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 32px 0;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.app-header h1 {
  margin: 0;
  font-size: 32px;
}

.app-header p {
  margin: 6px 0 0;
  color: #5d6679;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  margin-bottom: 16px;
  color: #39465d;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #9aa6ba;
}

.workbench {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
}

.panel {
  border: 1px solid #dce2ec;
  border-radius: 8px;
  background: #ffffff;
}

.controls {
  display: grid;
  gap: 16px;
  align-content: start;
  padding: 16px;
}

.source-row {
  display: grid;
  gap: 8px;
}

.source-button,
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  border: 1px solid #cbd4e2;
  border-radius: 8px;
  background: #ffffff;
  color: #18202f;
  cursor: pointer;
}

.source-button.active {
  border-color: #2563eb;
  color: #1d4ed8;
}

.primary-button {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.subtitle-panel {
  min-height: 420px;
  padding: 24px;
}

.subtitle-empty {
  margin: 0;
  color: #6b7280;
}

@media (max-width: 760px) {
  .workbench {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Update README with frontend commands**

Append to `README.md`:

```markdown
## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.
```

- [ ] **Step 6: Run tests and build**

Run:

```powershell
cd frontend
npm install
npm run test
npm run build
```

Expected: tests pass and production build completes.

- [ ] **Step 7: Commit**

```powershell
git add README.md frontend
git commit -m "feat: initialize frontend workbench"
```

---

### Task 6: Frontend Realtime Client And Subtitle State

**Files:**

- Create: `frontend/src/types/events.ts`
- Create: `frontend/src/services/realtimeClient.ts`
- Create: `frontend/src/hooks/useRealtimeSession.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ControlPanel.tsx`
- Modify: `frontend/src/components/StatusBar.tsx`
- Modify: `frontend/src/components/SubtitlePanel.tsx`
- Create: `frontend/src/hooks/useRealtimeSession.test.tsx`

- [ ] **Step 1: Write failing realtime session test**

Create `frontend/src/hooks/useRealtimeSession.test.tsx`:

```typescript
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRealtimeSession } from "./useRealtimeSession";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];

  constructor() {
    MockWebSocket.instances.push(this);
  }

  send(value: string) {
    this.sent.push(value);
  }

  close() {
    this.onclose?.();
  }
}

describe("useRealtimeSession", () => {
  it("stores final subtitles and applies revisions", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const { result } = renderHook(() => useRealtimeSession("ws://test"));

    act(() => result.current.connect());
    const socket = MockWebSocket.instances[0];
    act(() => socket.onopen?.());
    act(() =>
      socket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "subtitle_events",
            events: [
              {
                event_id: "a-0",
                session_id: "a",
                event_type: "final",
                source_text: "Welcome",
                translated_text: "欢迎。",
                replaces_event_id: null,
                reason: null,
              },
              {
                event_id: "a-1",
                session_id: "a",
                event_type: "revision",
                source_text: "",
                translated_text: "欢迎使用 FlowTrans。",
                replaces_event_id: "a-0",
                reason: "上下文修正",
              },
            ],
          }),
        }),
      ),
    );

    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.subtitles[0].translated_text).toBe("欢迎使用 FlowTrans。");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
cd frontend
npm run test -- useRealtimeSession
```

Expected: failure because the hook does not exist.

- [ ] **Step 3: Add event types and client**

Create `frontend/src/types/events.ts`:

```typescript
export type InputSource = "microphone" | "system";
export type SubtitleEventType = "partial" | "final" | "revision";

export type SubtitleEvent = {
  event_id: string;
  session_id: string;
  event_type: SubtitleEventType;
  source_text: string;
  translated_text: string;
  replaces_event_id: string | null;
  reason: string | null;
};

export type AudioChunkOut = {
  session_id: string;
  chunk_index: number;
  captured_at_ms: number;
  input_source: InputSource;
  mime_type: string;
  payload_b64: string;
};

export type RealtimeMessage =
  | { type: "subtitle_events"; events: SubtitleEvent[] }
  | { type: "error"; message: string };
```

Create `frontend/src/services/realtimeClient.ts`:

```typescript
import type { AudioChunkOut, RealtimeMessage } from "../types/events";

type Handlers = {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (message: RealtimeMessage) => void;
};

export class RealtimeClient {
  private socket: WebSocket | null = null;

  constructor(
    private readonly url: string,
    private readonly handlers: Handlers,
  ) {}

  connect() {
    this.socket = new WebSocket(this.url);
    this.socket.onopen = this.handlers.onOpen;
    this.socket.onclose = this.handlers.onClose;
    this.socket.onmessage = (event) => {
      this.handlers.onMessage(JSON.parse(event.data) as RealtimeMessage);
    };
  }

  sendChunk(chunk: AudioChunkOut) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(chunk));
    }
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}
```

- [ ] **Step 4: Add realtime session hook**

Create `frontend/src/hooks/useRealtimeSession.ts`:

```typescript
import { useMemo, useRef, useState } from "react";

import { RealtimeClient } from "../services/realtimeClient";
import type { AudioChunkOut, SubtitleEvent } from "../types/events";

type ConnectionStatus = "idle" | "connected" | "disconnected" | "error";

export function useRealtimeSession(url = "ws://127.0.0.1:8000/ws/realtime") {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [subtitles, setSubtitles] = useState<SubtitleEvent[]>([]);
  const clientRef = useRef<RealtimeClient | null>(null);

  const applyEvents = (events: SubtitleEvent[]) => {
    setSubtitles((current) => {
      let next = [...current];
      for (const event of events) {
        if (event.event_type === "revision" && event.replaces_event_id) {
          next = next.map((item) =>
            item.event_id === event.replaces_event_id
              ? { ...item, translated_text: event.translated_text, reason: event.reason }
              : item,
          );
        } else if (event.event_type === "final") {
          next = [...next.filter((item) => item.event_type !== "partial"), event];
        } else {
          next = [...next.filter((item) => item.event_type !== "partial"), event];
        }
      }
      return next;
    });
  };

  const client = useMemo(
    () =>
      new RealtimeClient(url, {
        onOpen: () => setConnectionStatus("connected"),
        onClose: () => setConnectionStatus("disconnected"),
        onMessage: (message) => {
          if (message.type === "subtitle_events") {
            applyEvents(message.events);
          } else {
            setConnectionStatus("error");
          }
        },
      }),
    [url],
  );

  const connect = () => {
    clientRef.current = client;
    client.connect();
  };

  const disconnect = () => {
    clientRef.current?.close();
    setConnectionStatus("idle");
  };

  const sendChunk = (chunk: AudioChunkOut) => {
    clientRef.current?.sendChunk(chunk);
  };

  return {
    connectionStatus,
    subtitles,
    connect,
    disconnect,
    sendChunk,
  };
}
```

- [ ] **Step 5: Wire UI to realtime state**

Modify `frontend/src/components/StatusBar.tsx`:

```typescript
type Props = {
  status: string;
};

export function StatusBar({ status }: Props) {
  const label = status === "connected" ? "实时连接中" : "等待音频输入";
  return (
    <section className="status-bar" aria-label="状态">
      <span className="status-dot" />
      {label}
    </section>
  );
}
```

Modify `frontend/src/components/SubtitlePanel.tsx`:

```typescript
import type { SubtitleEvent } from "../types/events";

type Props = {
  subtitles: SubtitleEvent[];
};

export function SubtitlePanel({ subtitles }: Props) {
  return (
    <section className="panel subtitle-panel" aria-label="字幕">
      {subtitles.length === 0 ? (
        <p className="subtitle-empty">中文字幕将在这里实时显示</p>
      ) : (
        <div className="subtitle-list">
          {subtitles.map((item) => (
            <article key={item.event_id} className={`subtitle-item ${item.event_type}`}>
              <p>{item.translated_text}</p>
              {item.source_text ? <small>{item.source_text}</small> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

Modify `frontend/src/components/ControlPanel.tsx`:

```typescript
import { Mic, MonitorUp, Play, Square } from "lucide-react";

type Props = {
  isConnected: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function ControlPanel({ isConnected, onStart, onStop }: Props) {
  return (
    <section className="panel controls" aria-label="同传控制">
      <div className="source-row">
        <button type="button" className="source-button active">
          <Mic size={18} />
          麦克风
        </button>
        <button type="button" className="source-button">
          <MonitorUp size={18} />
          系统音频
        </button>
      </div>
      <button type="button" className="primary-button" onClick={isConnected ? onStop : onStart}>
        {isConnected ? <Square size={18} /> : <Play size={18} />}
        {isConnected ? "停止" : "开始"}
      </button>
    </section>
  );
}
```

Modify `frontend/src/App.tsx`:

```typescript
import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";
import { useRealtimeSession } from "./hooks/useRealtimeSession";

export function App() {
  const session = useRealtimeSession();
  const isConnected = session.connectionStatus === "connected";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>FlowTrans</h1>
          <p>AI 实时同声传译助手</p>
        </div>
      </header>
      <StatusBar status={session.connectionStatus} />
      <div className="workbench">
        <ControlPanel
          isConnected={isConnected}
          onStart={session.connect}
          onStop={session.disconnect}
        />
        <SubtitlePanel subtitles={session.subtitles} />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Add subtitle styles**

Append to `frontend/src/styles.css`:

```css
.subtitle-list {
  display: grid;
  gap: 12px;
}

.subtitle-item {
  border-left: 3px solid #cbd5e1;
  padding-left: 12px;
}

.subtitle-item p {
  margin: 0;
  font-size: 22px;
  line-height: 1.55;
}

.subtitle-item small {
  display: block;
  margin-top: 4px;
  color: #6b7280;
}

.subtitle-item.partial p {
  color: #64748b;
}

.subtitle-item.final {
  border-left-color: #2563eb;
}
```

- [ ] **Step 7: Run tests and build**

Run:

```powershell
cd frontend
npm run test
npm run build
```

Expected: all frontend tests pass and build completes.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src
git commit -m "feat: add frontend realtime subtitle state"
```

---

### Task 7: Browser Audio Capture Hook

**Files:**

- Create: `frontend/src/hooks/useAudioCapture.ts`
- Create: `frontend/src/hooks/useAudioCapture.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ControlPanel.tsx`

- [ ] **Step 1: Write failing audio capture test**

Create `frontend/src/hooks/useAudioCapture.test.tsx`:

```typescript
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAudioCapture } from "./useAudioCapture";

describe("useAudioCapture", () => {
  it("starts microphone capture and reports recording status", async () => {
    const start = vi.fn();
    const stop = vi.fn();
    vi.stubGlobal(
      "MediaRecorder",
      class {
        ondataavailable: ((event: BlobEvent) => void) | null = null;
        start = start;
        stop = stop;
        constructor() {}
      },
    );
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      },
    });

    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.start("microphone", vi.fn());
    });

    expect(result.current.captureStatus).toBe("recording");
    expect(start).toHaveBeenCalledWith(500);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
cd frontend
npm run test -- useAudioCapture
```

Expected: failure because hook does not exist.

- [ ] **Step 3: Add audio capture hook**

Create `frontend/src/hooks/useAudioCapture.ts`:

```typescript
import { useRef, useState } from "react";

import type { InputSource } from "../types/events";

type CaptureStatus = "idle" | "recording" | "error";

export function useAudioCapture() {
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async (source: InputSource, onBlob: (blob: Blob) => void) => {
    try {
      const stream =
        source === "system"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onBlob(event.data);
        }
      };
      recorder.start(500);
      recorderRef.current = recorder;
      setCaptureStatus("recording");
    } catch {
      setCaptureStatus("error");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setCaptureStatus("idle");
  };

  return {
    captureStatus,
    start,
    stop,
  };
}
```

- [ ] **Step 4: Wire capture into app controls**

Modify `frontend/src/components/ControlPanel.tsx`:

```typescript
import { Mic, MonitorUp, Play, Square } from "lucide-react";

import type { InputSource } from "../types/events";

type Props = {
  inputSource: InputSource;
  isConnected: boolean;
  onSourceChange: (source: InputSource) => void;
  onStart: () => void;
  onStop: () => void;
};

export function ControlPanel({ inputSource, isConnected, onSourceChange, onStart, onStop }: Props) {
  return (
    <section className="panel controls" aria-label="同传控制">
      <div className="source-row">
        <button
          type="button"
          className={`source-button ${inputSource === "microphone" ? "active" : ""}`}
          onClick={() => onSourceChange("microphone")}
        >
          <Mic size={18} />
          麦克风
        </button>
        <button
          type="button"
          className={`source-button ${inputSource === "system" ? "active" : ""}`}
          onClick={() => onSourceChange("system")}
        >
          <MonitorUp size={18} />
          系统音频
        </button>
      </div>
      <button type="button" className="primary-button" onClick={isConnected ? onStop : onStart}>
        {isConnected ? <Square size={18} /> : <Play size={18} />}
        {isConnected ? "停止" : "开始"}
      </button>
    </section>
  );
}
```

Modify `frontend/src/App.tsx`:

```typescript
import { useRef, useState } from "react";

import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import type { InputSource } from "./types/events";

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buffer));
  return btoa(String.fromCharCode(...bytes));
}

export function App() {
  const [inputSource, setInputSource] = useState<InputSource>("microphone");
  const chunkIndexRef = useRef(0);
  const session = useRealtimeSession();
  const capture = useAudioCapture();
  const isConnected = session.connectionStatus === "connected";

  const start = async () => {
    session.connect();
    await capture.start(inputSource, async (blob) => {
      session.sendChunk({
        session_id: "browser-session",
        chunk_index: chunkIndexRef.current,
        captured_at_ms: Date.now(),
        input_source: inputSource,
        mime_type: blob.type || "audio/webm",
        payload_b64: await blobToBase64(blob),
      });
      chunkIndexRef.current += 1;
    });
  };

  const stop = () => {
    capture.stop();
    session.disconnect();
    chunkIndexRef.current = 0;
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>FlowTrans</h1>
          <p>AI 实时同声传译助手</p>
        </div>
      </header>
      <StatusBar status={capture.captureStatus === "recording" ? "connected" : session.connectionStatus} />
      <div className="workbench">
        <ControlPanel
          inputSource={inputSource}
          isConnected={isConnected || capture.captureStatus === "recording"}
          onSourceChange={setInputSource}
          onStart={start}
          onStop={stop}
        />
        <SubtitlePanel subtitles={session.subtitles} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
cd frontend
npm run test
npm run build
```

Expected: tests pass and build completes.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src
git commit -m "feat: add browser audio capture"
```

---

### Task 8: DashScope Provider Adapter Skeleton

**Files:**

- Create: `backend/app/providers/dashscope_provider.py`
- Create: `backend/tests/test_dashscope_provider.py`
- Modify: `backend/app/core/config.py`
- Modify: `README.md`

- [ ] **Step 1: Write failing provider tests**

Create `backend/tests/test_dashscope_provider.py`:

```python
import pytest

from app.providers.dashscope_provider import DashScopeProvider, MissingDashScopeApiKey


def test_dashscope_provider_requires_api_key() -> None:
    with pytest.raises(MissingDashScopeApiKey):
        DashScopeProvider(api_key=None)


def test_dashscope_provider_exposes_configured_model_names() -> None:
    provider = DashScopeProvider(
        api_key="test-key",
        asr_model="paraformer-realtime-v2",
        text_model="qwen-plus",
        tts_model="cosyvoice-v1",
    )

    assert provider.model_names() == {
        "asr_model": "paraformer-realtime-v2",
        "text_model": "qwen-plus",
        "tts_model": "cosyvoice-v1",
    }
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
cd backend
python -m pytest tests/test_dashscope_provider.py -v
```

Expected: failure because the provider module does not exist.

- [ ] **Step 3: Extend settings**

Modify `backend/app/core/config.py`:

```python
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    service_name: str = "flowtrans-backend"
    provider_mode: Literal["fake", "dashscope"] = "fake"
    target_language: str = "zh-CN"
    dashscope_api_key: str | None = None
    dashscope_asr_model: str = "paraformer-realtime-v2"
    dashscope_text_model: str = "qwen-plus"
    dashscope_tts_model: str = "cosyvoice-v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Add provider adapter skeleton**

Create `backend/app/providers/dashscope_provider.py`:

```python
class MissingDashScopeApiKey(RuntimeError):
    pass


class DashScopeProvider:
    def __init__(
        self,
        api_key: str | None,
        asr_model: str = "paraformer-realtime-v2",
        text_model: str = "qwen-plus",
        tts_model: str = "cosyvoice-v1",
    ) -> None:
        if not api_key:
            raise MissingDashScopeApiKey("DASHSCOPE_API_KEY is required when provider_mode is dashscope")
        self._api_key = api_key
        self._asr_model = asr_model
        self._text_model = text_model
        self._tts_model = tts_model

    def model_names(self) -> dict[str, str]:
        return {
            "asr_model": self._asr_model,
            "text_model": self._text_model,
            "tts_model": self._tts_model,
        }
```

- [ ] **Step 5: Update README environment section**

Append to `README.md`:

```markdown
## Environment

The local demo uses fake providers by default.

```powershell
$env:PROVIDER_MODE="fake"
```

To prepare real DashScope/Qwen integration:

```powershell
$env:PROVIDER_MODE="dashscope"
$env:DASHSCOPE_API_KEY="<your-api-key>"
$env:DASHSCOPE_ASR_MODEL="paraformer-realtime-v2"
$env:DASHSCOPE_TEXT_MODEL="qwen-plus"
$env:DASHSCOPE_TTS_MODEL="cosyvoice-v1"
```
```

- [ ] **Step 6: Run backend tests**

Run:

```powershell
cd backend
python -m pytest tests -v
```

Expected: all backend tests pass.

- [ ] **Step 7: Commit**

```powershell
git add README.md backend/app backend/tests
git commit -m "feat: add dashscope provider adapter skeleton"
```

---

### Task 9: Revision Highlight And TTS Toggle UI

**Files:**

- Modify: `frontend/src/components/ControlPanel.tsx`
- Modify: `frontend/src/components/SubtitlePanel.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Create: `frontend/src/components/SubtitlePanel.test.tsx`

- [ ] **Step 1: Write failing subtitle revision UI test**

Create `frontend/src/components/SubtitlePanel.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubtitlePanel } from "./SubtitlePanel";

describe("SubtitlePanel", () => {
  it("marks revised subtitles for visual feedback", () => {
    render(
      <SubtitlePanel
        subtitles={[
          {
            event_id: "a-0",
            session_id: "a",
            event_type: "final",
            source_text: "Welcome",
            translated_text: "欢迎使用 FlowTrans。",
            replaces_event_id: null,
            reason: "上下文修正",
          },
        ]}
      />,
    );

    expect(screen.getByText("欢迎使用 FlowTrans。").closest("article")).toHaveClass("revised");
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
cd frontend
npm run test -- SubtitlePanel
```

Expected: failure because revised class is not applied.

- [ ] **Step 3: Add TTS toggle to controls**

Modify `frontend/src/components/ControlPanel.tsx`:

```typescript
import { Mic, MonitorUp, Play, Square, Volume2 } from "lucide-react";

import type { InputSource } from "../types/events";

type Props = {
  inputSource: InputSource;
  isConnected: boolean;
  ttsEnabled: boolean;
  onSourceChange: (source: InputSource) => void;
  onTtsChange: (enabled: boolean) => void;
  onStart: () => void;
  onStop: () => void;
};

export function ControlPanel({
  inputSource,
  isConnected,
  ttsEnabled,
  onSourceChange,
  onTtsChange,
  onStart,
  onStop,
}: Props) {
  return (
    <section className="panel controls" aria-label="同传控制">
      <div className="source-row">
        <button
          type="button"
          className={`source-button ${inputSource === "microphone" ? "active" : ""}`}
          onClick={() => onSourceChange("microphone")}
        >
          <Mic size={18} />
          麦克风
        </button>
        <button
          type="button"
          className={`source-button ${inputSource === "system" ? "active" : ""}`}
          onClick={() => onSourceChange("system")}
        >
          <MonitorUp size={18} />
          系统音频
        </button>
      </div>
      <label className="toggle-row">
        <Volume2 size={18} />
        <span>中文语音</span>
        <input
          type="checkbox"
          checked={ttsEnabled}
          onChange={(event) => onTtsChange(event.target.checked)}
        />
      </label>
      <button type="button" className="primary-button" onClick={isConnected ? onStop : onStart}>
        {isConnected ? <Square size={18} /> : <Play size={18} />}
        {isConnected ? "停止" : "开始"}
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Mark revised subtitles**

Modify `frontend/src/components/SubtitlePanel.tsx`:

```typescript
import type { SubtitleEvent } from "../types/events";

type Props = {
  subtitles: SubtitleEvent[];
};

export function SubtitlePanel({ subtitles }: Props) {
  return (
    <section className="panel subtitle-panel" aria-label="字幕">
      {subtitles.length === 0 ? (
        <p className="subtitle-empty">中文字幕将在这里实时显示</p>
      ) : (
        <div className="subtitle-list">
          {subtitles.map((item) => (
            <article
              key={item.event_id}
              className={`subtitle-item ${item.event_type} ${item.reason ? "revised" : ""}`}
            >
              <p>{item.translated_text}</p>
              {item.source_text ? <small>{item.source_text}</small> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

Modify `frontend/src/App.tsx` to add `ttsEnabled` state and pass it to controls:

```typescript
import { useRef, useState } from "react";

import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import type { InputSource } from "./types/events";

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buffer));
  return btoa(String.fromCharCode(...bytes));
}

export function App() {
  const [inputSource, setInputSource] = useState<InputSource>("microphone");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const chunkIndexRef = useRef(0);
  const session = useRealtimeSession();
  const capture = useAudioCapture();
  const isConnected = session.connectionStatus === "connected";

  const start = async () => {
    session.connect();
    await capture.start(inputSource, async (blob) => {
      session.sendChunk({
        session_id: "browser-session",
        chunk_index: chunkIndexRef.current,
        captured_at_ms: Date.now(),
        input_source: inputSource,
        mime_type: blob.type || "audio/webm",
        payload_b64: await blobToBase64(blob),
      });
      chunkIndexRef.current += 1;
    });
  };

  const stop = () => {
    capture.stop();
    session.disconnect();
    chunkIndexRef.current = 0;
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>FlowTrans</h1>
          <p>AI 实时同声传译助手</p>
        </div>
      </header>
      <StatusBar status={capture.captureStatus === "recording" ? "connected" : session.connectionStatus} />
      <div className="workbench">
        <ControlPanel
          inputSource={inputSource}
          isConnected={isConnected || capture.captureStatus === "recording"}
          ttsEnabled={ttsEnabled}
          onSourceChange={setInputSource}
          onTtsChange={setTtsEnabled}
          onStart={start}
          onStop={stop}
        />
        <SubtitlePanel subtitles={session.subtitles} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Add revision styles**

Append to `frontend/src/styles.css`:

```css
.toggle-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  color: #334155;
}

.subtitle-item.revised {
  border-left-color: #10b981;
  background: #ecfdf5;
  margin-left: -8px;
  padding: 8px 8px 8px 12px;
  border-radius: 8px;
}
```

- [ ] **Step 6: Run frontend tests and build**

Run:

```powershell
cd frontend
npm run test
npm run build
```

Expected: all frontend tests pass and build completes.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src
git commit -m "feat: add revision highlight and tts toggle"
```

---

### Task 10: End-To-End Demo Documentation And Smoke Scripts

**Files:**

- Create: `backend/tests/test_demo_flow.py`
- Modify: `README.md`

- [ ] **Step 1: Write backend demo flow test**

Create `backend/tests/test_demo_flow.py`:

```python
import base64

from fastapi.testclient import TestClient

from app.main import create_app


def test_demo_flow_emits_partial_final_and_revision() -> None:
    client = TestClient(create_app())
    chunks = [
        {
            "session_id": "demo",
            "chunk_index": 0,
            "captured_at_ms": 0,
            "input_source": "microphone",
            "mime_type": "audio/webm",
            "payload_b64": base64.b64encode(b"first").decode("ascii"),
        },
        {
            "session_id": "demo",
            "chunk_index": 1,
            "captured_at_ms": 500,
            "input_source": "microphone",
            "mime_type": "audio/webm",
            "payload_b64": base64.b64encode(b"second").decode("ascii"),
        },
    ]

    with client.websocket_connect("/ws/realtime") as websocket:
      websocket.send_json(chunks[0])
      first = websocket.receive_json()
      websocket.send_json(chunks[1])
      second = websocket.receive_json()

    assert first["events"][0]["event_type"] == "partial"
    assert [event["event_type"] for event in second["events"]] == ["final", "revision"]
```

- [ ] **Step 2: Run demo flow test**

Run:

```powershell
cd backend
python -m pytest tests/test_demo_flow.py -v
```

Expected: test passes and proves the fake provider demo path works without API keys.

- [ ] **Step 3: Update README with full local demo flow**

Modify `README.md` so it contains these sections:

```markdown
# FlowTrans

AI 实时同声传译助手。

## Local Demo

The MVP runs with fake providers by default, so it works without `DASHSCOPE_API_KEY`.

Terminal 1:

```powershell
cd backend
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload
```

Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, choose microphone or system audio, then click `开始`.

## Environment

```powershell
$env:PROVIDER_MODE="fake"
```

To prepare real DashScope/Qwen integration:

```powershell
$env:PROVIDER_MODE="dashscope"
$env:DASHSCOPE_API_KEY="<your-api-key>"
$env:DASHSCOPE_ASR_MODEL="paraformer-realtime-v2"
$env:DASHSCOPE_TEXT_MODEL="qwen-plus"
$env:DASHSCOPE_TTS_MODEL="cosyvoice-v1"
```

## Test

Backend:

```powershell
cd backend
python -m pytest tests -v
```

Frontend:

```powershell
cd frontend
npm run test
npm run build
```

## PR Workflow

Each PR must implement one feature only. Use small PRs, keep main runnable after every merge, and include:

- Title
- Feature Description
- Implementation Approach
- Test Method
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
cd backend
python -m pytest tests -v
```

Run:

```powershell
cd frontend
npm run test
npm run build
```

Expected: all tests pass and frontend builds.

- [ ] **Step 5: Commit**

```powershell
git add README.md backend/tests
git commit -m "docs: add local demo workflow"
```

---

## Self-Review

Spec coverage:

- Web MVP: covered by Tasks 1, 4, 5, 6, and 7.
- Microphone and system audio input: covered by Task 7.
- Real-time subtitles: covered by Tasks 3, 4, 6, and 10.
- Subtitle revision: covered by Tasks 3, 6, and 9.
- TTS as optional enhancement: covered by Task 9 as UI state; backend provider skeleton is prepared in Task 8.
- DashScope/Qwen cloud path: covered by Task 8 as adapter skeleton, with fake provider preserving local runnability.
- PR discipline: defined in the PR section and represented by one task per commit.

Type consistency:

- Backend uses `AudioChunkIn`, `AcceptedAudioChunk`, and `SubtitleEvent` across services and tests.
- Frontend uses `AudioChunkOut`, `SubtitleEvent`, `InputSource`, and `RealtimeMessage` matching backend field names.
- Event types are consistently `partial`, `final`, and `revision`.

Execution notes:

- Install dependencies only inside the relevant task.
- If dependency installation fails because network access is blocked, rerun the same install command with escalation and a clear approval request.
- Keep fake provider tests independent of DashScope network calls.
