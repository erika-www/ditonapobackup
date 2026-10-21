def test_create_and_get_route(client, admin_headers):
    # Create Route
    create_resp = client.post("/api/v1/routes", json={
        "route_code": "TEST_QC_99",
        "route_name": "Test Route QC 99",
        "description": "Test description",
        "is_active": True
    }, headers=admin_headers)
    
    assert create_resp.status_code == 201
    route_data = create_resp.json()
    assert route_data["route_code"] == "TEST_QC_99"
    route_id = route_data["id"]

    # List Routes
    list_resp = client.get("/api/v1/routes")
    assert list_resp.status_code == 200
    routes = list_resp.json()
    assert len(routes) >= 1
    assert any(r["route_code"] == "TEST_QC_99" for r in routes)

    # Get Route Detail
    detail_resp = client.get(f"/api/v1/routes/{route_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["route_name"] == "Test Route QC 99"


def test_create_route_unauthorized(client):
    response = client.post("/api/v1/routes", json={
        "route_code": "UNAUTH_ROUTE",
        "route_name": "Unauthorized Route"
    })
    assert response.status_code == 401


def test_route_stop_sequence(client, admin_headers):
    # 1. Create Route
    r_resp = client.post("/api/v1/routes", json={
        "route_code": "SEQ_ROUTE",
        "route_name": "Sequence Test Route"
    }, headers=admin_headers).json()
    route_id = r_resp["id"]

    # 2. Create 2 Stops
    s1 = client.post("/api/v1/stops", json={
        "stop_code": "SEQ_STOP_1",
        "stop_name": "Sequence Stop 1"
    }, headers=admin_headers).json()
    
    s2 = client.post("/api/v1/stops", json={
        "stop_code": "SEQ_STOP_2",
        "stop_name": "Sequence Stop 2"
    }, headers=admin_headers).json()

    # 3. Add stops to route
    client.post(f"/api/v1/routes/{route_id}/stops", json={
        "stop_id": s1["id"],
        "stop_sequence": 1,
        "estimated_travel_minutes": 5
    }, headers=admin_headers)

    client.post(f"/api/v1/routes/{route_id}/stops", json={
        "stop_id": s2["id"],
        "stop_sequence": 2,
        "estimated_travel_minutes": 10
    }, headers=admin_headers)

    # 4. Fetch ordered stops
    stops_resp = client.get(f"/api/v1/routes/{route_id}/stops")
    assert stops_resp.status_code == 200
    stops = stops_resp.json()
    assert len(stops) == 2
    assert stops[0]["stop_sequence"] == 1
    assert stops[1]["stop_sequence"] == 2
