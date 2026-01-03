
export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  date: string; // The date of the expense/income (user selected)
  createdAt: string; // The timestamp when this was recorded (system time)
  type: TransactionType;
  category: string;
  amount: number;
  note: string;
}

export interface SavingsState {
  completedDays: number[]; // Array of numbers from 1 to 365
}

export type ViewType = 'tracker' | 'calendar' | 'savings';
