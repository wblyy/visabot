export interface PassportData {
  nameCN: string;
  surNameEN: string;
  givenNameEN: string;
  passportNo: string;
  nationality: string;
  dob: string; // YYYY-MM-DD
  gender: 'M' | 'F';
  issueDate: string;
  expiryDate: string;
  birthplace: string;
  issueAuthority: string;
}

export interface UserProfile {
  // Personal
  nameCN: string;
  nameEN: string;
  phone: string;
  email: string;
  address: string;
  maritalStatus: '未婚' | '已婚' | '离异' | '丧偶';

  // Employment
  employer: string;
  employerEN: string;
  position: string;
  positionEN: string;
  department: string;
  monthlySalary: string; // e.g. "¥15,000"
  employerAddress: string;
  employerPhone: string;
  employmentStartDate: string; // YYYY-MM-DD

  // Emergency contact
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export interface TravelIntent {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  cities: string[]; // e.g. ["东京", "大阪"]
  purpose: string; // e.g. "观光旅游"
  hotel?: string; // optional specific hotel
}

export interface MaterialFile {
  name: string;
  path: string;
  type: 'pdf' | 'jpg' | 'png';
  size: number;
}

export interface MaterialSet {
  sessionId: string;
  createdAt: string;
  visaForm?: MaterialFile;
  itinerary?: MaterialFile;
  hotelConfirmation?: MaterialFile;
  employmentLetter?: MaterialFile;
  photo?: MaterialFile;
}

export type GenerationStep =
  | 'ocr'
  | 'visa-form'
  | 'itinerary'
  | 'hotel'
  | 'employment'
  | 'photo';

export type StepStatus = 'pending' | 'running' | 'done' | 'error';

export interface AppState {
  currentSession: string | null;
  passport: PassportData | null;
  profile: UserProfile | null;
  intent: TravelIntent | null;
  materials: MaterialSet | null;
  steps: Record<GenerationStep, { status: StepStatus; message?: string }>;
}

export interface SSEEvent {
  type: 'step-update' | 'complete' | 'error';
  step?: GenerationStep;
  status?: StepStatus;
  message?: string;
  data?: unknown;
}
