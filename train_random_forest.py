import os
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


ROUTE4_CANONICAL_STOPS = [
    {"stopNumber": 1, "name": "Quezon City Hall – NHA Interchange", "csvName": "QC Hall (NHA) Interchange", "short": "QC Hall"},
    {"stopNumber": 2, "name": "North Avenue – Veterans Hospital / Vertis North", "csvName": "North Ave. - Veterans Memorial Medical Center (VMMC) - Vertis North", "short": "North Ave / VMMC"},
    {"stopNumber": 3, "name": "Mindanao Avenue corner Road 1", "csvName": "Mindanao Ave. - Road 1 Street", "short": "Mindanao cor. Road 1"},
    {"stopNumber": 4, "name": "Mindanao Avenue – Tullahan Bridge", "csvName": "Mindanao Ave. - Tullahan Bridge", "short": "Tullahan Bridge"},
    {"stopNumber": 5, "name": "Mindanao Avenue corner Congressional Avenue", "csvName": "Mindanao Ave. - Congressional Ave.", "short": "Mindanao cor. Congressional"},
    {"stopNumber": 6, "name": "Mindanao Avenue corner Tandang Sora Avenue", "csvName": "Tandang Sora Avenue", "short": "Tandang Sora Ave"},
    {"stopNumber": 7, "name": "Mindanao Avenue corner D. Muñoz Street", "csvName": "D. Muñoz Street", "short": "D. Muñoz St"},
    {"stopNumber": 8, "name": "Mindanao Avenue corner Old Sauyo Road", "csvName": "Old Sauyo Road Footbridge", "short": "Old Sauyo Rd"},
    {"stopNumber": 9, "name": "Mindanao Avenue corner Quirino Highway – Interchange", "csvName": "Mindanao Ave. - Quirino Highway Interchange", "short": "Mindanao - Quirino Interchange"},
    {"stopNumber": 10, "name": "Quezon City University Main Campus / Novaliches District Hospital", "csvName": "QC University - Novaliches District Hospital", "short": "QCU / Novaliches Hospital"},
    {"stopNumber": 11, "name": "Quirino Highway – SM City Novaliches", "csvName": "SM City Novaliches", "short": "SM Novaliches"},
    {"stopNumber": 12, "name": "Quirino Highway corner Forest Hills Drive", "csvName": "Quirino Highway - Forest Hill Drive", "short": "Forest Hills Drive"},
    {"stopNumber": 13, "name": "General Luis Avenue – Novaliches Bayan", "csvName": "Quirino Highway - Nova Bayan", "short": "Novaliches Bayan"},
    {"stopNumber": 14, "name": "General Luis Avenue corner Banahaw Street", "csvName": "Quirino Highway - Banahaw Street", "short": "Banahaw St"},
    {"stopNumber": 15, "name": "General Luis Avenue corner SB Road", "csvName": "Quirino Highway - SB Road", "short": "SB Road Terminal"}
]

CSV_TO_CANONICAL = {s["csvName"]: s for s in ROUTE4_CANONICAL_STOPS}

def to_minutes(time_str):
    parts = str(time_str).strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])

def format_minutes(m):
    return f"{m // 60:02d}:{m % 60:02d}"

def define_time_slots():
    """Defines the 54 time intervals according to requirements."""
    slots = []
    slot_id = 0
    # 05:00 to 09:00: every 15 minutes (16 slots)
    for m in range(300, 540, 15):
        slots.append({
            "slotId": slot_id,
            "period": "Morning Peak",
            "startMin": m,
            "endMin": m + 15,
            "duration": 15,
            "startTime": format_minutes(m),
            "endTime": format_minutes(m + 15),
            "label": f"{format_minutes(m)} - {format_minutes(m + 15)}"
        })
        slot_id += 1

    # 09:00 to 16:00: every 30 minutes (14 slots)
    for m in range(540, 960, 30):
        slots.append({
            "slotId": slot_id,
            "period": "Midday Off-Peak",
            "startMin": m,
            "endMin": m + 30,
            "duration": 30,
            "startTime": format_minutes(m),
            "endTime": format_minutes(m + 30),
            "label": f"{format_minutes(m)} - {format_minutes(m + 30)}"
        })
        slot_id += 1

    # 16:00 to 22:00: every 15 minutes (24 slots)
    for m in range(960, 1320, 15):
        period = "Evening Peak" if m < 1200 else "Night"
        slots.append({
            "slotId": slot_id,
            "period": period,
            "startMin": m,
            "endMin": m + 15,
            "duration": 15,
            "startTime": format_minutes(m),
            "endTime": format_minutes(m + 15),
            "label": f"{format_minutes(m)} - {format_minutes(m + 15)}"
        })
        slot_id += 1

    return slots

def map_to_slot(mins, slots):
    for s in slots:
        if s["startMin"] <= mins < s["endMin"]:
            return s
    return None

def main():
    print("=== Loading QC Bus Dataset ===")
    df = pd.read_csv("qcbus_data_modeling.csv", encoding="utf-8")
    print(f"Total rows: {len(df):,}")

    df["mins"] = df["time"].apply(to_minutes)
    df["datetime"] = pd.to_datetime(df["date"] + " " + df["time"])
    df["day_of_week"] = df["datetime"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    # Resolve canonical stop name
    df["canonical_name"] = df["stop name"].apply(lambda x: CSV_TO_CANONICAL.get(x, {}).get("name", x))
    df["stop_number"] = df["stop name"].apply(lambda x: CSV_TO_CANONICAL.get(x, {}).get("stopNumber", 0))

    # Detect trip directions
    trips_dir = {}
    for (d, b), g in df.groupby(["date", "busId"]):
        first_stop = g.iloc[0]["stop name"]
        trips_dir[(d, b)] = "Northbound" if "QC Hall" in first_stop else "Southbound"
    df["direction"] = df.apply(lambda r: trips_dir.get((r["date"], r["busId"]), "Northbound"), axis=1)

    slots = define_time_slots()
    print(f"Defined {len(slots)} operational time intervals.")

    # MODEL 1: Queue Prediction per Stop and Time Interval
    print("\n" + "="*50)
    print("TRAINING MODEL 1: Stop Queue Random Forest Regressor")
    print("="*50)

    df["slot"] = df["mins"].apply(lambda m: map_to_slot(m, slots))
    df_slotted = df.dropna(subset=["slot"]).copy()
    df_slotted["slot_id"] = df_slotted["slot"].apply(lambda s: s["slotId"])

    slot_agg = df_slotted.groupby(["canonical_name", "stop_number", "slot_id", "date", "day_of_week", "is_weekend"]).agg(
        total_boarded=("passenger loaded", "sum"),
        bus_count=("busId", "nunique"),
        avg_boarded_per_bus=("passenger loaded", "mean"),
        max_boarded=("passenger loaded", "max")
    ).reset_index()

    slot_meta_dict = {s["slotId"]: s for s in slots}
    slot_agg["start_min"] = slot_agg["slot_id"].apply(lambda sid: slot_meta_dict[sid]["startMin"])
    slot_agg["duration"] = slot_agg["slot_id"].apply(lambda sid: slot_meta_dict[sid]["duration"])
    slot_agg["hour"] = slot_agg["start_min"] // 60
    slot_agg["period"] = slot_agg["slot_id"].apply(lambda sid: slot_meta_dict[sid]["period"])
    slot_agg["is_morning_peak"] = (slot_agg["start_min"].between(360, 540)).astype(int)
    slot_agg["is_evening_peak"] = (slot_agg["start_min"].between(960, 1200)).astype(int)
    slot_agg["is_midday"] = (slot_agg["start_min"].between(540, 960)).astype(int)

    feature_cols_m1 = [
        "stop_number", "slot_id", "start_min", "duration", "hour",
        "day_of_week", "is_weekend", "is_morning_peak", "is_evening_peak", "is_midday", "bus_count"
    ]
    X_m1 = pd.get_dummies(slot_agg[feature_cols_m1 + ["canonical_name"]], columns=["canonical_name"], drop_first=False)

    y_queue = slot_agg["total_boarded"]

    X_train_m1, X_test_m1, y_train_m1, y_test_m1 = train_test_split(X_m1, y_queue, test_size=0.2, random_state=42)
    rf_queue = RandomForestRegressor(n_estimators=150, max_depth=16, random_state=42, n_jobs=1)
    rf_queue.fit(X_train_m1, y_train_m1)

    y_pred_m1 = rf_queue.predict(X_test_m1)
    mae_m1 = mean_absolute_error(y_test_m1, y_pred_m1)
    rmse_m1 = np.sqrt(mean_squared_error(y_test_m1, y_pred_m1))
    r2_m1 = r2_score(y_test_m1, y_pred_m1)

    print(f"Queue Model Performance:")
    print(f"  R² Score: {r2_m1:.4f} ({r2_m1*100:.1f}% variance explained)")
    print(f"  Mean Absolute Error (MAE): {mae_m1:.2f} passengers")
    print(f"  Root Mean Squared Error (RMSE): {rmse_m1:.2f} passengers")

    queue_predictions_by_stop = {}

    for s_info in ROUTE4_CANONICAL_STOPS:
        s_name = s_info["name"]
        s_num = s_info["stopNumber"]
        s_short = s_info["short"]

        stop_slots = []
        for s in slots:
            sid = s["slotId"]
            start_m = s["startMin"]
            dur = s["duration"]
            hr = start_m // 60

            hist_match = slot_agg[(slot_agg["stop_number"] == s_num) & (slot_agg["slot_id"] == sid)]
            hist_mean = float(hist_match["total_boarded"].mean()) if len(hist_match) > 0 else 0.0
            hist_bus_avg = float(hist_match["bus_count"].mean()) if len(hist_match) > 0 else (2 if dur == 30 else 1)
            hist_per_bus = float(hist_match["avg_boarded_per_bus"].mean()) if len(hist_match) > 0 else 0.0

            row_dict = {
                "stop_number": s_num,
                "slot_id": sid,
                "start_min": start_m,
                "duration": dur,
                "hour": hr,
                "day_of_week": 2,
                "is_weekend": 0,
                "is_morning_peak": int(360 <= start_m < 540),
                "is_evening_peak": int(960 <= start_m < 1200),
                "is_midday": int(540 <= start_m < 960),
                "bus_count": max(1, round(hist_bus_avg))
            }
            for candidate in ROUTE4_CANONICAL_STOPS:
                row_dict[f"canonical_name_{candidate['name']}"] = int(candidate["name"] == s_name)

            row_df = pd.DataFrame([row_dict])
            for col in X_m1.columns:
                if col not in row_df:
                    row_df[col] = 0
            row_df = row_df[X_m1.columns]

            pred_queue = float(rf_queue.predict(row_df)[0])
            final_queue = round(max(0, (pred_queue * 0.7 + hist_mean * 0.3)), 1)
            avg_per_bus_est = round(final_queue / max(1, hist_bus_avg), 1)

            if final_queue > 40:
                crowd_level = "High"
                crowd_color = "#ef4444"
            elif final_queue >= 15:
                crowd_level = "Moderate"
                crowd_color = "#f59e0b"
            else:
                crowd_level = "Low"
                crowd_color = "#10b981"

            stop_slots.append({
                "slotId": sid,
                "startTime": s["startTime"],
                "endTime": s["endTime"],
                "label": s["label"],
                "period": s["period"],
                "duration": dur,
                "predictedQueue": int(round(final_queue)),
                "predictedQueueExact": final_queue,
                "expectedBuses": max(1, int(round(hist_bus_avg))),
                "avgQueuePerBus": int(round(avg_per_bus_est)),
                "crowdLevel": crowd_level,
                "crowdColor": crowd_color
            })

        queue_predictions_by_stop[s_name] = {
            "stopNumber": s_num,
            "canonicalName": s_name,
            "shortName": s_short,
            "csvName": s_info["csvName"],
            "slots": stop_slots
        }

    # MODEL 2: Recommended Number of Passengers to be Boarded
    print("\n" + "="*50)
    print("TRAINING MODEL 2: Recommended Boarding Random Forest")
    print("="*50)

    df["stop_idx_in_trip"] = df.groupby(["date", "busId"]).cumcount()
    df["hour"] = df["mins"] // 60
    df["is_morning_peak"] = (df["mins"].between(360, 540)).astype(int)
    df["is_evening_peak"] = (df["mins"].between(960, 1200)).astype(int)
    df["is_midday"] = (df["mins"].between(540, 960)).astype(int)
    df["current_occupancy_ratio"] = df["total passenger"] / df["seating capacity"]

    m2_features = [
        "stop_number", "stop_idx_in_trip", "mins", "hour", "seating capacity",
        "day_of_week", "is_weekend", "is_morning_peak", "is_evening_peak", "is_midday"
    ]
    X_m2_raw = df[m2_features + ["canonical_name", "direction"]]
    X_m2 = pd.get_dummies(X_m2_raw, columns=["canonical_name", "direction"], drop_first=False)
    y_m2 = df["passenger loaded"]

    X_train_m2, X_test_m2, y_train_m2, y_test_m2 = train_test_split(X_m2, y_m2, test_size=0.2, random_state=42)
    rf_boarding = RandomForestRegressor(n_estimators=150, max_depth=16, random_state=42, n_jobs=1)
    rf_boarding.fit(X_train_m2, y_train_m2)

    y_pred_m2 = rf_boarding.predict(X_test_m2)
    mae_m2 = mean_absolute_error(y_test_m2, y_pred_m2)
    rmse_m2 = np.sqrt(mean_squared_error(y_test_m2, y_pred_m2))
    r2_m2 = r2_score(y_test_m2, y_pred_m2)

    print(f"Boarding Model Performance:")
    print(f"  R² Score: {r2_m2:.4f} ({r2_m2*100:.1f}% variance explained)")
    print(f"  Mean Absolute Error (MAE): {mae_m2:.2f} passengers")
    print(f"  Root Mean Squared Error (RMSE): {rmse_m2:.2f} passengers")

    # Generate Recommended Boarding Table for each Stop in Northbound and Southbound
    # across key operational periods: Morning Peak, Midday, Evening Peak, Overall Average
    recommended_boarding_results = {
        "metadata": {
            "model": "RandomForestRegressor",
            "trees": 150,
            "r2Score": round(float(r2_m2), 4),
            "mae": round(float(mae_m2), 2),
            "generatedAt": pd.Timestamp.now().isoformat()
        },
        "byDirectionAndStop": {
            "Northbound": {},
            "Southbound": {}
        }
    }

    periods = [
        {"key": "morning_peak", "label": "Morning Rush (6AM-9AM)", "mins": 450},   # 7:30 AM
        {"key": "midday", "label": "Midday (9AM-4PM)", "mins": 720},               # 12:00 PM
        {"key": "evening_peak", "label": "Evening Rush (4PM-8PM)", "mins": 1050},  # 5:30 PM
        {"key": "night", "label": "Night (8PM-10PM)", "mins": 1260}                # 9:00 PM
    ]

    for direction in ["Northbound", "Southbound"]:
        dir_stops = ROUTE4_CANONICAL_STOPS if direction == "Northbound" else list(reversed(ROUTE4_CANONICAL_STOPS))

        for idx, s_info in enumerate(dir_stops):
            s_name = s_info["name"]
            s_num = s_info["stopNumber"]
            seq_num = idx + 1 # 1 to 15 along travel direction
            is_terminal = (seq_num == 15)

            # Historical baseline for this stop and direction
            hist_sub = df[(df["canonical_name"] == s_name) & (df["direction"] == direction)]
            hist_avg = float(hist_sub["passenger loaded"].mean()) if len(hist_sub) > 0 else 0.0

            period_recs = {}
            for p in periods:
                p_min = p["mins"]
                row_dict = {
                    "stop_number": s_num,
                    "stop_idx_in_trip": idx,
                    "mins": p_min,
                    "hour": p_min // 60,
                    "seating capacity": 53,
                    "day_of_week": 2,
                    "is_weekend": 0,
                    "is_morning_peak": int(360 <= p_min < 540),
                    "is_evening_peak": int(960 <= p_min < 1200),
                    "is_midday": int(540 <= p_min < 960)
                }
                for candidate in ROUTE4_CANONICAL_STOPS:
                    row_dict[f"canonical_name_{candidate['name']}"] = int(candidate["name"] == s_name)
                row_dict["direction_Northbound"] = int(direction == "Northbound")
                row_dict["direction_Southbound"] = int(direction == "Southbound")

                row_df = pd.DataFrame([row_dict])
                for col in X_m2.columns:
                    if col not in row_df:
                        row_df[col] = 0
                row_df = row_df[X_m2.columns]

                pred = float(rf_boarding.predict(row_df)[0])
                if is_terminal:
                    rec_val = 0
                else:
                    # Blend with historical mean
                    blended = (pred * 0.7 + hist_avg * 0.3)
                    rec_val = max(1, int(round(blended))) if blended >= 0.5 else int(round(blended))

                period_recs[p["key"]] = rec_val

            # Baseline overall recommendation (weighted average across typical operating hours)
            if is_terminal:
                overall_rec = 0
                rec_range = "0 (Terminus)"
            else:
                overall_val = (period_recs["morning_peak"] * 0.35 +
                               period_recs["midday"] * 0.25 +
                               period_recs["evening_peak"] * 0.30 +
                               period_recs["night"] * 0.10)
                overall_rec = max(1, int(round(overall_val))) if overall_val >= 0.8 else int(round(overall_val))
                min_p = min(period_recs.values())
                max_p = max(period_recs.values())
                rec_range = f"{min_p}-{max_p} pax" if min_p != max_p else f"{overall_rec} pax"

            recommended_boarding_results["byDirectionAndStop"][direction][s_name] = {
                "stopNumber": s_num,
                "sequenceNumber": seq_num,
                "stopName": s_name,
                "shortName": s_info["short"],
                "isTerminal": is_terminal,
                "overallRecommended": overall_rec,
                "recommendedRange": rec_range,
                "byPeriod": period_recs
            }

    # Save to shared directory for frontend usage
    os.makedirs("shared/data", exist_ok=True)

    with open("shared/data/rf_queue_predictions.json", "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "model": "RandomForestRegressor",
                "intervalsCount": len(slots),
                "r2Score": round(float(r2_m1), 4),
                "mae": round(float(mae_m1), 2),
                "rmse": round(float(rmse_m1), 2),
                "generatedAt": pd.Timestamp.now().isoformat()
            },
            "slots": slots,
            "stops": queue_predictions_by_stop
        }, f, indent=2)

    with open("shared/data/rf_recommended_boarding.json", "w", encoding="utf-8") as f:
        json.dump(recommended_boarding_results, f, indent=2)

    # Also create JS exports for clean Vite module imports
    with open("shared/data/rfPredictions.js", "w", encoding="utf-8") as f:
        f.write("// Auto-generated by train_random_forest.py\n")
        f.write(f"export const RF_QUEUE_PREDICTIONS = {json.dumps({'metadata': {'model': 'RandomForestRegressor', 'intervalsCount': len(slots), 'r2Score': round(float(r2_m1), 4), 'mae': round(float(mae_m1), 2)}, 'slots': slots, 'stops': queue_predictions_by_stop}, indent=2)};\n\n")
        f.write(f"export const RF_RECOMMENDED_BOARDING = {json.dumps(recommended_boarding_results, indent=2)};\n")

    print("\n" + "="*50)
    print("SUCCESS: Generated model prediction assets:")
    print("  - shared/data/rf_queue_predictions.json")
    print("  - shared/data/rf_recommended_boarding.json")
    print("  - shared/data/rfPredictions.js")
    print("="*50)

if __name__ == "__main__":
    main()
