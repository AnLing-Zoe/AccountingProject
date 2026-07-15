import { useEffect, useMemo, useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils';

interface MonthlyCalendarProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

export default function MonthlyCalendar({ transactions, onDelete }: MonthlyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const monthTransactions = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return transactions.filter(transaction => transaction.date.startsWith(prefix));
  }, [transactions, year, month]);

  const totalsByDay = useMemo<Record<number, number>>(() => monthTransactions.reduce<Record<number, number>>((totals, transaction) => {
    const day = Number(transaction.date.slice(-2));
    totals[day] = (totals[day] ?? 0) + (transaction.type === 'income' ? transaction.amount : -transaction.amount);
    return totals;
  }, {}), [monthTransactions]);

  const monthlyTotal = monthTransactions.reduce(
    (total, transaction) => total + (transaction.type === 'income' ? transaction.amount : -transaction.amount),
    0
  );
  const dayTransactions = selectedDay === null
    ? []
    : monthTransactions.filter(transaction => Number(transaction.date.slice(-2)) === selectedDay);
  const days = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const years = Array.from({ length: 21 }, (_, index) => new Date().getFullYear() - 10 + index);

  useEffect(() => {
    if (selectedDay === null) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDay(null);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [selectedDay]);

  return (
    <div className="space-y-8">
      <section className="app-panel p-4 sm:p-6" aria-labelledby="calendar-title">
        <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 id="calendar-title" className="sr-only">月曆收支</h2>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="calendar-year">年份</label>
              <select id="calendar-year" value={year} onChange={event => setCurrentDate(new Date(Number(event.target.value), month, 1))} className="field w-auto font-bold">
                {years.map(option => <option key={option} value={option}>{option} 年</option>)}
              </select>
              <label className="sr-only" htmlFor="calendar-month">月份</label>
              <select id="calendar-month" value={month} onChange={event => setCurrentDate(new Date(year, Number(event.target.value), 1))} className="field w-auto font-bold">
                {Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{index + 1} 月</option>)}
              </select>
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
              本月淨額：<span className={`tabular-nums ${monthlyTotal >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{formatCurrency(monthlyTotal)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="上一個月" className="icon-button border border-[var(--border)]" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>‹</button>
            <button type="button" aria-label="下一個月" className="icon-button border border-[var(--border)]" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>›</button>
          </div>
        </header>

        <div className="grid grid-cols-7 gap-1" aria-hidden="true">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => <div key={day} className="py-2 text-center text-sm font-bold text-[var(--text-muted)]">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => day === null ? <div key={`empty-${index}`} /> : (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              aria-label={`${month + 1} 月 ${day} 日${totalsByDay[day] === undefined ? '，沒有紀錄' : `，淨額 ${formatCurrency(totalsByDay[day])}`}`}
              className={`min-h-11 rounded-lg border p-1 text-center transition-colors sm:min-h-20 sm:p-2 sm:text-left ${selectedDay === day
                ? 'border-[var(--primary)] bg-[var(--surface-muted)] ring-2 ring-[var(--focus)]'
                : 'border-gray-100 bg-gray-50 hover:border-[var(--primary)]'}`}
            >
              <span className="block font-bold text-[var(--text)]">{day}</span>
              {totalsByDay[day] !== undefined && (
                <span className={`hidden truncate text-xs font-semibold tabular-nums sm:block ${totalsByDay[day] >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {formatCurrency(totalsByDay[day])}
                </span>
              )}
              {totalsByDay[day] !== undefined && <span aria-hidden="true" className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full sm:hidden ${totalsByDay[day] >= 0 ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />}
            </button>
          ))}
        </div>
      </section>

      <ExpenseChart transactions={monthTransactions} />

      {selectedDay !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={event => {
          if (event.target === event.currentTarget) setSelectedDay(null);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-dialog-title"
            className="max-h-[85dvh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[var(--border)] p-5">
              <div>
                <h2 id="day-dialog-title" className="text-xl font-extrabold text-[var(--text)]">{year} 年 {month + 1} 月 {selectedDay} 日</h2>
                <p className="text-sm text-[var(--text-muted)]">當日明細</p>
              </div>
              <button type="button" autoFocus aria-label="關閉明細" className="icon-button" onClick={() => setSelectedDay(null)}>×</button>
            </header>
            <div className="max-h-[55dvh] overflow-y-auto p-5">
              {dayTransactions.length === 0 ? (
                <p className="py-10 text-center text-[var(--text-muted)]">這一天沒有紀錄。</p>
              ) : (
                <ul className="space-y-2">
                  {dayTransactions.map(transaction => (
                    <li key={transaction.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[var(--text)]">{transaction.category}</p>
                        <p className="truncate text-sm text-[var(--text-muted)]">{transaction.note || '沒有備註'}</p>
                      </div>
                      <span className={`font-extrabold tabular-nums ${transaction.type === 'expense' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                        {transaction.type === 'expense' ? '−' : '+'}{formatCurrency(transaction.amount)}
                      </span>
                      <button type="button" aria-label={`刪除 ${transaction.category}`} className="icon-button text-[var(--danger)]" onClick={() => onDelete(transaction.id)}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ExpenseChart({ transactions }: { transactions: Transaction[] }) {
  const data = useMemo(() => {
    const totals = transactions.filter(transaction => transaction.type === 'expense').reduce<Record<string, number>>((result, transaction) => {
      result[transaction.category] = (result[transaction.category] ?? 0) + transaction.amount;
      return result;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  if (data.length === 0) return null;
  const maximum = data[0][1];
  const total = data.reduce((sum, [, value]) => sum + value, 0);

  return (
    <section className="app-panel p-6" aria-labelledby="expense-chart-title">
      <h2 id="expense-chart-title" className="mb-5 text-xl font-extrabold text-[var(--text)]">本月支出分佈</h2>
      <p className="sr-only">本月總支出 {formatCurrency(total)}，依金額由高到低排列。</p>
      <ul className="space-y-4">
        {data.map(([name, value]) => (
          <li key={name}>
            <div className="mb-1 flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold text-[var(--text)]">{name}</span>
              <span className="font-bold tabular-nums text-[var(--danger)]">{formatCurrency(value)} · {Math.round(value / total * 100)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-full rounded-full bg-[var(--danger)]" style={{ width: `${value / maximum * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
