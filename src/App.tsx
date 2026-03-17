import { useEffect, useMemo, useState } from 'react';
import { BookingForm } from './components/BookingForm';
import { AdminPanel } from './components/AdminPanel';
import { BookingState, BookingSubmission, Scheduler, SchedulerConfig } from './types';
import {
  generateDateSlots,
  generateDateTimeSlots,
  getInitialState,
} from './data/initialData';
import { cn } from './utils/cn';
import { isRemotePersistenceEnabled, loadRemoteState, saveRemoteState } from './data/remotePersistence';

type ViewMode = 'booking' | 'admin';

const buildSlotBookingCounts = (scheduler: Scheduler) => {
  return scheduler.submissions.reduce<Record<string, number>>((acc, submission) => {
    if (submission.assignedSlotId) {
      acc[submission.assignedSlotId] = (acc[submission.assignedSlotId] ?? 0) + 1;
      return acc;
    }

    if (submission.allUnavailable) {
      return acc;
    }

    Array.from(new Set(submission.preferences)).forEach((slotId) => {
      acc[slotId] = (acc[slotId] ?? 0) + 1;
    });

    return acc;
  }, {});
};

const syncSchedulerAvailability = (scheduler: Scheduler): Scheduler => {
  const slotBookings = buildSlotBookingCounts(scheduler);
  const slotCountByDate = scheduler.dateTimeSlots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.dateId] = (acc[slot.dateId] ?? 0) + 1;
    return acc;
  }, {});

  const syncedDateTimeSlots = scheduler.dateTimeSlots.map((slot) => ({
    ...slot,
    currentBookings: slotBookings[slot.id] ?? 0,
  }));

  const bookingsByDate = syncedDateTimeSlots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.dateId] = (acc[slot.dateId] ?? 0) + slot.currentBookings;
    return acc;
  }, {});

  return {
    ...scheduler,
    dateTimeSlots: syncedDateTimeSlots,
    dateSlots: scheduler.dateSlots.map((slot) => ({
      ...slot,
      currentBookings: bookingsByDate[slot.id] ?? 0,
      maxBookings: (slotCountByDate[slot.id] ?? 0) * scheduler.config.preferenceLimit,
    })),
  };
};

export function App() {
  const [state, setState] = useState<BookingState>(getInitialState);
  const [viewMode, setViewMode] = useState<ViewMode>('booking');
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteError, setRemoteError] = useState('');

  useEffect(() => {
    let cancelled = false;

    loadRemoteState()
      .then((remoteState) => {
        if (cancelled) {
          return;
        }
        setState(remoteState);
        setRemoteReady(true);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load remote data.';
        setRemoteError(message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!remoteReady) {
      return;
    }

    saveRemoteState(state).catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to save remote data.';
      setRemoteError(message);
    });
  }, [remoteReady, state]);

  const activeScheduler = useMemo(() => {
    return (
      state.schedulers.find((scheduler) => scheduler.id === state.activeSchedulerId) ??
      state.schedulers[0]
    );
  }, [state.activeSchedulerId, state.schedulers]);

  const updateScheduler = (schedulerId: string, updater: (scheduler: Scheduler) => Scheduler) => {
    setState((prev) => ({
      ...prev,
      schedulers: prev.schedulers.map((scheduler) =>
        scheduler.id === schedulerId ? updater(scheduler) : scheduler
      ),
    }));
  };

  const handleSubmit = (submission: Omit<BookingSubmission, 'id' | 'submittedAt'>) => {
    if (!activeScheduler) {
      return;
    }
    const newSubmission: BookingSubmission = {
      ...submission,
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      emailSent: false,
      submittedAt: new Date().toISOString(),
    };

    updateScheduler(activeScheduler.id, (scheduler) => {
      return syncSchedulerAvailability({
        ...scheduler,
        submissions: [...scheduler.submissions, newSubmission],
      });
    });
  };

  const handleResetData = () => {

    if (!activeScheduler) {
      return;
    }
    updateScheduler(activeScheduler.id, (scheduler) => {
      const dateSlots = generateDateSlots(scheduler.config);
      return {
        ...scheduler,
        submissions: [],
        dateSlots,
        dateTimeSlots: generateDateTimeSlots(dateSlots, scheduler.config),
      };
    });
  };

  const handleUpdateSlotLimit = (slotId: string, newLimit: number) => {
    if (!activeScheduler) {
      return;
    }
    updateScheduler(activeScheduler.id, (scheduler) => ({
      ...scheduler,
      dateTimeSlots: scheduler.dateTimeSlots.map((slot) =>
        slot.id === slotId ? { ...slot, maxBookings: newLimit } : slot
      ),
    }));
  };

  const handleUpdateDateLimit = (dateId: string, newLimit: number) => {
    if (!activeScheduler) {
      return;
    }
    updateScheduler(activeScheduler.id, (scheduler) => ({
      ...scheduler,
      dateSlots: scheduler.dateSlots.map((slot) =>
        slot.id === dateId ? { ...slot, maxBookings: newLimit } : slot
      ),
    }));
  };

  const handleAssignSlot = (submissionId: string, slotId: string) => {
    if (!activeScheduler) {
      return;
    }
    updateScheduler(activeScheduler.id, (scheduler) => {
      return syncSchedulerAvailability({
        ...scheduler,
        submissions: scheduler.submissions.map((submission) =>
          submission.id === submissionId
            ? { ...submission, assignedSlotId: slotId }
            : submission
        ),
      });
    });
  };

  const handleUpdatePageInfo = (title: string, description: string) => {
    if (!activeScheduler) {
      return;
    }
    updateScheduler(activeScheduler.id, (scheduler) => ({
      ...scheduler,
      pageTitle: title,
      pageDescription: description,
    }));
  };

  const handleUpdateEmailTemplate = (subject: string, body: string) => {
    if (!activeScheduler) {
      return;
    }
    updateScheduler(activeScheduler.id, (scheduler) => ({
      ...scheduler,
      emailTemplateSubject: subject,
      emailTemplateBody: body,
    }));
  };

  const handleUpdateSchedulerConfig = (schedulerId: string, config: SchedulerConfig) => {
    updateScheduler(schedulerId, (scheduler) => {
      const dateSlots = generateDateSlots(config);
      return {
        ...scheduler,
        config,
        dateSlots,
        dateTimeSlots: generateDateTimeSlots(dateSlots, config),
        submissions: [],
      };
    });
  };

  const handleSetActiveScheduler = (schedulerId: string) => {
    setState((prev) => ({
      ...prev,
      activeSchedulerId: schedulerId,
    }));
  };

  const handleAdminLogin = () => {
    if (passcodeInput.trim() === state.adminPasscode) {
      setAdminAuthorized(true);
      setPasscodeInput('');
      setPasscodeError('');
    } else {
      setPasscodeError('Incorrect passcode. Please try again.');
    }
  };

  if (!isRemotePersistenceEnabled()) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-3">
          <h1 className="text-lg font-semibold text-slate-800">Remote persistence is required</h1>
          <p className="text-sm text-slate-600">
            Please configure <code>VITE_WORKER_API_URL</code> so the app can load data from MongoDB via Cloudflare Worker.
          </p>
        </div>
      </div>
    );
  }

  if (remoteError) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl bg-white border border-red-200 shadow-sm p-6 space-y-3">
          <h1 className="text-lg font-semibold text-red-700">Unable to load remote data</h1>
          <p className="text-sm text-slate-600">{remoteError}</p>
        </div>
      </div>
    );
  }

  if (!remoteReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-3">
          <h1 className="text-lg font-semibold text-slate-800">Loading remote scheduler data...</h1>
        </div>
      </div>
    );
  }

  if (!activeScheduler) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-3">
          <h1 className="text-lg font-semibold text-slate-800">Unable to load scheduler data</h1>
          <p className="text-sm text-slate-600">
            Remote scheduler data appears invalid.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Booking Scheduler</h1>
                <p className="text-xs text-slate-500">{activeScheduler.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('booking')}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  viewMode === 'booking'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                )}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Book
                </span>
              </button>
              <button
                onClick={() => setViewMode('admin')}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  viewMode === 'admin'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                )}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {viewMode === 'booking' ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg border border-indigo-100">
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-800 mb-2">
                {activeScheduler.pageTitle}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {activeScheduler.pageDescription}
              </p>
            </section>

            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 sm:p-6 text-white shadow-xl shadow-indigo-200">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">How it works</h2>
                  <ul className="text-indigo-100 text-sm sm:text-base space-y-1">
                    <li>• Fill in your personal information</li>
                    <li>• Select your <strong className="text-white">single preferred date</strong> and one preferred time slot</li>
                    <li>• Each time slot accepts <strong className="text-white">up to {activeScheduler.config.slotMaxBookings} booking requests</strong> during intake</li>
                    <li>• Bookings are assigned on a <strong className="text-white">first come, first reserved</strong> basis</li>
                    <li>• We will confirm your final booking by email</li>
                  </ul>
                </div>
              </div>
            </div>

            <BookingForm
              dateTimeSlots={activeScheduler.dateTimeSlots}
              dateSlots={activeScheduler.dateSlots}
              onSubmit={handleSubmit}
              totalSubmissions={activeScheduler.submissions.length}
              maxSubmissions={activeScheduler.config.maxSubmissions}
              submissions={activeScheduler.submissions}
              preferenceLimit={activeScheduler.config.preferenceLimit}
            />
          </div>
        ) : adminAuthorized ? (
          <AdminPanel
            scheduler={activeScheduler}
            schedulers={state.schedulers}
            activeSchedulerId={state.activeSchedulerId}
            adminPasscode={state.adminPasscode}
            onResetData={handleResetData}
            onUpdateSlotLimit={handleUpdateSlotLimit}
            onUpdateDateLimit={handleUpdateDateLimit}
            onAssignSlot={handleAssignSlot}
            onUpdatePageInfo={handleUpdatePageInfo}
            onUpdateEmailTemplate={handleUpdateEmailTemplate}
            onUpdateSchedulerConfig={handleUpdateSchedulerConfig}
            onSetActiveScheduler={handleSetActiveScheduler}
            onMarkEmailSent={(submissionId) => {
              updateScheduler(activeScheduler.id, (scheduler) => {
                const target = scheduler.submissions.find((submission) => submission.id === submissionId);
                if (!target || target.emailSent) {
                  return scheduler;
                }
                return {
                  ...scheduler,
                  submissions: scheduler.submissions.map((submission) =>
                    submission.id === submissionId ? { ...submission, emailSent: true } : submission
                  ),
                };
              });
            }}
          />
        ) : (
          <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5s-3 1.343-3 3 1.343 3 3 3zm0 0c-2.761 0-5 2.239-5 5h10c0-2.761-2.239-5-5-5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Admin access</h2>
                <p className="text-sm text-slate-500">
                  Enter the admin passcode to access management tools.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin passcode</label>
                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(event) => {
                    setPasscodeInput(event.target.value);
                    setPasscodeError('');
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter passcode"
                />
                {passcodeError && <p className="text-sm text-red-600 mt-1">{passcodeError}</p>}
              </div>

              <button
                type="button"
                onClick={handleAdminLogin}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
              >
                Unlock Admin Panel
              </button>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs sm:text-sm text-slate-600">
                <p className="font-semibold text-slate-700 mb-2">Admin access note</p>
                <p>
                  Share the admin passcode only with trusted coordinators.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/50 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
          <p>
            {activeScheduler.name} • Capacity: {activeScheduler.submissions.length}/{activeScheduler.config.maxSubmissions} submissions
          </p>
        </div>
      </footer>
    </div>
  );
}
