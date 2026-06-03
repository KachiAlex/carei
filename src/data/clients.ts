export interface Client {
  id: string
  name: string
  age: number
  address: string
  conditions: string[]
  medications: { name: string; dose: string; frequency: string }[]
  preferences: string
  emergencyContact: string
}

export interface Visit {
  id: string
  clientId: string
  clientName: string
  time: string
  duration: string
  status: 'pending' | 'in-progress' | 'completed' | 'missed'
  tasks: string[]
  flags: string[]
}

export const clients: Client[] = [
  {
    id: 'c1',
    name: 'Mary Johnson',
    age: 82,
    address: '12 Oak Street, Manchester M1 1AA',
    conditions: ['Dementia (moderate)', 'Type 2 diabetes', 'Hypertension'],
    medications: [
      { name: 'Metformin', dose: '500mg', frequency: 'twice daily' },
      { name: 'Amlodipine', dose: '5mg', frequency: 'once daily' },
      { name: 'Donepezil', dose: '10mg', frequency: 'once daily' },
    ],
    preferences: 'Prefers morning visits before 10am. Sundowning from 4pm.',
    emergencyContact: 'Sarah (daughter) — 07700 900001',
  },
  {
    id: 'c2',
    name: 'Tom Adams',
    age: 74,
    address: '45 Pine Road, Leeds LS1 1BB',
    conditions: ['COPD', 'Heart failure', 'Depression'],
    medications: [
      { name: 'Furosemide', dose: '40mg', frequency: 'once daily' },
      { name: 'Bisoprolol', dose: '2.5mg', frequency: 'once daily' },
      { name: 'Sertraline', dose: '50mg', frequency: 'once daily' },
    ],
    preferences: 'Oxygen concentrator in situ. Must check O2 levels.',
    emergencyContact: 'James (son) — 07700 900002',
  },
  {
    id: 'c3',
    name: 'Aisha Khan',
    age: 67,
    address: '8 Maple Lane, Birmingham B1 1CC',
    conditions: ["Parkinson's disease", 'Osteoporosis'],
    medications: [
      { name: 'Levodopa', dose: '100mg', frequency: 'three times daily' },
      { name: 'Calcium + D3', dose: '-', frequency: 'once daily' },
      { name: 'Rivastigmine', dose: '4.6mg patch', frequency: 'daily' },
    ],
    preferences: 'Levodopa timing critical — within 30 min of scheduled time.',
    emergencyContact: 'Ahmed (husband) — 07700 900003',
  },
  {
    id: 'c4',
    name: 'Grace Mensah',
    age: 79,
    address: '3 Birch Close, Glasgow G1 1DD',
    conditions: ['Stroke (right-sided weakness)', 'Dysphagia', 'AF'],
    medications: [
      { name: 'Apixaban', dose: '5mg', frequency: 'twice daily' },
      { name: 'Lansoprazole', dose: '15mg', frequency: 'once daily' },
    ],
    preferences: 'Thickened fluids only (Stage 2). Aspiration risk. Left-handed.',
    emergencyContact: 'Kwame (son) — 07700 900004',
  },
]

export const todayVisits: Visit[] = [
  {
    id: 'v1',
    clientId: 'c1',
    clientName: 'Mary Johnson',
    time: '08:30',
    duration: '45 min',
    status: 'completed',
    tasks: ['Personal care', 'Medication', 'Breakfast prep'],
    flags: [],
  },
  {
    id: 'v2',
    clientId: 'c2',
    clientName: 'Tom Adams',
    time: '10:00',
    duration: '1 hr',
    status: 'in-progress',
    tasks: ['O2 check', 'Medication', 'Mobility support'],
    flags: ['O2 sat below target yesterday'],
  },
  {
    id: 'v3',
    clientId: 'c3',
    clientName: 'Aisha Khan',
    time: '12:00',
    duration: '45 min',
    status: 'pending',
    tasks: ['Medication', 'Meal prep', 'Mobility'],
    flags: [],
  },
  {
    id: 'v4',
    clientId: 'c4',
    clientName: 'Grace Mensah',
    time: '14:00',
    duration: '1 hr',
    status: 'pending',
    tasks: ['Personal care', 'Thickened fluids', 'Medication'],
    flags: ['Thickened fluids only'],
  },
  {
    id: 'v5',
    clientId: 'c1',
    clientName: 'Mary Johnson',
    time: '16:30',
    duration: '30 min',
    status: 'pending',
    tasks: ['Evening check', 'Medication'],
    flags: ['Sundowning risk after 4pm'],
  },
]
