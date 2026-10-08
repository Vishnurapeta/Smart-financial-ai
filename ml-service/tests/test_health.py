from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify that GET /health returns 200 and operational status."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "SmartFinAI-ML-Service"
    assert "version" in data
    assert "timestamp" in data
    assert "uptimeSeconds" in data
