from fastapi.testclient import TestClient
from geosentinel.api import app
from geosentinel import video

client = TestClient(app)


def test_uploaded_video_result_keeps_selected_village_and_cleans_file(monkeypatch):
    paths = []
    def detect(path):
        paths.append(path)
        assert path.read_bytes() == b'video-fixture'
        return {'detected': True, 'image': 'data:image/jpeg;base64,fixture', 'confidence': .91}
    monkeypatch.setattr(video, 'detect', detect)
    response = client.post('/api/video-detection?village=Masinagudi', content=b'video-fixture')
    assert response.status_code == 200
    assert response.json()['village'] == 'Masinagudi'
    assert response.json()['detected'] is True
    assert not paths[0].exists()


def test_empty_upload_and_unknown_village_rejected():
    assert client.post('/api/video-detection?village=Masinagudi', content=b'').status_code == 422
    assert client.post('/api/video-detection?village=unknown', content=b'video').status_code == 422


def test_decoder_failure_is_not_a_detection(monkeypatch):
    def fail(path):
        raise ValueError('Invalid video')
    monkeypatch.setattr(video, 'detect', fail)
    response = client.post('/api/video-detection?village=Masinagudi', content=b'invalid')
    assert response.status_code == 422
    assert response.json()['detail'] == 'Invalid video'
