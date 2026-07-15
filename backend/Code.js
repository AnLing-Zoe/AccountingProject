function doGet(e) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
        return jsonResponse({ error: 'busy' });
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        // Ensure categories exist
        if (!ss.getSheetByName('分類')) updateCategories(ss, [], []);
        if (!ss.getSheetByName('記帳紀錄')) updateTransactions(ss, []);
        if (!ss.getSheetByName('365實行計畫')) updateSavings(ss, {});

        const properties = PropertiesService.getDocumentProperties();
        let updatedAt = properties.getProperty('updatedAt');
        if (!updatedAt) {
            updatedAt = new Date().toISOString();
            properties.setProperty('updatedAt', updatedAt);
        }

        const data = {
            expenseCategories: getCategories(ss, '支出'),
            incomeCategories: getCategories(ss, '收入'),
            transactions: getTransactions(ss),
            savings: getSavings(ss),
            updatedAt: updatedAt
        };

        return jsonResponse(data);

    } catch (e) {
        return jsonResponse({ error: e.toString() });
    } finally {
        lock.releaseLock();
    }
}

function doPost(e) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
        return jsonResponse({ result: 'busy' });
    }

    try {
        const data = JSON.parse(e.postData.contents);
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const properties = PropertiesService.getDocumentProperties();
        const currentUpdatedAt = properties.getProperty('updatedAt') || new Date(0).toISOString();

        if (Date.parse(data.updatedAt) < Date.parse(currentUpdatedAt)) {
            return jsonResponse({ result: 'stale', updatedAt: currentUpdatedAt });
        }

        updateCategories(ss, data.expenseCategories, data.incomeCategories);
        updateTransactions(ss, data.transactions);
        updateSavings(ss, data.savings);
        properties.setProperty('updatedAt', data.updatedAt);

        return jsonResponse({ result: 'success', updatedAt: data.updatedAt });

    } catch (e) {
        return jsonResponse({ result: 'error', error: e.toString() });
    } finally {
        lock.releaseLock();
    }
}

function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
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
    return values.filter(row => row[0] === type).map(row => row[1]);
}

function getTransactions(ss) {
    const sheet = ss.getSheetByName('記帳紀錄');
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    // Check how many columns we have to decide parse strategy
    const maxCols = sheet.getMaxColumns();
    const lastCol = sheet.getLastColumn();

    // Read up to 7 columns
    const readCols = Math.min(lastCol, 7);
    if (readCols < 1) return [];

    // Use getDisplayValues to preserve text like "7-11" as "7-11" instead of Date
    const values = sheet.getRange(2, 1, lastRow - 1, readCols).getDisplayValues();

    const isNewFormat = sheet.getRange(1, 1).getDisplayValue() === 'ID';

    return values.map(row => {
        // [ID, 錄入時間, 帳目時間, 分類, 類別, 金額, 備註] (New Format)

        // Heuristic: Check if row[3] is type
        // row values are all Strings now.
        let id, createdAt, date, type, category, amount, note;

        if (isNewFormat) {
            id = row[0];
            createdAt = row[1];
            date = row[2];
            type = row[3] === '支出' ? 'expense' : 'income';
            category = row[4];
            // Remove commas for amount parsing
            amount = Number(row[5].replace(/,/g, ''));
            note = row[6];
        } else {
            // Legacy
            id = Utilities.getUuid();
            createdAt = row[0];
            date = row[1];
            type = row[2] === '支出' ? 'expense' : 'income';
            category = row[3];
            amount = Number(row[4].replace(/,/g, ''));
            note = row[5];
        }

        // Date Parsing (from String)
        // GAS getDisplayValues depends on Sheet Locale format.
        // Assuming "yyyy/MM/dd HH:mm" or similar standard formats.
        // We will try our best to keep them as strings or parse if needed by frontend.
        // Frontend expects ISO string for createdAt.
        // If display value is "2024/01/01 12:00", new Date() works usually.

        try {
            if (createdAt) {
                const parsedCo = new Date(createdAt.replace(/\//g, '-'));
                if (!isNaN(parsedCo)) createdAt = parsedCo.toISOString();
            }
        } catch (e) { }

        try {
            if (date) {
                date = date.replace(/\//g, '-');
            }
        } catch (e) { }

        return { id, createdAt, date, type, category, amount: isNaN(amount) ? 0 : amount, note };
    });
}

function getSavings(ss) {
    const sheet = ss.getSheetByName('365實行計畫');
    if (!sheet) return { completedDays: [] };

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { completedDays: [] };

    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
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

    const oldRowCount = Math.max(sheet.getLastRow() - 1, 0);
    const rows = [];
    if (expenseCats) expenseCats.forEach(c => rows.push(['支出', c]));
    if (incomeCats) incomeCats.forEach(c => rows.push(['收入', c]));

    if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
    }
    if (oldRowCount > rows.length) {
        sheet.getRange(2 + rows.length, 1, oldRowCount - rows.length, 2).clearContent();
    }
}

function updateTransactions(ss, transactions) {
    let sheet = ss.getSheetByName('記帳紀錄');
    if (!sheet) {
        sheet = ss.insertSheet('記帳紀錄');
        sheet.appendRow(['ID', '錄入時間', '帳目時間', '分類', '類別', '金額', '備註']);
    } else {
        if (sheet.getMaxColumns() < 7) {
            sheet.insertColumnsAfter(sheet.getMaxColumns(), 7 - sheet.getMaxColumns());
        }
        if (sheet.getRange(1, 1).getValue() !== 'ID') {
            sheet.getRange(1, 1, 1, 7).setValues([['ID', '錄入時間', '帳目時間', '分類', '類別', '金額', '備註']]);
        }
    }

    const oldRowCount = Math.max(sheet.getLastRow() - 1, 0);

    if (transactions && transactions.length > 0) {
        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        const rows = sortedTransactions.map(t => [
            t.id || Utilities.getUuid(),
            formatTimestamp(t.createdAt),
            formatDateString(t.date),
            t.type === 'expense' ? '支出' : '收入',
            t.category,
            t.amount,
            t.note || ''
        ]);

        const range = sheet.getRange(2, 1, rows.length, 7);
        range.setValues(rows);

        // Force Text Format for ID (1), Category (5), Note (7)
        // Force Number Format for Amount (6) just in case
        sheet.getRange(2, 1, rows.length, 1).setNumberFormat('@'); // ID
        sheet.getRange(2, 5, rows.length, 1).setNumberFormat('@'); // Category
        sheet.getRange(2, 7, rows.length, 1).setNumberFormat('@'); // Note

    }
    if (oldRowCount > transactions.length) {
        sheet.getRange(2 + transactions.length, 1, oldRowCount - transactions.length, 7).clearContent();
    }
}

function updateSavings(ss, savings) {
    let sheet = ss.getSheetByName('365實行計畫');
    if (!sheet) {
        sheet = ss.insertSheet('365實行計畫');
        sheet.appendRow(['紀錄時間', '金額']);
    }

    const oldRowCount = Math.max(sheet.getLastRow() - 1, 0);
    const days = savings && savings.completedDays ? [...savings.completedDays].sort((a, b) => a - b) : [];

    if (days.length > 0) {
        const formattedNow = formatTimestamp(new Date().toISOString());
        const rows = days.map(day => [formattedNow, day]);

        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, 2).setValues(rows);
        }
    }
    if (oldRowCount > days.length) {
        sheet.getRange(2 + days.length, 1, oldRowCount - days.length, 2).clearContent();
    }
}
