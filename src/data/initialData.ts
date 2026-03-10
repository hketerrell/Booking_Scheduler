import { BookingState, DateSlot, DateTimeSlot, Scheduler, SchedulerConfig } from '../types';

const padTime = (value: number) => value.toString().padStart(2, '0');

const parseTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${padTime(hours)}:${padTime(mins)}`;
};

const generateBaseTimeSlots = (config: SchedulerConfig) => {
  const slots: Array<{ start: string; end: string; label: string }> = [];
  const startMinutes = parseTimeToMinutes(config.startTime);
  const endMinutes = parseTimeToMinutes(config.endTime);
  const duration = config.slotDurationMinutes;

  for (let current = startMinutes; current + duration <= endMinutes; current += duration) {
    const start = formatMinutesToTime(current);
    const end = formatMinutesToTime(current + duration);
    slots.push({ start, end, label: `${start} - ${end}` });
  }

  return slots;
};

export const generateDateSlots = (config: SchedulerConfig): DateSlot[] => {
  const slots: DateSlot[] = [];
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const excludedDates = new Set(config.excludeDates);
  const dailySlotCapacity = generateBaseTimeSlots(config).length * config.preferenceLimit;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (!config.weekdaysOnly || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      const dateString = currentDate.toISOString().split('T')[0];
      if (excludedDates.has(dateString)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      const label = currentDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      slots.push({
        id: `date-${dateString}`,
        label,
        date: dateString,
        currentBookings: 0,
        maxBookings: dailySlotCapacity,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
};

export const generateDateTimeSlots = (dateSlots: DateSlot[], config: SchedulerConfig): DateTimeSlot[] => {
  const baseSlots = generateBaseTimeSlots(config);
  const combinedSlots: DateTimeSlot[] = [];

  dateSlots.forEach((dateSlot) => {
    baseSlots.forEach((timeSlot) => {
      combinedSlots.push({
        id: `${dateSlot.id}-${timeSlot.start.replace(':', '')}`,
        dateId: dateSlot.id,
        dateLabel: dateSlot.label,
        label: timeSlot.label,
        startTime: timeSlot.start,
        endTime: timeSlot.end,
        currentBookings: 0,
        maxBookings: config.slotMaxBookings,
      });
    });
  });

  return combinedSlots;
};

export const DEFAULT_ADMIN_PASSCODE = 'hkUO@852';
export const DEFAULT_EMAIL_SUBJECT = 'Your booking is confirmed: {{slot}}';
export const DEFAULT_EMAIL_BODY =
  'Hello {{name}},\n\nYour booking has been confirmed for {{slot}}.\n' +
  'If you have any further enquiries, please let us know.\n\nThank you.';

export const buildDefaultConfig = (): SchedulerConfig => {
  const year = new Date().getFullYear();
  return {
    id: `config-${year}`,
    name: 'Default Schedule',
    maxSubmissions: 300,
    slotMaxBookings: 4,
    preferenceLimit: 5,
    startDate: new Date(year, 4, 1).toISOString().split('T')[0],
    endDate: new Date(year, 4, 31).toISOString().split('T')[0],
    excludeDates: [
      new Date(year, 4, 1).toISOString().split('T')[0],
      new Date(year, 4, 25).toISOString().split('T')[0],
    ],
    startTime: '09:30',
    endTime: '17:30',
    slotDurationMinutes: 60,
    weekdaysOnly: true,
  };
};

export const createScheduler = (name?: string, configOverride?: Partial<SchedulerConfig>): Scheduler => {
  const baseConfig = buildDefaultConfig();
  const config: SchedulerConfig = {
    ...baseConfig,
    ...configOverride,
    id: configOverride?.id ?? `config-${Date.now()}`,
    name: name ?? configOverride?.name ?? baseConfig.name,
  };
  const dateSlots = generateDateSlots(config);
  const dateTimeSlots = generateDateTimeSlots(dateSlots, config);

  return {
    id: `scheduler-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: config.name,
    submissions: [],
    dateSlots,
    dateTimeSlots,
    pageTitle: 'Booking Request',
    pageDescription: 'Add a short description for participants.',
    emailTemplateSubject: DEFAULT_EMAIL_SUBJECT,
    emailTemplateBody: DEFAULT_EMAIL_BODY,
    config,
  };
};

const normalizeScheduler = (scheduler: Scheduler): Scheduler => {
  const regeneratedDateSlots = generateDateSlots(scheduler.config);
  const slotCountByDate = scheduler.dateTimeSlots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.dateId] = (acc[slot.dateId] ?? 0) + 1;
    return acc;
  }, {});
  const bookingsByDate = scheduler.dateTimeSlots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.dateId] = (acc[slot.dateId] ?? 0) + slot.currentBookings;
    return acc;
  }, {});

  return {
    ...scheduler,
    dateSlots: regeneratedDateSlots.map((slot) => ({
      ...slot,
      currentBookings: bookingsByDate[slot.id] ?? 0,
      maxBookings: (slotCountByDate[slot.id] ?? 0) * scheduler.config.preferenceLimit,
    })),
  };
};

const sanitizeScheduler = (rawScheduler: Partial<Scheduler>): Scheduler => {
  const defaultConfig = buildDefaultConfig();
  const rawConfig = (rawScheduler as any).config as Partial<SchedulerConfig> | undefined;

  const config: SchedulerConfig = {
    ...defaultConfig,
    ...rawConfig,
    id: rawConfig?.id ?? `config-${Date.now()}`,
    name: rawConfig?.name ?? rawScheduler.name ?? defaultConfig.name,
  };

  const scheduler = createScheduler(rawScheduler.name ?? config.name, config);

  return normalizeScheduler({
    ...scheduler,
    ...rawScheduler,
    id: rawScheduler.id ?? scheduler.id,
    name: rawScheduler.name ?? scheduler.name,
    submissions: Array.isArray(rawScheduler.submissions) ? rawScheduler.submissions : [],
    dateSlots: Array.isArray(rawScheduler.dateSlots) ? rawScheduler.dateSlots : scheduler.dateSlots,
    dateTimeSlots: Array.isArray(rawScheduler.dateTimeSlots)
      ? rawScheduler.dateTimeSlots
      : scheduler.dateTimeSlots,
    pageTitle: rawScheduler.pageTitle ?? scheduler.pageTitle,
    pageDescription: rawScheduler.pageDescription ?? scheduler.pageDescription,
    emailTemplateSubject: rawScheduler.emailTemplateSubject ?? scheduler.emailTemplateSubject,
    emailTemplateBody: rawScheduler.emailTemplateBody ?? scheduler.emailTemplateBody,
    config,
  });
};

const migrateLegacyState = (parsed: Partial<BookingState>): BookingState | null => {
  if ('submissions' in parsed || 'dateSlots' in parsed || 'dateTimeSlots' in parsed) {
    const config = buildDefaultConfig();
    const scheduler: Scheduler = {
      id: `scheduler-${Date.now()}`,
      name: 'Default Schedule',
      submissions: (parsed as any).submissions ?? [],
      dateSlots: (parsed as any).dateSlots ?? generateDateSlots(config),
      dateTimeSlots: (parsed as any).dateTimeSlots ?? generateDateTimeSlots(generateDateSlots(config), config),
      pageTitle: (parsed as any).pageTitle ?? 'Booking Request',
      pageDescription: (parsed as any).pageDescription ?? 'Add a short description for participants.',
      emailTemplateSubject: (parsed as any).emailTemplateSubject ?? DEFAULT_EMAIL_SUBJECT,
      emailTemplateBody: (parsed as any).emailTemplateBody ?? DEFAULT_EMAIL_BODY,
      config,
    };

    return {
      schedulers: [scheduler],
      activeSchedulerId: scheduler.id,
      adminPasscode: (parsed as any).adminPasscode ?? DEFAULT_ADMIN_PASSCODE,
    };
  }
  return null;
};

const createFallbackState = (): BookingState => {
  const scheduler = createScheduler('Default Schedule');
  return {
    schedulers: [scheduler],
    activeSchedulerId: scheduler.id,
    adminPasscode: DEFAULT_ADMIN_PASSCODE,
  };
};

export const hydrateState = (parsed: Partial<BookingState>): BookingState | null => {
  const migrated = migrateLegacyState(parsed);
  if (migrated) {
    return migrated;
  }

  if (!Array.isArray(parsed.schedulers)) {
    return null;
  }

  const sanitizedSchedulers = parsed.schedulers
    .map((scheduler) => {
      try {
        return sanitizeScheduler(scheduler as Partial<Scheduler>);
      } catch {
        return null;
      }
    })
    .filter((scheduler): scheduler is Scheduler => scheduler !== null);

  if (sanitizedSchedulers.length === 0) {
    return null;
  }

  const hasActiveScheduler = sanitizedSchedulers.some((scheduler) => scheduler.id === parsed.activeSchedulerId);

  return {
    schedulers: sanitizedSchedulers,
    activeSchedulerId: hasActiveScheduler
      ? parsed.activeSchedulerId ?? sanitizedSchedulers[0].id
      : sanitizedSchedulers[0].id,
    adminPasscode: parsed.adminPasscode ?? DEFAULT_ADMIN_PASSCODE,
  };
};

export const getInitialState = (): BookingState => {
  return createFallbackState();
};

export const saveState = (_state: BookingState): void => {
  // Local storage persistence disabled. State is remote-only.
};
