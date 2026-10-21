def test_login_success(client):
    response = client.post("/api/v1/auth/login", json={
        "username": "testadmin",
        "password": "TestAdmin123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["username"] == "testadmin"
    assert data["role"] == "ADMIN"


def test_login_wrong_password(client):
    response = client.post("/api/v1/auth/login", json={
        "username": "testadmin",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


def test_get_me_authenticated(client, admin_headers):
    response = client.get("/api/v1/auth/me", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testadmin"
    assert data["role"] == "ADMIN"


def test_get_me_unauthorized(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
