import { useMemo } from 'react';
import { TARGET_SAVINGS_AMOUNT } from '../constants';
import { SavingsState, SyncStatus } from '../types';
import { formatCurrency } from '../utils';

interface SavingsChallengeProps {
  savings: SavingsState;
  onToggle: (day: number) => void;
  onSync: () => void;
  syncStatus: SyncStatus;
}

const syncLabels: Record<SyncStatus, string> = {
  idle: '同步到雲端',
  loading: '載入雲端資料中',
  sending: '傳送中',
  sent: '已送出，未確認',
  error: '同步失敗，請重試'
};

export default function SavingsChallenge({ savings, onToggle, onSync, syncStatus }: SavingsChallengeProps) {
  const currentTotal = useMemo(() => savings.completedDays.reduce((total, day) => total + day, 0), [savings.completedDays]);
  const amountProgress = Math.min(100, currentTotal / TARGET_SAVINGS_AMOUNT * 100);
  const dayProgress = savings.completedDays.length / 365 * 100;
  const isSyncing = syncStatus === 'loading' || syncStatus === 'sending';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="app-panel grid gap-8 p-6 md:grid-cols-[auto_1fr] md:items-center md:p-10" aria-labelledby="savings-title">
        <div className="relative mx-auto h-48 w-48">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" role="img" aria-label={`存款金額進度 ${Math.round(amountProgress)}%`}>
            <circle cx="50" cy="50" r="42" stroke="var(--surface-muted)" strokeWidth="8" fill="none" />
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="var(--primary)"
              strokeWidth="9"
              fill="none"
              strokeDasharray="263.89"
              strokeDashoffset={263.89 - 263.89 * amountProgress / 100}
              strokeLinecap="round"
              className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <strong className="text-4xl font-extrabold tabular-nums text-[var(--text)]">{Math.round(amountProgress)}%</strong>
            <span className="text-sm font-semibold text-[var(--text-muted)]">金額進度</span>
          </div>
        </div>

        <div>
          <h2 id="savings-title" className="mb-5 text-2xl font-extrabold text-[var(--text)]">365 天存錢挑戰</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--primary)] p-5 text-white">
              <dt className="text-sm font-semibold">已存金額</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums">{formatCurrency(currentTotal)}</dd>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-5 text-[var(--text)]">
              <dt className="text-sm font-semibold">目標金額</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums">{formatCurrency(TARGET_SAVINGS_AMOUNT)}</dd>
            </div>
          </dl>
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-sm font-semibold text-[var(--text-muted)]">
              <span>已完成天數</span>
              <span className="tabular-nums">{savings.completedDays.length} / 365</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={savings.completedDays.length} aria-valuemin={0} aria-valuemax={365}>
              <div className="h-full rounded-full bg-[var(--success)] motion-safe:transition-[width] motion-safe:duration-300" style={{ width: `${dayProgress}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel p-4 sm:p-6 md:p-8" aria-labelledby="savings-grid-title">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="savings-grid-title" className="text-xl font-extrabold text-[var(--text)]">挑戰清單</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">每完成一格，就存入該格標示的金額。</p>
          </div>
          <button type="button" onClick={onSync} disabled={isSyncing} className="secondary-button disabled:cursor-wait disabled:opacity-50">
            {syncLabels[syncStatus]}
          </button>
        </header>
        <p aria-live="polite" className="sr-only">{syncLabels[syncStatus]}</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
          {Array.from({ length: 365 }, (_, index) => index + 1).map(day => {
            const completed = savings.completedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={completed}
                aria-label={`${day} 元，${completed ? '已完成' : '未完成'}`}
                onClick={() => onToggle(day)}
                className={`min-h-11 rounded-lg border text-sm font-bold tabular-nums transition-colors ${completed
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]'}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
