import { ReactNode, useEffect, useRef, useState } from 'react';
import DailyTracker from './components/DailyTracker';
import MonthlyCalendar from './components/MonthlyCalendar';
import SavingsChallenge from './components/SavingsChallenge';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './constants';
import { AppSnapshot, SavingsState, SyncStatus, Transaction, ViewType } from './types';
import { isSavings, isSnapshot, isStringArray, isTransactions, readStorage, STORAGE_KEYS } from './utils';

const cloudUrl = import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL;

const createId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('tracker');
  const [transactions, setTransactions] = useState(() => readStorage(STORAGE_KEYS.transactions, [], isTransactions));
  const [expenseCategories, setExpenseCategories] = useState(() => readStorage(STORAGE_KEYS.expenseCategories, DEFAULT_EXPENSE_CATEGORIES, isStringArray));
  const [incomeCategories, setIncomeCategories] = useState(() => readStorage(STORAGE_KEYS.incomeCategories, DEFAULT_INCOME_CATEGORIES, isStringArray));
  const [savings, setSavings] = useState(() => readStorage(STORAGE_KEYS.savings, { completedDays: [] }, isSavings));
  const [updatedAt, setUpdatedAt] = useState(() => localStorage.getItem(STORAGE_KEYS.updatedAt) ?? new Date(0).toISOString());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloudUrl ? 'loading' : 'idle');
  const stateRef = useRef({ transactions, expenseCategories, incomeCategories, savings, updatedAt });

  useEffect(() => {
    stateRef.current = { transactions, expenseCategories, incomeCategories, savings, updatedAt };
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
    localStorage.setItem(STORAGE_KEYS.expenseCategories, JSON.stringify(expenseCategories));
    localStorage.setItem(STORAGE_KEYS.incomeCategories, JSON.stringify(incomeCategories));
    localStorage.setItem(STORAGE_KEYS.savings, JSON.stringify(savings));
    localStorage.setItem(STORAGE_KEYS.updatedAt, updatedAt);
  }, [transactions, expenseCategories, incomeCategories, savings, updatedAt]);

  useEffect(() => {
    if (!cloudUrl) return;
    const controller = new AbortController();
    fetch(`${cloudUrl}?action=get`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Cloud request failed');
        return response.json() as Promise<unknown>;
      })
      .then(data => {
        if (!isSnapshot(data)) throw new Error('Invalid cloud snapshot');
        if (Date.parse(data.updatedAt) > Date.parse(stateRef.current.updatedAt)) applySnapshot(data);
        setSyncStatus('idle');
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSyncStatus('error');
      });
    return () => controller.abort();
  }, []);

  const applySnapshot = (snapshot: AppSnapshot) => {
    stateRef.current = snapshot;
    setTransactions(snapshot.transactions);
    setExpenseCategories(snapshot.expenseCategories);
    setIncomeCategories(snapshot.incomeCategories);
    setSavings(snapshot.savings);
    setUpdatedAt(snapshot.updatedAt);
  };

  const syncSnapshot = (changes: Partial<Omit<AppSnapshot, 'updatedAt'>> = {}) => {
    const next: AppSnapshot = {
      ...stateRef.current,
      ...changes,
      updatedAt: new Date(Math.max(Date.now(), Date.parse(stateRef.current.updatedAt) + 1)).toISOString()
    };
    stateRef.current = next;
    setUpdatedAt(next.updatedAt);
    if (!cloudUrl) return;
    setSyncStatus('sending');
    fetch(cloudUrl, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(next)
    })
      .then(() => setSyncStatus('sent'))
      .catch(() => setSyncStatus('error'));
  };

  const addTransaction = (input: Omit<Transaction, 'id' | 'createdAt'>) => {
    const next = [{ ...input, id: createId(), createdAt: new Date().toISOString() }, ...transactions];
    setTransactions(next);
    syncSnapshot({ transactions: next });
  };

  const deleteTransactions = (ids: string[]) => {
    if (!confirm(`確定要刪除選取的 ${ids.length} 筆紀錄嗎？`)) return;
    const next = transactions.filter(transaction => !ids.includes(transaction.id));
    setTransactions(next);
    syncSnapshot({ transactions: next });
  };

  const deleteTransaction = (id: string) => {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return;
    const next = transactions.filter(transaction => transaction.id !== id);
    setTransactions(next);
    syncSnapshot({ transactions: next });
  };

  const toggleSavingsDay = (day: number) => {
    const completed = savings.completedDays.includes(day);
    const next: SavingsState = {
      completedDays: (completed ? savings.completedDays.filter(item => item !== day) : [...savings.completedDays, day]).sort((a, b) => a - b)
    };
    setSavings(next);
    syncSnapshot({ savings: next });
  };

  const changeExpenseCategories = (categories: string[]) => {
    setExpenseCategories(categories);
    syncSnapshot({ expenseCategories: categories });
  };

  const changeIncomeCategories = (categories: string[]) => {
    setIncomeCategories(categories);
    syncSnapshot({ incomeCategories: categories });
  };

  return (
    <div className="min-h-dvh bg-[var(--page)] text-[var(--text)]">
      <a href="#main-content" className="skip-link">跳至主要內容</a>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color:var(--nav)]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <h1 className="text-lg font-extrabold sm:text-xl">Zoe 記帳本</h1>
          <nav aria-label="主要功能" className="flex gap-1 overflow-x-auto py-2">
            <NavButton active={activeView === 'tracker'} onClick={() => setActiveView('tracker')}>記帳</NavButton>
            <NavButton active={activeView === 'calendar'} onClick={() => setActiveView('calendar')}>月曆</NavButton>
            <NavButton active={activeView === 'savings'} onClick={() => setActiveView('savings')}>存錢挑戰</NavButton>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl p-4 py-8 sm:px-6">
        {activeView === 'tracker' && (
          <DailyTracker
            onAdd={addTransaction}
            onDeleteMany={deleteTransactions}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            onExpenseCategoriesChange={changeExpenseCategories}
            onIncomeCategoriesChange={changeIncomeCategories}
            transactions={transactions}
          />
        )}
        {activeView === 'calendar' && <MonthlyCalendar transactions={transactions} onDelete={deleteTransaction} />}
        {activeView === 'savings' && (
          <SavingsChallenge savings={savings} onToggle={toggleSavingsDay} onSync={() => syncSnapshot()} syncStatus={syncStatus} />
        )}
      </main>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 whitespace-nowrap rounded-lg px-3 font-bold transition-colors sm:px-4 ${active
        ? 'bg-[var(--primary)] text-white'
        : 'text-gray-700 hover:bg-white/70'}`}
    >
      {children}
    </button>
  );
}
