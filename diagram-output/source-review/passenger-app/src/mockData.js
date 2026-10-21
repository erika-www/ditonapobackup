/**
 * Dito Na Po - Quezon City Bus System Mock Data (JavaScript)
 * Updated with official QC Bus Route 4 stop sequence and updated seat capacities.
 */
import { ROUTE4_STOPS } from '@shared/route4Stops';

// Official 15 Stops list requested by user for Route 4 (QC Hall to General Luis)
export const OFFICIAL_ROUTE4_STOPS = ROUTE4_STOPS;

export const QC_ROUTES = [
  {
    id: 'route-1',
    name: 'Route 1: QC Hall to Cubao',
    code: 'R1',
    color: '#0284c7',
    description: 'Connects Quezon City Hall Main Complex directly to Cubao commercial district and Araneta City.',
    totalDistanceKm: 5.2,
    estMinutes: 22,
    stops: [
      { id: 'stop-r1-1', name: 'Quezon City Hall Gate 3, Kalayaan Ave.' },
      { id: 'stop-r1-2', name: 'Kalayaan Ave. cor. Masigla St.' },
      { id: 'stop-r1-3', name: 'Kalayaan Ave. cor. Kamias Rd. Interchange' },
      { id: 'stop-r1-4', name: 'Barangay Silangan Hall' },
      { id: 'stop-r1-5', name: '15th Ave. cor. Aurora Blvd.' },
      { id: 'stop-r1-6', name: 'Cubao (Araneta City)' }
    ]
  },
  {
    id: 'route-2',
    name: 'Route 2: QC Hall to Litex / IBP Road',
    code: 'R2',
    color: '#16a34a',
    description: 'Traverses Commonwealth Avenue connecting QC Hall to Litex Market & IBP Road.',
    totalDistanceKm: 10.8,
    estMinutes: 38,
    stops: [
      { id: 'stop-r2-1', name: 'Quezon City Hall NHA Interchange' },
      { id: 'stop-r2-2', name: 'Commonwealth Ave. (St. Peter Parish Church)' },
      { id: 'stop-r2-3', name: 'IBP Rd. Maclang General Hospital' },
      { id: 'stop-r2-4', name: 'IBP Rd. Quezon City University – Batasan Hills' },
      { id: 'stop-r2-5', name: 'IBP Rd. Litex' }
    ]
  },
  {
    id: 'route-3',
    name: 'Route 3: Welcome Rotonda to Aurora Katipunan',
    code: 'R3',
    color: '#eab308',
    description: 'Express line connecting Welcome Rotonda along Quezon Avenue and Aurora Boulevard to Katipunan.',
    totalDistanceKm: 7.5,
    estMinutes: 28,
    stops: [
      { id: 'stop-r3-1', name: 'Welcome Rotonda cor. E. Rodriguez Sr. Ave.' },
      { id: 'stop-r3-2', name: 'E. Rodriguez Sr. Ave. cor. Araneta Ave. — Quezon Institute (Q.I.)' },
      { id: 'stop-r3-3', name: 'E. Rodriguez Sr. Ave. — St. Luke\'s / National Children\'s Hospital' },
      { id: 'stop-r3-4', name: 'E. Rodriguez Sr. Ave. cor. Gilmore Interchange' },
      { id: 'stop-r3-5', name: 'Kamuning Rd. Delgado Hospital (Kamuning Market)' },
      { id: 'stop-r3-6', name: 'Kamuning Rd. K-E St.' },
      { id: 'stop-r3-7', name: 'Kamias Rd. EDSA' },
      { id: 'stop-r3-8', name: 'Kalayaan Ave. cor. Kamias Interchange' },
      { id: 'stop-r3-9', name: 'Kamias Rd. cor. Anonas' },
      { id: 'stop-r3-10', name: 'Anonas Rd. Chico St.' },
      { id: 'stop-r3-11', name: 'Aurora Blvd. LRT 2 Anonas Station' },
      { id: 'stop-r3-12', name: 'Aurora Blvd. J.P. Rizal St.' },
      { id: 'stop-r3-13', name: 'Aurora Blvd. LRT 2 Katipunan Station' }
    ]
  },
  {
    id: 'route-4',
    name: 'Route 4: QC Hall to General Luis',
    code: 'R4',
    color: '#8b5cf6',
    description: 'Major arterial route linking QC Hall, Mindanao Avenue, QCU Main Campus, SM Novaliches, and General Luis.',
    totalDistanceKm: 14.5,
    estMinutes: 45,
    stops: OFFICIAL_ROUTE4_STOPS
  },
  {
    id: 'route-5',
    name: 'Route 5: QC Hall to Mindanao Ave. via Visayas Ave.',
    code: 'R5',
    color: '#ec4899',
    description: 'Connecting QC Hall via Visayas Avenue and Mindanao Avenue to Quirino Highway.',
    totalDistanceKm: 11.2,
    estMinutes: 35,
    stops: [
      { id: 'stop-r5-1', name: 'Quezon City Hall NHA Interchange' },
      { id: 'stop-r5-2', name: 'Visayas Ave. – Central Ave.' },
      { id: 'stop-r5-3', name: 'Visayas Ave. – Vargas St.' },
      { id: 'stop-r5-4', name: 'Congressional Ave. – Visayas Ave.' },
      { id: 'stop-r5-5', name: 'Congressional Ave. – Circle C' },
      { id: 'stop-r5-6', name: 'Mindanao Ave. – Congressional Ave.' },
      { id: 'stop-r5-7', name: 'Tandang Sora Ave.' },
      { id: 'stop-r5-8', name: 'D. Muñoz St.' },
      { id: 'stop-r5-9', name: 'Old Sauyo Rd. Footbridge' },
      { id: 'stop-r5-10', name: 'Mindanao Ave. – Quirino Highway Interchange' }
    ]
  },
  {
    id: 'route-6',
    name: 'Route 6: QC Hall to Gilmore',
    code: 'R6',
    color: '#f97316',
    description: 'Connecting QC Hall through E. Rodriguez Avenue to Gilmore LRT-2 Station.',
    totalDistanceKm: 8.4,
    estMinutes: 30,
    stops: [
      { id: 'stop-r6-1', name: 'Quezon City Hall NHA Interchange' },
      { id: 'stop-r6-2', name: 'Quezon Ave. (Philippine Children\'s Medical Center)' },
      { id: 'stop-r6-3', name: 'Quezon Ave. – EDSA' },
      { id: 'stop-r6-4', name: 'Quezon Ave. cor. Examiner St.' },
      { id: 'stop-r6-5', name: 'Quezon Ave. (Delta) – Panay Ave.' },
      { id: 'stop-r6-6', name: 'Timog Ave. – Sct. Tuason St.' },
      { id: 'stop-r6-7', name: 'Tomas Morato Ave. – Sct. Limbaga St.' },
      { id: 'stop-r6-8', name: 'Tomas Morato Ave. – Sct. Lozano St.' },
      { id: 'stop-r6-9', name: 'Don A. Roces Ave. – Don Alejandro Roces Sr. Science – Technological High School' },
      { id: 'stop-r6-10', name: 'Sct. Reyes St. – District 4 Action Center' },
      { id: 'stop-r6-11', name: 'Sct. Chuatoco Ave. – Sct. Tobias St.' },
      { id: 'stop-r6-12', name: 'E. Rodriguez Sr. Ave. cor. Gilmore (Interchange)' },
      { id: 'stop-r6-13', name: 'Gilmore Ave. cor. Aurora Blvd.' },
      { id: 'stop-r6-14', name: 'Aurora Blvd. (Hemady St.)' }
    ]
  },
  {
    id: 'route-7',
    name: 'Route 7: QC Hall to C5 / Ortigas Ave. Ext.',
    code: 'R7',
    color: '#06b6d4',
    description: 'Connecting QC Central Corridor via Katipunan Avenue to C5 and Ortigas Avenue Extension.',
    totalDistanceKm: 9.8,
    estMinutes: 32,
    stops: [
      { id: 'stop-r7-1', name: 'Quezon Hall NHA Interchange' },
      { id: 'stop-r7-2', name: 'C.P. Garcia Ave. (Krus na Ligas)' },
      { id: 'stop-r7-3', name: 'Katipunan Ave. (Sta. Maria Della Strada Parish)' },
      { id: 'stop-r7-4', name: 'Katipunan Ave. (Ateneo de Manila Gate 3)' },
      { id: 'stop-r7-5', name: 'Aurora Blvd. cor. Katipunan Ave. (Interchange)' },
      { id: 'stop-r7-6', name: 'Katipunan Ave. P. Tuazon Ave. (Quirino Memorial Medical Center)' },
      { id: 'stop-r7-7', name: 'Katipunan Ave. cor. Boni Serrano Ave.' },
      { id: 'stop-r7-8', name: 'E. Rodriguez Jr. Ave. / Eastwood City' },
      { id: 'stop-r7-9', name: 'E. Rodriguez Jr. Ave. cor. Green Meadows Ave.' },
      { id: 'stop-r7-10', name: 'E. Rodriguez Jr. Ave. cor. Ortigas Ave. (Fly-over)' }
    ]
  },
  {
    id: 'route-8',
    name: 'Route 8: QC Hall to Muñoz',
    code: 'R8',
    color: '#14b8a6',
    description: 'Connecting QC Hall, North Avenue, TriNoma, SM North EDSA, and Roosevelt / Muñoz interchange.',
    totalDistanceKm: 4.1,
    estMinutes: 18,
    stops: [
      { id: 'stop-r8-1', name: 'Quezon City Hall NHA Interchange' },
      { id: 'stop-r8-2', name: 'North Ave. Veterans Hospital' },
      { id: 'stop-r8-3', name: 'North Ave. Philippine Medical Association / MRT-3 Trinoma Mall' },
      { id: 'stop-r8-4', name: 'Congressional Ave. cor. Abra St.' },
      { id: 'stop-r8-5', name: 'Barangay Ramon Magsaysay Hall' },
      { id: 'stop-r8-6', name: 'Corregidor St. cor. Ilocos Sur St.' },
      { id: 'stop-r8-7', name: 'SM City North EDSA – Quezon City University (San Francisco High School)' },
      { id: 'stop-r8-8', name: 'North Ave. Vertis North' }
    ]
  }
];

// Updated Capacities: Priority Seats: 20, Regular Seats: 35, Standing: 15
export const MOCK_BUS_FLEET = {
  'route-4': {
    busId: 'BUS-QC-402',
    plateNumber: 'QC-BUS-0402 (NKG-6611)',
    routeId: 'route-4',
    prioritySeatsAvailable: 14,
    prioritySeatsTotal: 20,
    regularSeatsAvailable: 22,
    regularSeatsTotal: 35,
    standingAvailable: 10,
    standingTotal: 15,
    driverName: 'Danilo Aquino',
    currentLat: 14.66869,
    currentLng: 121.03358
  },
  'route-1': {
    busId: 'BUS-QC-101',
    plateNumber: 'QC-BUS-0101 (NKG-8821)',
    routeId: 'route-1',
    prioritySeatsAvailable: 16,
    prioritySeatsTotal: 20,
    regularSeatsAvailable: 25,
    regularSeatsTotal: 35,
    standingAvailable: 12,
    standingTotal: 15,
    driverName: 'Ramon Dela Cruz',
    currentLat: 14.649,
    currentLng: 121.046
  },
  'route-2': {
    busId: 'BUS-QC-204',
    plateNumber: 'QC-BUS-0204 (NKG-9943)',
    routeId: 'route-2',
    prioritySeatsAvailable: 10,
    prioritySeatsTotal: 20,
    regularSeatsAvailable: 18,
    regularSeatsTotal: 35,
    standingAvailable: 8,
    standingTotal: 15,
    driverName: 'Jose Santos',
    currentLat: 14.667,
    currentLng: 121.071
  }
};

export const LANDMARK_SPOTS = [
  {
    id: 'lm-qmc',
    name: 'Quezon Memorial Circle',
    category: 'Tourist Spot',
    nearestStop: 'Quezon City Hall – NHA Interchange',
    routeId: 'route-4',
    address: 'Elliptical Road, Diliman, Quezon City',
    description: 'National park and shrine dedicated to President Manuel L. Quezon.'
  },
  {
    id: 'lm-pcm',
    name: 'Presidential Car Museum',
    category: 'Tourist Spot',
    nearestStop: 'Quezon City Hall – NHA Interchange',
    routeId: 'route-4',
    address: 'Quezon Memorial Circle, Elliptical Road, Diliman, Quezon City',
    description: 'Historical museum showcasing official presidential cars and historic state vehicles of Philippine presidents.'
  },
  {
    id: 'lm-vmmc',
    name: 'Veterans Memorial Medical Center',
    category: 'Hospital',
    nearestStop: 'North Avenue – Veterans Hospital / Vertis North',
    routeId: 'route-4',
    address: 'North Avenue, Diliman, Quezon City',
    description: 'Major government tertiary hospital providing comprehensive medical services to military veterans and civilians.'
  },
  {
    id: 'lm-smnorth',
    name: 'SM City North EDSA',
    category: 'Mall',
    nearestStop: 'North Avenue – Veterans Hospital / Vertis North',
    routeId: 'route-8',
    address: 'North Avenue corner EDSA, Quezon City',
    description: 'One of the largest shopping complexes in Southeast Asia with extensive retail, dining, and entertainment spaces.'
  },
  {
    id: 'lm-trinoma',
    name: 'TriNoma',
    category: 'Mall',
    nearestStop: 'North Avenue – Veterans Hospital / Vertis North',
    routeId: 'route-8',
    address: 'North Avenue corner EDSA, Quezon City',
    description: 'Premier shopping center and public transportation interchange connecting MRT-3 and bus lines.'
  },
  {
    id: 'lm-vertis',
    name: 'Vertis North',
    category: 'Mall',
    nearestStop: 'North Avenue – Veterans Hospital / Vertis North',
    routeId: 'route-4',
    address: 'North Avenue, Vertis North Estate, Quezon City',
    description: 'Modern mixed-use urban estate featuring high-rise commercial buildings, retail, and green open gardens.'
  },
  {
    id: 'lm-mnmch',
    name: 'Metro North Medical Center and Hospital',
    category: 'Hospital',
    nearestStop: 'Mindanao Avenue corner Congressional Avenue',
    routeId: 'route-4',
    address: 'Mindanao Avenue, Project 8, Quezon City',
    description: 'Advanced private medical facility offering specialized healthcare, surgical services, and 24/7 emergency care.'
  },
  {
    id: 'lm-pgmc',
    name: 'Pacific Global Medical Center',
    category: 'Hospital',
    nearestStop: 'Mindanao Avenue corner Tandang Sora Avenue',
    routeId: 'route-4',
    address: 'Mindanao Avenue, Tandang Sora, Quezon City',
    description: 'Modern tertiary hospital serving northern Quezon City with comprehensive diagnostic and clinical services.'
  },
  {
    id: 'lm-bgh',
    name: 'Bernardino General Hospital',
    category: 'Hospital',
    nearestStop: 'Mindanao Avenue corner Quirino Highway – Interchange',
    routeId: 'route-4',
    address: 'Quirino Highway, San Bartolome, Novaliches, Quezon City',
    description: 'Established community hospital providing quality inpatient, outpatient, and maternity care in Novaliches.'
  },
  {
    id: 'lm-qcu',
    name: 'Quezon City University Main Campus',
    category: 'University',
    nearestStop: 'Quezon City University Main Campus / Novaliches District Hospital',
    routeId: 'route-4',
    address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City',
    description: 'Premier local government university providing quality higher education and technical programs.'
  },
  {
    id: 'lm-ndh',
    name: 'Novaliches District Hospital',
    category: 'Hospital',
    nearestStop: 'Quezon City University Main Campus / Novaliches District Hospital',
    routeId: 'route-4',
    address: 'Quirino Highway, San Bartolome, Novaliches, Quezon City',
    description: 'Public district hospital operated by Quezon City Government providing essential community healthcare.'
  },
  {
    id: 'lm-smnova',
    name: 'SM City Novaliches',
    category: 'Mall',
    nearestStop: 'Quirino Highway – SM City Novaliches',
    routeId: 'route-4',
    address: 'Quirino Highway, San Bartolome, Novaliches, Quezon City',
    description: 'Major shopping mall, dining hub, and public transport terminal serving Novaliches residents.'
  },
  {
    id: 'lm-stinova',
    name: 'STI College Novaliches',
    category: 'University',
    nearestStop: 'Mindanao Avenue corner Quirino Highway – Interchange',
    routeId: 'route-4',
    address: 'Quirino Highway, Novaliches, Quezon City',
    description: 'Higher educational institution offering degrees in Information Technology, Business, and Arts.'
  },
  {
    id: 'lm-ngh',
    name: 'Novaliches General Hospital',
    category: 'Hospital',
    nearestStop: 'General Luis Avenue – Novaliches Bayan',
    routeId: 'route-4',
    address: 'General Luis Street, Novaliches Bayan, Quezon City',
    description: 'Community hospital offering general medicine, pediatrics, and emergency care services.'
  },
  {
    id: 'lm-novaplaza',
    name: 'Nova Plaza Mall',
    category: 'Mall',
    nearestStop: 'General Luis Avenue – Novaliches Bayan',
    routeId: 'route-4',
    address: 'Novaliches Bayan Commercial Center, Quezon City',
    description: 'Bustling commercial complex in Novaliches Bayan housing retail stores, services, and eateries.'
  },
  {
    id: 'lm-savemore',
    name: 'Savemore Market Novaliches',
    category: 'Landmark',
    nearestStop: 'General Luis Avenue – Novaliches Bayan',
    routeId: 'route-4',
    address: 'General Luis Street, Novaliches Bayan, Quezon City',
    description: 'Popular supermarket offering convenient daily grocery shopping for Novaliches commuters.'
  },
  {
    id: 'lm-novadeci',
    name: 'NOVADECI Convention Center',
    category: 'Government Office',
    nearestStop: 'General Luis Avenue corner Banahaw Street',
    routeId: 'route-4',
    address: 'General Luis Street, Novaliches, Quezon City',
    description: 'Prominent community and event hall hosting seminars, civic assemblies, and cooperative functions.'
  }
];

export const MOCK_NOTIFICATIONS = [];

export const MOCK_TRIP_HISTORY = [];

