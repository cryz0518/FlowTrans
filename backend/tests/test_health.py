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
