export const COLORS = {
  navy: "#1B2A49",
  darkNavy: "#0F1D34",
  teal: "#4FD1C5",
  teal2: "#38B2AC",
  amber: "#F6B73C",
  red: "#FF5A5F",
  green: "#22C55E",
  g0: "#F8FAFC",
  g1: "#E2E8F0",
  g2: "#94A3B8",
  g3: "#475569",
  g4: "#64748B",
};

export interface ClientProfile {
  name: string;
  age: number;
  address: string;
  conditions: string[];
  allergy: string;
  gp: string;
  meds: {
    name: string;
    dose: string;
    time: string;
    route: string;
    adminNote: string;
  }[];
}

export const CLIENT: ClientProfile = {
  name: "Grace Mensah",
  age: 83,
  address: "10 Oak Avenue, Reading RG1 4AT",
  conditions: ["Hypertension", "T2 Diabetes", "Mild Cognitive Impairment"],
  allergy: "Penicillin",
  gp: "Dr Sandra Obi",
  meds: [
    {
      name: "Amlodipine",
      dose: "5mg",
      time: "10AM",
      route: "Oral",
      adminNote: "Give with a full glass of water. Monitor for dizziness for 20 mins after.",
    },
    {
      name: "Metformin",
      dose: "500mg",
      time: "10AM",
      route: "Oral",
      adminNote: "⚠ Give AFTER meals — never on an empty stomach. Monitor for nausea/vomiting for 30 mins after administration.",
    },
    {
      name: "Atorvastatin",
      dose: "20mg",
      time: "10AM",
      route: "Oral",
      adminNote: "Give at same time each day. Monitor for any muscle pain or weakness after administration.",
    },
  ],
};

export const TASKS = [
  "Personal care — wash, dress",
  "Breakfast preparation",
  "Morning medication (10AM)",
  "Blood pressure check",
  "Activity & social engagement",
];

export const QUICK_CHIPS = [
  "Paracetamol safe?",
  "Fall risk?",
  "What did she eat?",
  "Medications",
];

export const OFFLINE_RESPONSES: Record<string, string> = {
  "Paracetamol safe?":
    "Paracetamol is generally safe for Grace at standard doses (500mg–1g up to 4x daily). Always confirm with her GP given her conditions. No known interactions with her current medications.",
  "Fall risk?":
    "Grace has an elevated fall risk due to her age (83), T2 Diabetes (peripheral neuropathy risk), and Mild Cognitive Impairment. Ensure pathways are clear, grab rails are accessible, and footwear is secure.",
  "What did she eat?":
    "No meal data recorded yet for today's visit. Document meals in the visit notes once breakfast has been prepared and served.",
  Medications:
    "Grace's current medications: Amlodipine 5mg (10AM oral) for hypertension, Metformin 500mg (10AM oral, AFTER meals) for T2 Diabetes, Atorvastatin 20mg (10AM oral) for cholesterol. ALLERGY: Penicillin. Always monitor for 20–30 mins after administration.",
};

export interface ScheduleClient {
  id: string;
  name: string;
  age: number;
  address: string;
  time: string;
  condition: string;
  tags: string[];
  emoji: string;
  gp: string;
  allergy: string;
  supportLevel: string;
  framework: string;
  communication: string;
  mobilityNote: string;
  medNote: string;
  meds: { name: string; dose: string; adminNote: string }[];
}

export const SCHEDULE_CLIENTS: ScheduleClient[] = [
  {
    id: "mary",
    name: "Mary Johnson",
    age: 82,
    address: "4 Birch Close, Reading RG2 7LN",
    time: "09:00 – 10:00",
    condition: "Dementia",
    tags: ["Dementia", "Medication Required"],
    emoji: "👩🏼",
    gp: "Dr A. Patel · Earley Surgery",
    allergy: "None known",
    supportLevel: "Full physical assistance + 1-to-1 supervision throughout",
    framework: "Person-Centred · PBS · Dementia Care Mapping (DCM)",
    communication: "Use simple words and short sentences. Validate feelings — never argue or correct. Approach from the front, maintain eye contact. Mary may not recognise you — introduce yourself each visit.",
    mobilityNote: "Walking frame required at all times — high fall risk",
    medNote: "Donepezil 10mg after breakfast · Aspirin 75mg with food",
    meds: [
      { name: "Aspirin", dose: "75mg", adminNote: "Give with food. Monitor for stomach discomfort." },
      { name: "Donepezil", dose: "10mg", adminNote: "Give after breakfast. Monitor for nausea or sleep disturbance." },
    ],
  },
  {
    id: "tom",
    name: "Tom Adams",
    age: 75,
    address: "12 Elm Street, Reading RG1 2BT",
    time: "10:30 – 11:00",
    condition: "Post Stroke",
    tags: ["Post Stroke", "Mobility Support"],
    emoji: "👨🏾",
    gp: "Dr M. Clarke · Castle Hill Surgery",
    allergy: "None known",
    supportLevel: "Physical assistance with personal care and transfers. Mobility support throughout.",
    framework: "Person-Centred · Stroke Rehabilitation Approach · PACE",
    communication: "Speak slowly and clearly — Tom may have word-finding difficulties. Allow extra time to respond. Do not finish his sentences. Use gestures where helpful.",
    mobilityNote: "Hoist required for transfers — never attempt manual lift alone",
    medNote: "Aspirin 75mg and Lisinopril 10mg with morning meal",
    meds: [
      { name: "Aspirin", dose: "75mg", adminNote: "Give with morning meal. Monitor for dizziness." },
      { name: "Lisinopril", dose: "10mg", adminNote: "Give with food. Monitor blood pressure. Report readings above 140/90." },
    ],
  },
  {
    id: "aisha",
    name: "Aisha Khan",
    age: 69,
    address: "8 Maple Drive, Reading RG4 5PQ",
    time: "12:00 – 13:00",
    condition: "Diabetes",
    tags: ["Diabetes", "Nutrition Monitoring"],
    emoji: "👩🏽",
    gp: "Dr F. Hassan · Woodley Health Centre",
    allergy: "Sulfonamides — do not administer",
    supportLevel: "Verbal prompts and encouragement. Assistance with nutrition monitoring and medication.",
    framework: "Person-Centred · Diabetes Care Protocol · Trauma-Informed Care",
    communication: "Aisha speaks English and Urdu. Use simple language and offer choices. She is private — always explain what you are doing before doing it.",
    mobilityNote: "Independent walking — monitor for dizziness (hypoglycaemia risk)",
    medNote: "Metformin 500mg AFTER meals — never on an empty stomach",
    meds: [
      { name: "Metformin", dose: "500mg", adminNote: "⚠ Give AFTER meals only — never on an empty stomach. Monitor for nausea for 30 mins after." },
      { name: "Lisinopril", dose: "10mg", adminNote: "Give with food. Monitor blood pressure and report readings above 140/90." },
    ],
  },
];
