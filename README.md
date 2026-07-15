# MoneyWise - Personal Finance Tracker

使用 React、TypeScript、Vite 與 Tailwind CSS 製作的個人記帳工具，包含日常收支、月曆統計及 365 天存錢挑戰。

資料預設保存在瀏覽器 `localStorage`。設定 Google Apps Script 後，可同步到 Google Sheet。

## 開發環境

- Node.js 20+
- npm

```bash
npm ci
npm run dev
```

開發伺服器預設為 `http://localhost:3000/AccountingProject/`。

## 可用指令

```bash
npm run dev        # 啟動開發伺服器
npm run typecheck  # TypeScript 檢查
npm run build      # 產生 dist/
npm run preview    # 預覽正式建置
```

## Google Sheet 同步

1. 將 [backend/Code.js](backend/Code.js) 放入綁定 Google Sheet 的 Apps Script 專案。
2. 將 Apps Script 部署為 Web App。
3. 複製 `.env.example` 為 `.env`，填入部署網址：

```env
VITE_GOOGLE_APP_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

`VITE_` 值會出現在瀏覽器 bundle，不能存放密鑰。未設定網址時，應用程式只使用本機儲存。

同步採完整快照與時間戳版本。前端使用 `no-cors` 傳送，因此「已送出」不代表伺服器已確認寫入；重要資料仍應定期備份 Google Sheet。

## 專案結構

```text
App.tsx                 應用程式狀態與同步協調
components/             記帳、月曆及存錢挑戰畫面
utils.ts                儲存、驗證、日期及金額格式
types.ts                共用型別
constants.ts            預設類別與目標金額
backend/Code.js         Google Apps Script 後端
.github/workflows/      GitHub Pages 自動部署
```

## 部署

推送到 `main` 後，GitHub Actions 會依序執行 `npm ci`、型別檢查、正式建置並部署至 GitHub Pages。
