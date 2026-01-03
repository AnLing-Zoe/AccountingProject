function doGet(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        const data = {
            expenseCategories: getCategories(ss, '支出'),
            incomeCategories: getCategories(ss, '收入'),
            transactions: getTransactions(ss),
            savings: getSavings(ss)
        };

        return ContentService.createTextOutput(JSON.stringify(data))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ error: e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const data = JSON.parse(e.postData.contents);
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        updateCategories(ss, data.expenseCategories, data.incomeCategories);
        updateTransactions(ss, data.transactions);
        updateSavings(ss, data.savings);

        return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// Helper to format ISO timestamp to yyyy/MM/dd HH:mm
function formatTimestamp(isoString) {
    if (!isoString) return '';
    return Utilities.formatDate(new Date(isoString), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
}

// Helper to format YYYY-MM-DD date string to yyyy/MM/dd
function formatDateString(dateStr) {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '/');
}

// --- Read Functions ---

function getCategories(ss, type) {
    const sheet = ss.getSheetByName('分類');
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    // Col 1: Type, Col 2: Name
    return values.filter(row => row[0] === type).map(row => row[1]);
}

function getTransactions(ss) {
    const sheet = ss.getSheetByName('記帳紀錄');
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    // Columns: [ID, 錄入時間, 帳目時間, 分類, 類別, 金額, 備註]
    const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

    return values.map(row => {
        // Convert sheet date format back to what App expects if needed
        // App expects ISO string for createdAt. 
        // row[1] is 'yyyy/MM/dd HH:mm'. new Date(row[1]).toISOString() works.

        let createdAt = row[1];
        try {
            if (createdAt instanceof Date) {
                createdAt = createdAt.toISOString();
            } else if (typeof createdAt === 'string' && createdAt) {
                createdAt = new Date(createdAt).toISOString();
            }
        } catch (e) {
            console.error('Date parse error', e);
        }

        // row[2] is 'yyyy/MM/dd'. App expects 'yyyy-MM-dd'.
        let date = row[2];
        if (typeof date === 'string') {
            date = date.replace(/\//g, '-');
        } else if (date instanceof Date) {
            date = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
        }

        return {
            id: row[0],
            createdAt: createdAt,
            date: date,
            type: row[3] === '支出' ? 'expense' : 'income',
            category: row[4],
            amount: Number(row[5]),
            note: row[6]
        };
    });
}

function getSavings(ss) {
    const sheet = ss.getSheetByName('365實行計畫');
    if (!sheet) return { completedDays: [] };

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { completedDays: [] };

    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    // Col 2 is the amount/day
    const days = values.map(row => Number(row[1])).filter(n => !isNaN(n));
    return { completedDays: days };
}

// --- Write Functions ---

function updateCategories(ss, expenseCats, incomeCats) {
    let sheet = ss.getSheetByName('分類');
    if (!sheet) {
        sheet = ss.insertSheet('分類');
        sheet.appendRow(['分類', '類別']);
    }

    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
    }

    const rows = [];
    if (expenseCats) {
        expenseCats.forEach(c => rows.push(['支出', c]));
    }
    if (incomeCats) {
        incomeCats.forEach(c => rows.push(['收入', c]));
    }

    if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
    }
}

function updateTransactions(ss, transactions) {
    let sheet = ss.getSheetByName('記帳紀錄');
    if (!sheet) {
        sheet = ss.insertSheet('記帳紀錄');
        sheet.appendRow(['ID', '錄入時間', '帳目時間', '分類', '類別', '金額', '備註']);
    }

    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).clearContent();
    }

    if (transactions && transactions.length > 0) {
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const rows = transactions.map(t => [
            t.id || Utilities.getUuid(),                // ID
            formatTimestamp(t.createdAt),               // 錄入時間
            formatDateString(t.date),                   // 帳目時間
            t.type === 'expense' ? '支出' : '收入',       // 分類
            t.category,                                 // 類別
            t.amount,                                   // 金額
            t.note || ''                                // 備註
        ]);
        sheet.getRange(2, 1, rows.length, 7).setValues(rows);
    }
}

function updateSavings(ss, savings) {
    let sheet = ss.getSheetByName('365實行計畫');
    if (!sheet) {
        sheet = ss.insertSheet('365實行計畫');
        sheet.appendRow(['紀錄時間', '金額']);
    }

    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
    }

    if (savings && savings.completedDays && savings.completedDays.length > 0) {
        const nowStr = new Date().toISOString();
        const formattedNow = formatTimestamp(nowStr);

        const rows = savings.completedDays.sort((a, b) => a - b).map(day => [
            formattedNow,
            day
        ]);

        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, 2).setValues(rows);
        }
    }
}
