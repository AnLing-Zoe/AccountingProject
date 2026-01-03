function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const data = JSON.parse(e.postData.contents);
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        // 1. Sync Categories
        updateCategories(ss, data.expenseCategories, data.incomeCategories);

        // 2. Sync Transactions
        updateTransactions(ss, data.transactions);

        // 3. Sync Savings
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

function updateCategories(ss, expenseCats, incomeCats) {
    let sheet = ss.getSheetByName('分類');
    if (!sheet) {
        sheet = ss.insertSheet('分類');
        sheet.appendRow(['類型', '類別']); // Header
    }

    // Clear content except header
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
        sheet.appendRow(['錄入時間', '帳目時間', '分類', '類別', '金額', '備註']); // Header
    }

    // Clear content except header
    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).clearContent();
    }

    if (transactions && transactions.length > 0) {
        // Sort by date desc (optional, but good for viewing)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const rows = transactions.map(t => [
            t.createdAt, // 錄入時間
            t.date,      // 帳目時間
            t.type === 'expense' ? '支出' : '收入', // 分類
            t.category,  // 類別
            t.amount,    // 金額
            t.note || '' // 備註
        ]);
        sheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }
}

function updateSavings(ss, savings) {
    let sheet = ss.getSheetByName('365實行計畫');
    if (!sheet) {
        sheet = ss.insertSheet('365實行計畫');
        sheet.appendRow(['紀錄時間', '金額', '已選取']); // Header
    }

    // Clear content except header
    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
    }

    if (savings && savings.completedDays && savings.completedDays.length > 0) {
        const now = new Date().toISOString();
        // We'll list each completed day as a row
        const rows = savings.completedDays.sort((a, b) => a - b).map(day => [
            now,  // 紀錄時間 (Using sync time as record time since local storage doesn't track when it was clicked)
            day,  // 金額 (Day number equals amount)
            day   // 已選取 (Same as day/amount)
        ]);
        sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    }
}
