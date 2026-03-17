export interface DateSlot {
  id: string;
  label: string;
  date: string;
  currentBookings: number;
  maxBookings: number;
}

export interface DateTimeSlot {
  id: string;
  dateId: string;
  dateLabel: string;
  label: string;
  startTime: string;
  endTime: string;
  currentBookings: number;
  maxBookings: number;
}

export interface BookingSubmission {
  id: string;
  name: string;
  email: string;
  staffNumber: string;
  preferredDateIds: string[];
  preferences: string[]; // Top 3 date-time slot IDs
  buyCurrentIpad?: 'yes' | 'no';
  furtherEnquiries?: string;
  allUnavailable?: boolean;
  unavailableReason?: string;
  alternateRequest?: string;
  assignedSlotId?: string;
  emailSent?: boolean;
  submittedAt: string;
}

export interface SchedulerConfig {
  id: string;
  name: string;
  maxSubmissions: number;
  slotMaxBookings: number;
  preferenceLimit: number;
  startDate: string;
  endDate: string;
  excludeDates: string[];
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  weekdaysOnly: boolean;
}

export interface Scheduler {
  id: string;
  name: string;
  submissions: BookingSubmission[];
  dateSlots: DateSlot[];
  dateTimeSlots: DateTimeSlot[];
  pageTitle: string;
  pageDescription: string;
  emailTemplateSubject: string;
  emailTemplateBody: string;
  config: SchedulerConfig;
}

export interface BookingState {
  schedulers: Scheduler[];
  activeSchedulerId: string;
  adminPasscode: string;
}
