import pytest

from app.core.config import Settings
from app.providers.dashscope_provider import DashScopeProvider, MissingDashScopeApiKey
from app.providers.factory import create_provider
from app.providers.fake_provider import FakeProvider


def test_provider_factory_returns_fake_provider() -> None:
    settings = Settings(provider_mode="fake")

    provider = create_provider(settings)

    assert isinstance(provider, FakeProvider)


def test_provider_factory_requires_api_key_for_dashscope() -> None:
    settings = Settings(provider_mode="dashscope", dashscope_api_key=None)

    with pytest.raises(MissingDashScopeApiKey):
        create_provider(settings)


def test_provider_factory_returns_dashscope_provider() -> None:
    settings = Settings(provider_mode="dashscope", dashscope_api_key="test-key")

    provider = create_provider(settings)

    assert isinstance(provider, DashScopeProvider)
