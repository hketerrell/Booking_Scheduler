import { useEffect, useState } from 'react';
import { DateTimeSlot } from '../types';
import { cn } from '../utils/cn';

interface TimeSlotSelectorProps {
  timeSlots: DateTimeSlot[];
  selectedSlots: string[];
  selectedDateIds: string[];
  primaryDateId?: string | null;
  onSelectSlot: (slotId: string) => void;
  onClearSelections: () => void;
  maxSelections: number;
  preferenceLimit: number;
  disabled?: boolean;
}

const TIME_GROUPS = [
  { label: 'Morning', start: '09:00', end: '11:59' },
  { label: 'Midday', start: '12:00', end: '14:59' },
  { label: 'Afternoon', start: '15:00', end: '17:59' },
];

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export function TimeSlotSelector({
  timeSlots,
  selectedSlots,
  selectedDateIds,
  primaryDateId,
  onSelectSlot,
  onClearSelections,
  maxSelections,
  preferenceLimit,
}: TimeSlotSelectorProps) {
  const [openDateIds, setOpenDateIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenDateIds((prev) => {
      const nextState = { ...prev };
      timeSlots.forEach((slot) => {
        if (nextState[slot.dateId] === undefined) {
          nextState[slot.dateId] = false;
        }
      });
      return nextState;
    });
  }, [timeSlots]);
  const getSelectionOrder = (slotId: string): number => {
    return selectedSlots.indexOf(slotId) + 1;
  };

  const isSlotAvailable = (slot: DateTimeSlot): boolean => {
    return slot.currentBookings < preferenceLimit;
  };

  const getStatusClasses = (percentage: number) => {
    if (percentage >= 100) {
      return {
        badge: 'bg-slate-200 text-slate-600',
        bar: 'bg-slate-400',
        container: 'border-slate-300 bg-slate-100 text-slate-500',
      };
    }
    if (percentage >= 90) {
      return {
        badge: 'bg-red-100 text-red-700',
        bar: 'bg-red-500',
        container: 'border-red-200 bg-red-50 text-red-700',
      };
    }
    if (percentage >= 70) {
      return {
        badge: 'bg-amber-100 text-amber-700',
        bar: 'bg-amber-500',
        container: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    }
    return {
      badge: 'bg-emerald-100 text-emerald-700',
      bar: 'bg-emerald-500',
      container: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  };

  const canSelectMore = selectedSlots.length < maxSelections;
  const groupedSlots = timeSlots.reduce<Record<string, DateTimeSlot[]>>((acc, slot) => {
    if (!acc[slot.dateId]) {
      acc[slot.dateId] = [];
    }
    acc[slot.dateId].push(slot);
    return acc;
  }, {});

  const orderedDateIds = Object.keys(groupedSlots).sort((a, b) => {
    const aDate = a.replace('date-', '');
    const bDate = b.replace('date-', '');
    return aDate.localeCompare(bDate);
  });

  useEffect(() => {
    if (selectedDateIds.length === 0) {
      return;
    }
    setOpenDateIds((prev) => {
      const nextState = { ...prev };
      if (primaryDateId) {
        Object.keys(nextState).forEach((dateId) => {
          nextState[dateId] = dateId === primaryDateId;
        });
        return nextState;
      }
      selectedDateIds.forEach((dateId) => {
        if (nextState[dateId] !== undefined) {
          nextState[dateId] = true;
        }
      });
      return nextState;
    });
  }, [selectedDateIds, primaryDateId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-800">
            Select Your Top {maxSelections} Preferred Time Slots
          </h3>
          <p className="text-sm sm:text-base text-slate-600">
            You can select time slots across different dates. Click in order of preference. Each slot accepts up to {preferenceLimit} preference requests.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
            {maxSelections >= 1 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Preference 1 {maxSelections > 1 ? '(most preferred)' : ''}
              </span>
            )}
            {maxSelections >= 2 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Preference 2
              </span>
            )}
            {maxSelections >= 3 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Preference 3 (least preferred)
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm sm:text-base text-slate-500">
            {selectedSlots.length} of {maxSelections} selected
          </span>
          <button
            type="button"
            onClick={onClearSelections}
            disabled={selectedSlots.length === 0}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              selectedSlots.length === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            )}
          >
            Unselect all
          </button>
          <span className="text-xs text-slate-400">Click “Review & Submit” when you’re ready.</span>
        </div>
      </div>

      <div className="space-y-5">
        {orderedDateIds.map((dateId) => {
          const slotsForDate = groupedSlots[dateId] || [];
          const dateLabel = slotsForDate[0]?.dateLabel ?? 'Date';
          const totalBookings = slotsForDate.reduce((acc, slot) => acc + slot.currentBookings, 0);
          const totalCapacity = slotsForDate.reduce((acc, slot) => acc + slot.maxBookings, 0);
          const percentage = totalCapacity === 0 ? 0 : (totalBookings / totalCapacity) * 100;
          const status = getStatusClasses(percentage);

          const isExpanded = openDateIds[dateId] ?? false;
          const hasSelectionInDate = slotsForDate.some((slot) => selectedSlots.includes(slot.id));

          return (
            <details
              key={dateId}
              className={cn(
                'rounded-2xl border border-slate-200 shadow-sm transition-all',
                'open:shadow-md open:border-indigo-200',
                status.container,
                !isExpanded && hasSelectionInDate && 'border-red-500 border-4'
              )}
              open={isExpanded}
              onToggle={(event) => {
                const nextOpen = (event.target as HTMLDetailsElement).open;
                setOpenDateIds((prev) => ({ ...prev, [dateId]: nextOpen }));
              }}
            >
              <summary className="cursor-pointer list-none px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-base sm:text-lg font-semibold text-slate-800">{dateLabel}</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {slotsForDate.length} slots available · {totalCapacity - totalBookings} remaining
                  </p>
                </div>
                <span className="text-sm text-indigo-600 font-medium">{isExpanded ? 'Collapse' : 'Expand'}</span>
              </summary>

              <div className="px-4 pb-4 space-y-4">
                {TIME_GROUPS.map((group) => {
                  const groupSlots = slotsForDate.filter((slot) => {
                    const minutes = toMinutes(slot.startTime);
                    return minutes >= toMinutes(group.start) && minutes <= toMinutes(group.end);
                  });

                  if (groupSlots.length === 0) {
                    return null;
                  }

                  return (
                    <div key={group.label} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-semibold text-slate-700">{group.label}</h5>
                        <span className="text-xs text-slate-400">{groupSlots.length} slots</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {groupSlots.map((slot) => {
                          const isSelected = selectedSlots.includes(slot.id);
                          const selectionOrder = getSelectionOrder(slot.id);
                          const available = isSlotAvailable(slot);
                          const spotsLeft = Math.max(preferenceLimit - slot.currentBookings, 0);
                          const percentage = (slot.currentBookings / preferenceLimit) * 100;
                          const status = getStatusClasses(percentage);
                          const hasReachedPreferenceLimit = slot.currentBookings >= preferenceLimit;

                          return (
                            <button
                              type="button"
                              key={slot.id}
                              onClick={() => onSelectSlot(slot.id)}
                              disabled={(!available && !isSelected) || (!isSelected && hasReachedPreferenceLimit)}
                              className={cn(
                                'relative p-4 rounded-xl border-2 transition-all duration-200',
                                'flex flex-col items-start text-left',
                                !isSelected && status.container,
                                isSelected &&
                                  (selectionOrder === 1
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : selectionOrder === 2
                                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                                    : 'border-rose-500 bg-rose-50 text-rose-700'),
                                isSelected && 'shadow-md',
                                !isSelected && available && canSelectMore && !hasReachedPreferenceLimit && 'hover:border-indigo-300 hover:bg-indigo-50/50',
                                !isSelected && (!available || !canSelectMore || hasReachedPreferenceLimit) && 'opacity-60 cursor-not-allowed'
                              )}
                            >
                              {isSelected && (
                                <div
                                  className={cn(
                                    'absolute -top-2 -right-2 w-7 h-7 rounded-full text-white flex items-center justify-center text-sm font-bold shadow-lg',
                                    selectionOrder === 1
                                      ? 'bg-emerald-600'
                                      : selectionOrder === 2
                                      ? 'bg-amber-600'
                                      : 'bg-rose-600'
                                  )}
                                >
                                  {selectionOrder}
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2 mb-2">
                                  <svg
                                    className={cn(
                                      'w-5 h-5',
                                      isSelected
                                        ? selectionOrder === 1
                                          ? 'text-emerald-600'
                                          : selectionOrder === 2
                                          ? 'text-amber-600'
                                          : 'text-rose-600'
                                        : 'text-slate-400'
                                    )}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <div>
                                    <span
                                      className={cn(
                                        'font-semibold block',
                                        isSelected
                                          ? selectionOrder === 1
                                            ? 'text-emerald-700'
                                            : selectionOrder === 2
                                            ? 'text-amber-700'
                                            : 'text-rose-700'
                                          : 'text-slate-700'
                                      )}
                                    >
                                      {slot.label}
                                    </span>
                                  <span className="text-xs text-slate-500">{slot.dateLabel}</span>
                                </div>
                              </div>
                              
                              <div className="w-full">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', status.badge)}>
                                    {hasReachedPreferenceLimit
                                      ? 'Preference limit reached'
                                      : available
                                      ? `${spotsLeft} spots left`
                                      : 'Fully booked'}
                                  </span>
                                  <span className="text-slate-400">
                                    {slot.currentBookings}/{preferenceLimit}
                                  </span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full transition-all duration-300', status.bar)}
                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
