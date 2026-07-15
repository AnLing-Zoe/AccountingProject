import { AppSnapshot, SavingsState, Transaction } from './types';

export const STORAGE_KEYS = {
  transactions: 'mw_transactions',
  expenseCategories: 'mw_expense_cats',
  incomeCategories: 'mw_income_cats',
  savings: 'mw_savings',
  updatedAt: 'mw_updated_at'
} as const;

export function readStorage<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

export const isTransactions = (value: unknown): value is Transaction[] =>
  Array.isArray(value) && value.every(item => {
    if (!item || typeof item !== 'object') return false;
    const transaction = item as Record<string, unknown>;
    return typeof transaction.id === 'string'
      && typeof transaction.date === 'string'
      && typeof transaction.createdAt === 'string'
      && (transaction.type === 'expense' || transaction.type === 'income')
      && typeof transaction.category === 'string'
      && typeof transaction.amount === 'number'
      && Number.isFinite(transaction.amount)
      && transaction.amount > 0
      && typeof transaction.note === 'string';
  });

export const isSavings = (value: unknown): value is SavingsState => {
  if (!value || typeof value !== 'object') return false;
  const days = (value as SavingsState).completedDays;
  return Array.isArray(days)
    && days.every(day => Number.isInteger(day) && day >= 1 && day <= 365)
    && new Set(days).size === days.length;
};

export const isSnapshot = (value: unknown): value is AppSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as AppSnapshot;
  return isTransactions(snapshot.transactions)
    && isStringArray(snapshot.expenseCategories)
    && isStringArray(snapshot.incomeCategories)
    && isSavings(snapshot.savings)
    && typeof snapshot.updatedAt === 'string'
    && !Number.isNaN(Date.parse(snapshot.updatedAt));
};

export const localDateValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatCurrency = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0
}).format;
