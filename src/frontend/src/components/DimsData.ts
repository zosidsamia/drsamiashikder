export interface DimsMedication {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface DimsEntry {
  diagnosis: string;
  category: string;
  medications: DimsMedication[];
  notes?: string;
}

export const DIMS_DATABASE: DimsEntry[] = [
  // RESPIRATORY
  {
    diagnosis: "Acute Pharyngitis",
    category: "Respiratory",
    medications: [
      {
        name: "Amoxicillin",
        dose: "500 mg",
        frequency: "3 times daily",
        duration: "7 days",
        instructions: "Take after meals",
      },
      {
        name: "Paracetamol",
        dose: "500 mg",
        frequency: "3 times daily as needed",
        duration: "5 days",
        instructions: "Take for fever or pain",
      },
      {
        name: "Cetirizine",
        dose: "10 mg",
        frequency: "Once daily at night",
        duration: "5 days",
        instructions: "For throat irritation and allergy",
      },
    ],
    notes:
      "Swab for Group A Strep if suspected. Avoid antibiotics for viral pharyngitis.",
  },
  {
    diagnosis: "Acute Bronchitis",
    category: "Respiratory",
    medications: [
      {
        name: "Amoxicillin-Clavulanate",
        dose: "625 mg",
        frequency: "Twice daily",
        duration: "7 days",
        instructions: "Take after meals",
      },
      {
        name: "Salbutamol inhaler",
        dose: "2 puffs",
        frequency: "Every 4-6 hours as needed",
        duration: "5-7 days",
        instructions: "Shake well before use",
      },
      {
        name: "Paracetamol",
        dose: "500 mg",
        frequency: "3 times daily as needed",
        duration: "5 days",
        instructions: "For fever",
      },
    ],
    notes:
      "Most cases are viral. Antibiotics only if bacterial features present.",
  },
  {
    diagnosis: "Community-Acquired Pneumonia",
    category: "Respiratory",
    medications: [
      {
        name: "Amoxicillin-Clavulanate",
        dose: "1 g",
        frequency: "Twice daily",
        duration: "7-10 days",
        instructions: "Take after meals",
      },
      {
        name: "Azithromycin",
        dose: "500 mg",
        frequency: "Once daily",
        duration: "5 days",
        instructions: "For atypical coverage",
      },
      {
        name: "Paracetamol",
        dose: "500 mg",
        frequency: "3 times daily as needed",
        duration: "5 days",
        instructions: "For fever",
      },
    ],
    notes:
      "Chest X-ray recommended. Consider hospitalization for severe cases.",
  },
  {
    diagnosis: "Bronchial Asthma (Acute)",
    category: "Respiratory",
    medications: [
      {
        name: "Salbutamol inhaler",
        dose: "2-4 puffs",
        frequency: "Every 4-6 hours",
        duration: "7-10 days",
        instructions: "Use spacer if available",
      },
      {
        name: "Prednisolone",
        dose: "40 mg",
        frequency: "Once daily in the morning",
        duration: "5 days",
        instructions: "Take with food",
      },
      {
        name: "Budesonide/Formoterol inhaler",
        dose: "1 puff",
        frequency: "Twice daily",
        duration: "Ongoing",
        instructions: "Long-term controller - do not stop abruptly",
      },
    ],
    notes: "Reassess after 1 week. Step up therapy if control is poor.",
  },
  {
    diagnosis: "COPD Exacerbation",
    category: "Respiratory",
    medications: [
      {
        name: "Salbutamol + Ipratropium nebulisation",
        dose: "2.5 mg + 0.5 mg",
        frequency: "Every 6 hours",
        duration: "5 days",
        instructions: "Nebulise with oxygen or air",
      },
      {
        name: "Prednisolone",
        dose: "40 mg",
        frequency: "Once daily",
        duration: "5 days",
        instructions: "Take with food",
      },
      {
        name: "Azithromycin",
        dose: "500 mg",
        frequency: "Once daily",
        duration: "5 days",
        instructions: "For bacterial exacerbation",
      },
    ],
    notes: "Ensure SpO2 88-92%. Spirometry recommended when stable.",
  },
  {
    diagnosis: "Upper Respiratory Tract Infection",
    category: "Respiratory",
    medications: [
      {
        name: "Paracetamol",
        dose: "500 mg",
        frequency: "3 times daily as needed",
        duration: "5 days",
        instructions: "For fever and discomfort",
      },
      {
        name: "Cetirizine",
        dose: "10 mg",
        frequency: "Once daily at night",
        duration: "5 days",
        instructions: "For nasal symptoms",
      },
      {
        name: "Normal saline nasal drops",
        dose: "2 drops each nostril",
        frequency: "3 times daily",
        duration: "5 days",
        instructions: "Tilt head back slightly",
      },
    ],
    notes:
      "Viral URTI is self-limiting. Antibiotics are not indicated routinely.",
  },
  {
    diagnosis: "Sinusitis",
    category: "Respiratory",
    medications: [
      {
        name: "Amoxicillin-Clavulanate",
        dose: "625 mg",
        frequency: "Twice daily",
        duration: "10 days",
        instructions: "Take after meals",
      },
      {
        name: "Xylometazoline nasal spray",
        dose: "2 sprays each nostril",
        frequency: "Twice daily",
        duration: "5 days",
        instructions: "Do not use more than 5 days",
      },
      {
        name: "Paracetamol",
        dose: "500 mg",
        frequency: "3 times daily",
        duration: "5 days",
        instructions: "For pain and fever",
      },
    ],
    notes:
      "Consider nasal endoscopy if recurrent. Avoid prolonged decongestant use.",
  },
  {
    diagnosis: "Allergic Rhinitis",
    category: "Respiratory",
    medications: [
      {
        name: "Cetirizine",
        dose: "10 mg",
        frequency: "Once daily at night",
        duration: "30 days",
        instructions: "Long-term control",
      },
      {
        name: "Fluticasone nasal spray",
        dose: "2 sprays each nostril",
        frequency: "Once daily in the morning",
        duration: "4-8 weeks",
        instructions: "Tilt head slightly forward",
      },
      {
        name: "Montelukast",
        dose: "10 mg",
        frequency: "Once daily at night",
        duration: "30 days",
        instructions: "Take before sleep",
      },
    ],
    notes:
      "Identify and avoid triggers. Allergen immunotherapy for refractory cases.",
  },
  {
    diagnosis: "Pulmonary Tuberculosis",
    category: "Respiratory",
    medications: [
      {
        name: "HRZE (Intensive phase)",
        dose: "As per weight-based dosing",
        frequency: "Once daily",
        duration: "2 months",
        instructions: "Take on empty stomach in the morning",
      },
      {
        name: "HR (Continuation phase)",
        dose: "As per weight-based dosing",
        frequency: "Once daily",
        duration: "4 months",
        instructions: "Take on empty stomach in the morning",
      },
      {
        name: "Pyridoxine (Vitamin B6)",
        dose: "25 mg",
        frequency: "Once daily",
        duration: "6 months",
        instructions: "To prevent INH-induced neuropathy",
      },
    ],
    notes: "DOTS recommended. Screen household contacts. Monitor LFT monthly.",
  },
  // CARDIOVASCULAR
  {
    diagnosis: "Hypertension (Mild)",
    category: "Cardiovascular",
    medications: [
      {
        name: "Amlodipine",
        dose: "5 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Take at the same time each day",
      },
    ],
    notes:
      "Lifestyle modification: low-salt diet, exercise, weight control. Monitor BP weekly.",
  },
  {
    diagnosis: "Hypertension (Moderate)",
    category: "Cardiovascular",
    medications: [
      {
        name: "Amlodipine",
        dose: "5-10 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Take at the same time each day",
      },
      {
        name: "Losartan",
        dose: "50 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Monitor kidney function and potassium",
      },
    ],
    notes: "Target BP < 130/80 mmHg. Review in 4 weeks.",
  },
  {
    diagnosis: "Heart Failure (Systolic)",
    category: "Cardiovascular",
    medications: [
      {
        name: "Furosemide",
        dose: "40 mg",
        frequency: "Once daily in the morning",
        duration: "Ongoing",
        instructions: "Take in the morning to avoid nocturia",
      },
      {
        name: "Enalapril",
        dose: "5 mg",
        frequency: "Twice daily",
        duration: "Ongoing",
        instructions: "Monitor potassium and creatinine",
      },
      {
        name: "Carvedilol",
        dose: "3.125 mg",
        frequency: "Twice daily",
        duration: "Ongoing",
        instructions: "Titrate slowly; take with food",
      },
      {
        name: "Spironolactone",
        dose: "25 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Monitor potassium levels",
      },
    ],
    notes: "Low-sodium diet. Daily weight monitoring. Refer cardiology.",
  },
  {
    diagnosis: "Atrial Fibrillation",
    category: "Cardiovascular",
    medications: [
      {
        name: "Metoprolol succinate",
        dose: "25-50 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Do not stop abruptly",
      },
      {
        name: "Warfarin",
        dose: "As per INR target (2-3)",
        frequency: "Once daily at the same time",
        duration: "Ongoing",
        instructions: "Regular INR monitoring required",
      },
    ],
    notes:
      "CHA2DS2-VASc score for anticoagulation decision. ECG and echocardiography.",
  },
  {
    diagnosis: "Angina Pectoris",
    category: "Cardiovascular",
    medications: [
      {
        name: "Isosorbide mononitrate",
        dose: "20 mg",
        frequency: "Twice daily",
        duration: "Ongoing",
        instructions: "Avoid in hypotension",
      },
      {
        name: "Atenolol",
        dose: "50 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Monitor pulse; do not stop abruptly",
      },
      {
        name: "Aspirin",
        dose: "75 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Take after meals",
      },
      {
        name: "Atorvastatin",
        dose: "40 mg",
        frequency: "Once daily at night",
        duration: "Ongoing",
        instructions: "Monitor LFT at 3 months",
      },
    ],
    notes: "Sublingual GTN for acute attacks. Cardiac workup required.",
  },
  {
    diagnosis: "Post-Acute MI",
    category: "Cardiovascular",
    medications: [
      {
        name: "Aspirin",
        dose: "75-100 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Take after meals",
      },
      {
        name: "Clopidogrel",
        dose: "75 mg",
        frequency: "Once daily",
        duration: "12 months",
        instructions: "Dual antiplatelet therapy post-PCI",
      },
      {
        name: "Atorvastatin",
        dose: "80 mg",
        frequency: "Once daily at night",
        duration: "Ongoing",
        instructions: "High intensity statin",
      },
      {
        name: "Metoprolol succinate",
        dose: "25-50 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Do not stop abruptly",
      },
      {
        name: "Ramipril",
        dose: "2.5-5 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Monitor creatinine and BP",
      },
    ],
    notes:
      "Cardiac rehabilitation recommended. Regular follow-up every 3 months.",
  },
  {
    diagnosis: "Hyperlipidemia",
    category: "Cardiovascular",
    medications: [
      {
        name: "Atorvastatin",
        dose: "20-40 mg",
        frequency: "Once daily at night",
        duration: "Ongoing",
        instructions: "Monitor LFT at 3 months",
      },
    ],
    notes:
      "Low-fat diet, regular exercise. Target LDL < 100 mg/dl (or < 70 mg/dl for high risk).",
  },
  // GASTROINTESTINAL
  {
    diagnosis: "Peptic Ulcer Disease",
    category: "Gastrointestinal",
    medications: [
      {
        name: "Omeprazole",
        dose: "20 mg",
        frequency: "Twice daily before meals",
        duration: "4-8 weeks",
        instructions: "Take 30 minutes before meals",
      },
      {
        name: "Sucralfate",
        dose: "1 g",
        frequency: "4 times daily",
        duration: "4-8 weeks",
        instructions: "Take on an empty stomach",
      },
    ],
    notes: "Test for H. pylori. Avoid NSAIDs, alcohol, and smoking.",
  },
  {
    diagnosis: "GERD / Acid Reflux",
    category: "Gastrointestinal",
    medications: [
      {
        name: "Esomeprazole",
        dose: "40 mg",
        frequency: "Once daily before breakfast",
        duration: "4-8 weeks",
        instructions: "Take 30 minutes before eating",
      },
      {
        name: "Domperidone",
        dose: "10 mg",
        frequency: "3 times daily before meals",
        duration: "2-4 weeks",
        instructions: "Take 30 minutes before meals",
      },
    ],
    notes: "Elevate head of bed. Avoid late meals, spicy food, and alcohol.",
  },
  {
    diagnosis: "Acute Gastroenteritis",
    category: "Gastrointestinal",
    medications: [
      {
        name: "Oral Rehydration Salt (ORS)",
        dose: "200-400 ml",
        frequency: "After each loose stool",
        duration: "Until recovered",
        instructions: "Prepare as per packet instructions",
      },
      {
        name: "Zinc",
        dose: "20 mg",
        frequency: "Once daily",
        duration: "10-14 days",
        instructions: "Reduces duration of diarrhoea",
      },
      {
        name: "Metronidazole",
        dose: "400 mg",
        frequency: "3 times daily",
        duration: "5 days",
        instructions: "If Giardia or Entamoeba suspected",
      },
    ],
    notes: "Emphasise hydration. Avoid antidiarrhoeals in children.",
  },
  {
    diagnosis: "Irritable Bowel Syndrome",
    category: "Gastrointestinal",
    medications: [
      {
        name: "Mebeverine",
        dose: "135 mg",
        frequency: "3 times daily before meals",
        duration: "4 weeks",
        instructions: "Take 20 minutes before meals",
      },
      {
        name: "Ispaghula husk",
        dose: "1 sachet",
        frequency: "Twice daily",
        duration: "4 weeks",
        instructions: "Dissolve in water and drink immediately",
      },
    ],
    notes: "Dietary modification: low FODMAP diet. Stress management helpful.",
  },
  {
    diagnosis: "Constipation",
    category: "Gastrointestinal",
    medications: [
      {
        name: "Ispaghula husk",
        dose: "1 sachet",
        frequency: "Twice daily",
        duration: "2-4 weeks",
        instructions: "Take with plenty of water",
      },
      {
        name: "Lactulose",
        dose: "15 ml",
        frequency: "Twice daily",
        duration: "As needed",
        instructions: "Adjust dose according to response",
      },
    ],
    notes:
      "High fibre diet and adequate water intake. Rule out secondary causes.",
  },
  {
    diagnosis: "Acute Hepatitis",
    category: "Gastrointestinal",
    medications: [
      {
        name: "Silymarin (Milk Thistle)",
        dose: "140 mg",
        frequency: "3 times daily",
        duration: "4-8 weeks",
        instructions: "Take with meals",
      },
      {
        name: "Ursodeoxycholic acid",
        dose: "250 mg",
        frequency: "Twice daily",
        duration: "4 weeks",
        instructions: "For cholestasis features",
      },
      {
        name: "Vitamin B complex",
        dose: "1 tablet",
        frequency: "Once daily",
        duration: "4 weeks",
        instructions: "Nutritional support",
      },
    ],
    notes: "Rest, avoid alcohol and hepatotoxic drugs. Monitor LFT weekly.",
  },
  {
    diagnosis: "Liver Cirrhosis",
    category: "Gastrointestinal",
    medications: [
      {
        name: "Spironolactone",
        dose: "100 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Monitor potassium",
      },
      {
        name: "Furosemide",
        dose: "40 mg",
        frequency: "Once daily in the morning",
        duration: "Ongoing",
        instructions: "For ascites management",
      },
      {
        name: "Propranolol",
        dose: "20-40 mg",
        frequency: "Twice daily",
        duration: "Ongoing",
        instructions: "Prophylaxis for variceal bleeding",
      },
      {
        name: "Lactulose",
        dose: "30 ml",
        frequency: "3 times daily",
        duration: "Ongoing",
        instructions: "Target 2-3 soft stools daily",
      },
    ],
    notes:
      "Avoid NSAIDs and alcohol. Regular monitoring of LFT, AFP, abdominal ultrasound.",
  },
  {
    diagnosis: "H. pylori Infection",
    category: "Gastrointestinal",
    medications: [
      {
        name: "Omeprazole",
        dose: "20 mg",
        frequency: "Twice daily",
        duration: "14 days",
        instructions: "Take 30 minutes before meals",
      },
      {
        name: "Clarithromycin",
        dose: "500 mg",
        frequency: "Twice daily",
        duration: "14 days",
        instructions: "Take with meals",
      },
      {
        name: "Amoxicillin",
        dose: "1 g",
        frequency: "Twice daily",
        duration: "14 days",
        instructions: "Take with meals",
      },
    ],
    notes:
      "Triple therapy. Test of cure (UBT) 4 weeks after completing treatment.",
  },
  // DIABETES / ENDOCRINE
  {
    diagnosis: "Type 2 Diabetes Mellitus",
    category: "Diabetes/Endocrine",
    medications: [
      {
        name: "Metformin",
        dose: "500 mg",
        frequency: "Twice daily with meals",
        duration: "Ongoing",
        instructions:
          "Start low and titrate. Take with meals to reduce GI side effects",
      },
      {
        name: "Glibenclamide",
        dose: "5 mg",
        frequency: "Once daily before breakfast",
        duration: "Ongoing",
        instructions: "Monitor for hypoglycaemia",
      },
    ],
    notes:
      "HbA1c target < 7%. Diet, exercise, and weight loss are cornerstone therapy.",
  },
  {
    diagnosis: "Diabetes Mellitus (Uncontrolled)",
    category: "Diabetes/Endocrine",
    medications: [
      {
        name: "Metformin",
        dose: "1000 mg",
        frequency: "Twice daily with meals",
        duration: "Ongoing",
        instructions: "Take with meals",
      },
      {
        name: "Sitagliptin",
        dose: "100 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Can be taken with or without food",
      },
      {
        name: "Glargine insulin",
        dose: "10 units",
        frequency: "Once daily at bedtime",
        duration: "Ongoing",
        instructions: "Rotate injection sites",
      },
    ],
    notes: "Consider endocrinology referral. HbA1c monitoring every 3 months.",
  },
  {
    diagnosis: "Hypothyroidism",
    category: "Diabetes/Endocrine",
    medications: [
      {
        name: "Levothyroxine",
        dose: "25-50 mcg",
        frequency: "Once daily on empty stomach",
        duration: "Ongoing",
        instructions:
          "Take 30-60 minutes before breakfast. Do not take with calcium or iron",
      },
    ],
    notes:
      "Recheck TSH after 6-8 weeks. Start low in elderly or cardiac patients.",
  },
  {
    diagnosis: "Hyperthyroidism",
    category: "Diabetes/Endocrine",
    medications: [
      {
        name: "Carbimazole",
        dose: "10-20 mg",
        frequency: "3 times daily",
        duration: "6-18 months",
        instructions: "Monitor WBC count - stop if fever or sore throat",
      },
      {
        name: "Propranolol",
        dose: "40 mg",
        frequency: "3 times daily",
        duration: "Until euthyroid",
        instructions: "For symptom control",
      },
    ],
    notes: "Monitor TFT every 4 weeks. Refer for RAI or surgery if relapse.",
  },
  {
    diagnosis: "Vitamin D Deficiency",
    category: "Diabetes/Endocrine",
    medications: [
      {
        name: "Cholecalciferol (Vitamin D3)",
        dose: "60,000 IU",
        frequency: "Once weekly",
        duration: "8-12 weeks",
        instructions: "Take with fatty meal for absorption",
      },
      {
        name: "Calcium carbonate",
        dose: "500 mg",
        frequency: "Twice daily",
        duration: "3 months",
        instructions: "Take with meals",
      },
    ],
    notes:
      "Recheck 25-OH Vitamin D after 3 months. Maintenance dosing thereafter.",
  },
  {
    diagnosis: "Iron Deficiency Anemia",
    category: "Diabetes/Endocrine",
    medications: [
      {
        name: "Ferrous sulfate",
        dose: "200 mg",
        frequency: "Twice daily",
        duration: "3 months",
        instructions: "Take on an empty stomach; avoid with tea, antacids",
      },
      {
        name: "Folic acid",
        dose: "5 mg",
        frequency: "Once daily",
        duration: "3 months",
        instructions: "Take with or without food",
      },
    ],
    notes:
      "Identify and treat underlying cause. Recheck CBC and ferritin at 3 months.",
  },
  // NEUROLOGICAL
  {
    diagnosis: "Migraine",
    category: "Neurological",
    medications: [
      {
        name: "Sumatriptan",
        dose: "50 mg",
        frequency: "At onset; repeat after 2 hours if needed",
        duration: "Per attack",
        instructions: "Do not exceed 300 mg/day",
      },
      {
        name: "Naproxen",
        dose: "500 mg",
        frequency: "Twice daily as needed",
        duration: "Per attack",
        instructions: "Take with food",
      },
      {
        name: "Propranolol",
        dose: "40 mg",
        frequency: "Twice daily",
        duration: "Ongoing (prophylaxis)",
        instructions: "Monitor pulse",
      },
    ],
    notes:
      "Migraine diary recommended. Avoid triggers. Consider neurology referral for frequent episodes.",
  },
  {
    diagnosis: "Tension Headache",
    category: "Neurological",
    medications: [
      {
        name: "Paracetamol",
        dose: "500-1000 mg",
        frequency: "Every 6 hours as needed",
        duration: "Per episode",
        instructions: "Do not exceed 4 g/day",
      },
      {
        name: "Ibuprofen",
        dose: "400 mg",
        frequency: "3 times daily with food",
        duration: "Per episode",
        instructions: "Take with meals to reduce GI upset",
      },
    ],
    notes:
      "Stress management, posture correction, and sleep hygiene are important.",
  },
  {
    diagnosis: "Seizure Disorder (Epilepsy)",
    category: "Neurological",
    medications: [
      {
        name: "Sodium valproate",
        dose: "200-400 mg",
        frequency: "Twice daily",
        duration: "Ongoing",
        instructions: "Do not stop abruptly; monitor LFT and CBC",
      },
      {
        name: "Clonazepam",
        dose: "0.5 mg",
        frequency: "Once daily at night",
        duration: "Ongoing",
        instructions: "May cause drowsiness",
      },
    ],
    notes:
      "Avoid driving. Monitor drug levels. Do not discontinue without neurology advice.",
  },
  {
    diagnosis: "Peripheral Neuropathy",
    category: "Neurological",
    medications: [
      {
        name: "Gabapentin",
        dose: "300 mg",
        frequency: "3 times daily",
        duration: "Ongoing",
        instructions: "Start low; may cause dizziness",
      },
      {
        name: "Vitamin B1 + B6 + B12 (Neurobion)",
        dose: "1 tablet",
        frequency: "Once daily",
        duration: "3 months",
        instructions: "Take with food",
      },
      {
        name: "Alpha lipoic acid",
        dose: "600 mg",
        frequency: "Once daily",
        duration: "3 months",
        instructions: "Take before meals",
      },
    ],
    notes:
      "Control underlying DM or nutritional cause. Physiotherapy may help.",
  },
  {
    diagnosis: "Vertigo / BPPV",
    category: "Neurological",
    medications: [
      {
        name: "Betahistine",
        dose: "16 mg",
        frequency: "3 times daily",
        duration: "4 weeks",
        instructions: "Take with food",
      },
      {
        name: "Cinnarizine",
        dose: "25 mg",
        frequency: "3 times daily",
        duration: "2 weeks",
        instructions: "May cause drowsiness",
      },
    ],
    notes: "Epley manoeuvre for BPPV. Refer ENT if persists beyond 4 weeks.",
  },
  // MUSCULOSKELETAL
  {
    diagnosis: "Osteoarthritis",
    category: "Musculoskeletal",
    medications: [
      {
        name: "Paracetamol",
        dose: "1 g",
        frequency: "3 times daily",
        duration: "As needed",
        instructions: "Do not exceed 4 g/day",
      },
      {
        name: "Celecoxib",
        dose: "200 mg",
        frequency: "Once daily",
        duration: "2-4 weeks",
        instructions: "Take with food; avoid in peptic ulcer",
      },
      {
        name: "Glucosamine sulfate",
        dose: "1500 mg",
        frequency: "Once daily",
        duration: "3 months",
        instructions: "Take with food",
      },
    ],
    notes: "Physiotherapy and weight reduction are cornerstone management.",
  },
  {
    diagnosis: "Rheumatoid Arthritis",
    category: "Musculoskeletal",
    medications: [
      {
        name: "Methotrexate",
        dose: "7.5-15 mg",
        frequency: "Once weekly",
        duration: "Ongoing",
        instructions: "Take folic acid on other days; monitor LFT and CBC",
      },
      {
        name: "Folic acid",
        dose: "5 mg",
        frequency: "Once daily (not on MTX day)",
        duration: "Ongoing",
        instructions: "Reduces MTX side effects",
      },
      {
        name: "Hydroxychloroquine",
        dose: "200 mg",
        frequency: "Twice daily",
        duration: "Ongoing",
        instructions: "Annual eye check for retinopathy",
      },
      {
        name: "Prednisolone",
        dose: "5-10 mg",
        frequency: "Once daily in the morning",
        duration: "Short-term bridging",
        instructions: "Taper gradually; take with calcium supplement",
      },
    ],
    notes:
      "Refer rheumatology. Baseline and periodic CBC, LFT, and CXR required.",
  },
  {
    diagnosis: "Gout (Acute)",
    category: "Musculoskeletal",
    medications: [
      {
        name: "Colchicine",
        dose: "0.5 mg",
        frequency: "Every 6-8 hours",
        duration: "3-5 days",
        instructions: "Stop at first sign of diarrhoea",
      },
      {
        name: "Indomethacin",
        dose: "50 mg",
        frequency: "3 times daily",
        duration: "5-7 days",
        instructions: "Take with food",
      },
    ],
    notes:
      "Avoid allopurinol during acute attack. Start urate-lowering therapy only after 4 weeks.",
  },
  {
    diagnosis: "Back Pain (Acute)",
    category: "Musculoskeletal",
    medications: [
      {
        name: "Ibuprofen",
        dose: "400 mg",
        frequency: "3 times daily with food",
        duration: "5-7 days",
        instructions: "Take with food",
      },
      {
        name: "Cyclobenzaprine (Muscle relaxant)",
        dose: "5 mg",
        frequency: "3 times daily",
        duration: "5 days",
        instructions: "May cause drowsiness; avoid driving",
      },
      {
        name: "Omeprazole",
        dose: "20 mg",
        frequency: "Once daily",
        duration: "5 days",
        instructions: "Gastric protection with NSAIDs",
      },
    ],
    notes: "Maintain activity. Bed rest not recommended beyond 2 days.",
  },
  {
    diagnosis: "Osteoporosis",
    category: "Musculoskeletal",
    medications: [
      {
        name: "Alendronate",
        dose: "70 mg",
        frequency: "Once weekly on empty stomach",
        duration: "Ongoing",
        instructions: "Remain upright for 30 minutes after dose",
      },
      {
        name: "Calcium carbonate",
        dose: "500 mg",
        frequency: "Twice daily with meals",
        duration: "Ongoing",
        instructions: "Take with meals for absorption",
      },
      {
        name: "Cholecalciferol (Vitamin D3)",
        dose: "1000 IU",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Take with fatty meal",
      },
    ],
    notes: "DEXA scan recommended. Fall prevention strategies.",
  },
  {
    diagnosis: "Fibromyalgia",
    category: "Musculoskeletal",
    medications: [
      {
        name: "Amitriptyline",
        dose: "10-25 mg",
        frequency: "Once daily at night",
        duration: "Ongoing",
        instructions: "Low dose; titrate up as needed",
      },
      {
        name: "Duloxetine",
        dose: "30-60 mg",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Monitor mood changes",
      },
      {
        name: "Pregabalin",
        dose: "75 mg",
        frequency: "Twice daily",
        duration: "Ongoing",
        instructions: "May cause drowsiness and weight gain",
      },
    ],
    notes: "Aerobic exercise and CBT are first-line. Avoid opioids.",
  },
  // INFECTIONS
  {
    diagnosis: "Urinary Tract Infection",
    category: "Infections",
    medications: [
      {
        name: "Nitrofurantoin",
        dose: "100 mg",
        frequency: "Twice daily",
        duration: "5-7 days",
        instructions: "Take with food",
      },
      {
        name: "Trimethoprim",
        dose: "200 mg",
        frequency: "Twice daily",
        duration: "7 days",
        instructions: "Increase fluid intake",
      },
    ],
    notes:
      "Urine C/S recommended. Increase oral fluid intake to 2-3 litres/day.",
  },
  {
    diagnosis: "Typhoid Fever",
    category: "Infections",
    medications: [
      {
        name: "Cefixime",
        dose: "200 mg",
        frequency: "Twice daily",
        duration: "14 days",
        instructions: "Take with or without food",
      },
      {
        name: "Paracetamol",
        dose: "500 mg",
        frequency: "3-4 times daily as needed",
        duration: "As needed",
        instructions: "For fever",
      },
    ],
    notes:
      "Consider ciprofloxacin based on local resistance pattern. Widal test for confirmation.",
  },
  {
    diagnosis: "Malaria (Uncomplicated)",
    category: "Infections",
    medications: [
      {
        name: "Artemether-Lumefantrine",
        dose: "4 tablets (80/480 mg)",
        frequency: "Twice daily (6 doses total over 3 days)",
        duration: "3 days",
        instructions: "Take with fatty meal for absorption",
      },
      {
        name: "Paracetamol",
        dose: "500 mg",
        frequency: "3-4 times daily",
        duration: "3 days",
        instructions: "For fever",
      },
    ],
    notes:
      "Confirm with RDT or blood film. Primaquine for P. vivax radical cure after G6PD check.",
  },
  {
    diagnosis: "Dengue Fever",
    category: "Infections",
    medications: [
      {
        name: "Paracetamol",
        dose: "500 mg",
        frequency: "3-4 times daily",
        duration: "As needed",
        instructions: "AVOID aspirin and ibuprofen (bleeding risk)",
      },
      {
        name: "ORS",
        dose: "200-400 ml",
        frequency: "Frequently",
        duration: "Until fever subsides",
        instructions: "Maintain oral hydration",
      },
    ],
    notes:
      "AVOID NSAIDs and aspirin. Monitor platelet count and haematocrit daily.",
  },
  {
    diagnosis: "Skin and Soft Tissue Infection",
    category: "Infections",
    medications: [
      {
        name: "Cloxacillin",
        dose: "500 mg",
        frequency: "4 times daily",
        duration: "7-10 days",
        instructions: "Take on empty stomach",
      },
      {
        name: "Ibuprofen",
        dose: "400 mg",
        frequency: "3 times daily",
        duration: "5 days",
        instructions: "Take with food for anti-inflammatory effect",
      },
    ],
    notes: "Mark erythema borders at presentation. Elevate affected limb.",
  },
  {
    diagnosis: "Wound Infection",
    category: "Infections",
    medications: [
      {
        name: "Co-amoxiclav",
        dose: "625 mg",
        frequency: "3 times daily",
        duration: "7 days",
        instructions: "Take after meals",
      },
      {
        name: "Metronidazole",
        dose: "400 mg",
        frequency: "3 times daily",
        duration: "7 days",
        instructions: "For anaerobic cover; avoid alcohol",
      },
      {
        name: "Tetanus toxoid",
        dose: "0.5 ml IM",
        frequency: "Single dose (if not immunised)",
        duration: "One-time",
        instructions: "Administer into deltoid",
      },
    ],
    notes:
      "Wound debridement and dressing essential. Culture from wound discharge.",
  },
  // MENTAL HEALTH
  {
    diagnosis: "Anxiety Disorder",
    category: "Mental Health",
    medications: [
      {
        name: "Sertraline",
        dose: "50 mg",
        frequency: "Once daily in the morning",
        duration: "6-12 months",
        instructions: "Takes 2-4 weeks for full effect",
      },
      {
        name: "Clonazepam",
        dose: "0.25-0.5 mg",
        frequency: "Twice daily as needed (short-term)",
        duration: "2-4 weeks",
        instructions: "Avoid long-term use; risk of dependence",
      },
    ],
    notes:
      "CBT is first-line. Avoid benzodiazepines long-term. Review in 4 weeks.",
  },
  {
    diagnosis: "Depression",
    category: "Mental Health",
    medications: [
      {
        name: "Escitalopram",
        dose: "10 mg",
        frequency: "Once daily",
        duration: "6-12 months",
        instructions:
          "Take at the same time each day; full effect in 4-6 weeks",
      },
      {
        name: "Mirtazapine",
        dose: "15 mg",
        frequency: "Once daily at night",
        duration: "6 months",
        instructions: "Useful if insomnia is a feature",
      },
    ],
    notes:
      "Assess suicide risk. Psychotherapy combined with medication is most effective.",
  },
  {
    diagnosis: "Insomnia",
    category: "Mental Health",
    medications: [
      {
        name: "Melatonin",
        dose: "2-5 mg",
        frequency: "Once at bedtime",
        duration: "4 weeks",
        instructions: "Take 30 minutes before sleep; dim lights",
      },
      {
        name: "Hydroxyzine",
        dose: "25 mg",
        frequency: "Once at bedtime as needed",
        duration: "2-4 weeks",
        instructions: "May cause drowsiness",
      },
    ],
    notes:
      "Sleep hygiene first: fixed bedtime, no screens before sleep. CBT-I most effective.",
  },
  // OTHERS
  {
    diagnosis: "Allergic Reaction (Mild)",
    category: "Others",
    medications: [
      {
        name: "Cetirizine",
        dose: "10 mg",
        frequency: "Once daily",
        duration: "7 days",
        instructions: "Take at night for best effect",
      },
      {
        name: "Hydrocortisone cream 1%",
        dose: "Apply thin layer",
        frequency: "Twice daily",
        duration: "7 days",
        instructions: "For skin involvement only",
      },
    ],
    notes:
      "Identify and avoid allergen. For angioedema or severe reaction, seek emergency care.",
  },
  {
    diagnosis: "Scabies",
    category: "Others",
    medications: [
      {
        name: "Permethrin cream 5%",
        dose: "Apply neck-to-toe",
        frequency: "Leave for 8-14 hours; repeat after 1 week",
        duration: "2 applications",
        instructions: "Apply to cool, dry skin; wash off after 8-14 hours",
      },
      {
        name: "Cetirizine",
        dose: "10 mg",
        frequency: "Once daily at night",
        duration: "2 weeks",
        instructions: "For itch relief",
      },
    ],
    notes:
      "Treat all household contacts simultaneously. Wash all clothes and bedding.",
  },
  {
    diagnosis: "Fungal Infection (Dermatophytosis)",
    category: "Others",
    medications: [
      {
        name: "Terbinafine",
        dose: "250 mg",
        frequency: "Once daily",
        duration: "2-4 weeks",
        instructions: "Take with food",
      },
      {
        name: "Clotrimazole cream 1%",
        dose: "Apply to affected area",
        frequency: "Twice daily",
        duration: "4 weeks",
        instructions: "Dry area before applying",
      },
    ],
    notes: "Keep area dry and clean. Avoid sharing towels or footwear.",
  },
];

export const DIMS_CATEGORIES = [
  ...new Set(DIMS_DATABASE.map((e) => e.category)),
];

export function searchDims(query: string): DimsEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return DIMS_DATABASE.filter(
    (e) =>
      e.diagnosis.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q),
  );
}

export function getDimsByDiagnosis(diagnosis: string): DimsEntry | undefined {
  return DIMS_DATABASE.find(
    (e) => e.diagnosis.toLowerCase() === diagnosis.toLowerCase(),
  );
}
