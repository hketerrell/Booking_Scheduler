import { useEffect, useMemo, useState } from 'react';
import { BookingSubmission, DateSlot, DateTimeSlot } from '../types';
import { TimeSlotSelector } from './TimeSlotSelector';
import { DateSlotSelector } from './DateSlotSelector';
import { cn } from '../utils/cn';

interface BookingFormProps {
  dateTimeSlots: DateTimeSlot[];
  dateSlots: DateSlot[];
  onSubmit: (submission: Omit<BookingSubmission, 'id' | 'submittedAt'>) => void;
  totalSubmissions: number;
  maxSubmissions: number;
  submissions: BookingSubmission[];
  preferenceLimit: number;
}

export function BookingForm({
  dateTimeSlots,
  dateSlots,
  onSubmit,
  totalSubmissions,
  maxSubmissions,
  submissions,
  preferenceLimit,
}: BookingFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [staffNumber, setStaffNumber] = useState('');
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [furtherEnquiries, setFurtherEnquiries] = useState('');
  const [allUnavailable, setAllUnavailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [alternateRequest, setAlternateRequest] = useState('');
  const [primaryDateId, setPrimaryDateId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const draftKey = 'bookingDraft';

  useEffect(() => {
    const storedDraft = localStorage.getItem(draftKey);
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft);
        setName(draft.name ?? '');
        setEmail(draft.email ?? '');
        setStaffNumber(draft.staffNumber ?? '');
        const restoredDateIds = draft.selectedDateIds ?? [];
        setSelectedDateIds(restoredDateIds);
        setSelectedSlots(draft.selectedSlots ?? []);
        setFurtherEnquiries(draft.furtherEnquiries ?? '');
        setAllUnavailable(draft.allUnavailable ?? false);
        setUnavailableReason(draft.unavailableReason ?? '');
        setAlternateRequest(draft.alternateRequest ?? '');
        setPrimaryDateId(draft.primaryDateId ?? restoredDateIds[0] ?? null);
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
  }, []);

  useEffect(() => {
    const draft = {
      name,
      email,
      staffNumber,
      selectedDateIds,
      selectedSlots,
      furtherEnquiries,
      allUnavailable,
      unavailableReason,
      alternateRequest,
      primaryDateId,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    name,
    email,
    staffNumber,
    selectedDateIds,
    selectedSlots,
    furtherEnquiries,
    allUnavailable,
    unavailableReason,
    alternateRequest,
  ]);
  const filteredSlots = useMemo(
    () => dateTimeSlots.filter((slot) => selectedDateIds.includes(slot.dateId)),
    [dateTimeSlots, selectedDateIds]
  );

  const handleSlotSelect = (slotId: string) => {
    const slot = dateTimeSlots.find((item) => item.id === slotId);
    if (!slot) {
      return;
    }

    if (!selectedSlots.includes(slotId) && slot.currentBookings >= preferenceLimit) {
      setErrors((prev) => ({ ...prev, slots: 'This time slot has reached the preference limit.' }));
      return;
    }

    setSelectedSlots((prev) => {
      if (prev.includes(slotId)) {
        return prev.filter((id) => id !== slotId);
      }
      if (prev.length < 3) {
        return [...prev, slotId];
      }
      return prev;
    });
    setErrors((prev) => ({ ...prev, slots: '' }));
  };

  const handleToggleDate = (dateId: string) => {
    if (dateId === 'all-unavailable') {
      setAllUnavailable((prev) => {
        const next = !prev;
        if (next) {
          setSelectedDateIds([]);
          setSelectedSlots([]);
          setPrimaryDateId(null);
        }
        return next;
      });
      setErrors((prev) => ({ ...prev, dates: '' }));
      return;
    }

    setAllUnavailable(false);
    setSelectedDateIds((prev) => {
      if (prev.includes(dateId)) {
        const next = prev.filter((id) => id !== dateId);
        const slotsToRemove = dateTimeSlots
          .filter((slot) => slot.dateId === dateId)
          .map((slot) => slot.id);
        setSelectedSlots((current) => current.filter((id) => !slotsToRemove.includes(id)));
        if (primaryDateId === dateId) {
          setPrimaryDateId(next[0] ?? null);
        }
        return next;
      }
      setPrimaryDateId(dateId);
      return [...prev, dateId];
    });
    setErrors((prev) => ({ ...prev, dates: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!staffNumber.trim()) {
      newErrors.staffNumber = 'Staff number is required';
    } else if (!/^\d+$/.test(staffNumber)) {
      newErrors.staffNumber = 'Staff number must contain digits only';
    }

    if (!allUnavailable && selectedDateIds.length === 0) {
      newErrors.dates = 'Please select at least one preferred date or choose all unavailable';
    }

    if (allUnavailable) {
      if (!unavailableReason.trim()) {
        newErrors.unavailableReason = 'Please share why all dates are unavailable';
      }
      if (!alternateRequest.trim()) {
        newErrors.alternateRequest = 'Please provide a preferred date/time request';
      }
    } else if (selectedSlots.length !== 3) {
      newErrors.slots = 'Please select exactly 3 preferred time slots';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    const normalizedName = name.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedStaffNumber = staffNumber.trim();

    const duplicate = submissions.some(
      (sub) =>
        sub.name.trim().toLowerCase() === normalizedName ||
        sub.email.trim().toLowerCase() === normalizedEmail ||
        sub.staffNumber === normalizedStaffNumber
    );

    if (duplicate) {
      setErrors((prev) => ({
        ...prev,
        duplicate: 'A booking already exists for this name, email, or staff number.'
      }));
      return;
    }

    setShowReviewModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowReviewModal(false);
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    onSubmit({
      name: name.trim(),
      email: email.trim(),
      staffNumber: staffNumber.trim(),
      preferredDateIds: selectedDateIds,
      preferences: selectedSlots,
      furtherEnquiries: furtherEnquiries.trim() || undefined,
      allUnavailable,
      unavailableReason: allUnavailable ? unavailableReason.trim() : undefined,
      alternateRequest: allUnavailable ? alternateRequest.trim() : undefined,
    });

    localStorage.removeItem(draftKey);
    setIsSubmitting(false);
    setSubmitSuccess(true);
  };

  const remainingSpots = Math.max(maxSubmissions - totalSubmissions, 0);
  const isClosed = remainingSpots <= 0;

  // Review Modal
  if (showReviewModal) {
    const selectedSlotsData = selectedSlots
      .map((slotId) => dateTimeSlots.find((slot) => slot.id === slotId))
      .filter(Boolean) as DateTimeSlot[];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Review Your Booking</h2>
            <p className="text-slate-600 mb-6">
              Please review your information before submitting.
            </p>

            <div className="space-y-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-2">Personal Information</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-500">Name:</span> <span className="font-medium">{name}</span></p>
                  <p><span className="text-slate-500">Email:</span> <span className="font-medium">{email}</span></p>
                  <p><span className="text-slate-500">Staff number:</span> <span className="font-medium">{staffNumber}</span></p>
                </div>
              </div>

              {allUnavailable ? (
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-700 mb-2">All Dates Unavailable</h3>
                  <div className="space-y-2 text-sm text-slate-600">
                    <p><span className="text-slate-500">Reason:</span> <span className="font-medium">{unavailableReason}</span></p>
                    <p><span className="text-slate-500">Preferred alternative:</span> <span className="font-medium">{alternateRequest}</span></p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-700 mb-3">Your Top 3 Time Slot Preferences</h3>
                  <ol className="space-y-2">
                    {selectedSlotsData.map((slot, index) => (
                      <li key={slot.id} className="flex items-start gap-3">
                        <span className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                          index === 0 ? 'bg-indigo-600' : index === 1 ? 'bg-violet-600' : 'bg-purple-600'
                        )}>
                          {index + 1}
                        </span>
                        <div className="text-sm">
                          <div className="font-medium text-slate-800">{slot.dateLabel}</div>
                          <div className="text-slate-600">{slot.label}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {furtherEnquiries && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-700 mb-2">Further Enquiries</h3>
                  <p className="text-sm text-slate-600">{furtherEnquiries}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Go Back to Edit
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className={cn(
                  'flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all',
                  'bg-gradient-to-r from-indigo-600 to-violet-600',
                  'hover:from-indigo-700 hover:to-violet-700',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  'shadow-lg shadow-indigo-200'
                )}
              >
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    const submittedSlotsData = selectedSlots
      .map((slotId) => dateTimeSlots.find((slot) => slot.id === slotId))
      .filter(Boolean) as DateTimeSlot[];

    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Booking Submitted!</h2>
        <p className="text-slate-600 mb-4">
          Thank you, {name}! Your preferences have been recorded.
        </p>
        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
          <div>
            <h3 className="font-semibold text-slate-700 mb-2">Your Top 3 Time Slot Preferences</h3>
            <ol className="space-y-2">
              {submittedSlotsData.map((slot, index) => (
                <li key={slot.id} className="flex items-start gap-2">
                  <span className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                    index === 0 ? 'bg-indigo-600' : index === 1 ? 'bg-violet-600' : 'bg-purple-600'
                  )}>
                    {index + 1}
                  </span>
                  <div className="text-sm pt-0.5">
                    <div className="font-medium text-slate-800">{slot.dateLabel}</div>
                    <div className="text-slate-600">{slot.label}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          The booking time will be informed through email shortly after admin confirmed the arrangements.
        </p>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Booking Closed</h2>
        <p className="text-slate-600">
          We have reached the maximum capacity of {maxSubmissions} bookings.
          Please contact the administrator if you need assistance.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Book Your Time Slot</h2>
        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm sm:text-base font-medium">
          {remainingSpots} spots remaining
        </span>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg sm:text-xl font-semibold text-slate-700">Personal Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: '' }));
              }}
              className={cn(
                'w-full px-4 py-2.5 rounded-lg border transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'
              )}
              placeholder="Enter your full name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: '' }));
              }}
              className={cn(
                'w-full px-4 py-2.5 rounded-lg border transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                errors.email ? 'border-red-300 bg-red-50' : 'border-slate-300'
              )}
              placeholder="your.email@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="staffNumber" className="block text-sm font-medium text-slate-700 mb-1">
              Staff Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              id="staffNumber"
              value={staffNumber}
              onChange={(e) => {
                const nextValue = e.target.value.replace(/\D/g, '');
                setStaffNumber(nextValue);
                setErrors((prev) => ({ ...prev, staffNumber: '' }));
              }}
              className={cn(
                'w-full px-4 py-2.5 rounded-lg border transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                errors.staffNumber ? 'border-red-300 bg-red-50' : 'border-slate-300'
              )}
              placeholder="Numbers only"
            />
            {errors.staffNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.staffNumber}</p>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <DateSlotSelector
          dateSlots={dateSlots}
          selectedDateIds={selectedDateIds}
          allUnavailable={allUnavailable}
          onToggleDate={handleToggleDate}
        />
        {errors.dates && (
          <p className="mt-2 text-sm text-red-600">{errors.dates}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Preferred date selection is required unless you select “All dates unavailable”.
        </p>
      </div>

      {allUnavailable ? (
        <div className="pt-4 border-t border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason all dates are unavailable <span className="text-red-500">*</span>
            </label>
            <textarea
              value={unavailableReason}
              onChange={(event) => {
                setUnavailableReason(event.target.value);
                setErrors((prev) => ({ ...prev, unavailableReason: '' }));
              }}
              className={cn(
                'w-full px-4 py-3 rounded-lg border transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                errors.unavailableReason ? 'border-red-300 bg-red-50' : 'border-slate-300'
              )}
              placeholder="Let us know why the listed dates do not work"
            />
            {errors.unavailableReason && (
              <p className="mt-1 text-sm text-red-600">{errors.unavailableReason}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Preferred alternative date/time <span className="text-red-500">*</span>
            </label>
            <textarea
              value={alternateRequest}
              onChange={(event) => {
                setAlternateRequest(event.target.value);
                setErrors((prev) => ({ ...prev, alternateRequest: '' }));
              }}
              className={cn(
                'w-full px-4 py-3 rounded-lg border transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                errors.alternateRequest ? 'border-red-300 bg-red-50' : 'border-slate-300'
              )}
              placeholder="Share a suitable date or time range"
            />
            {errors.alternateRequest && (
              <p className="mt-1 text-sm text-red-600">{errors.alternateRequest}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-slate-200">
          {selectedDateIds.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              Select at least one preferred date above to see the available time slots.
            </div>
          ) : (
            <TimeSlotSelector
              timeSlots={filteredSlots}
              selectedSlots={selectedSlots}
              selectedDateIds={selectedDateIds}
              primaryDateId={primaryDateId}
              onSelectSlot={handleSlotSelect}
              onClearSelections={() => setSelectedSlots([])}
              maxSelections={3}
              preferenceLimit={preferenceLimit}
            />
          )}
          {errors.slots && (
            <p className="mt-2 text-sm text-red-600">{errors.slots}</p>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-slate-200 space-y-2">
        <label htmlFor="enquiries" className="block text-sm font-medium text-slate-700">
          Further enquiries <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="enquiries"
          value={furtherEnquiries}
          onChange={(e) => setFurtherEnquiries(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors min-h-[120px]"
          placeholder="Share any additional questions or requests"
        />
      </div>

      <p className="text-sm sm:text-base text-slate-500">
        The booking time will be informed through email shortly after admin confirmed the arrangements.
      </p>

      {errors.duplicate && (
        <p className="text-sm text-red-600 font-medium">{errors.duplicate}</p>
      )}

      <div className="pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200',
            'bg-gradient-to-r from-indigo-600 to-violet-600',
            'hover:from-indigo-700 hover:to-violet-700',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'shadow-lg shadow-indigo-200'
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Submitting...
            </span>
          ) : (
            'Review & Submit'
          )}
        </button>
      </div>
    </form>
  );
}
