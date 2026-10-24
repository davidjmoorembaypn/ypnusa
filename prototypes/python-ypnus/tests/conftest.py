import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture(autouse=True)
def isolated_data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("YPN_DATA_DIR", str(tmp_path))
    main._hits.clear()


@pytest.fixture()
def client():
    return TestClient(main.app, follow_redirects=False)
