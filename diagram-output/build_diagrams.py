from pathlib import Path
from html import escape
import textwrap
import json
import zipfile

OUT = Path(__file__).resolve().parent
COLORS = {'blue':('#eef5ff','#3374c5'), 'green':('#edf9f4','#238463'), 'purple':('#f4efff','#7956b6'), 'orange':('#fff5e9','#b87621'), 'gray':('#f2f5f8','#687b8e'), 'red':('#fff0f0','#b74f59')}

class Diagram:
    def __init__(self, filename, title, subtitle, height=1120):
        self.filename, self.title, self.subtitle, self.h = filename,title,subtitle,height
        self.elements=[]; self.nodes={}; self.edges=[]; self.backgrounds=[]
    def text(self,x,y,value,size=17,color='#20334c',weight='400',anchor='start'):
        self.elements.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>')
    def panel(self,x,y,w,h,label,color='gray'):
        fill,stroke=COLORS[color]
        self.backgrounds.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{fill}" fill-opacity=".45" stroke="{stroke}" stroke-opacity=".4"/>')
        self.text(x+20,y+30,label,15,stroke,'700')
    def box(self,id,x,y,w,h,title,lines=(),color='blue',diamond=False):
        assert id not in self.nodes
        self.nodes[id]=(x,y,w,h)
        fill,stroke=COLORS[color]
        if diamond:
            self.elements.append(f'<path d="M{x+w/2},{y} L{x+w},{y+h/2} L{x+w/2},{y+h} L{x},{y+h/2} Z" fill="{fill}" stroke="{stroke}" stroke-width="1.8"/>')
            self.text(x+w/2,y+h/2-3,title,18,'#172c46','700','middle')
            for i,line in enumerate(lines): self.text(x+w/2,y+h/2+21+i*21,line,15,'#344a62',anchor='middle')
        else:
            self.elements.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="11" fill="{fill}" stroke="{stroke}" stroke-width="1.7"/>')
            self.text(x+16,y+29,title,19,'#172c46','700')
            for i,line in enumerate(lines): self.text(x+16,y+55+i*22,line,16,'#344a62')
    def port(self,id,side):
        x,y,w,h=self.nodes[id]
        return {'t':(x+w/2,y),'b':(x+w/2,y+h),'l':(x,y+h/2),'r':(x+w,y+h/2)}[side]
    def arrow(self,a,b,label='',s='b',t='t',via=(),dashed=False,labelpos=None,color='#657a92'):
        pts=[self.port(a,s),*via,self.port(b,t)]
        path='M'+' L'.join(f'{x},{y}' for x,y in pts)
        dash=' stroke-dasharray="7 5"' if dashed else ''
        self.edges.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.9"{dash} marker-end="url(#arrow)"/>')
        if label:
            x,y=labelpos if labelpos else ((pts[0][0]+pts[-1][0])/2,(pts[0][1]+pts[-1][1])/2-8)
            width=len(label)*8+14
            self.edges.append(f'<rect x="{x-width/2}" y="{y-15}" width="{width}" height="22" rx="4" fill="white" fill-opacity=".95"/><text x="{x}" y="{y+1}" text-anchor="middle" font-size="14" fill="{color}">{escape(label)}</text>')
    def note(self,y,lines):
        for i,line in enumerate(lines): self.text(50,y+i*22,line,15,'#51657d')
    def save(self,mmd):
        header=f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="{self.h}" viewBox="0 0 1600 {self.h}" role="img" aria-labelledby="title desc"><title id="title">{escape(self.title)}</title><desc id="desc">{escape(self.subtitle)}</desc><defs><marker id="arrow" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#657a92"/></marker></defs><rect width="1600" height="{self.h}" fill="white"/><g font-family="Segoe UI, Arial, sans-serif">'
        intro=f'<text x="50" y="53" font-size="30" font-weight="700" fill="#172c46">{escape(self.title)}</text><text x="50" y="84" font-size="17" fill="#536b83">{escape(self.subtitle)}</text>'
        footer=f'<text x="50" y="{self.h-24}" font-size="13" fill="#6a7d91">DITO NA PO • Source: dito-na-po-wa - backup (5).zip • Static code and migration review • 21 October 2026</text></g></svg>'
        (OUT/(self.filename+'.svg')).write_text(header+intro+''.join(self.backgrounds)+''.join(self.edges)+''.join(self.elements)+footer,encoding='utf-8')
        (OUT/(self.filename+'.mmd')).write_text(mmd.strip()+'\n',encoding='utf-8')
        return {'file':self.filename,'title':self.title,'subtitle':self.subtitle}

pages=[]
d=Diagram('01-system-architecture','System Architecture','Web applications, cloud services, and onboard hardware — connections found in the archive.',1190)
d.panel(35,120,1030,310,'WEB APPLICATIONS & SHARED ASSETS','blue')
d.box('p',65,180,300,100,'Passenger web app',['React + Vite','Trip planning, QR pass, live map'])
d.box('o',415,180,300,100,'Personnel / admin app',['React + Vite','Duty trips, QR scans, reporting'])
d.box('s',765,180,270,100,'Shared JavaScript',['Stops + direction + QR rules','Queue prediction lookups'],'purple')
d.box('m',65,320,300,80,'Map / ETA services',['Leaflet + OSM; optional Google'],'gray')
d.box('rf',765,320,270,80,'Offline model training',['Random Forest → static assets'],'purple')
d.arrow('rf','s','generated data',labelpos=(900,307),s='t',t='b')
d.arrow('p','m',s='b',t='t')
d.panel(35,455,1030,310,'SUPABASE CLOUD','green')
d.box('auth',65,510,270,85,'Authentication',['Accounts, sessions, profiles'],'green')
d.box('data',390,510,300,85,'Data API + RPC',['Journeys, trips, boarding, admin'],'green')
d.box('rt',745,510,290,85,'Realtime',['Location and journey changes'],'green')
d.box('db',65,650,970,85,'PostgreSQL',['Operational tables + boarding events + trip_occupancy view + GPS history / current location'],'green')
d.arrow('p','auth','Auth',s='l',via=((50,230),(50,445),(200,445)),labelpos=(135,444))
d.arrow('o','data','Data / RPC',via=((565,445),(540,445)),labelpos=(540,444))
d.arrow('p','data','Data / RPC',s='r',t='t',via=((378,230),(378,480),(540,480)),labelpos=(460,479))
d.arrow('auth','db',t='t',via=((200,620),(550,620)))
d.arrow('data','db')
d.arrow('db','rt','change feed',s='r',t='b',via=((1050,692),(1050,620),(890,620)),labelpos=(963,620))
d.arrow('rt','o','subscriptions / polling',s='t',t='r',via=((890,480),(1090,480),(1090,230)),labelpos=(1090,380),dashed=True)
d.panel(1110,120,455,645,'ADDITIONAL REST BACKEND','gray')
d.box('api',1140,185,395,150,'FastAPI /api/v1',['Auth, routes, stops, schedules','Buses, trips, import, health','SQLAlchemy + Pydantic'],'gray')
d.box('adb',1140,420,395,105,'Configured SQL database',['DATABASE_URL','Deployment target is configurable'],'gray')
d.arrow('api','adb','SQLAlchemy',labelpos=(1337,382))
d.text(1140,580,'api.js clients exist in both web apps.',16)
d.text(1140,610,'Supabase and FastAPI are separate',16)
d.text(1140,634,'code paths in the supplied archive.',16)
d.arrow('o','api','REST clients',s='t',t='l',via=((565,165),(1120,165),(1120,260)),dashed=True,labelpos=(1040,165))
d.panel(35,800,1530,275,'ONBOARD BUS SYSTEM','orange')
d.box('gps',65,875,235,90,'USB GPS receiver',['Serial NMEA readings'],'orange')
d.box('pi3',350,855,330,130,'Raspberry Pi 3B',['GPSReader → TripTracker','Audio + display + local HTTP API','English / Tagalog announcements'],'orange')
d.box('pi4',745,855,330,130,'Raspberry Pi 4B bridge',['UDP GPS receiver → cloud upload','HTTP trip / direction relay','Cloud command polling fallback'],'orange')
d.box('edge',1150,855,380,130,'Supabase Edge Functions',['ingest-gps: device + GPS checks','bus-direction: command endpoint','device_keys + bus_commands'],'green')
d.arrow('gps','pi3','serial',s='r',t='l',labelpos=(325,904))
d.arrow('pi3','pi4','UDP / JSON',s='r',t='l',labelpos=(711,904))
d.arrow('pi4','pi3','HTTP control',s='b',t='b',via=((910,1025),(515,1025)),labelpos=(710,1023))
d.arrow('pi4','edge','HTTPS',s='r',t='l',labelpos=(1110,904))
d.arrow('edge','db','GPS writes / command reads',s='t',t='r',via=((1340,780),(1080,780),(1080,692)),labelpos=(1325,784))
d.arrow('o','pi4','local HTTP control',s='l',t='t',via=((390,230),(390,790),(910,790)),dashed=True,labelpos=(665,787))
d.note(1100,['Cloud arrows summarize data paths; Realtime also supplies the passenger app. Dashed lines indicate alternate or summarized connections.', 'The bus-direction endpoint and device poller exist; a web-app call to that cloud endpoint was not found. Runtime deployment was not verified.'])
pages.append(d.save('''flowchart TB
  subgraph WEB[Web applications]
    P[Passenger app: React + Vite]
    O[Personnel and admin app: React + Vite]
    S[Shared stops, direction validation, QR utilities]
    RF[Offline Random Forest training] --> AS[Static prediction assets]
    AS --> S
    P --> S
    O --> S
    P --> MAP[Leaflet / OpenStreetMap; optional Google ETA]
  end
  subgraph CLOUD[Supabase]
    A[Auth and profiles]
    D[Data API and RPC]
    DB[(PostgreSQL operational database)]
    RT[Realtime]
    E[ingest-gps Edge Function]
    C[bus-direction Edge Function]
    A --> DB
    D --> DB
    E --> DB
    C --> DB
    DB --> RT
  end
  P --> A
  O --> A
  P --> D
  O --> D
  RT --> P
  RT --> O
  subgraph BUS[Onboard bus]
    G[USB GPS receiver] -->|Serial NMEA| PI3[Pi 3B: GPSReader, TripTracker, AudioManager, DisplayState]
    PI3 --> AUDIO[Speaker and screen]
    PI3 -->|UDP JSON| PI4[Pi 4B bridge]
    PI4 -->|HTTP trip control| PI3
  end
  O -->|Local HTTP bridge| PI4
  PI4 -->|HTTPS GPS upload| E
  PI4 -.->|Poll cloud commands| C
  subgraph REST[Additional REST backend]
    F[FastAPI routers + Pydantic + SQLAlchemy] --> SQL[(Configured DATABASE_URL)]
  end
  P -.->|api.js REST client| F
  O -.->|api.js REST client| F
'''))

d=Diagram('02-process-passenger-boarding','Process Diagram · Passenger Journey & Boarding','From journey planning and QR issuance to boarding, alighting, and feedback.',1270)
for x,w,label,c in [(35,460,'PASSENGER APP','blue'),(540,510,'PERSONNEL APP','orange'),(1095,470,'SHARED JOURNEY STATE','green')]:d.panel(x,120,w,1000,label,c)
d.box('select',65,175,400,90,'Choose a journey',['Select origin, destination, direction'])
d.box('party',65,310,400,105,'Enter passenger details',['Category + companions + party count','Check active journey / stop selection'])
d.box('save',65,460,400,105,'Save passenger journey',['Generate daily pass ID + QR payload','Persist journey; test mode can save locally'])
d.box('show',65,610,400,90,'Show / download QR pass',['Journey state: planned'])
d.box('track',65,825,400,110,'Track the journey',['Bus map + seat availability + status','Realtime subscriptions and polling'])
d.box('start',575,175,440,90,'Start / resume duty trip',['Assign bus + staff; send direction to bridge'],'orange')
d.box('scan',575,310,440,90,'Scan QR / enter pass code',['Scanner requires an active operational trip'],'orange')
d.box('valid',615,440,360,120,'Pass valid?', ['Registry + direction checks'],'orange',True)
d.box('state',615,610,360,115,'Already boarded?',[],'orange',True)
d.box('board',575,795,200,120,'Board',['Check seat limits','Record board event'],'orange')
d.box('alight',815,795,200,120,'Alight',['Record alight event','Restore seat count'],'orange')
d.box('error',1125,445,410,110,'Reject / show error',['Unknown pass, no active trip,','wrong direction, or capacity limit'],'red')
d.box('sync',1125,795,410,120,'Update journey + occupancy',['boarded / completed','Persist events; refresh onboard totals','Notify app views / refresh registry'],'green')
d.box('feedback',1125,975,410,90,'Journey history & feedback',['Passenger reviews completed journey'],'green')
d.arrow('select','party');d.arrow('party','save');d.arrow('save','show');d.arrow('show','track')
d.arrow('start','scan');d.arrow('show','scan','present QR',s='r',t='l',via=((515,655),(515,355)),labelpos=(510,580))
d.arrow('scan','valid');d.arrow('valid','state','Yes',labelpos=(795,589))
d.arrow('valid','error','No',s='r',t='l',labelpos=(1050,484))
d.arrow('state','board','No',s='b',t='t',via=((795,760),(675,760)),labelpos=(675,756))
d.arrow('state','alight','Yes',s='r',t='t',via=((1030,667),(1030,760),(915,760)),labelpos=(981,756))
d.arrow('board','sync',s='b',t='b',via=((675,950),(1330,950)),label='event + status',labelpos=(905,948))
d.arrow('alight','sync',s='r',t='l')
d.arrow('sync','feedback')
d.arrow('sync','track','refresh UI',s='b',t='b',via=((1330,1090),(265,1090)),labelpos=(680,1088),dashed=True)
d.note(1155,['Board and alight are alternative actions: the scanner uses the current journey state to choose the event type.', 'The code also supports manual registration, destination-based alighting, and local test fallbacks; these are summarized here.', 'Capacity and category checks vary by personnel screen. A QR pass represents a party; occupancy counts its passenger_count.'])
pages.append(d.save('''flowchart TB
  subgraph Passenger
    A[Select origin, destination and direction] --> B[Enter category and companions]
    B --> C[Generate pass ID and QR payload]
    C --> D[Save planned journey: Supabase or local test fallback]
    D --> E[Display or download QR pass]
  end
  subgraph Personnel
    F[Start or resume duty trip; bus and staff assignment] --> G[Start announcer through local bridge]
    G --> H[Scan QR or enter pass code]
    E --> H
    H --> I{Active trip, recognized pass and valid direction?}
    I -->|No| X[Show error]
    I -->|Yes| J{Already boarded?}
    J -->|No| K{Boarding capacity checks pass?}
    K -->|No| X
    K -->|Yes| L[Record board event; mark journey boarded]
    J -->|Yes| M[Record alight event; mark journey completed]
  end
  L --> N[Update occupancy and refresh registry]
  M --> N
  N --> O[Passenger app receives status, location and seat updates]
  O --> P[Journey history and feedback]
'''))

d=Diagram('03-process-gps-announcements','Process Diagram · GPS Tracking & Announcements','One accepted GPS fix feeds an onboard state machine and a separate cloud tracking path.',1270)
d.panel(35,120,740,1000,'LOCAL ONBOARD PATH · PI 3B','orange');d.panel(820,120,745,1000,'CLOUD TRACKING PATH · PI 4B + SUPABASE','green')
d.box('gps',205,170,400,85,'Read GPS fix',['USB serial → NMEA latitude / longitude'],'orange')
d.box('filter',225,300,360,110,'Fix accepted?',['Valid fix + GPS jump filter'],'orange',True)
d.box('wait',65,465,280,85,'Wait for next GPS fix',['No fix / rejected jump'],'gray')
d.box('active',400,465,330,110,'Trip active?',['GPS still updates when idle'],'orange',True)
d.box('distance',400,620,330,90,'Calculate stop distance',['Haversine distance in route order'],'orange')
d.box('phase',65,770,665,115,'Advance trip state machine',['waiting → approaching → at_stop → next stop','Default: approach 140 m; arrival 5 m; departure 20 m','Pass detection can advance a missed stop; stop overrides apply'],'orange')
d.box('audio',65,940,310,100,'Play announcement',['English / Tagalog audio queue','Approaching, here, next'],'orange')
d.box('display',420,940,310,100,'Update screen / state',['Current stop + GPS + trip phase','Last stop → trip_complete'],'orange')
d.box('udp',865,170,650,85,'Receive UDP JSON on Pi 4B',['Pi4Sender sends accepted coordinates; bridge receives packets'],'green')
d.box('upload',865,310,650,85,'Upload to ingest-gps Edge Function',['HTTPS POST with x-device-key'],'green')
d.box('check',1010,440,360,120,'Packet accepted?',['Key, rate, position, time'],'green',True)
d.box('reject',865,620,270,100,'Return error',['Validation failure:','do not write location'],'red')
d.box('history',1200,620,315,90,'Insert GPS history',['bus_locations'],'green')
d.box('latest',1200,770,315,90,'Upsert latest location',['bus_current_location'],'green')
d.box('realtime',865,940,650,100,'Refresh live maps',['Supabase Realtime + client polling','Passenger app and personnel dashboard'],'green')
d.arrow('gps','filter');d.arrow('filter','wait','No',s='l',t='t',via=((160,355),(160,435),(205,435)),labelpos=(165,432))
d.arrow('filter','active','Yes',s='r',t='t',via=((650,355),(650,435),(565,435)),labelpos=(650,432))
d.arrow('active','distance','Yes',labelpos=(565,605))
d.arrow('active','wait','No',s='l',t='r',labelpos=(372,504))
d.arrow('distance','phase',t='r',s='b',via=((565,740),(750,740),(750,827)))
d.arrow('phase','audio',s='b',t='t',via=((397,912),(220,912)))
d.arrow('phase','display',s='b',t='t',via=((397,912),(575,912)))
d.arrow('filter','udp','accepted fixes',s='r',t='l',via=((790,355),(790,212)),labelpos=(785,280),dashed=True)
d.arrow('udp','upload');d.arrow('upload','check');d.arrow('check','reject','No',s='l',t='t',via=((1000,500),(1000,590)),labelpos=(1000,587))
d.arrow('check','history','Yes',s='r',t='t',via=((1440,500),(1440,585),(1357,585)),labelpos=(1440,583))
d.arrow('history','latest');d.arrow('latest','realtime',s='b',t='t',via=((1357,902),(1190,902)))
d.note(1150,['The cloud upload and local announcement paths operate independently. Announcements do not require the cloud upload to succeed.', 'Default thresholds come from bus_announcer/config.json; departure is arrival radius (5 m) + depart_extra_m (15 m).', 'ingest-gps writes history and current location in separate operations. The diagram does not imply an atomic transaction.'])
pages.append(d.save('''flowchart TB
  A[Read serial GPS / NMEA] --> B{Valid fix and accepted by jump filter?}
  B -->|No| W[Wait for next fix]
  B -->|Yes| C[Update GPS display]
  C --> D{Trip active?}
  D -->|No| W
  D -->|Yes| E[Calculate Haversine distance to next stop]
  E --> F[waiting: enter approach radius]
  F --> G[approaching: announce approaching except at first stop]
  G --> H{Inside arrival radius?}
  H -->|Yes| I[at_stop: announce here]
  H -->|No, distance exceeds minimum plus pass margin| N[Advance to next stop]
  H -->|No, still approaching| E
  I --> J{Final stop?}
  J -->|Yes| K[Emit trip_complete and return idle]
  J -->|No, bus departs| N
  N --> L[Emit next announcement and set phase waiting]
  L --> E
  B -->|Accepted coordinates| U[Send UDP JSON to Pi 4B bridge]
  U --> V[HTTPS POST to ingest-gps]
  V --> Q{Device key, rate limit, coordinates and timestamp valid?}
  Q -->|No| R[Return error]
  Q -->|Yes| S[Insert bus_locations history]
  S --> T[Upsert bus_current_location]
  T --> Z[Realtime and polling update maps]
'''))

d=Diagram('04-software-component-design','Software Design · Components & Dependencies','Module responsibilities and dependency direction, grouped by application.',1240)
d.panel(35,120,740,420,'REACT APPLICATIONS','blue')
d.box('pui',65,175,325,140,'Passenger UI',['App + AuthContext','StartTripInterface','InteractiveMap + StopQueuePredictor'])
d.box('oui',420,175,325,140,'Personnel / admin UI',['ProtectedRoute + AuthContext','RouteInformation + PassengerCheckIn','Admin pages + daily summary'])
d.box('ps',65,380,325,110,'Passenger services',['supabaseClient + api.js','geoUtils + QR generator','googleMapsService'])
d.box('os',420,380,325,110,'Personnel services',['supabaseClient + api.js','busAnnouncerBridge','PDF report generator'])
d.arrow('pui','ps');d.arrow('oui','os')
d.panel(825,120,740,420,'SHARED DOMAIN RULES & DATA','purple')
d.box('shared',865,175,660,140,'Shared JavaScript modules',['route4Stops: stop order, coordinates, direction validation','qrPassUtils: pass generation, parsing, priority categories','queueAndBoardingService: prediction lookup by stop / period'],'purple')
d.box('assets',865,380,660,110,'Prediction asset pipeline',['train_random_forest.py → shared/data/rfPredictions.js','Precomputed queue / boarding recommendations; browser lookup','Training runs offline; no live inference server is shown in source'],'purple')
d.arrow('assets','shared','static data',s='t',t='b',labelpos=(1195,350))
d.arrow('pui','shared','imports',s='t',t='t',via=((227,166),(1195,166)),labelpos=(700,165))
d.arrow('oui','shared',s='r',t='l')
d.panel(35,590,740,490,'ONBOARD PYTHON MODULES','orange')
d.box('main',65,650,325,105,'main.py orchestration',['Load config + routes; wire callbacks','GPSReader + jump_filter'],'orange')
d.box('tracker',420,650,325,105,'TripTracker',['start_trip / update / end_trip','Distance-based state machine'],'orange')
d.box('out',420,825,325,130,'AudioManager / DisplayState',['Queue bilingual audio + reminders','Thread-safe display snapshot','Screen renders current state'],'orange')
d.box('bridge',65,825,325,130,'Pi4Sender + bridge.py',['UDP transport + HTTP relay','GPS upload + command polling','web.py exposes Pi 3B control API'],'orange')
d.arrow('main','tracker',s='r',t='l');d.arrow('tracker','out','events',labelpos=(582,799));d.arrow('main','bridge','accepted fixes',labelpos=(227,800))
d.panel(825,590,740,490,'SERVER & PERSISTENCE MODULES','green')
d.box('sb',865,650,315,150,'Supabase services',['Auth + Data API + Realtime','SQL RPC + triggers + views','PostgreSQL operational tables','Edge: ingest-gps / bus-direction'],'green')
d.box('fast',1210,650,315,150,'FastAPI backend',['v1 routers → dependencies','Pydantic schemas','SQLAlchemy models / session','Alembic migrations'],'gray')
d.box('persistence',865,885,660,110,'Persistence boundaries',['Supabase migrations define operational relationships and RPCs.','FastAPI uses a configurable DATABASE_URL and its own ORM models.','The archive does not establish a single shared deployment target.'],'gray')
d.arrow('ps','sb','Supabase SDK',s='b',t='t',via=((227,560),(1022,560)),labelpos=(595,557))
d.arrow('os','sb',s='b',t='t',via=((582,575),(1022,575)))
d.arrow('os','bridge','local HTTP',s='l',t='r',via=((405,435),(405,890)),labelpos=(404,580),dashed=True)
d.arrow('sb','persistence');d.arrow('fast','persistence',t='r',via=((1367,840),(1545,840),(1545,940)))
d.note(1120,['Arrows show calls, imports, events, or data production as labeled; this is a component dependency view rather than a class inheritance diagram.', 'api.js REST clients target FastAPI. Supabase service modules directly access cloud services. Local test branches also use browser storage.'])
pages.append(d.save('''flowchart TB
  PUI[Passenger UI: App, AuthContext, StartTripInterface, InteractiveMap, StopQueuePredictor]
  OUI[Personnel UI: ProtectedRoute, AuthContext, RouteInformationPage, PassengerCheckInPage, Admin pages]
  PS[Passenger services: supabaseClient, api.js, geoUtils, QR generator, googleMapsService]
  OS[Personnel services: supabaseClient, api.js, busAnnouncerBridge, pdfReportGenerator]
  SH[Shared: route4Stops, qrPassUtils, queueAndBoardingService]
  PUI --> PS
  OUI --> OS
  PUI --> SH
  OUI --> SH
  TRAIN[train_random_forest.py] --> AS[shared/data/rfPredictions.js]
  AS --> SH
  PS --> SB[Supabase Auth, Data API, RPC and Realtime]
  OS --> SB
  PS -.-> FAST[FastAPI v1 routers and dependencies]
  OS -.-> FAST
  FAST --> SC[Pydantic schemas]
  FAST --> ORM[SQLAlchemy models and database session]
  ORM --> DB[(Configured SQL database)]
  OS --> BR[Pi 4B bridge.py]
  MAIN[Pi 3B main.py] --> GPS[GPSReader + jump_filter]
  GPS --> TRACK[TripTracker]
  TRACK --> AUDIO[AudioManager]
  TRACK --> DISP[DisplayState]
  DISP --> SCREEN[Screen]
  GPS --> SEND[Pi4Sender]
  SEND -->|UDP| BR
  BR -->|HTTP| WEB[Pi 3B web.py API]
  WEB --> TRACK
  BR --> EDGE[ingest-gps / bus-direction Edge Functions]
  EDGE --> SDB[(Supabase PostgreSQL)]
  SB --> SDB
'''))

d=Diagram('05-software-data-design','Software Design · Core Data Relationships','Selected Supabase entities and relationships verified in SQL migrations; fields are abbreviated.',1350)
d.box('route',65,160,350,130,'routes',['PK id • code • name','origin_stop_name / destination_stop_name','est_minutes'],'green')
d.box('stop',65,390,350,130,'stops',['PK id • FK route_id (nullable)','sequence_number • name','latitude • longitude'],'green')
d.box('trip',605,160,380,165,'trips',['PK id • FK bus_id • FK route_id','status • started_at • ended_at','driver / conductor / dispatcher IDs','Staff IDs reference operations_personnel'],'green')
d.box('bus',1190,160,350,130,'buses',['PK id • plate_number (unique)','capacity • status'],'green')
d.box('profile',65,650,350,130,'profiles',['PK/FK id → auth.users','full_name • email • role','Profile of the authenticated user'],'blue')
d.box('journey',605,430,380,190,'passenger_journeys',['PK id • FK passenger_id • FK trip_id','qr_token • origin / destination names','passenger_count • category • companions','status • boarded_at • alighted_at','Optional trip link until assignment'],'blue')
d.box('events',605,765,380,165,'boarding_events',['PK id • FK trip_id • FK bus_id','FK passenger_id • FK journey_id','FK recorded_by → profiles','event_type • method • idempotency_key','is_reversed • reversal_reason'],'orange')
d.box('view',605,1060,380,130,'trip_occupancy (VIEW)',['Derived per trip + bus capacity','SUM party counts: board − alight','Available seats + standing passengers'],'purple')
d.box('device',1190,400,350,105,'device_keys',['PK id • FK bus_id • key_hash','revoked_at'],'orange')
d.box('loc',1190,585,350,105,'bus_locations',['PK id • FK bus_id','Coordinates + recorded_at (history)'],'orange')
d.box('current',1190,770,350,105,'bus_current_location',['PK/FK bus_id → buses','Latest coordinates + updated_at'],'orange')
d.box('commands',1190,955,350,105,'bus_commands',['PK id • FK bus_id','command_type • direction • status'],'orange')
d.box('staff',65,965,350,130,'operations_personnel',['PK id • UNIQUE personnel_id','full_name • personnel_type • is_active','Duty assignments on trips'],'gray')
d.arrow('route','stop','1 → 0..*',labelpos=(240,350))
d.arrow('route','trip','1 → 0..*',s='r',t='l',labelpos=(505,220))
d.arrow('bus','trip','1 → 0..*',s='l',t='r',labelpos=(1085,220))
d.arrow('trip','journey','0..1 trip / journey',labelpos=(795,377))
d.arrow('profile','journey','0..1 profile / journey',s='r',t='l',via=((465,715),(465,525)),labelpos=(484,624))
d.arrow('journey','events','0..1 journey / event',labelpos=(795,697))
d.arrow('trip','events','1 trip / event',s='r',t='r',via=((1060,242),(1060,847)),labelpos=(1060,736))
d.arrow('events','view','derived; excludes reversed events',labelpos=(795,1000),dashed=True)
d.arrow('bus','device','1 → 0..*',labelpos=(1365,350))
d.arrow('bus','loc','1 → 0..*',s='r',t='r',via=((1560,225),(1560,637)),labelpos=(1495,550))
d.arrow('bus','current','1 → 0..1',s='l',t='l',via=((1155,225),(1155,822)),labelpos=(1148,728))
d.arrow('bus','commands','1 → 0..*',s='r',t='r',via=((1575,225),(1575,1007)),labelpos=(1488,920))
d.arrow('staff','trip','3 optional duty links',s='l',t='t',via=((40,1030),(40,125),(795,125)),labelpos=(475,123),dashed=True)
d.note(1230,['PK = primary key; FK = foreign key. Arrows run from parent / source to child / derived view. Cardinality labels describe the relationship.', 'Latest migrations allow anonymous/manual journeys (nullable passenger_id). Trip, journey, and recorder links may also be nullable.', 'For readability, approval tables and some direct event FKs are omitted. Bus and profile event references are listed inside boarding_events.'])
pages.append(d.save('''erDiagram
  AUTH_USERS ||--o| PROFILES : profile
  ROUTES o|--o{ STOPS : contains
  ROUTES ||--o{ TRIPS : schedules
  BUSES ||--o{ TRIPS : operates
  OPERATIONS_PERSONNEL o|--o{ TRIPS : driver
  OPERATIONS_PERSONNEL o|--o{ TRIPS : conductor
  OPERATIONS_PERSONNEL o|--o{ TRIPS : dispatcher
  PROFILES o|--o{ PASSENGER_JOURNEYS : owns
  TRIPS o|--o{ PASSENGER_JOURNEYS : assigned
  TRIPS ||--o{ BOARDING_EVENTS : records
  BUSES ||--o{ BOARDING_EVENTS : vehicle
  PROFILES o|--o{ BOARDING_EVENTS : passenger
  PROFILES o|--o{ BOARDING_EVENTS : recorded_by
  PASSENGER_JOURNEYS o|--o{ BOARDING_EVENTS : journey
  BUSES ||--o{ DEVICE_KEYS : authenticates
  BUSES ||--o{ BUS_LOCATIONS : history
  BUSES ||--o| BUS_CURRENT_LOCATION : latest
  BUSES ||--o{ BUS_COMMANDS : receives
  TRIPS {
    uuid id PK
    uuid bus_id FK
    uuid route_id FK
    text status
    text driver_personnel_id FK
    text conductor_personnel_id FK
    text dispatcher_personnel_id FK
  }
  PASSENGER_JOURNEYS {
    uuid id PK
    uuid passenger_id FK "nullable in latest migrations"
    uuid trip_id FK "nullable"
    text qr_token
    integer passenger_count
    text status
  }
  BOARDING_EVENTS {
    uuid id PK
    uuid trip_id FK
    uuid bus_id FK
    uuid journey_id FK
    text event_type
    text idempotency_key
    boolean is_reversed
  }
'''))

notes='''# DITO NA PO diagrams

Source: `dito-na-po-wa - backup (5).zip`, supplied by the user. These diagrams describe source code and migrations, not a verified running deployment. No application configuration or database was changed.

## Files

1. **01-system-architecture** — applications, cloud services, backend, and onboard hardware.
2. **02-process-passenger-boarding** — planning, QR issuance, scanning, boarding/alighting, and status synchronization.
3. **03-process-gps-announcements** — local GPS announcement path and cloud location path.
4. **04-software-component-design** — component responsibilities and dependencies.
5. **05-software-data-design** — selected Supabase entities and foreign-key relationships.

Each diagram is supplied as SVG (scalable vector), PNG (image), and Mermaid `.mmd` (editable source). SVGs and Mermaid are independently editable representations of the same subject; the Mermaid versions include some finer branches that the presentation SVGs summarize. Open `index.html` for the complete illustrated gallery. Use the browser print command to print one diagram per page.

## Interpretation notes

- The top-level project copy is used. The ZIP also includes an older nested `dito-na-po-wa/` copy with differences, including fewer shared services and Edge Functions. The diagrams do not merge both snapshots.
- Both web apps use Supabase directly. They also contain REST clients for the included FastAPI backend. A single deployment/database shared by those paths cannot be established from the source alone.
- Supabase relationships are based on `supabase/migrations/`, including later changes, rather than treating FastAPI ORM classes as the Supabase schema.
- The local personnel-to-announcer path is `busAnnouncerBridge.js` → Pi 4B `bridge.py` → Pi 3B `web.py` / `TripTracker`. A `bus-direction` cloud endpoint and device poller are included, but no web-app invocation of that cloud endpoint was found.
- Random Forest training produces static JSON/JavaScript prediction assets for browser lookup. The archive does not show an online prediction service.
- Map rendering uses Leaflet/OpenStreetMap. Google Distance Matrix is conditional on the browser SDK being available; ETA calculation has a local fallback.
- GPS thresholds are configurable. The included defaults are approach 140 m, arrive 5 m, depart 20 m (5 + 15), and pass margin 50 m. Individual stops may override them.
- `ingest-gps` authenticates a device, checks rate/coordinates/time, inserts history, and then upserts current location. Those two writes are separate operations.
- Local test branches are present and use browser storage / direct table operations. Production and test behavior should not be assumed identical.
- Current occupancy is defined by the latest `trip_occupancy` view: non-reversed boarding/alighting events weighted by the journey's passenger count, including companions. Frontend priority/regular seat calculations are separate from that view.
- The unified passenger registry migration permits nullable passenger ownership for manual journeys. Local test branches also support anonymous journeys. Optional journey/trip links are represented accordingly. The data diagram is selective, not a complete database schema.

## Source map

All paths below are relative to the top-level project inside the supplied archive.

| Diagram | Main source evidence |
|---|---|
| Architecture | `passenger-app/src/services/{supabaseClient,api,googleMapsService}.js`; `personnel-app/src/services/{supabaseClient,api,busAnnouncerBridge}.js`; `backend/app/main.py`; `backend/app/core/database.py`; `bus_announcer/main.py`; `bus_announcer/raspi4b connec/bridge.py`; `supabase/functions/` |
| Journey and boarding | `passenger-app/src/components/StartTripInterface.jsx`; `personnel-app/src/pages/{PassengerCheckInPage,RouteInformationPage}.jsx`; both `services/supabaseClient.js`; `shared/{qrPassUtils,route4Stops}.js` |
| GPS and announcements | `bus_announcer/{gps_reader,main,tracker,audio_manager,display,sender,web}.py`; `bus_announcer/config.json`; bridge `bridge.py`; `supabase/functions/ingest-gps/index.ts` |
| Software components | Both apps' `src/` trees; `shared/`; `train_random_forest.py`; `backend/app/{api,models,schemas,core}/`; `bus_announcer/` |
| Data relationships | `supabase/migrations/2026100400000{1,2,3,4}_*.sql`; `20261010000001_unified_passenger_registry.sql`; personnel and duty-assignment migrations; `20261018000001_create_bus_commands.sql`; `20261019000004_count_all_passengers_in_occupancy.sql`; `20261019000006_enable_public_test_access.sql` |
'''
(OUT/'README.md').write_text(notes,encoding='utf-8')
(OUT/'manifest.json').write_text(json.dumps(pages,indent=2),encoding='utf-8')
nav=''.join(f'<a href="#{p["file"]}">{escape(p["title"])}</a>' for p in pages)
sections=''.join(f'<section id="{p["file"]}"><div class="links"><a download href="{p["file"]}.svg">SVG</a><a download href="{p["file"]}.png">PNG</a><a download href="{p["file"]}.mmd">Mermaid source</a></div><img src="{p["file"]}.svg" alt="{escape(p["title"])}" /></section>' for p in pages)
(OUT/'index.html').write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DITO NA PO — System Diagrams</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#edf2f7;font-family:Segoe UI,Arial,sans-serif;color:#172c46}}header{{padding:30px 5%;background:#172c46;color:white}}h1{{margin:0 0 10px}}header p{{max-width:1000px;color:#d7e3f0}}nav{{display:flex;gap:12px;flex-wrap:wrap;margin-top:25px}}nav a{{color:white;border:1px solid #60778f;padding:9px 12px;border-radius:7px;text-decoration:none}}main{{padding:28px 3%}}section{{margin:0 auto 32px;background:white;max-width:1600px;border-radius:12px;box-shadow:0 5px 25px #172c4610;overflow:hidden}}img{{display:block;width:100%;height:auto}}.links{{padding:14px 30px;border-bottom:1px solid #e5ebf2;display:flex;gap:25px}}a{{color:#245e9f}}footer{{padding:0 5% 35px}}@media print{{@page{{size:A3 landscape;margin:5mm}}body,main{{margin:0;padding:0;background:white}}header,footer,.links{{display:none}}section{{break-after:page;margin:0;box-shadow:none;border-radius:0}}section:last-child{{break-after:auto}}img{{width:100%;max-height:278mm;object-fit:contain}}}}</style><header><h1>DITO NA PO · System Diagrams</h1><p>Separate architecture, process, and software design diagrams based on the supplied project ZIP. The diagrams reflect source code and SQL migrations; running deployments were not inspected.</p><nav>{nav}</nav></header><main>{sections}</main><footer><a href="README.md">Scope, interpretation notes, and source evidence</a> · Source snapshot: 21 October 2026</footer></html>''',encoding='utf-8')
print(f'Generated {len(pages)} diagrams, Mermaid sources, and gallery in {OUT}')
