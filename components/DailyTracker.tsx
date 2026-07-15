import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { formatCurrency, localDateValue } from '../utils';

interface DailyTrackerProps {
  onAdd: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDeleteMany: (ids: string[]) => void;
  expenseCategories: string[];
  incomeCategories: string[];
  onExpenseCategoriesChange: (categories: string[]) => void;
  onIncomeCategoriesChange: (categories: string[]) => void;
  transactions: Transaction[];
}

export default function DailyTracker({
  onAdd,
  onDeleteMany,
  expenseCategories,
  incomeCategories,
  onExpenseCategoriesChange,
  onIncomeCategoriesChange,
  transactions
}: DailyTrackerProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(localDateValue);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0] ?? '');
  }, [categories, category]);

  useEffect(() => {
    setSelectedIds(previous => previous.filter(id => transactions.some(transaction => transaction.id === id)));
  }, [transactions]);

  const todayTransactions = useMemo(
    () => transactions.filter(transaction => localDateValue(new Date(transaction.createdAt)) === localDateValue()).slice(0, 10),
    [transactions]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('請輸入大於 0 的有效金額。');
      return;
    }
    if (!category) {
      setError('請先選擇或新增類別。');
      return;
    }
    onAdd({ type, date, category, amount: numericAmount, note: note.trim() });
    setAmount('');
    setNote('');
    setError('');
  };

  const updateCategories = (next: string[]) => {
    if (type === 'expense') onExpenseCategoriesChange(next);
    else onIncomeCategoriesChange(next);
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setError('這個類別已經存在。');
      return;
    }
    updateCategories([...categories, trimmed]);
    setCategory(trimmed);
    setNewCategory('');
    setError('');
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="app-panel p-6 md:p-8" aria-labelledby="tracker-title">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h2 id="tracker-title" className="text-2xl font-extrabold text-[var(--text)]">今日記帳</h2>
          <button
            type="button"
            aria-expanded={isEditingCategories}
            onClick={() => setIsEditingCategories(value => !value)}
            className="secondary-button"
          >
            {isEditingCategories ? '完成' : '管理類別'}
          </button>
        </header>

        {isEditingCategories && (
          <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
            <h3 className="mb-4 font-bold text-[var(--text)]">{type === 'expense' ? '支出' : '收入'}類別</h3>
            <div className="mb-4 flex flex-wrap gap-2">
              {categories.map(item => (
                <span key={item} className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 font-semibold">
                  {item}
                  <button
                    type="button"
                    aria-label={`刪除類別 ${item}`}
                    onClick={() => updateCategories(categories.filter(categoryItem => categoryItem !== item))}
                    className="icon-button text-[var(--danger)]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="new-category" className="sr-only">新增類別名稱</label>
              <input
                id="new-category"
                value={newCategory}
                onChange={event => setNewCategory(event.target.value)}
                className="field flex-1"
                placeholder="新增類別"
              />
              <button type="button" onClick={handleAddCategory} className="primary-button">新增</button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <fieldset>
            <legend className="sr-only">交易類型</legend>
            <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1">
              {(['expense', 'income'] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => setType(value)}
                  className={`min-h-11 rounded-lg px-4 font-bold transition-colors ${type === value
                    ? value === 'expense' ? 'bg-[var(--danger)] text-white' : 'bg-[var(--success)] text-white'
                    : 'text-gray-600 hover:bg-white'}`}
                >
                  {value === 'expense' ? '支出' : '收入'}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="transaction-date" className="field-label">日期</label>
              <input id="transaction-date" type="date" value={date} onChange={event => setDate(event.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="transaction-category" className="field-label">類別</label>
              <select id="transaction-category" value={category} onChange={event => setCategory(event.target.value)} className="field" required>
                <option value="" disabled>請選擇</option>
                {categories.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="transaction-amount" className="field-label">金額（新台幣）</label>
            <input
              id="transaction-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              className="field text-2xl font-extrabold tabular-nums"
              placeholder="0"
              aria-describedby={error ? 'transaction-error' : undefined}
              required
            />
          </div>

          <div>
            <label htmlFor="transaction-note" className="field-label">備註</label>
            <textarea id="transaction-note" value={note} onChange={event => setNote(event.target.value)} className="field min-h-20 resize-y" placeholder="選填" />
          </div>

          {error && <p id="transaction-error" role="alert" className="font-semibold text-[var(--danger)]">{error}</p>}

          <button type="submit" className={`primary-button w-full text-lg ${type === 'expense' ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'}`}>
            新增{type === 'expense' ? '支出' : '收入'}
          </button>
        </form>
      </section>

      <section className="app-panel p-6 md:p-8" aria-labelledby="recent-title">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 id="recent-title" className="text-xl font-extrabold text-[var(--text)]">最近新增</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">今天建立的最近 10 筆紀錄</p>
          </div>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => { onDeleteMany(selectedIds); setSelectedIds([]); }}
              className="danger-button"
            >
              刪除 {selectedIds.length} 筆
            </button>
          )}
        </header>

        {todayTransactions.length === 0 ? (
          <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-8 text-center text-[var(--text-muted)]">今天還沒有新增紀錄。</p>
        ) : (
          <ul className="space-y-2">
            {todayTransactions.map(transaction => (
              <li key={transaction.id} className="flex items-center gap-3 rounded-xl border border-transparent bg-gray-50 p-3 hover:border-[var(--border)]">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(transaction.id)}
                  onChange={() => toggleSelected(transaction.id)}
                  aria-label={`選取 ${transaction.category} ${formatCurrency(transaction.amount)}`}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-bold text-[var(--text)]">{transaction.category}</span>
                    <time className="text-sm text-[var(--text-muted)]">{new Date(transaction.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                  <p className="truncate text-sm text-[var(--text-muted)]">{transaction.date}{transaction.note ? ` · ${transaction.note}` : ''}</p>
                </div>
                <span className={`font-extrabold tabular-nums ${transaction.type === 'expense' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                  {transaction.type === 'expense' ? '−' : '+'}{formatCurrency(transaction.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
