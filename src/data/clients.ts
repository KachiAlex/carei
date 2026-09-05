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
