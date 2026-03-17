import { DateSlot } from '../types';
import { cn } from '../utils/cn';

interface DateSlotSelectorProps {
  dateSlots: DateSlot[];
  selectedDateId: string | null;
  allUnavailable: boolean;
  onSelectDate: (dateId: string) => void;
}

export function DateSlotSelector({
  dateSlots,
  selectedDateId,
  allUnavailable,
  onSelectDate,
}: DateSlotSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-800">Select your preferred date</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {dateSlots.map((slot) => {
          const selected = selectedDateId === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSelectDate(slot.id)}
              className={cn(
                'rounded-xl border px-4 py-3 text-left transition-colors',
                selected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
              )}
            >
              <p className="font-medium">{slot.label}</p>
              <p className="text-xs text-slate-500">{slot.currentBookings}/{slot.maxBookings} preference requests</p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelectDate('all-unavailable')}
        className={cn(
          'rounded-xl border px-4 py-3 text-left w-full transition-colors',
          allUnavailable
            ? 'border-rose-500 bg-rose-50 text-rose-700'
            : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50/40'
        )}
      >
        <p className="font-medium">All dates unavailable</p>
        <p className="text-xs text-slate-500">Choose this if none of the listed dates work for you.</p>
      </button>
    </div>
  );
}
