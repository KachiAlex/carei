// Demo Data - Matching CAREi_Features.md specification
// Demo accounts: Sarah O'Brien (Carer), Alex Morgan (Manager)
// Clients: Mary Johnson, Tom Adams, Aisha Khan

import type { Client, Carer, User } from '../types'

export const COLORS = {
  navy: '#1B2A49',
  darkNavy: '#0F1D34',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
}

// Demo Carer Account (from document)
export const DEMO_CARER: User = {
  id: 'c1',
  name: 'Sarah O\'Brien',
  email: 'sarah@adjoy.co.uk',
  agency: 'Adjoy Healthcare',
  role: 'carer',
  pin: '1234',
  initials: 'SO',
  status: 'active',
  lastActive: 'Today, 10:02',
  visits: 142,
  compliance: 97,
}

// Demo Manager Account (from document)
export const DEMO_MANAGER: User = {
  id: 'm1',
  name: 'Alex Morgan',
  email: 'alex@adjoy.co.uk',
  agency: 'Adjoy Healthcare',
  role: 'manager',
  pin: '1234',
  initials: 'AM',
  status: 'active',
  lastActive: 'Today, 09:45',
  visits: 0,
  compliance: 100,
}

// Demo Carers for Manager Portal
export const DEMO_CARERS: Carer[] = [
  { id: 'c1', name: 'Sarah O\'Brien', email: 'sarah.obrien@agency.com', role: 'Senior Carer', status: 'active', lastActive: 'Today, 10:02', visits: 142, initials: 'SO', dbs: 'Mar 2027', compliance: 97 },
  { id: 'c2', name: 'John Mensah', email: 'john.mensah@agency.com', role: 'Carer', status: 'active', lastActive: 'Today, 08:45', visits: 98, initials: 'JM', dbs: 'Sep 2026', compliance: 91 },
  { id: 'c3', name: 'Amina Diallo', email: 'amina.diallo@agency.com', role: 'Care Assistant', status: 'active', lastActive: 'Yesterday', visits: 67, initials: 'AD', dbs: 'Jun 2027', compliance: 88 },
  { id: 'c4', name: 'Priya Sharma', email: 'priya.sharma@agency.com', role: 'Carer', status: 'invited', lastActive: '—', visits: 0, initials: 'PS', dbs: '—', compliance: 0 },
]

// Client 1: Mary Johnson (Dementia, Osteoporosis, Hypothyroidism)
export const MARY_JOHNSON: Client = {
  id: 'mary',
  name: 'Mary Johnson',
  age: 82,
  address: '4 Birch Close, Reading RG2 7LN',
  emoji: '👩🏼',
  time: '09:00 – 10:00',
  condition: 'Dementia',
  tags: ['Dementia', 'Medication Required'],
  gp: 'Dr A. Patel · Earley Surgery',
  allergy: 'None known',
  supportLevel: 'Full physical assistance + 1-to-1 supervision throughout',
  framework: 'Person-Centred · PBS · Dementia Care Mapping (DCM)',
  communication: 'Use simple words and short sentences. Validate feelings, never argue or correct. Approach from the front, maintain eye contact. Mary may not recognise you, introduce yourself each visit.',
  mobilityNote: 'Walking frame required at all times, high fall risk',
  medNote: 'Donepezil 10mg after breakfast · Aspirin 75mg with food',
  vitalSignsRequired: false,
  vitalSignsThreshold: '',
  lastHandoverBullets: [
    'Mary was calm and cooperative throughout, no exit-seeking behaviour noted. Personal care completed fully.',
    'No changes since last visit, routine and medication both as planned. Ate a full breakfast.',
    'Watch for: agitation around mealtimes, offer familiar music as a calming distraction before continuing.',
  ],
  contextualCues: [
    { trigger: 'Prepare breakfast', content: 'Encourage fluid alongside meal, Mary requires 6–8 glasses daily. Offer water or juice first before starting breakfast. Aspirin must be given WITH food.' },
    { trigger: 'Assist with mobility', content: 'Walking frame must remain within reach at all times. Mary is HIGH FALL RISK, never leave her standing unassisted. Remove trip hazards before starting movement.' },
    { trigger: 'Record mood', content: 'Use the PBS framework: Green (calm/engaging), Amber (repetitive questioning/pacing), Red (physical behaviour). Document what helped in the notes.' },
  ],
  meds: [
    { 
      name: 'Aspirin', 
      dose: '75mg', 
      dueTime: '09:15', 
      dosingGapHours: 24, 
      timeSensitive: false, 
      adminNote: 'Give with food. Monitor for stomach discomfort.', 
      interactions: [], 
      possibleDuplicate: true, 
      duplicateNote: 'Aspirin may also be prescribed in Mary\'s afternoon regimen. Please confirm this is the correct morning dose for this visit and check the medication administration record.' 
    },
    { 
      name: 'Donepezil', 
      dose: '10mg', 
      dueTime: '09:30', 
      dosingGapHours: 24, 
      timeSensitive: false, 
      adminNote: 'Give after breakfast. Monitor for nausea or sleep disturbance.', 
      isControlled: true, 
      interactions: [], 
      possibleDuplicate: true, 
      duplicateNote: 'Donepezil is a once-daily medication. Please check the medication administration record to confirm today\'s dose has not already been given before proceeding.' 
    },
  ],
  conditions: ['Dementia', 'Osteoporosis', 'Hypothyroidism'],
  chokingRisk: false,
  bpBaseline: { sys: 125, dia: 78 },
  pronouns: 'she/her',
  emergencyContacts: [
    { name: 'Robert Johnson', relation: 'Son (Next of Kin)', phone: '07700 900212', primary: true },
    { name: 'Susan Johnson', relation: 'Daughter', phone: '07700 900438', primary: false },
    { name: 'Dr A. Patel', relation: 'GP: Earley Surgery', phone: '0118 926 7000', primary: false },
  ],
  pbsFramework: {
    state: 'green',
    calmSigns: ['Smiling', 'Making eye contact', 'Following routine willingly'],
    calmActions: ['Maintain calm tone', 'Offer choice', 'Praise cooperation'],
    anxiousSigns: ['Repetitive questioning', 'Pacing', 'Fidgeting'],
    anxiousActions: ['Validate feelings', 'Redirect to familiar activity', 'Use distraction'],
    riskSigns: ['Raised voice', 'Physical resistance', 'Attempting to leave'],
    riskActions: ['Create space', 'Stay calm', 'Call for support if needed'],
  },
}

// Client 2: Tom Adams (Post-Stroke, Hypertension, Dysphagia Risk)
export const TOM_ADAMS: Client = {
  id: 'tom',
  name: 'Tom Adams',
  age: 75,
  address: '12 Elm Street, Reading RG1 2BT',
  emoji: '👨🏾',
  time: '10:30 – 11:00',
  condition: 'Post Stroke',
  tags: ['Post Stroke', 'Mobility Support'],
  gp: 'Dr M. Clarke · Castle Hill Surgery',
  allergy: 'None known',
  supportLevel: 'Physical assistance with personal care and transfers. Mobility support throughout.',
  framework: 'Person-Centred · Stroke Rehabilitation Approach · PACE',
  communication: 'Speak slowly and clearly, Tom may have word-finding difficulties. Allow extra time to respond. Do not finish his sentences. Use gestures where helpful.',
  mobilityNote: 'Hoist required for transfers, never attempt manual lift alone',
  medNote: 'Aspirin 75mg and Lisinopril 10mg with morning meal',
  vitalSignsRequired: true,
  vitalSignsThreshold: 'Report to supervisor if BP above 140/90 mmHg, call office immediately',
  lastHandoverBullets: [
    'Tom completed transfers safely with hoist, cooperated well. BP 138/86, within normal range.',
    'Change since last visit: appetite slightly reduced, ate approximately half of breakfast.',
    'Watch for: any difficulty swallowing, do not rush food or drink; report immediately if observed.',
  ],
  contextualCues: [
    { trigger: 'Prepare breakfast', content: 'Aspirin and Lisinopril must be given WITH this meal, confirm Tom has eaten before administering. Record BP 20 mins after Lisinopril.' },
    { trigger: 'Assist with mobility', content: 'Hoist required for ALL transfers, never attempt manual lift alone. Support Tom\'s affected side throughout. Allow him extra time, do not rush.' },
    { trigger: 'Record mood', content: 'Allow extra time for Tom to communicate, post-stroke aphasia means he needs processing time. Do not finish his sentences. Note any visible frustration or withdrawal.' },
  ],
  meds: [
    { 
      name: 'Aspirin', 
      dose: '75mg', 
      dueTime: '10:45', 
      dosingGapHours: 24, 
      timeSensitive: false, 
      adminNote: 'Give with morning meal. Monitor for dizziness.', 
      interactions: ['Aspirin may reduce Lisinopril\'s blood pressure-lowering effect — monitor BP closely after both are given'], 
      possibleDuplicate: true, 
      duplicateNote: 'Aspirin also appears in Tom\'s earlier visit record today. Please confirm this is the correct scheduled dose for this visit and not a duplicate before proceeding.' 
    },
    { 
      name: 'Lisinopril', 
      dose: '10mg', 
      dueTime: '10:45', 
      dosingGapHours: 24, 
      timeSensitive: true, 
      adminNote: 'Give with food. Monitor blood pressure. Report readings above baseline.', 
      interactions: ['Aspirin may reduce Lisinopril\'s blood pressure-lowering effect — monitor BP closely after both are given'],
      possibleDuplicate: false
    },
  ],
  conditions: ['Post-Stroke', 'Hypertension', 'Dysphagia Risk'],
  chokingRisk: true,
  chokingHistory: 'Dysphagia confirmed — use thickened fluids as prescribed. Never rush food or drink. Remain present throughout all meals and drinks. If choking occurs: encourage coughing, call 999 immediately if airway is blocked.',
  dysphagiaProtocol: 'Use thickened fluids as prescribed. Never rush food or drink. Remain present throughout all meals and drinks. If choking occurs: encourage coughing, call 999 immediately if airway is blocked.',
  bpBaseline: { sys: 130, dia: 82 },
  pronouns: 'he/him',
  emergencyContacts: [
    { name: 'Patricia Adams', relation: 'Wife (Next of Kin)', phone: '07700 900571', primary: true },
    { name: 'James Adams', relation: 'Son', phone: '07700 900684', primary: false },
    { name: 'Dr M. Clarke', relation: 'GP: Castle Hill Surgery', phone: '0118 957 3488', primary: false },
  ],
  pbsFramework: {
    state: 'green',
    calmSigns: ['Cooperative with hoist', 'Attempting communication', 'Following instructions'],
    calmActions: ['Praise effort', 'Allow processing time', 'Be patient'],
    anxiousSigns: ['Frustration with speech', 'Withdrawal', 'Refusing care'],
    anxiousActions: ['Stay calm', 'Use gestures', 'Give extra time', 'Try different approach'],
    riskSigns: ['Agitation', 'Resistance to transfers', 'Signs of distress'],
    riskActions: ['Stop and reassess', 'Ensure hoist safety', 'Call for assistance'],
  },
}

// Client 3: Aisha Khan (Type 2 Diabetes, Hypertension, Peripheral Neuropathy)
export const AISHA_KHAN: Client = {
  id: 'aisha',
  name: 'Aisha Khan',
  age: 69,
  address: '8 Maple Drive, Reading RG4 5PQ',
  emoji: '👩🏽',
  time: '12:00 – 13:00',
  condition: 'Diabetes',
  tags: ['Diabetes', 'Nutrition Monitoring'],
  gp: 'Dr F. Hassan · Woodley Health Centre',
  allergy: 'Sulfonamides: do not administer',
  supportLevel: 'Verbal prompts and encouragement. Assistance with nutrition monitoring and medication.',
  framework: 'Person-Centred · Diabetes Care Protocol · Trauma-Informed Care',
  communication: 'Aisha speaks English and Urdu. Use simple language and offer choices. She is private, always explain what you are doing before doing it.',
  mobilityNote: 'Independent walking, monitor for dizziness (hypoglycaemia risk)',
  medNote: 'Metformin 500mg AFTER meals, never on empty stomach',
  vitalSignsRequired: true,
  vitalSignsThreshold: 'Report to supervisor if BP is elevated above Aisha\'s baseline (138/85 mmHg) or if systolic drops below 90. Monitor for hypoglycaemia — dizziness or confusion may indicate low blood sugar.',
  lastHandoverBullets: [
    'Aisha in good spirits, engaged positively with carer. Blood sugar 7.2 mmol/L before Metformin.',
    'No changes since last visit, foot inspection normal, no redness, wounds or swelling noted.',
    'Watch for: signs of hypoglycaemia before and after meals, sweating, shaking, confusion, pale skin.',
  ],
  contextualCues: [
    { trigger: 'Prepare breakfast', content: 'Confirm Aisha has eaten BEFORE giving Metformin, never administer on an empty stomach. Monitor for nausea for 30 mins after. Encourage water with meal.' },
    { trigger: 'Assist with mobility', content: 'Monitor for dizziness before and after movement, hypoglycaemia risk. If Aisha appears unsteady or confused, sit her down and check blood sugar immediately.' },
    { trigger: 'Record mood', content: 'Always explain each step before doing it, Aisha values being in control of her care. Note any signs of withdrawal or reduced engagement; these may indicate low blood sugar.' },
  ],
  meds: [
    { 
      name: 'Metformin', 
      dose: '500mg', 
      dueTime: '12:15', 
      dosingGapHours: 6, 
      timeSensitive: true, 
      adminNote: '⚠ Give AFTER meals only, never on an empty stomach. Monitor for nausea for 30 mins after.', 
      interactions: [], 
      possibleDuplicate: true, 
      duplicateNote: 'Metformin may be prescribed more than once daily. Please confirm this is the correct lunchtime dose for this visit and check the medication administration record.' 
    },
    { 
      name: 'Lisinopril', 
      dose: '10mg', 
      dueTime: '12:15', 
      dosingGapHours: 24, 
      timeSensitive: false, 
      adminNote: 'Give with food. Monitor blood pressure and report readings above 140/90.', 
      interactions: [], 
      possibleDuplicate: true, 
      duplicateNote: 'Lisinopril is a once-daily medication. Please confirm today\'s dose has not already been recorded before administering.' 
    },
  ],
  conditions: ['Type 2 Diabetes', 'Hypertension', 'Peripheral Neuropathy'],
  chokingRisk: false,
  bpBaseline: { sys: 138, dia: 85 },
  pronouns: 'she/her',
  emergencyContacts: [
    { name: 'Imran Khan', relation: 'Son (Next of Kin)', phone: '07700 900317', primary: true },
    { name: 'Yasmin Khan', relation: 'Daughter', phone: '07700 900752', primary: false },
    { name: 'Dr F. Hassan', relation: 'GP: Woodley Health Centre', phone: '0118 969 2222', primary: false },
  ],
  pbsFramework: {
    state: 'green',
    calmSigns: ['Engaged', 'Asking questions', 'Following routine'],
    calmActions: ['Offer choices', 'Explain steps', 'Encourage independence'],
    anxiousSigns: ['Withdrawal', 'Reduced engagement', 'Appearing unsteady'],
    anxiousActions: ['Check blood sugar', 'Offer seated rest', 'Provide reassurance'],
    riskSigns: ['Confusion', 'Dizziness', 'Signs of hypoglycaemia'],
    riskActions: ['Sit down immediately', 'Check blood sugar', 'Call supervisor if needed'],
  },
}

// All clients array
export const SCHEDULE_CLIENTS: Client[] = [MARY_JOHNSON, TOM_ADAMS, AISHA_KHAN]

// Get client by ID
export function getClientById(id: string): Client | undefined {
  return SCHEDULE_CLIENTS.find(c => c.id === id)
}

// Get all client names for demo
export function getClientNames(): string[] {
  return SCHEDULE_CLIENTS.map(c => c.name)
}
