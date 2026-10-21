import io


def test_import_preview_valid_csv(client, admin_headers):
    csv_content = "route_code,route_name,description\nIMP_01,Imported Route 1,Description 1\nIMP_02,Imported Route 2,Description 2\n"
    file_bytes = io.BytesIO(csv_content.encode("utf-8"))
    
    response = client.post(
        "/api/v1/import/preview",
        data={"entity_type": "routes"},
        files={"file": ("routes.csv", file_bytes, "text/csv")},
        headers=admin_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["entity_type"] == "routes"
    assert data["total_rows"] == 2
    assert data["valid_rows_count"] == 2
    assert data["invalid_rows_count"] == 0
    assert data["is_ready_to_commit"] is True


def test_import_commit(client, admin_headers):
    commit_data = {
        "entity_type": "routes",
        "data": [
            {
                "route_code": "COMMIT_ROUTE_01",
                "route_name": "Commit Route 01",
                "description": "Committed description",
                "is_active": True,
                "data_source": "TEST_IMPORT"
            }
        ]
    }
    
    response = client.post(
        "/api/v1/import/commit",
        json=commit_data,
        headers=admin_headers
    )
    
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["inserted_count"] == 1

    # Verify route exists in API
    get_res = client.get("/api/v1/routes")
    routes = get_res.json()
    assert any(r["route_code"] == "COMMIT_ROUTE_01" for r in routes)
