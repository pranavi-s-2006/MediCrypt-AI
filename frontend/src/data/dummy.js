export const DUMMY_PATIENT = {
  id: 'PAT-2024-0042',
  name: 'Ravi Kumar',
  email: 'ravi.kumar@email.com',
  phone: '+91 98765 43210',
  blood_group: 'O+',
  age: 58,
  gender: 'Male',
  address: 'No. 14, Anna Nagar, Chennai – 600040',
  allergies: ['Penicillin', 'Sulfa drugs', 'Aspirin'],
  chronic_diseases: ['Type 2 Diabetes', 'Hypertension'],
  emergency_contact: '+91 98765 00001',
  emergency_contact_name: 'Kavitha Kumar (Wife)',
  caregivers: ['Kavitha Kumar'],
  last_visit: '2024-06-01',
  joined: '2022-03-15',
  insurance: 'Star Health – SH-2022-443321',
}

export const DUMMY_MEDICINES = [
  { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', duration: '90 days', prescribed_by: 'Dr. Priya Sharma', status: 'active' },
  { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: 'Ongoing', prescribed_by: 'Dr. Priya Sharma', status: 'active' },
  { name: 'Atorvastatin', dosage: '10mg', frequency: 'Once at night', duration: 'Ongoing', prescribed_by: 'Dr. Priya Sharma', status: 'active' },
  { name: 'Telmisartan', dosage: '40mg', frequency: 'Once daily', duration: 'Ongoing', prescribed_by: 'Dr. Arjun Mehta', status: 'active' },
  { name: 'Aspirin', dosage: '75mg', frequency: 'Once daily', duration: 'Stopped – Allergy', prescribed_by: 'Dr. Sneha Patel', status: 'inactive' },
]

export const DUMMY_INTERACTIONS = [
  { drug_a: 'Metformin', drug_b: 'Alcohol', level: 'Medium', description: 'Risk of lactic acidosis. Avoid alcohol during therapy.' },
  { drug_a: 'Atorvastatin', drug_b: 'Clarithromycin', level: 'High', description: 'CYP3A4 inhibition raises atorvastatin plasma levels — rhabdomyolysis risk.' },
  { drug_a: 'Amlodipine', drug_b: 'Simvastatin', level: 'Medium', description: 'Amlodipine inhibits CYP3A4 metabolism of simvastatin, increasing muscle toxicity risk.' },
]

export const DUMMY_RECORDS = [
  {
    _id: 'rec001',
    original_filename: 'Prescription_Apr2024.jpg',
    document_type: 'prescription',
    risk_alert: 'High',
    ai_summary: 'Atorvastatin + Clarithromycin interaction detected. Monitor for muscle pain and elevated CK levels.',
    ocr_text: 'Tab Metformin 500mg BD, Tab Atorvastatin 10mg HS, Tab Amlodipine 5mg OD',
    created_at: '2024-04-12T10:30:00Z',
    doctor: 'Dr. Priya Sharma',
    hospital: 'City Medical Centre',
    extracted_medicines: [{ name: 'Metformin' }, { name: 'Atorvastatin' }, { name: 'Amlodipine' }],
    drug_interactions: [{ drug_a: 'Atorvastatin', drug_b: 'Clarithromycin', level: 'High', description: 'Rhabdomyolysis risk — monitor CK levels' }],
  },
  {
    _id: 'rec002',
    original_filename: 'Lab_Report_Mar2024.pdf',
    document_type: 'lab_report',
    risk_alert: 'Low',
    ai_summary: 'HbA1c: 7.2%, Fasting glucose: 138 mg/dL. Diabetes under moderate control. eGFR stable at 72.',
    ocr_text: 'HbA1c 7.2% | FBS 138 mg/dL | Creatinine 1.1 | eGFR 72 | Total Cholesterol 192',
    created_at: '2024-03-05T08:15:00Z',
    doctor: 'Dr. Arjun Mehta',
    hospital: 'Apollo Diagnostics',
    extracted_medicines: [],
    drug_interactions: [],
  },
  {
    _id: 'rec003',
    original_filename: 'Discharge_Summary_Jan2024.pdf',
    document_type: 'discharge_summary',
    risk_alert: 'Low',
    ai_summary: 'Discharged after 3-day admission for hypertensive crisis. BP stabilised at 132/86. Continued on Amlodipine + Telmisartan.',
    ocr_text: 'Admitted with BP 190/110. IV Labetalol administered. Discharged on Amlodipine 5mg + Telmisartan 40mg.',
    created_at: '2024-01-20T14:00:00Z',
    doctor: 'Dr. Sneha Patel',
    hospital: 'City Medical Centre',
    extracted_medicines: [{ name: 'Amlodipine' }, { name: 'Telmisartan' }],
    drug_interactions: [],
  },
  {
    _id: 'rec004',
    original_filename: 'Echo_Report_Dec2023.pdf',
    document_type: 'scan_report',
    risk_alert: 'Medium',
    ai_summary: 'Echocardiogram shows mild LV diastolic dysfunction. EF 58%. Recommend follow-up in 6 months.',
    ocr_text: 'Ejection Fraction: 58%. Mild Grade 1 diastolic dysfunction. No significant valvular pathology.',
    created_at: '2023-12-10T11:00:00Z',
    doctor: 'Dr. Priya Sharma',
    hospital: 'City Medical Centre',
    extracted_medicines: [],
    drug_interactions: [],
  },
]

export const DUMMY_ACCESS_REQUESTS = [
  { _id: 'req001', doctor_id: 'Dr. Priya Sharma', doctor_specialty: 'Cardiology', hospital: 'City Medical Centre', patient_id: 'PAT-2024-0042', reason: 'Follow-up for hypertension management and cardiac review', status: 'pending', requested_at: '2024-06-10T09:00:00Z', expires_at: '2024-06-17T09:00:00Z' },
  { _id: 'req002', doctor_id: 'Dr. Arjun Mehta', doctor_specialty: 'Endocrinology', hospital: 'Apollo Specialty', patient_id: 'PAT-2024-0042', reason: 'Annual diabetic review and HbA1c monitoring', status: 'pending', requested_at: '2024-06-09T14:30:00Z', expires_at: '2024-06-16T14:30:00Z' },
  { _id: 'req003', doctor_id: 'Dr. Sneha Patel', doctor_specialty: 'General Medicine', hospital: 'City Medical Centre', patient_id: 'PAT-2024-0042', reason: 'Routine health checkup', status: 'approved', requested_at: '2024-05-20T11:00:00Z', expires_at: '2024-05-27T11:00:00Z' },
  { _id: 'req004', doctor_id: 'Dr. Ramesh Babu', doctor_specialty: 'Nephrology', hospital: 'MIOT Hospital', patient_id: 'PAT-2024-0042', reason: 'eGFR monitoring due to metformin use', status: 'rejected', requested_at: '2024-04-05T10:00:00Z', expires_at: '2024-04-12T10:00:00Z' },
]

export const DUMMY_DOCTOR = {
  id: 'DOC-2024-0018',
  name: 'Dr. Priya Sharma',
  email: 'priya.sharma@cityhospital.in',
  specialization: 'Cardiology',
  license_number: 'MCI-TN-2018-4421',
  hospital: 'City Medical Centre, Chennai',
  hospital_id: 'HOSP-CMC-001',
  department: 'Cardiology',
  qualification: 'MBBS, MD (Medicine), DM (Cardiology)',
  experience: '12 years',
  is_verified: true,
  approved_patients: 12,
  pending_requests: 3,
}

export const DUMMY_APPROVED_PATIENTS = [
  { patient_id: 'PAT-2024-0042', name: 'Ravi Kumar', age: 58, blood_group: 'O+', last_visit: '2024-06-01', risk: 'High', conditions: ['Diabetes', 'Hypertension'] },
  { patient_id: 'PAT-2024-0031', name: 'Meena Sundar', age: 45, blood_group: 'A+', last_visit: '2024-05-28', risk: 'Low', conditions: ['Hypothyroidism'] },
  { patient_id: 'PAT-2024-0019', name: 'Balaji Rao', age: 67, blood_group: 'B-', last_visit: '2024-05-15', risk: 'Medium', conditions: ['COPD', 'IHD'] },
  { patient_id: 'PAT-2024-0055', name: 'Lakshmi Devi', age: 52, blood_group: 'AB+', last_visit: '2024-06-08', risk: 'Medium', conditions: ['Arthritis', 'Osteoporosis'] },
]

export const DUMMY_DOCTORS = [
  { _id: 'd1', user_id: 'DOC-001', name: 'Dr. Priya Sharma', specialization: 'Cardiology', license_number: 'MCI-TN-2018-4421', is_verified: true, department: 'Cardiology', joined: '2022-01-10', patients: 24 },
  { _id: 'd2', user_id: 'DOC-002', name: 'Dr. Arjun Mehta', specialization: 'Endocrinology', license_number: 'MCI-TN-2019-3312', is_verified: false, department: 'Endocrinology', joined: '2024-05-20', patients: 0 },
  { _id: 'd3', user_id: 'DOC-003', name: 'Dr. Sneha Patel', specialization: 'General Medicine', license_number: 'MCI-TN-2020-1156', is_verified: true, department: 'General Medicine', joined: '2023-03-15', patients: 18 },
  { _id: 'd4', user_id: 'DOC-004', name: 'Dr. Ramesh Babu', specialization: 'Nephrology', license_number: 'MCI-TN-2021-2287', is_verified: false, department: 'Nephrology', joined: '2024-06-01', patients: 0 },
]

export const DUMMY_AUDIT_LOGS = [
  { _id: 'a1', user_id: 'DOC-001', user_name: 'Dr. Priya Sharma', action: 'view_patient_records', resource: 'medical_records', resource_id: 'PAT-2024-0042', timestamp: '2024-06-10T10:45:00Z', ip_address: '192.168.1.10', status: 'success' },
  { _id: 'a2', user_id: 'PAT-2024-0042', user_name: 'Ravi Kumar', action: 'generate_qr', resource: 'emergency_profiles', resource_id: 'PAT-2024-0042', timestamp: '2024-06-10T09:30:00Z', ip_address: '192.168.1.22', status: 'success' },
  { _id: 'a3', user_id: 'CAR-001', user_name: 'Kavitha Kumar', action: 'access_approved', resource: 'access_requests', resource_id: 'req001', timestamp: '2024-06-09T15:20:00Z', ip_address: '192.168.1.31', status: 'success' },
  { _id: 'a4', user_id: 'DOC-002', user_name: 'Dr. Arjun Mehta', action: 'request_access', resource: 'access_requests', resource_id: 'PAT-2024-0042', timestamp: '2024-06-09T14:30:00Z', ip_address: '192.168.1.14', status: 'success' },
  { _id: 'a5', user_id: 'PAT-2024-0042', user_name: 'Ravi Kumar', action: 'upload_file', resource: 'medical_records', resource_id: 'rec001', timestamp: '2024-04-12T10:30:00Z', ip_address: '192.168.1.22', status: 'success' },
  { _id: 'a6', user_id: 'ADM-001', user_name: 'Admin User', action: 'verify_doctor', resource: 'doctors', resource_id: 'DOC-001', timestamp: '2024-03-01T09:00:00Z', ip_address: '192.168.1.5', status: 'success' },
  { _id: 'a7', user_id: 'DOC-003', user_name: 'Dr. Sneha Patel', action: 'add_prescription', resource: 'medical_records', resource_id: 'PAT-2024-0031', timestamp: '2024-05-28T11:20:00Z', ip_address: '192.168.1.10', status: 'success' },
  { _id: 'a8', user_id: 'PAT-2024-0042', user_name: 'Ravi Kumar', action: 'login', resource: 'auth', resource_id: 'session', timestamp: '2024-06-10T09:00:00Z', ip_address: '192.168.1.22', status: 'success' },
  { _id: 'a9', user_id: 'UNKNOWN', user_name: 'Unknown', action: 'login', resource: 'auth', resource_id: 'session', timestamp: '2024-06-08T03:15:00Z', ip_address: '45.33.32.156', status: 'failed' },
]

export const DUMMY_EMERGENCY = {
  blood_group: 'O+',
  allergies: ['Penicillin', 'Sulfa drugs'],
  current_medicines: ['Metformin 500mg', 'Amlodipine 5mg', 'Atorvastatin 10mg', 'Telmisartan 40mg'],
  chronic_diseases: ['Type 2 Diabetes', 'Hypertension'],
  emergency_contact: '+91 98765 00001',
  emergency_contact_name: 'Kavitha Kumar (Wife)',
  patient_name: 'Ravi Kumar',
  patient_id: 'PAT-2024-0042',
  summary: 'Patient has Type 2 Diabetes and Hypertension. Allergic to Penicillin and Sulfa drugs. Currently on Metformin, Amlodipine, Atorvastatin, Telmisartan. No known surgical history.',
  generated_at: '2024-06-10T09:30:00Z',
}

export const DUMMY_CAREGIVER = {
  id: 'CAR-2024-001',
  name: 'Kavitha Kumar',
  email: 'kavitha.kumar@email.com',
  phone: '+91 98765 00001',
  relationship: 'Spouse',
  language_preference: 'Tamil',
  linked_patients: ['PAT-2024-0042'],
}

export const DUMMY_CAREGIVER_PATIENTS = [
  { _id: 'cp1', patient_user_id: 'PAT-2024-0042', name: 'Ravi Kumar', age: 58, blood_group: 'O+', relationship: 'Husband', language_preference: 'Tamil', last_activity: '2024-06-10T09:00:00Z', risk: 'High' },
]

export const DUMMY_HOSPITAL = {
  id: 'HOSP-CMC-001',
  name: 'City Medical Centre',
  registration_number: 'TN-HOS-2010-0042',
  address: '15, Poonamallee High Road, Chennai – 600010',
  departments: ['Cardiology', 'Endocrinology', 'General Medicine', 'Nephrology', 'Orthopedics', 'Neurology'],
  total_doctors: 4,
  verified_doctors: 2,
  total_patients: 156,
  active_sessions: 7,
}

export const DUMMY_SECURITY_EVENTS = [
  { id: 's1', type: 'failed_login', message: 'Failed login attempt from IP 45.33.32.156', severity: 'High', timestamp: '2024-06-08T03:15:00Z' },
  { id: 's2', type: 'unusual_access', message: 'Doctor DOC-002 accessed records outside working hours', severity: 'Medium', timestamp: '2024-06-07T23:45:00Z' },
  { id: 's3', type: 'qr_scan', message: 'Emergency QR scanned for PAT-2024-0042', severity: 'Low', timestamp: '2024-06-06T14:20:00Z' },
  { id: 's4', type: 'bulk_export', message: 'Bulk record export attempted by DOC-001 — blocked', severity: 'Critical', timestamp: '2024-06-05T10:10:00Z' },
]
