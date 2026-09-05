export const CARE_PLAN_TEMPLATES = {
  objectives: [
    "Maintain personal hygiene and dignity",
    "Administer medication on time as prescribed",
    "Monitor vital signs and health status",
    "Provide emotional support and companionship",
    "Assist with mobility and transfers",
    "Prepare nutritious meals and monitor intake",
    "Promote social engagement and activities",
    "Ensure safe living environment",
    "Document care provided and any changes",
    "Communicate with healthcare team and family"
  ],
  
  preventive: [
    "Regular repositioning to prevent pressure ulcers",
    "Frequent hand hygiene to prevent infections",
    "Fall prevention strategies (non-slip mats, grab bars)",
    "Medication reconciliation and review",
    "Regular health screenings and check-ups",
    "Vaccination updates and monitoring",
    "Skin integrity checks and skincare",
    "Nutritional monitoring and supplementation",
    "Cognitive stimulation activities",
    "Environmental safety assessments"
  ],
  
  risks: [
    "Falls risk - use mobility aids and supervision",
    "Medication errors - double-check dosages and timing",
    "Choking risk - supervise meals and modify food consistency",
    "Pressure ulcers - implement turning schedule",
    "Infection risk - maintain strict hygiene protocols",
    "Wandering/elopement risk - secure environment",
    "Dehydration - monitor fluid intake regularly",
    "Malnutrition - track weight and food intake",
    "Social isolation - encourage activities and visitors",
    "Caregiver burnout - provide support and respite"
  ],
  
  postMed: [
    "Monitor blood pressure 30 minutes after antihypertensives",
    "Observe for dizziness after diuretics",
    "Check blood glucose levels before and after insulin",
    "Watch for sedation effects after pain medication",
    "Monitor respiratory rate after opioids",
    "Check for allergic reactions within 1 hour",
    "Document effectiveness and side effects",
    "Notify prescriber of adverse reactions",
    "Educate on medication timing with meals",
    "Track medication adherence patterns"
  ],
  
  pbsTriggers: [
    "Loud noises or chaotic environments",
    "Changes in routine or caregivers",
    "Physical discomfort or pain",
    "Feeling ignored or misunderstood",
    "Loss of control or autonomy",
    "Overstimulation or too many choices",
    "Memory lapses or confusion",
    "Fatigue or hunger",
    "Unfamiliar people or places",
    "Perceived criticism or judgment"
  ],
  
  safetyPlan: [
    "Immediate assessment of danger level",
    "Remove client from triggering environment",
    "Use de-escalation techniques and calm voice",
    "Call for backup assistance if needed",
    "Ensure safety of client and others first",
    "Follow emergency protocols for medical crises",
    "Document incident thoroughly and objectively",
    "Notify family and healthcare team promptly",
    "Review and update care plan after incident",
    "Provide emotional support and reassurance"
  ],
  
  lastReview: [
    "Care plan reviewed with client and family",
    "Next review scheduled in 3 months",
    "Current care package: 15 hours/week",
    "Support framework: Positive Behaviour Support",
    "Risk assessment updated - medium risk level",
    "Medication review completed by GP",
    "Physical health assessment stable",
    "Mental health support ongoing",
    "Social care needs reassessed",
    "Emergency contacts verified and updated"
  ],
  
  pbsCalmSigns: [
    "Relaxed body posture and facial expression",
    "Engages in conversation willingly",
    "Follows directions without resistance",
    "Participates in activities independently",
    "Maintains appropriate personal space",
    "Uses calm, steady voice tone",
    "Makes eye contact appropriately",
    "Shows interest in surroundings",
    "Expresses needs clearly",
    "Demonstrates cooperative behavior"
  ],
  
  pbsCalmActions: [
    "Provide positive reinforcement for calm behavior",
    "Maintain consistent routine and structure",
    "Offer choices within appropriate limits",
    "Use active listening and validation",
    "Encourage participation in preferred activities",
    "Maintain calm, predictable environment",
    "Provide regular breaks and rest periods",
    "Acknowledge and praise cooperative behavior",
    "Use gentle, reassuring touch if appropriate",
    "Document positive interactions and progress"
  ],
  
  pbsAnxiousSigns: [
    "Increased fidgeting or restlessness",
    "Repetitive questioning or movements",
    "Withdrawn or avoidant behavior",
    "Increased vocal volume or rapid speech",
    "Pacing or inability to sit still",
    "Facial tension or clenched jaw",
    "Short, fragmented sentences",
    "Avoids eye contact",
    "Physical complaints (headache, stomach pain)",
    "Increased sensitivity to stimuli"
  ],
  
  pbsAnxiousActions: [
    "Speak in calm, slow, reassuring tone",
    "Reduce environmental stimulation",
    "Offer simple, clear choices",
    "Use grounding techniques (deep breathing)",
    "Provide one-on-one attention",
    "Redirect to familiar, calming activities",
    "Validate feelings without reinforcing anxiety",
    "Maintain physical safety boundaries",
    "Offer comfort items or personal objects",
    "Monitor for escalation to risk state"
  ],
  
  pbsRiskSigns: [
    "Aggressive gestures or threatening behavior",
    "Loud yelling or screaming",
    "Physical violence toward self or others",
    "Property damage or throwing objects",
    "Complete withdrawal or non-responsiveness",
    "Self-harm behaviors or threats",
    "Extreme agitation or panic",
    "Disorientation or confusion",
    "Inability to follow simple directions",
    "Medical emergency symptoms"
  ],
  
  pbsRiskActions: [
    "Ensure immediate safety of all individuals",
    "Clear area of other clients if necessary",
    "Use emergency call system for backup",
    "Follow specific crisis intervention protocols",
    "Maintain calm, non-threatening demeanor",
    "Use minimal physical intervention only if required",
    "Administer PRN medication if prescribed",
    "Contact emergency services if medical crisis",
    "Document incident in detail immediately",
    "Debrief with team after crisis resolution"
  ]
}

export const getTemplateSuggestions = (section: string, limit: number = 5): string[] => {
  return (CARE_PLAN_TEMPLATES[section as keyof typeof CARE_PLAN_TEMPLATES] || []).slice(0, limit)
}

export const getPBSTemplateSuggestions = (state: 'calm' | 'anxious' | 'risk', type: 'signs' | 'actions', limit: number = 3): string[] => {
  const key = `pbs${state.charAt(0).toUpperCase() + state.slice(1)}${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof CARE_PLAN_TEMPLATES
  return (CARE_PLAN_TEMPLATES[key] || []).slice(0, limit)
}
