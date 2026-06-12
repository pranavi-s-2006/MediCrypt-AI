import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ────────────────────────────────────────────────
export const authLogin    = (data) => api.post('/auth/login', data)
export const authRegister = (data) => api.post('/auth/register', data)
export const authMe       = ()     => api.get('/auth/me')

// ── Patient ─────────────────────────────────────────────
export const getPatientProfile    = ()     => api.get('/patient/profile')
export const updatePatientProfile = (data) => api.put('/patient/profile', data)
export const uploadPatientFile    = (fd)   => api.post('/patient/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getPatientHistory    = ()     => api.get('/patient/history')
export const addCaregiver         = (id)   => api.post(`/patient/add-caregiver?caregiver_user_id=${encodeURIComponent(id)}`)
export const getPatientAccessRequests  = ()                    => api.get('/patient/access-requests')
export const respondPatientAccessRequest = (requestId, status) => api.post(`/patient/respond-access?request_id=${encodeURIComponent(requestId)}&status=${encodeURIComponent(status)}`)

// ── Doctor ───────────────────────────────────────────────
export const getDoctorProfile       = ()           => api.get('/doctor/profile')
export const saveDoctorProfile      = (data)       => api.post('/doctor/profile', data)
export const requestPatientAccess   = (pid, reason)=> api.post(`/doctor/request-access?patient_id=${encodeURIComponent(pid)}&reason=${encodeURIComponent(reason||'')}`)
export const getApprovedPatients    = ()           => api.get('/doctor/approved-patients')
export const getPatientRecords      = (pid)        => api.get(`/doctor/patient-records/${encodeURIComponent(pid)}`)
export const addPrescription        = (data)       => api.post('/doctor/add-prescription', data)
export const getDoctorDrugAlerts    = ()           => api.get('/doctor/drug-alerts')

// ── Caregiver ────────────────────────────────────────────
export const getCaregiverRequests  = ()     => api.get('/caregiver/pending-requests')
export const respondToRequest      = (data) => api.post('/caregiver/respond', data)
export const getCaregiverPatients  = ()     => api.get('/caregiver/patients')
export const getCaregiverAuditLogs = ()     => api.get('/caregiver/audit-logs')

// ── Hospital ─────────────────────────────────────────────
export const createHospital         = (data) => api.post('/hospital/create', data)
export const getHospitalDoctors     = ()     => api.get('/hospital/doctors')
export const verifyDoctor           = (data) => api.put('/hospital/verify-doctor', data)
export const getHospitalDepartments = ()     => api.get('/hospital/departments')
export const getHospitalAccessStatus      = (patientId) => api.get(`/hospital/access-status/${encodeURIComponent(patientId)}`)
export const getHospitalPatientRecords    = (patientId) => api.get(`/hospital/patient-records/${encodeURIComponent(patientId)}`)

// ── Hospital Appointment Flow ─────────────────────────────
// Search patient by ID for appointment check-in
export const lookupPatientById    = (patientId) => api.get(`/patient/lookup/${encodeURIComponent(patientId)}`)
// Hospital requests access to a patient's records (patient must approve)
export const hospitalRequestAccess = (patientId, reason) =>
  api.post(`/hospital/request-patient-access?patient_id=${encodeURIComponent(patientId)}&reason=${encodeURIComponent(reason || '')}`)
// Hospital forwards patient records to an assigned doctor
export const forwardToDoctor      = (data) => api.post('/hospital/forward-to-doctor', data)
// Get list of active hospital-initiated access sessions
export const getActiveAppointments = () => api.get('/hospital/active-appointments')
// Revoke hospital access to a patient (patient-initiated or hospital-initiated)
export const revokeHospitalAccess  = (patientId) =>
  api.post(`/hospital/revoke-access?patient_id=${encodeURIComponent(patientId)}`)
// Hospital uploads prescription on behalf of a doctor after consultation
export const hospitalUploadPrescription = (fd) =>
  api.post('/hospital/upload-prescription', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  })

// ── AI ───────────────────────────────────────────────────
// POST /patient/upload-prescription  (used by UploadPrescription page — saves file + triggers pipeline)
export const uploadPrescription   = (fd)        => api.post('/patient/upload-prescription', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 })
// POST /ai/retry-ocr/:record_id  — re-run OCR + downstream on already-uploaded file
export const retryOCR             = (recordId)  => api.post(`/ai/retry-ocr/${encodeURIComponent(recordId)}`, {}, { timeout: 180000 })
export const processPrescription  = (fd)        => api.post('/ai/process-prescription', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const checkDrugInteraction = (medicines) => api.post('/ai/check-drug-interaction', { medicines })
export const comparePrescriptions = (fd) => api.post('/ai/compare-prescriptions', fd, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 180_000,
})
export const runOCR               = (fd)        => api.post('/ai/ocr', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const extractMedicine      = (ocr_text)  => api.post('/ai/extract-medicine', { ocr_text })
// Doctor prescription analysis pipeline
export const analyzePrescription  = (fd)        => api.post('/doctor/analyze-prescription', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 })
export const acceptPrescription   = (draftId)   => api.post(`/doctor/accept-prescription/${encodeURIComponent(draftId)}`)
export const overridePrescription = (draftId, reason) => api.post(`/doctor/override-prescription/${encodeURIComponent(draftId)}`, { reason })

// ── Emergency (authenticated) ────────────────────────────
export const getEmergencyProfile  = ()  => api.get('/emergency/profile')
export const generateEmergencyQR  = ()  => api.post('/emergency/generate-qr')
export const getQRImage           = ()  => api.get('/emergency/qr-image', { responseType: 'blob' })
export const createEmergencyProfile  = (data) => api.post('/emergency/create-profile', data)
export const updateEmergencyProfile  = (data) => api.put('/emergency/update-profile', data)

// ── Emergency QR scan — PUBLIC (no auth) ─────────────────
// GET /emergency/scan/:patient_id — called when QR code is scanned
export const scanEmergencyQR = (patientId) =>
  axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/emergency/scan/${encodeURIComponent(patientId)}`)

// ── Face Recognition ─────────────────────────────────────
// POST /emergency/face-register — patient uploads photo (auth required)
export const registerFace = (fd) =>
  api.post('/emergency/face-register', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })

// GET /emergency/face-status — check if face is registered
export const getFaceStatus = () => api.get('/emergency/face-status')

// DELETE /emergency/face-revoke — remove face data
export const revokeFace = () => api.delete('/emergency/face-revoke')

// POST /emergency/face-scan — PUBLIC, no auth, sends webcam frame
// Returns emergency profile of matched patient
export const faceScanEmergency = (fd) =>
  axios.post(
    `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/emergency/face-scan`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }
  )

// ── Queue ────────────────────────────────────────────────
export const addToQueue             = (data)    => api.post('/queue/add', data, { timeout: 60000 })
export const sendFileToDoctorQueue  = (data)    => api.post('/queue/send-file', data)
export const completeConsultation   = (data)    => api.post('/queue/complete', data)
export const uploadQueueReport      = (fd)      => api.post('/queue/upload-report', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
export const getHospitalQueue       = (doctorId)=> api.get(`/queue/hospital/${encodeURIComponent(doctorId)}`)
export const getDoctorQueue         = ()        => api.get('/queue/doctor')
export const getConsultationRecords = (queueId) => api.get(`/queue/patient-records/${encodeURIComponent(queueId)}`)
export const savePrescription       = (data)    => api.post('/queue/save-prescription', data)

// ── Audit ────────────────────────────────────────────────
export const getAuditLogs = (limit = 100) => api.get(`/audit/logs?limit=${limit}`)

export default api
