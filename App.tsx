
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, ViewType, SavingsState } from './types';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, TARGET_SAVINGS_AMOUNT } from './constants';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('tracker');
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('mw_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [savings, setSavings] = useState<SavingsState>(() => {
    const saved = localStorage.getItem('mw_savings');
    return saved ? JSON.parse(saved) : { completedDays: [] };
  });

  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('mw_expense_cats');
    return saved ? JSON.parse(saved) : DEFAULT_EXPENSE_CATEGORIES;
  });

  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('mw_income_cats');
    return saved ? JSON.parse(saved) : DEFAULT_INCOME_CATEGORIES;
  });

  useEffect(() => {
    localStorage.setItem('mw_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('mw_savings', JSON.stringify(savings));
    localStorage.setItem('mw_expense_cats', JSON.stringify(expenseCategories));
    localStorage.setItem('mw_income_cats', JSON.stringify(incomeCategories));
  }, [savings, expenseCategories, incomeCategories]);

  // Load data from cloud on start
  useEffect(() => {
    const url = import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL;
    if (!url) return;

    const fetchData = async () => {
      try {
        console.log('☁️ Fetching data from Cloud...');
        const res = await fetch(url + '?action=get'); // GAS doGet doesn't strictly read params but good for caching prevention or intent
        if (!res.ok) throw new Error('Network response was not ok');

        const data = await res.json();
        console.log('☁️ Data received:', data);

        if (data.transactions) {
          setTransactions(data.transactions);
        }
        if (data.expenseCategories) {
          setExpenseCategories(data.expenseCategories);
        }
        if (data.incomeCategories) {
          setIncomeCategories(data.incomeCategories);
        }
        if (data.savings) {
          setSavings({ completedDays: data.savings.completedDays || [] });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  // 獨立出 Sync 函數以便調用
  const syncToCloud = async (
    currentTransactions: Transaction[],
    currentExpenseCats: string[],
    currentIncomeCats: string[],
    currentSavings: SavingsState
  ) => {
    const url = import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL;
    if (!url) return; // Silent return if not configured

    try {
      const payload = {
        action: 'sync',
        expenseCategories: currentExpenseCats,
        incomeCategories: currentIncomeCats,
        transactions: currentTransactions,
        savings: currentSavings
      };

      console.log('☁️ Syncing to Cloud...', {
        url,
        txCount: currentTransactions.length,
        payload
      });

      // 使用 no-cors 模式發送，不等待回應以避免阻塞 UI
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(e => console.error('Background sync failed:', e));

    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  // 單項刪除功能
  const removeTransaction = (id: string) => {
    if (confirm('確定要刪除這筆紀錄嗎？')) {
      setTransactions(prev => {
        const newTransactions = prev.filter(t => t.id !== id);
        syncToCloud(newTransactions, expenseCategories, incomeCategories, savings);
        return newTransactions;
      });
    }
  };

  // 批量刪除功能
  const removeTransactions = (ids: string[]) => {
    if (confirm(`確定要刪除選取的 ${ids.length} 筆紀錄嗎？`)) {
      setTransactions(prev => {
        const newTransactions = prev.filter(t => !ids.includes(t.id));
        syncToCloud(newTransactions, expenseCategories, incomeCategories, savings);
        return newTransactions;
      });
    }
  };

  const addTransaction = (t: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTransaction: Transaction = {
      ...t,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    setTransactions(prev => {
      const newTransactions = [newTransaction, ...prev];
      syncToCloud(newTransactions, expenseCategories, incomeCategories, savings);
      return newTransactions;
    });
  };

  const toggleSavingsDay = (day: number) => {
    setSavings(prev => {
      const isCompleted = prev.completedDays.includes(day);
      if (isCompleted) {
        return { completedDays: prev.completedDays.filter(d => d !== day) };
      } else {
        return { completedDays: [...prev.completedDays, day].sort((a, b) => a - b) };
      }
    });
  };



  const handleSyncToCloud = async () => {
    const url = import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL;
    if (!url) {
      alert('請先設定環境變數 VITE_GOOGLE_APP_SCRIPT_URL');
      return;
    }

    if (!confirm('即將覆蓋 Sheet 上的舊資料。')) return;

    try {
      const payload = {
        action: 'sync',
        expenseCategories,
        incomeCategories,
        transactions,
        savings
      };

      await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // GAS web app requires no-cors for simple requests from browser
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      alert('同步請求已發送！(因跨域限制無法直接確認結果，請檢查 Google Sheet)');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('同步失敗，請檢查控制台');
    }
  };

  return (
    <div className="min-h-screen bg-[#fffcf9] flex flex-col transition-all duration-300">
      {/* 頂部導覽列 - 使用 #FFEECF 作為底色 */}
      <nav className="sticky top-0 w-full bg-[#FFEECF]/90 backdrop-blur-md border-b border-[#C9A690]/20 shadow-sm z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#C9A690] rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#C9A690]/30">$</div>
              <h1 className="text-xl font-black text-[#443730] tracking-tight hidden sm:block">Zoe個人記帳</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-1 sm:gap-4 overflow-x-auto no-scrollbar">
                <NavItem active={activeView === 'tracker'} onClick={() => setActiveView('tracker')} icon="✏️" label="收支紀錄" />
                <NavItem active={activeView === 'calendar'} onClick={() => setActiveView('calendar')} icon="📅" label="月曆總覽" />
                <NavItem active={activeView === 'savings'} onClick={() => setActiveView('savings')} icon="💰" label="365挑戰" />
              </div>
              <button
                onClick={handleSyncToCloud}
                className="ml-2 px-3 py-1.5 bg-white/50 hover:bg-white text-[#C9A690] rounded-lg text-sm font-bold border border-[#C9A690]/20 transition-all flex items-center gap-1.5"
                title="同步至 Google Sheet"
              >
                <span>☁️</span>
                <span className="hidden sm:inline">同步</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要內容區 */}
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        {activeView === 'tracker' && (
          <DailyTracker
            onAdd={addTransaction}
            onDelete={removeTransaction}
            onDeleteMany={removeTransactions}
            expenseCats={expenseCategories}
            incomeCats={incomeCategories}
            setExpenseCats={setExpenseCategories}
            setIncomeCats={setIncomeCategories}
            transactions={transactions}
          />
        )}
        {activeView === 'calendar' && <MonthlyCalendar transactions={transactions} onDelete={removeTransaction} />}
        {activeView === 'savings' && <SavingsChallenge savings={savings} onToggle={toggleSavingsDay} />}
      </main>
    </div>
  );
};

// 導覽按鈕 - 激活時使用 #C9A690
const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 whitespace-nowrap group ${active ? 'text-white bg-[#C9A690] font-bold shadow-md' : 'text-gray-500 hover:bg-[#FFEECF] hover:text-[#C9A690]'
      }`}
  >
    <span className={`text-lg transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
    <span className="text-sm sm:text-base">{label}</span>
  </button>
);

const DailyTracker: React.FC<{
  onAdd: (t: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  expenseCats: string[];
  incomeCats: string[];
  setExpenseCats: React.Dispatch<React.SetStateAction<string[]>>;
  setIncomeCats: React.Dispatch<React.SetStateAction<string[]>>;
  transactions: Transaction[];
}> = ({ onAdd, onDelete, onDeleteMany, expenseCats, incomeCats, setExpenseCats, setIncomeCats, transactions }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isEditingCats, setIsEditingCats] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const currentCats = type === 'expense' ? expenseCats : incomeCats;

  useEffect(() => {
    if (!currentCats.includes(category)) {
      setCategory(currentCats[0] || '');
    }
  }, [type, expenseCats, incomeCats, category]);

  // 當 transactions 變更時，清理 selectedIds 中已經不存在的 ID
  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => transactions.some(t => t.id === id)));
  }, [transactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return alert('請輸入有效金額');
    if (!category) return alert('請選擇或新增類別項目');
    onAdd({
      type,
      date,
      category,
      amount: Number(amount),
      note
    });
    setAmount('');
    setNote('');
  };

  const handleAddCat = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (currentCats.includes(trimmed)) return alert('類別已存在');
    if (type === 'expense') {
      setExpenseCats(prev => [...prev, trimmed]);
    } else {
      setIncomeCats(prev => [...prev, trimmed]);
    }
    setNewCatName('');
  };

  const handleRemoveCat = (catToRemove: string) => {
    if (type === 'expense') {
      setExpenseCats(prev => prev.filter(c => c !== catToRemove));
    } else {
      setIncomeCats(prev => prev.filter(c => c !== catToRemove));
    }
  };

  const handleToggleId = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    onDeleteMany(selectedIds);
    setSelectedIds([]);
  };

  const todayOperations = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    return transactions
      .filter(t => {
        const tDate = new Date(t.createdAt);
        return tDate.getFullYear() === currentYear &&
          tDate.getMonth() === currentMonth &&
          tDate.getDate() === currentDate;
      })
      .slice(0, 10);
  }, [transactions]);

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-[#FFEECF] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black text-[#443730] tracking-tight">收支紀錄</h2>
          <button
            onClick={() => setIsEditingCats(!isEditingCats)}
            className="text-sm font-bold text-[#C9A690] bg-[#FFEECF] px-3 py-1.5 rounded-full hover:bg-[#C9A690]/10 transition-colors"
          >
            {isEditingCats ? '✓ 完成' : '⚙️ 類別管理'}
          </button>
        </header>

        {isEditingCats && (
          <div className="mb-8 p-6 bg-[#FFEECF]/30 rounded-[1.5rem] border border-[#FFEECF] animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-black text-[#C9A690] mb-4 tracking-wider">
              管理 {type === 'expense' ? '支出' : '收入'} 項目
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {currentCats.map(cat => (
                <span key={cat} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl text-sm font-bold text-gray-700 shadow-sm border border-[#FFEECF]">
                  {cat}
                  <button onClick={() => handleRemoveCat(cat)} className="text-red-400 hover:text-red-600 font-bold transition-colors">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="輸入新名稱..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border-2 border-[#FFEECF] focus:border-[#C9A690] outline-none text-sm font-bold bg-white/50"
              />
              <button onClick={handleAddCat} className="bg-[#C9A690] text-white font-black px-6 py-2 rounded-xl text-sm hover:opacity-90 transition-colors">新增</button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all ${type === 'expense' ? 'bg-[#550C18] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              💸 支出
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all ${type === 'income' ? 'bg-[#357266] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              💰 收入
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#443730] ml-1">日期</label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ colorScheme: 'light' }}
                  className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#C9A690] focus:bg-white outline-none font-bold text-[#443730] block appearance-none [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:bg-[#C9A690] [&::-webkit-calendar-picker-indicator]:p-1.5 [&::-webkit-calendar-picker-indicator]:rounded-lg [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#443730] ml-1">項目</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#C9A690] focus:bg-white outline-none appearance-none font-bold text-[#443730] cursor-pointer"
              >
                <option value="" disabled>請選擇</option>
                {currentCats.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-[#443730] ml-1">金額</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-[#443730]">$</span>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 p-5 text-4xl font-black rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#C9A690] focus:bg-white outline-none text-[#443730]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-[#443730] ml-1">備註</label>
            <textarea
              placeholder="細項..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#C9A690] focus:bg-white outline-none min-h-[80px] font-bold text-gray-800 resize-none"
            />
          </div>

          <button
            type="submit"
            className={`w-full py-5 rounded-2xl text-white font-black text-xl shadow-xl transition-all active:scale-95 ${type === 'expense' ? 'bg-[#550C18] hover:opacity-90 shadow-[#550C18]/20' : 'bg-[#357266] hover:opacity-90 shadow-[#357266]/20'
              }`}
          >
            儲存
          </button>
        </form>
      </div>

      {/* 今日操作紀錄區塊 */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-[#FFEECF]">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-[#443730]">今日帳務</h3>
            <p className="text-sm text-gray-400 font-bold mt-1">系統錄入紀錄</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-black animate-in fade-in zoom-in hover:bg-red-600 transition-colors"
              >
                刪除選取 ({selectedIds.length})
              </button>
            )}
            <span className="px-3 py-1 bg-[#C9A690] text-white rounded-full text-xs font-black">{todayOperations.length} 筆項目</span>
          </div>
        </header>

        {todayOperations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
            <span className="text-4xl block mb-2 opacity-30">📒</span>
            <p className="text-gray-400 font-bold text-sm">今日尚無紀錄</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayOperations.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group border border-transparent hover:border-[#C9A690]/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center p-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => handleToggleId(t.id)}
                      className="w-5 h-5 rounded-lg border-2 border-gray-300 text-[#C9A690] focus:ring-[#C9A690] cursor-pointer accent-[#C9A690]"
                    />
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-sm ${t.type === 'expense' ? 'bg-[#550C18]' : 'bg-[#357266]'}`}>
                    {t.type === 'expense' ? '−' : '+'}
                  </div>
                  <div>
                    <div className="font-black text-[#443730] flex items-center gap-2">
                      {t.category}
                      <span className="text-[10px] font-bold text-gray-300 bg-white px-1.5 py-0.5 rounded border border-gray-100">
                        {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-gray-400">
                      日期 {t.date} {t.note && ` • ${t.note}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`text-xl font-black ${t.type === 'expense' ? 'text-[#550C18]' : 'text-[#357266]'}`}>
                    {t.type === 'expense' ? '-' : '+'}${t.amount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MonthlyCalendar: React.FC<{ transactions: Transaction[]; onDelete: (id: string) => void }> = ({ transactions, onDelete }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentDate(new Date(parseInt(e.target.value), currentMonth, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentDate(new Date(currentYear, parseInt(e.target.value), 1));
  };

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const monthData = useMemo(() => {
    const data: Record<number, number> = {};
    const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    transactions.forEach(t => {
      if (t.date.startsWith(yearMonth)) {
        const day = parseInt(t.date.split('-')[2]);
        const value = t.type === 'income' ? t.amount : -t.amount;
        data[day] = (data[day] || 0) + value;
      }
    });
    return data;
  }, [transactions, currentYear, currentMonth]);

  const dayTransactions = useMemo(() => {
    if (selectedDay === null) return [];
    const yearMonthDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    return transactions.filter(t => t.date === yearMonthDay);
  }, [transactions, currentYear, currentMonth, selectedDay]);

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-[#FFEECF] overflow-hidden">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 px-2 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={currentYear}
                onChange={handleYearChange}
                className="appearance-none bg-[#FFEECF] border-2 border-[#C9A690]/20 text-[#443730] font-black text-2xl py-1 px-4 pr-10 rounded-xl focus:border-[#C9A690] outline-none cursor-pointer"
              >
                {years.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#C9A690]">▼</div>
            </div>
            <div className="relative">
              <select
                value={currentMonth}
                onChange={handleMonthChange}
                className="appearance-none bg-[#FFEECF] border-2 border-[#C9A690]/20 text-[#443730] font-black text-2xl py-1 px-4 pr-10 rounded-xl focus:border-[#C9A690] outline-none cursor-pointer"
              >
                {months.map(m => <option key={m} value={m}>{m + 1}月</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#C9A690]">▼</div>
            </div>
          </div>
          <p className="text-[#C9A690] font-bold text-xs tracking-widest mt-1">當月結算</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={prevMonth}
            className="w-14 h-14 flex items-center justify-center bg-[#FFEECF] text-[#C9A690] hover:bg-[#C9A690] hover:text-white rounded-2xl transition-all text-3xl font-bold shadow-sm active:scale-90"
          >
            ←
          </button>
          <button
            onClick={nextMonth}
            className="w-14 h-14 flex items-center justify-center bg-[#FFEECF] text-[#C9A690] hover:bg-[#C9A690] hover:text-white rounded-2xl transition-all text-3xl font-bold shadow-sm active:scale-90"
          >
            →
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 mb-4">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-center text-xs font-black text-[#C9A690]/60 py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3 sm:gap-4">
        {days.map((day, idx) => (
          <button
            key={idx}
            disabled={day === null}
            onClick={() => day !== null && setSelectedDay(day)}
            className={`aspect-square sm:aspect-auto sm:min-h-[100px] border rounded-2xl p-2 transition-all flex flex-col items-center justify-center sm:items-start sm:justify-start group ${day === null
              ? 'bg-transparent border-transparent cursor-default'
              : 'bg-gray-50/50 border-gray-100 hover:border-[#C9A690] hover:shadow-xl hover:-translate-y-1 active:scale-95'
              } ${selectedDay === day ? 'ring-4 ring-[#FFEECF] border-[#C9A690]' : ''}`}
          >
            {day && (
              <>
                <div className={`text-sm font-black mb-1 ${monthData[day] !== undefined ? 'text-[#443730]' : 'text-gray-300'}`}>{day}</div>
                {monthData[day] !== undefined && (
                  <div className={`text-[10px] sm:text-xs font-black truncate px-1.5 py-0.5 rounded-lg w-full text-center ${monthData[day] >= 0 ? 'text-white bg-[#357266]' : 'text-white bg-[#550C18]'
                    }`}>
                    {monthData[day] > 0 ? '+' : ''}{monthData[day].toLocaleString()}
                  </div>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* 單日詳情彈窗 */}
      {selectedDay !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedDay(null)}>
          <div
            className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 pb-4 flex items-center justify-between border-b border-[#FFEECF]">
              <div>
                <h3 className="text-2xl font-black text-[#443730]">{currentYear}年 {currentMonth + 1}月 {selectedDay}日</h3>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">當日詳細明細</p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center hover:bg-[#550C18] hover:text-white transition-all text-xl"
              >✕</button>
            </div>

            <div className="p-8 max-h-[50vh] overflow-y-auto space-y-4 no-scrollbar">
              {dayTransactions.length === 0 ? (
                <div className="text-center py-16 text-gray-300 font-bold italic">這天沒有任何明細紀錄</div>
              ) : (
                dayTransactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-[1.5rem] border border-transparent hover:border-[#C9A690]/20 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-sm ${t.type === 'expense' ? 'bg-[#550C18]' : 'bg-[#357266]'}`}>
                        {t.type === 'expense' ? '−' : '+'}
                      </div>
                      <div>
                        <div className="font-black text-[#443730] text-lg">{t.category}</div>
                        <div className="text-sm font-bold text-gray-400">{t.note || '無備註'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-xl font-black ${t.type === 'expense' ? 'text-[#550C18]' : 'text-[#357266]'}`}>
                        {t.type === 'expense' ? '-' : '+'}${t.amount.toLocaleString()}
                      </div>
                      <button type="button" onClick={() => onDelete(t.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2" title="刪除">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={`p-8 border-t flex justify-between items-center ${(monthData[selectedDay] || 0) >= 0 ? 'bg-[#357266]' : 'bg-[#550C18]'}`}>
              <span className="font-black text-white uppercase text-sm tracking-wider">今日結算盈虧</span>
              <span className="text-3xl font-black text-white">
                ${(monthData[selectedDay] || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SavingsChallenge: React.FC<{ savings: SavingsState; onToggle: (day: number) => void }> = ({ savings, onToggle }) => {
  const currentTotal = useMemo(() => savings.completedDays.reduce((a, b) => a + b, 0), [savings.completedDays]);
  const progressPercent = (currentTotal / TARGET_SAVINGS_AMOUNT) * 100;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      {/* 儀表板區域 */}
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-[#FFEECF] flex flex-col md:flex-row items-center gap-12">
        <div className="relative w-56 h-56 flex-shrink-0">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-[#FFEECF]" />
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={263.89}
              strokeDashoffset={263.89 - (263.89 * progressPercent) / 100}
              strokeLinecap="round"
              className="text-[#C9A690] transition-all duration-1000 ease-out drop-shadow-[0_4px_10px_rgba(201,166,144,0.3)]"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-[#443730] tracking-tighter">{Math.round(progressPercent)}%</span>
            <span className="text-[11px] text-[#C9A690] font-black tracking-widest mt-1">累積進度</span>
            <span className="text-[10px] text-gray-400 font-bold mt-1 text-center">
              {currentTotal.toLocaleString()} / {TARGET_SAVINGS_AMOUNT.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-6 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 bg-[#C9A690] rounded-[2rem] shadow-lg shadow-[#C9A690]/20 flex flex-col justify-center items-center text-center">
              <p className="text-white/90 text-xs font-black uppercase tracking-widest mb-1">已存金額</p>
              <p className="text-3xl font-black text-white tracking-tight">${currentTotal.toLocaleString()}</p>
            </div>
            <div className="p-6 bg-[#FFEECF] rounded-[2rem] border border-[#C9A690]/20 flex flex-col justify-center items-center text-center">
              <p className="text-[#C9A690] text-xs font-black uppercase tracking-widest mb-1">目標總額</p>
              <p className="text-3xl font-black text-[#443730] tracking-tight">${TARGET_SAVINGS_AMOUNT.toLocaleString()}</p>
            </div>
          </div>
          <div className="p-5 bg-gradient-to-r from-[#C9A690] to-[#FFEECF] rounded-3xl shadow-lg">
            <div className="flex justify-between items-center text-white">
              <span className="font-black uppercase text-xs tracking-widest">挑戰天數進度</span>
              <span className="text-2xl font-black">{savings.completedDays.length} / 365</span>
            </div>
            <div className="w-full bg-black/10 h-2.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-white h-full transition-all duration-1000 shadow-[0_0_12px_white]" style={{ width: `${(savings.completedDays.length / 365) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 365 網格 */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-[#FFEECF]">
        <header className="mb-8 flex items-center justify-between px-2">
          <div>
            <h3 className="text-2xl font-black text-[#443730]">365 存錢挑戰表</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">點擊即可標記完成</p>
          </div>
          <div className="hidden sm:flex gap-1.5 items-center bg-[#FFEECF] px-3 py-1.5 rounded-full">
            <div className="w-3 h-3 bg-[#C9A690] rounded-full"></div>
            <span className="text-[10px] font-black text-[#C9A690]">已達成項目</span>
          </div>
        </header>
        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 gap-1.5 sm:gap-2">
          {Array.from({ length: 365 }, (_, i) => i + 1).map(day => {
            const isDone = savings.completedDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => onToggle(day)}
                className={`aspect-square flex items-center justify-center text-[10px] md:text-xs font-black rounded-xl transition-all ${isDone
                  ? 'bg-[#C9A690] text-white shadow-md shadow-[#C9A690]/30 scale-95 border-b-4 border-[#C9A690]/80'
                  : 'bg-gray-50 text-gray-400 border border-gray-100 hover:border-[#C9A690]/40 hover:bg-[#FFEECF]/30'
                  }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default App;
