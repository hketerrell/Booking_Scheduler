import { useEffect, useMemo, useState } from 'react';
import { BookingSubmission, DateSlot, DateTimeSlot, Scheduler, SchedulerConfig } from '../types';
import { cn } from '../utils/cn';

interface AdminPanelProps {
  scheduler: Scheduler;
  schedulers: Scheduler[];
  activeSchedulerId: string;
  adminPasscode: string;
  onResetData: () => void;
  onUpdateSlotLimit: (slotId: string, newLimit: number) => void;
  onUpdateDateLimit: (dateId: string, newLimit: number) => void;
  onAssignSlot: (submissionId: string, slotId: string) => void;
  onUpdatePageInfo: (title: string, description: string) => void;
  onUpdateEmailTemplate: (subject: string, body: string) => void;
  onUpdateSchedulerConfig: (schedulerId: string, config: SchedulerConfig) => void;
  onSetActiveScheduler: (schedulerId: string) => void;
  onMarkEmailSent: (submissionId: string) => void;
}

type AdminTab = 'overview' | 'submissions' | 'email' | 'settings';
type PreferenceFilter = '' | '1' | '2' | '3' | 'all-unavailable';
type StatusFilter = '' | 'pending' | 'assigned' | 'email-sent' | 'all-unavailable';
type BuyIpadFilter = '' | 'yes' | 'no';

type PreferenceEntry = {
  slot: DateTimeSlot;
  preference: 1 | 2 | 3;
  assigned: boolean;
};

type StatusMeta = {
  key: StatusFilter;
  label: string;
  tone: string;
};

const tabs: AdminTab[] = ['overview', 'submissions', 'email', 'settings'];

const preferenceToneMap: Record<1 | 2 | 3, string> = {
  1: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  2: 'border-amber-200 bg-amber-50 text-amber-700',
  3: 'border-rose-200 bg-rose-50 text-rose-700',
};

const formatSlotLabel = (slot: { dateLabel: string; label: string }) => `${slot.dateLabel} ${slot.label}`;

const formatDateValue = (date: string) =>
  new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

const getAvailabilityTone = (percentage: number) => {
  if (percentage >= 100) {
    return 'border-slate-300 bg-slate-100 text-slate-700';
  }
  if (percentage >= 90) {
    return 'border-red-300 bg-red-50 text-red-700';
  }
  if (percentage >= 70) {
    return 'border-amber-300 bg-amber-50 text-amber-700';
  }
  return 'border-emerald-300 bg-emerald-50 text-emerald-700';
};

const getSubmissionStatus = (submission: BookingSubmission): StatusMeta => {
  if (submission.emailSent) {
    return {
      key: 'email-sent',
      label: 'Email sent',
      tone: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    };
  }

  if (submission.assignedSlotId) {
    return {
      key: 'assigned',
      label: 'Assigned, pending email',
      tone: 'border-indigo-200 bg-indigo-100 text-indigo-700',
    };
  }

  if (submission.allUnavailable) {
    return {
      key: 'all-unavailable',
      label: 'All unavailable',
      tone: 'border-rose-200 bg-rose-100 text-rose-700',
    };
  }

  return {
    key: 'pending',
    label: 'Pending assignment',
    tone: 'border-amber-200 bg-amber-100 text-amber-700',
  };
};

const buildMailto = (emails: string[], subject: string, body: string) =>
  `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const buildConfigDateOptions = (config: SchedulerConfig) => {
  if (!config.startDate || !config.endDate) {
    return [] as string[];
  }

  const start = new Date(config.startDate);
  const end = new Date(config.endDate);
  const dates: string[] = [];

  for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const weekday = current.getDay();
    if (config.weekdaysOnly && (weekday === 0 || weekday === 6)) {
      continue;
    }
    dates.push(current.toISOString().split('T')[0]);
  }

  return dates;
};

export function AdminPanel({
  scheduler,
  schedulers,
  activeSchedulerId,
  adminPasscode,
  onResetData,
  onUpdateSlotLimit,
  onUpdateDateLimit,
  onAssignSlot,
  onUpdatePageInfo,
  onUpdateEmailTemplate,
  onUpdateSchedulerConfig,
  onSetActiveScheduler,
  onMarkEmailSent,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [filterDate, setFilterDate] = useState('');
  const [filterSlot, setFilterSlot] = useState('');
  const [filterPreference, setFilterPreference] = useState<PreferenceFilter>('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('');
  const [filterBuyIpad, setFilterBuyIpad] = useState<BuyIpadFilter>('');
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [selectedOverviewDateId, setSelectedOverviewDateId] = useState(scheduler.dateSlots[0]?.id ?? '');
  const [selectedOverviewSlotId, setSelectedOverviewSlotId] = useState('');
  const [tempTitle, setTempTitle] = useState(scheduler.pageTitle);
  const [tempDescription, setTempDescription] = useState(scheduler.pageDescription);
  const [tempEmailSubject, setTempEmailSubject] = useState(scheduler.emailTemplateSubject);
  const [tempEmailBody, setTempEmailBody] = useState(scheduler.emailTemplateBody);
  const [tempConfig, setTempConfig] = useState<SchedulerConfig>(scheduler.config);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [tempSlotLimit, setTempSlotLimit] = useState(scheduler.config.slotMaxBookings);
  const [tempDateLimit, setTempDateLimit] = useState(scheduler.dateSlots[0]?.maxBookings ?? 0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [emailSaveMessage, setEmailSaveMessage] = useState('');

  const { submissions, dateSlots, dateTimeSlots } = scheduler;

  const slotById = useMemo(
    () => Object.fromEntries(dateTimeSlots.map((slot) => [slot.id, slot])),
    [dateTimeSlots]
  );

  useEffect(() => {
    setTempTitle(scheduler.pageTitle);
    setTempDescription(scheduler.pageDescription);
    setTempEmailSubject(scheduler.emailTemplateSubject);
    setTempEmailBody(scheduler.emailTemplateBody);
    setTempConfig(scheduler.config);
    setSelectedSubmissionIds([]);
    setSelectedOverviewDateId((current) =>
      scheduler.dateSlots.some((slot) => slot.id === current) ? current : scheduler.dateSlots[0]?.id ?? ''
    );
  }, [scheduler]);

  const configDateOptions = useMemo(() => buildConfigDateOptions(tempConfig), [tempConfig]);

  const daySlots = useMemo(
    () => dateTimeSlots.filter((slot) => slot.dateId === selectedOverviewDateId),
    [dateTimeSlots, selectedOverviewDateId]
  );

  useEffect(() => {
    if (selectedOverviewSlotId && !daySlots.some((slot) => slot.id === selectedOverviewSlotId)) {
      setSelectedOverviewSlotId('');
    }
  }, [daySlots, selectedOverviewSlotId]);

  const getDateStats = (dateId: string) =>
    dateTimeSlots.filter((slot) => slot.dateId === dateId).reduce((sum, slot) => sum + slot.currentBookings, 0);

  const getAssignedCount = (slotId: string) =>
    submissions.filter((submission) => submission.assignedSlotId === slotId).length;

  const getPreferenceStats = (slotId: string) => {
    let first = 0;
    let second = 0;
    let third = 0;

    submissions.forEach((submission) => {
      if (submission.preferences[0] === slotId) first += 1;
      if (submission.preferences[1] === slotId) second += 1;
      if (submission.preferences[2] === slotId) third += 1;
    });

    return { first, second, third };
  };

  const getPreferenceEntries = (submission: BookingSubmission): PreferenceEntry[] =>
    submission.preferences
      .map((slotId, index) => {
        const slot = slotById[slotId];
        if (!slot) {
          return null;
        }

        return {
          slot,
          preference: (index + 1) as 1 | 2 | 3,
          assigned: submission.assignedSlotId === slot.id,
        };
      })
      .filter(Boolean) as PreferenceEntry[];

  const getVisiblePreferenceEntries = (submission: BookingSubmission) => {
    if (submission.allUnavailable) {
      return [] as PreferenceEntry[];
    }

    let entries = getPreferenceEntries(submission);

    if (filterPreference && filterPreference !== 'all-unavailable') {
      entries = entries.filter((entry) => entry.preference === Number(filterPreference));
    }
    if (filterDate) {
      entries = entries.filter((entry) => entry.slot.dateId === filterDate);
    }
    if (filterSlot) {
      entries = entries.filter((entry) => entry.slot.id === filterSlot);
    }

    if (submission.assignedSlotId) {
      const assignedEntry = entries.find((entry) => entry.slot.id === submission.assignedSlotId);
      if (assignedEntry) {
        return [assignedEntry];
      }
    }

    return entries;
  };

  const getVisiblePreferredDates = (submission: BookingSubmission) => {
    const grouped = new Map<string, { label: string; ranks: Array<1 | 2 | 3> }>();

    getVisiblePreferenceEntries(submission).forEach((entry) => {
      const current = grouped.get(entry.slot.dateId) ?? { label: entry.slot.dateLabel, ranks: [] };
      grouped.set(entry.slot.dateId, {
        label: entry.slot.dateLabel,
        ranks: [...current.ranks, entry.preference],
      });
    });

    return Array.from(grouped.entries()).map(([id, value]) => ({
      id,
      label: value.label,
      ranks: Array.from(new Set(value.ranks)).sort((left, right) => left - right),
    }));
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      const status = getSubmissionStatus(submission);
      if (filterStatus && status.key !== filterStatus) {
        return false;
      }

      if (filterPreference === 'all-unavailable') {
        if (!submission.allUnavailable) {
          return false;
        }
      }

      if (filterBuyIpad && submission.buyCurrentIpad !== filterBuyIpad) {
        return false;
      }

      if (submission.allUnavailable) {
        return filterPreference === 'all-unavailable'
          ? !filterDate && !filterSlot
          : !filterDate && !filterSlot && !filterPreference;
      }

      let entries = getPreferenceEntries(submission);
      if (filterPreference) {
        entries = entries.filter((entry) => entry.preference === Number(filterPreference));
      }
      if (filterDate) {
        entries = entries.filter((entry) => entry.slot.dateId === filterDate);
      }
      if (filterSlot) {
        entries = entries.filter((entry) => entry.slot.id === filterSlot);
      }

      return entries.length > 0 || (!filterDate && !filterSlot && !filterPreference);
    });
  }, [filterDate, filterPreference, filterSlot, filterStatus, filterBuyIpad, submissions, slotById]);

  const totalSlotCapacity = dateTimeSlots.reduce((sum, slot) => sum + slot.maxBookings, 0);
  const remainingSlotCapacity = dateTimeSlots.reduce(
    (sum, slot) => sum + Math.max(slot.maxBookings - slot.currentBookings, 0),
    0
  );
  const assignedCount = submissions.filter((submission) => Boolean(submission.assignedSlotId)).length;
  const pendingEmailCount = submissions.filter(
    (submission) => submission.assignedSlotId && !submission.emailSent
  ).length;
  const allUnavailableSubmissions = submissions.filter((submission) => submission.allUnavailable);

  const selectedSubmissions = filteredSubmissions.filter((submission) =>
    selectedSubmissionIds.includes(submission.id)
  );
  const selectedAssignedSlotIds = Array.from(
    new Set(selectedSubmissions.map((submission) => submission.assignedSlotId).filter(Boolean))
  );
  const selectedGroupSlot = selectedAssignedSlotIds[0] ? slotById[selectedAssignedSlotIds[0]] : undefined;
  const canSendSelected =
    selectedSubmissions.length > 0 &&
    selectedSubmissions.every((submission) => Boolean(submission.assignedSlotId)) &&
    selectedAssignedSlotIds.length === 1;

  const overviewDetails = useMemo(() => {
    if (!selectedOverviewSlotId) {
      return [] as Array<{ submission: BookingSubmission; preference: number | null; assigned: boolean }>;
    }

    return submissions
      .map((submission) => {
        const preferenceIndex = submission.preferences.findIndex((slotId) => slotId === selectedOverviewSlotId);
        const assigned = submission.assignedSlotId === selectedOverviewSlotId;
        if (preferenceIndex === -1 && !assigned) {
          return null;
        }
        return {
          submission,
          preference: preferenceIndex === -1 ? null : preferenceIndex + 1,
          assigned,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftItem = left!;
        const rightItem = right!;
        const leftRank = leftItem.preference ?? 99;
        const rightRank = rightItem.preference ?? 99;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        if (leftItem.assigned !== rightItem.assigned) {
          return leftItem.assigned ? -1 : 1;
        }
        return leftItem.submission.submittedAt.localeCompare(rightItem.submission.submittedAt);
      }) as Array<{ submission: BookingSubmission; preference: number | null; assigned: boolean }>;
  }, [selectedOverviewSlotId, submissions]);

  const previewSubmission = submissions[0];
  const previewSlot = previewSubmission?.assignedSlotId
    ? slotById[previewSubmission.assignedSlotId]
    : dateTimeSlots[0];
  const previewSlotLabel = previewSlot ? formatSlotLabel(previewSlot) : 'Selected slot';
  const previewSubject = tempEmailSubject.replace('{{slot}}', previewSlotLabel);
  const previewBody = tempEmailBody
    .replace('{{name}}', previewSubmission?.name ?? 'Applicant')
    .replace('{{slot}}', previewSlotLabel);

  const toggleSelectSubmission = (submissionId: string) => {
    setSelectedSubmissionIds((current) =>
      current.includes(submissionId)
        ? current.filter((id) => id !== submissionId)
        : [...current, submissionId]
    );
  };

  const selectAllVisible = () => {
    setSelectedSubmissionIds((current) => {
      const next = new Set(current);
      filteredSubmissions.forEach((submission) => next.add(submission.id));
      return Array.from(next);
    });
  };

  const deselectAllVisible = () => {
    setSelectedSubmissionIds((current) =>
      current.filter((id) => !filteredSubmissions.some((submission) => submission.id === id))
    );
  };

  const handleSendEmail = (submission: BookingSubmission) => {
    const slot = submission.assignedSlotId ? slotById[submission.assignedSlotId] : undefined;
    const slotLabel = slot ? formatSlotLabel(slot) : 'Alternative arrangement follow-up';
    const subject = scheduler.emailTemplateSubject.replace('{{slot}}', slotLabel);
    const body = scheduler.emailTemplateBody
      .replace('{{name}}', submission.name)
      .replace('{{slot}}', slotLabel);

    window.open(buildMailto([submission.email], subject, body), '_blank');
    onMarkEmailSent(submission.id);
  };

  const handleSendSelected = () => {
    if (!canSendSelected || !selectedGroupSlot) {
      window.alert('Select applicants assigned to the same time slot before sending a group email.');
      return;
    }

    const slotLabel = formatSlotLabel(selectedGroupSlot);
    const subject = scheduler.emailTemplateSubject.replace('{{slot}}', slotLabel);
    const body = scheduler.emailTemplateBody.replace('{{name}}', 'Applicant').replace('{{slot}}', slotLabel);

    window.open(
      buildMailto(selectedSubmissions.map((submission) => submission.email), subject, body),
      '_blank'
    );

    selectedSubmissions.forEach((submission) => onMarkEmailSent(submission.id));
  };

  const handleToggleExcludeDate = (date: string) => {
    setTempConfig((current) => ({
      ...current,
      excludeDates: current.excludeDates.includes(date)
        ? current.excludeDates.filter((item) => item !== date)
        : [...current.excludeDates, date].sort(),
    }));
  };

  const handleSaveConfig = () => {
    const confirmed = window.confirm(
      'Saving schedule settings will rebuild dates and time slots for this plan and clear submissions. Continue?'
    );
    if (!confirmed) {
      return;
    }

    onUpdateSchedulerConfig(scheduler.id, tempConfig);
  };

  const slotOptions = filterDate
    ? dateTimeSlots.filter((slot) => slot.dateId === filterDate)
    : dateTimeSlots;

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
      <div className="bg-slate-900 px-5 py-6 text-white sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Admin Dashboard</h2>
            <p className="mt-1 text-sm text-slate-300">
              Manage submissions, assignments, email templates, and schedule settings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Active plan</span>
            <select
              value={activeSchedulerId}
              onChange={(event) => onSetActiveScheduler(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
            >
              {schedulers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-6">
        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <div className="text-sm text-slate-300">Total submissions</div>
                <div className="mt-2 text-3xl font-semibold">{submissions.length}</div>
                <div className="mt-1 text-sm text-slate-400">of {scheduler.config.maxSubmissions}</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="text-sm text-emerald-700">Remaining request spots</div>
                <div className="mt-2 text-3xl font-semibold text-emerald-800">{remainingSlotCapacity}</div>
                <div className="mt-1 text-sm text-emerald-600">of {totalSlotCapacity}</div>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
                <div className="text-sm text-indigo-700">Assigned applicants</div>
                <div className="mt-2 text-3xl font-semibold text-indigo-800">{assignedCount}</div>
                <div className="mt-1 text-sm text-indigo-600">{pendingEmailCount} awaiting email</div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <div className="text-sm text-rose-700">All unavailable requests</div>
                <div className="mt-2 text-3xl font-semibold text-rose-800">{allUnavailableSubmissions.length}</div>
                <div className="mt-1 text-sm text-rose-600">Need follow-up arrangement</div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.2fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-800">Date Availability</h3>
                <div className="mt-4 space-y-3">
                  {dateSlots.map((date) => {
                    const current = getDateStats(date.id);
                    const percentage = date.maxBookings === 0 ? 0 : (current / date.maxBookings) * 100;
                    const remaining = Math.max(date.maxBookings - current, 0);

                    return (
                      <button
                        key={date.id}
                        type="button"
                        onClick={() => setSelectedOverviewDateId(date.id)}
                        className={cn(
                          'w-full rounded-2xl border p-4 text-left transition-colors',
                          getAvailabilityTone(percentage),
                          selectedOverviewDateId === date.id && 'ring-2 ring-indigo-300'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{date.label}</span>
                          <span className="text-sm font-medium">{remaining} left</span>
                        </div>
                        <div className="mt-2 text-sm">
                          {current} / {date.maxBookings} request spots used
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Time Slot Availability</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Click a slot to review who selected it and their preference order.
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {dateSlots.find((date) => date.id === selectedOverviewDateId)?.label}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {daySlots.map((slot) => {
                    const percentage = slot.maxBookings === 0 ? 0 : (slot.currentBookings / slot.maxBookings) * 100;
                    const preferenceStats = getPreferenceStats(slot.id);
                    const assigned = getAssignedCount(slot.id);

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedOverviewSlotId(slot.id)}
                        className={cn(
                          'rounded-2xl border p-4 text-left transition-colors',
                          getAvailabilityTone(percentage),
                          selectedOverviewSlotId === slot.id && 'ring-2 ring-indigo-300'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{slot.label}</div>
                            <div className="mt-1 text-sm">
                              {slot.currentBookings} / {slot.maxBookings} request spots used
                            </div>
                          </div>
                          {assigned > 0 && (
                            <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                              Assigned {assigned}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                            P1 {preferenceStats.first}
                          </span>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                            P2 {preferenceStats.second}
                          </span>
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
                            P3 {preferenceStats.third}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-800">Selected Slot Summary</h3>
                {!selectedOverviewSlotId ? (
                  <p className="mt-4 text-sm text-slate-500">Choose a time slot to view the applicant list.</p>
                ) : overviewDetails.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No applicants selected this time slot.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {overviewDetails.map(({ submission, preference, assigned }) => (
                      <div key={submission.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-800">{submission.name}</div>
                            <div className="text-sm text-slate-500">{submission.email}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {preference && (
                              <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', preferenceToneMap[preference as 1 | 2 | 3])}>
                                Preference {preference}
                              </span>
                            )}
                            {assigned && (
                              <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                Assigned
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-slate-800">All Dates Unavailable Requests</h3>
              {allUnavailableSubmissions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No all-unavailable requests yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left text-slate-600">
                        <th className="border border-slate-200 px-3 py-2 font-semibold">Name</th>
                        <th className="border border-slate-200 px-3 py-2 font-semibold">Email</th>
                        <th className="border border-slate-200 px-3 py-2 font-semibold">Reason</th>
                        <th className="border border-slate-200 px-3 py-2 font-semibold">Alternate date/time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUnavailableSubmissions.map((submission) => (
                        <tr key={submission.id} className="odd:bg-white even:bg-slate-50">
                          <td className="border border-slate-200 px-3 py-2">{submission.name}</td>
                          <td className="border border-slate-200 px-3 py-2">{submission.email}</td>
                          <td className="border border-slate-200 px-3 py-2">{submission.unavailableReason || 'Not provided'}</td>
                          <td className="border border-slate-200 px-3 py-2">{submission.alternateRequest || 'Not provided'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Filter by date</label>
                  <select
                    value={filterDate}
                    onChange={(event) => {
                      setFilterDate(event.target.value);
                      setFilterSlot('');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All dates</option>
                    {dateSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Filter by time slot</label>
                  <select
                    value={filterSlot}
                    onChange={(event) => setFilterSlot(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All time slots</option>
                    {slotOptions.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {formatSlotLabel(slot)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Filter by preference</label>
                  <select
                    value={filterPreference}
                    onChange={(event) => setFilterPreference(event.target.value as PreferenceFilter)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All preferences</option>
                    <option value="1">Preference 1</option>
                    <option value="2">Preference 2</option>
                    <option value="3">Preference 3</option>
                    <option value="all-unavailable">All unavailable</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Buy current iPad</label>
                  <select
                    value={filterBuyIpad}
                    onChange={(event) => setFilterBuyIpad(event.target.value as BuyIpadFilter)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All responses</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Filter by status</label>
                  <select
                    value={filterStatus}
                    onChange={(event) => setFilterStatus(event.target.value as StatusFilter)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending assignment</option>
                    <option value="assigned">Assigned, pending email</option>
                    <option value="email-sent">Email sent</option>
                    <option value="all-unavailable">All unavailable</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Select all visible
                </button>
                <button
                  type="button"
                  onClick={deselectAllVisible}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Deselect all visible
                </button>
                <button
                  type="button"
                  onClick={handleSendSelected}
                  disabled={!canSendSelected}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                    canSendSelected
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'cursor-not-allowed bg-slate-200 text-slate-500'
                  )}
                >
                  Send group email
                </button>
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {canSendSelected
                  ? `Selected applicants share ${selectedGroupSlot ? formatSlotLabel(selectedGroupSlot) : 'the same assigned slot'}.`
                  : 'Group email is available only when all selected applicants are assigned to the same slot.'}
              </p>
            </section>

            <section className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">
                        <input
                          type="checkbox"
                          checked={filteredSubmissions.length > 0 && filteredSubmissions.every((s) => selectedSubmissionIds.includes(s.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubmissionIds((current) => {
                                const next = new Set(current);
                                filteredSubmissions.forEach((s) => next.add(s.id));
                                return Array.from(next);
                              });
                            } else {
                              setSelectedSubmissionIds((current) =>
                                current.filter((id) => !filteredSubmissions.some((s) => s.id === id))
                              );
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                      </th>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Staff #</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Buy iPad</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Preferred Dates</th>
                      <th className="px-3 py-2 font-semibold">Preferred Slots</th>
                      <th className="px-3 py-2 font-semibold">Assigned Slot</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubmissions.map((submission) => {
                      const status = getSubmissionStatus(submission);
                      const visibleEntries = getVisiblePreferenceEntries(submission);
                      const visibleDates = getVisiblePreferredDates(submission);
                      const assignedSlot = submission.assignedSlotId ? slotById[submission.assignedSlotId] : undefined;
                      const isSelected = selectedSubmissionIds.includes(submission.id);

                      return (
                        <tr
                          key={submission.id}
                          className={cn(
                            'hover:bg-slate-50',
                            isSelected && 'bg-indigo-50'
                          )}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectSubmission(submission.id)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">{submission.name}</td>
                          <td className="px-3 py-2 text-slate-600">{submission.staffNumber}</td>
                          <td className="px-3 py-2 text-slate-600">{submission.email}</td>
                          <td className="px-3 py-2 text-slate-600">{submission.buyCurrentIpad ? submission.buyCurrentIpad.toUpperCase() : '—'}</td>
                          <td className="px-3 py-2">
                            <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', status.tone)}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {submission.allUnavailable ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                                All unavailable
                              </span>
                            ) : visibleDates.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {visibleDates.map((date) => (
                                  <div key={date.id} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                    <span className="text-xs text-slate-700">{date.label}</span>
                                    <div className="flex gap-0.5">
                                      {date.ranks.map((rank) => (
                                        <span
                                          key={rank}
                                          className={cn(
                                            'rounded-full px-1 py-0.5 text-[9px] font-semibold',
                                            preferenceToneMap[rank]
                                          )}
                                        >
                                          P{rank}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {submission.allUnavailable ? (
                              <span className="text-xs text-rose-600">All unavailable</span>
                            ) : submission.assignedSlotId ? (
                              // If assigned, only show the assigned slot
                              (() => {
                                const assignedSlot = slotById[submission.assignedSlotId];
                                if (!assignedSlot) return <span className="text-xs text-slate-400">—</span>;
                                
                                return (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs ring-1 ring-emerald-400">
                                      <span className="font-semibold text-emerald-800">✓ Assigned</span>
                                      <span className="text-[10px] text-emerald-700">{assignedSlot.dateLabel} {assignedSlot.label}</span>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : visibleEntries.length > 0 ? (
                              // If not assigned, show preferred slots
                              <div className="flex flex-col gap-1">
                                {visibleEntries.map((entry) => (
                                  <div
                                    key={entry.slot.id}
                                    className={cn(
                                      'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                                      preferenceToneMap[entry.preference]
                                    )}
                                  >
                                    <span className="font-semibold">P{entry.preference}</span>
                                    <span className="text-[10px]">{entry.slot.dateLabel} {entry.slot.label}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {assignedSlot ? (
                              <span className="font-medium text-indigo-700">{assignedSlot.dateLabel} {assignedSlot.label}</span>
                            ) : (
                              <span className="text-xs text-slate-400">Not assigned</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <select
                                value={submission.assignedSlotId ?? ''}
                                onChange={(event) => onAssignSlot(submission.id, event.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                              >
                                <option value="">Not assigned</option>
                                {(submission.allUnavailable
                                  ? dateTimeSlots
                                  : getPreferenceEntries(submission).map((entry) => entry.slot)
                                ).map((slot) => (
                                  <option key={slot.id} value={slot.id}>
                                    {formatSlotLabel(slot)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleSendEmail(submission)}
                                className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                              >
                                Send email
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredSubmissions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No submissions match the current filters.
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-800">Email Confirmation Template</h3>
              <p className="mt-1 text-sm text-slate-500">Use {'{{name}}'} and {'{{slot}}'} placeholders in the subject and body.</p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email subject</label>
                  <input
                    value={tempEmailSubject}
                    onChange={(event) => setTempEmailSubject(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email body</label>
                  <textarea
                    value={tempEmailBody}
                    onChange={(event) => setTempEmailBody(event.target.value)}
                    className="min-h-[180px] w-full rounded-xl border border-slate-300 px-4 py-2.5"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateEmailTemplate(tempEmailSubject.trim(), tempEmailBody.trim());
                    setEmailSaveMessage('Email template updated.');
                    window.setTimeout(() => setEmailSaveMessage(''), 2000);
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
                >
                  Save email template
                </button>
                {emailSaveMessage && <p className="text-sm text-emerald-600">{emailSaveMessage}</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-800">Email Preview</h3>
              <p className="mt-1 text-sm text-slate-500">Preview using the first submission, or a placeholder when none exist.</p>
              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700">{previewSubject}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Body</div>
                  <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700">{previewBody}</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-800">Admin Access Passcode</h3>
              <p className="mt-1 text-sm text-slate-500">Visible for reference only.</p>
              <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-lg text-slate-800">
                {adminPasscode}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-800">Booking Page Content</h3>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Page title</label>
                  <input
                    value={tempTitle}
                    onChange={(event) => setTempTitle(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Short description</label>
                  <textarea
                    value={tempDescription}
                    onChange={(event) => setTempDescription(event.target.value)}
                    className="min-h-[120px] w-full rounded-xl border border-slate-300 px-4 py-2.5"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePageInfo(tempTitle.trim() || scheduler.pageTitle, tempDescription.trim() || scheduler.pageDescription);
                    setSaveMessage('Page content updated.');
                    window.setTimeout(() => setSaveMessage(''), 2000);
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
                >
                  Save page content
                </button>
                {saveMessage && <p className="text-sm text-emerald-600">{saveMessage}</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Schedule Configuration</h3>
                <p className="mt-1 text-sm text-slate-500">Saving these settings rebuilds the active plan and clears submissions.</p>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Schedule name</label>
                  <input
                    value={tempConfig.name}
                    onChange={(event) => setTempConfig((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Max submissions</label>
                  <input
                    type="number"
                    min={1}
                    value={tempConfig.maxSubmissions}
                    onChange={(event) => setTempConfig((current) => ({ ...current, maxSubmissions: Number(event.target.value) || 1 }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
                  <input
                    type="date"
                    value={tempConfig.startDate}
                    onChange={(event) => setTempConfig((current) => ({ ...current, startDate: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">End date</label>
                  <input
                    type="date"
                    value={tempConfig.endDate}
                    onChange={(event) => setTempConfig((current) => ({ ...current, endDate: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Exclude dates</label>
                      <p className="mt-1 text-xs text-slate-500">Click dates to exclude them instead of typing manually.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTempConfig((current) => ({ ...current, excludeDates: [] }))}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Clear excluded dates
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {configDateOptions.map((date) => {
                      const selected = tempConfig.excludeDates.includes(date);
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => handleToggleExcludeDate(date)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                            selected
                              ? 'border-rose-300 bg-rose-50 text-rose-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          {formatDateValue(date)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-7">
                  <input
                    type="checkbox"
                    checked={tempConfig.weekdaysOnly}
                    onChange={(event) => setTempConfig((current) => ({ ...current, weekdaysOnly: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-sm text-slate-600">Weekdays only</span>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Start time</label>
                  <input
                    type="time"
                    value={tempConfig.startTime}
                    onChange={(event) => setTempConfig((current) => ({ ...current, startTime: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">End time</label>
                  <input
                    type="time"
                    value={tempConfig.endTime}
                    onChange={(event) => setTempConfig((current) => ({ ...current, endTime: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Slot duration (minutes)</label>
                  <input
                    type="number"
                    min={15}
                    value={tempConfig.slotDurationMinutes}
                    onChange={(event) => setTempConfig((current) => ({ ...current, slotDurationMinutes: Number(event.target.value) || 15 }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Max bookings per slot</label>
                  <input
                    type="number"
                    min={1}
                    value={tempConfig.slotMaxBookings}
                    onChange={(event) => setTempConfig((current) => ({ ...current, slotMaxBookings: Number(event.target.value) || 1 }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Preference limit per slot</label>
                  <input
                    type="number"
                    min={1}
                    value={tempConfig.preferenceLimit}
                    onChange={(event) => setTempConfig((current) => ({ ...current, preferenceLimit: Number(event.target.value) || 1 }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
              >
                Save schedule settings
              </button>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-800">Date Limits</h3>
              {dateSlots.map((slot: DateSlot) => (
                <div key={slot.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-slate-700">{slot.label}</span>
                  {editingDateId === slot.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={getDateStats(slot.id)}
                        value={tempDateLimit}
                        onChange={(event) => setTempDateLimit(Number(event.target.value) || 0)}
                        className="w-24 rounded-xl border border-slate-300 px-3 py-1.5 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateDateLimit(slot.id, tempDateLimit);
                          setEditingDateId(null);
                        }}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Limit: <strong className="text-slate-700">{slot.maxBookings}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDateId(slot.id);
                          setTempDateLimit(slot.maxBookings);
                        }}
                        className="rounded-xl bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-800">Time Slot Limits</h3>
              {dateTimeSlots.map((slot) => (
                <div key={slot.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-slate-700">{formatSlotLabel(slot)}</span>
                  {editingSlotId === slot.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={slot.currentBookings}
                        value={tempSlotLimit}
                        onChange={(event) => setTempSlotLimit(Number(event.target.value) || 0)}
                        className="w-24 rounded-xl border border-slate-300 px-3 py-1.5 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSlotLimit(slot.id, tempSlotLimit);
                          setEditingSlotId(null);
                        }}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Limit: <strong className="text-slate-700">{slot.maxBookings}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSlotId(slot.id);
                          setTempSlotLimit(slot.maxBookings);
                        }}
                        className="rounded-xl bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-red-700">Danger Zone</h3>
              <p className="mt-1 text-sm text-red-600">Resetting removes every submission from the active schedule.</p>
              {!showResetConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2.5 font-semibold text-red-600 hover:bg-red-100"
                >
                  Reset all data
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-red-700">Are you sure you want to reset all submissions and rebuild the schedule?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetData();
                        setShowResetConfirm(false);
                      }}
                      className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700"
                    >
                      Yes, reset everything
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}