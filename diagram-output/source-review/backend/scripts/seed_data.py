import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.user import User
from app.models.route import Route
from app.models.stop import Stop
from app.models.route_stop import RouteStop
from app.models.bus import Bus
from app.models.schedule import Schedule
from app.models.trip import Trip
from app.models.bus_location import BusLocation


def seed_database():
    print("Initializing schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Seeding initial administrator account...")
        admin_user = db.query(User).filter(User.username == settings.INITIAL_ADMIN_USERNAME).first()
        if not admin_user:
            admin_user = User(
                username=settings.INITIAL_ADMIN_USERNAME,
                email=settings.INITIAL_ADMIN_EMAIL,
                password_hash=get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                role="ADMIN",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print(f"Created admin user: {settings.INITIAL_ADMIN_USERNAME}")
        else:
            print(f"Admin user {settings.INITIAL_ADMIN_USERNAME} already exists.")

        print("Seeding QC Bus stops...")
        stops_data = [
            {"stop_code": "STOP_001", "stop_name": "Quezon City Hall – NHA Interchange", "address": "Elliptical Road, Diliman, QC", "latitude": 14.650220638010133, "longitude": 121.05202242497576},
            {"stop_code": "STOP_002", "stop_name": "North Avenue – Veterans Hospital / Vertis North", "address": "North Ave, Diliman, QC", "latitude": 14.653837872891756, "longitude": 121.03919441495735},
            {"stop_code": "STOP_003", "stop_name": "Mindanao Avenue corner Road 1", "address": "Mindanao Ave cor Road 1, Project 6, QC", "latitude": 14.65565931812385, "longitude": 121.03557040362864},
            {"stop_code": "STOP_004", "stop_name": "Mindanao Avenue – Tullahan Bridge", "address": "Mindanao Ave, QC", "latitude": 14.661252097669013, "longitude": 121.03681768535263},
            {"stop_code": "STOP_005", "stop_name": "Mindanao Avenue corner Congressional Avenue", "address": "Mindanao Ave cor Congressional Ave, QC", "latitude": 14.668691489622583, "longitude": 121.03358168194845},
            {"stop_code": "STOP_006", "stop_name": "Mindanao Avenue corner Tandang Sora Avenue", "address": "Mindanao Ave cor Tandang Sora Ave, QC", "latitude": 14.677454693786517, "longitude": 121.03221195651783},
            {"stop_code": "STOP_007", "stop_name": "Mindanao Avenue corner D. Muñoz Street", "address": "Mindanao Ave cor D. Muñoz St, QC", "latitude": 14.681690588320933, "longitude": 121.03214549217034},
            {"stop_code": "STOP_008", "stop_name": "Mindanao Avenue corner Old Sauyo Road", "address": "Mindanao Ave cor Old Sauyo Rd, QC", "latitude": 14.688344391235496, "longitude": 121.03095713022918},
            {"stop_code": "STOP_009", "stop_name": "Mindanao Avenue corner Quirino Highway – Interchange", "address": "Mindanao Ave cor Quirino Hwy, QC", "latitude": 14.69038993558755, "longitude": 121.0283830873586},
            {"stop_code": "STOP_010", "stop_name": "Quezon City University Main Campus / Novaliches District Hospital", "address": "San Bartolome, Novaliches, QC", "latitude": 14.700148091475898, "longitude": 121.03464947084294},
            {"stop_code": "STOP_011", "stop_name": "Quirino Highway – SM City Novaliches", "address": "Quirino Hwy, Novaliches, QC", "latitude": 14.707175129320298, "longitude": 121.038840489371},
            {"stop_code": "STOP_012", "stop_name": "Quirino Highway corner Forest Hills Drive", "address": "Quirino Hwy cor Forest Hills Dr, QC", "latitude": 14.716621284392273, "longitude": 121.04029019577789},
            {"stop_code": "STOP_013", "stop_name": "General Luis Avenue – Novaliches Bayan", "address": "General Luis Ave, Novaliches, QC", "latitude": 14.721924560116276, "longitude": 121.03909751380627},
            {"stop_code": "STOP_014", "stop_name": "General Luis Avenue corner Banahaw Street", "address": "General Luis Ave cor Banahaw St, QC", "latitude": 14.720656149260963, "longitude": 121.02811208540082},
            {"stop_code": "STOP_015", "stop_name": "General Luis Avenue corner SB Road", "address": "General Luis Ave cor SB Rd, QC", "latitude": 14.719769998791955, "longitude": 121.02128987815283},
        ]

        stop_objects = {}
        for sd in stops_data:
            stop = db.query(Stop).filter(Stop.stop_code == sd["stop_code"]).first()
            if not stop:
                stop = Stop(**sd, data_source="OFFICIAL_QC_BUS")
                db.add(stop)
                db.flush()
            stop_objects[sd["stop_code"]] = stop

        db.commit()

        print("Seeding QC Bus routes...")
        routes_data = [
            {
                "route_code": "R4",
                "route_name": "Route 4: QC Hall to General Luis",
                "description": "Quezon City Hall to General Luis Avenue traversing North Ave, Mindanao Ave, and Quirino Highway.",
                "stops": [f"STOP_{i:03d}" for i in range(1, 16)]
            },
        ]

        route_objects = {}
        for rd in routes_data:
            route = db.query(Route).filter(Route.route_code == rd["route_code"]).first()
            if not route:
                route = Route(
                    route_code=rd["route_code"],
                    route_name=rd["route_name"],
                    description=rd["description"],
                    is_active=True,
                    data_source="MOCK_QC_BUS"
                )
                db.add(route)
                db.flush()
            route_objects[rd["route_code"]] = route

            # Link ordered route stops
            seq = 1
            for stop_code in rd["stops"]:
                stop_obj = stop_objects.get(stop_code)
                if stop_obj:
                    existing_rs = db.query(RouteStop).filter(
                        RouteStop.route_id == route.id,
                        RouteStop.stop_sequence == seq
                    ).first()
                    if not existing_rs:
                        rs = RouteStop(
                            route_id=route.id,
                            stop_id=stop_obj.id,
                            stop_sequence=seq,
                            estimated_travel_minutes=(seq - 1) * 8
                        )
                        db.add(rs)
                seq += 1

        db.commit()

        print("Seeding QC Bus fleet...")
        buses_data = [
            {"bus_code": "MOCK_BUS_101", "display_name": "QC Bus #101 (Euro 5 Electric)", "plate_number": "NQA-1001", "capacity": 60},
            {"bus_code": "MOCK_BUS_102", "display_name": "QC Bus #102 (Euro 5 Electric)", "plate_number": "NQA-1002", "capacity": 60},
            {"bus_code": "MOCK_BUS_103", "display_name": "QC Bus #103 (Low Floor Low Emission)", "plate_number": "NQA-1003", "capacity": 55},
            {"bus_code": "MOCK_BUS_104", "display_name": "QC Bus #104 (Low Floor Low Emission)", "plate_number": "NQA-1004", "capacity": 55},
            {"bus_code": "MOCK_BUS_105", "display_name": "QC Bus #105 (Articulated Express)", "plate_number": "NQA-1005", "capacity": 90},
            {"bus_code": "MOCK_BUS_106", "display_name": "QC Bus #106 (Articulated Express)", "plate_number": "NQA-1006", "capacity": 90},
        ]

        bus_objects = {}
        for bd in buses_data:
            bus = db.query(Bus).filter(Bus.bus_code == bd["bus_code"]).first()
            if not bus:
                bus = Bus(**bd, is_active=True)
                db.add(bus)
                db.flush()
            bus_objects[bd["bus_code"]] = bus

        db.commit()

        print("Seeding QC Bus schedules...")
        departure_times = ["06:00", "07:00", "08:00", "09:30", "11:00", "13:30", "15:00", "16:30", "18:00", "19:30"]
        schedule_objects = []
        for r_code, route in route_objects.items():
            for dt in departure_times:
                sched = db.query(Schedule).filter(
                    Schedule.route_id == route.id,
                    Schedule.departure_time == dt
                ).first()
                if not sched:
                    sched = Schedule(
                        route_id=route.id,
                        service_day="DAILY",
                        departure_time=dt,
                        arrival_time=f"{int(dt.split(':')[0]) + 1:02d}:{dt.split(':')[1]}",
                        is_active=True
                    )
                    db.add(sched)
                    db.flush()
                schedule_objects.append(sched)

        db.commit()

        print("Seeding active & scheduled QC Bus trips...")
        statuses = ["IN_TRANSIT", "SCHEDULED", "IN_TRANSIT", "COMPLETED", "DELAYED", "CANCELLED"]
        now = datetime.now(timezone.utc)
        
        routes_list = list(route_objects.values())
        buses_list = list(bus_objects.values())

        for idx in range(12):
            route = routes_list[idx % len(routes_list)]
            bus = buses_list[idx % len(buses_list)]
            status = statuses[idx % len(statuses)]
            
            sch_dep = now - timedelta(hours=idx, minutes=15)
            act_dep = sch_dep + timedelta(minutes=5) if status in ["IN_TRANSIT", "COMPLETED", "DELAYED"] else None
            act_arr = act_dep + timedelta(minutes=45) if status == "COMPLETED" else None

            trip = db.query(Trip).filter(
                Trip.route_id == route.id,
                Trip.bus_id == bus.id,
                Trip.status == status
            ).first()

            if not trip:
                trip = Trip(
                    route_id=route.id,
                    bus_id=bus.id,
                    scheduled_departure=sch_dep,
                    actual_departure=act_dep,
                    actual_arrival=act_arr,
                    status=status
                )
                db.add(trip)
                db.flush()

                # If in transit, add a simulated location
                if status == "IN_TRANSIT":
                    loc = BusLocation(
                        bus_id=bus.id,
                        trip_id=trip.id,
                        latitude=14.6500 + (idx * 0.005),
                        longitude=121.0500 + (idx * 0.003),
                        speed=35.5,
                        heading=45.0,
                        is_simulated=True,
                        source="MOCK_SIMULATION_ENGINE",
                        recorded_at=now
                    )
                    db.add(loc)

        db.commit()
        print("Mock dataset seeding successfully completed!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
