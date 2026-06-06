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
