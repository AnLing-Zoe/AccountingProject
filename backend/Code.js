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
        sheet.appendRow(['分類', '類別']); // Header: Classification, Category
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
        // Sort by date desc
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Map to columns: 錄入時間, 帳目時間, 分類, 類別, 金額, 備註
        const rows = transactions.map(t => [
            t.createdAt,                  // 錄入時間 (System Time)
            t.date,                       // 帳目時間 (Selected Date)
            t.type === 'expense' ? '支出' : '收入', // 分類
            t.category,                   // 類別
            t.amount,                     // 金額
            t.note || ''                  // 備註
        ]);
        sheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }
}

function updateSavings(ss, savings) {
    let sheet = ss.getSheetByName('365實行計畫');
    if (!sheet) {
        sheet = ss.insertSheet('365實行計畫');
        sheet.appendRow(['紀錄時間', '金額']); // Header (User removed IsSelected)
    }

    // Clear content except header
    if (sheet.getLastRow() > 1) {
        // Note: Use getLastColumn or hardcode 2 based on header
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
    }

    if (savings && savings.completedDays && savings.completedDays.length > 0) {
        const now = new Date().toISOString();

        // Map to columns: 紀錄時間, 金額
        const rows = savings.completedDays.sort((a, b) => a - b).map(day => [
            now,  // 紀錄時間
            day   // 金額 (Day number)
        ]);

        // Check if we have rows to insert to avoid error
        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, 2).setValues(rows);
        }
    }
}
