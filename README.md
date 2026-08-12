# SpacedRep

App học từ vựng tiếng Anh với **lặp lại ngắt quãng (SRS / SuperMemo-2)**, flashcard, bài đặt câu (Gemini), import Excel/CSV, lưu local trên trình duyệt.

## 0. Setup

```bash
npm install
npm run dev      # dev server
npm run build    # production build → dist/
npm run preview  # xem bản build
npm run deploy   # gh-pages (base: /SPS/)
```

- Stack: React 19 + Vite 8, localStorage, optional Gemini API.
- Deploy: `homepage` / `base` = `/SPS/` (GitHub Pages).

## 1. Tổng quan tính năng

- **Học SRS**: hàng đợi từ đến hạn (ưu tiên quá hạn & xáo trộn ngẫu nhiên từ cùng hạn ôn), giới hạn daily, 2 mức chấm (Quên / Dễ).
- **Luyện tự do**: ôn không ảnh hưởng lịch SRS.
- **Lọc tag** khi bắt đầu phiên; **xáo mặt thẻ** Anh ↔ Việt.
- **Bài đặt câu** sau flashcard (bật/tắt, giới hạn số từ, bỏ qua trong phiên).
- **Hoàn tác** chấm điểm gần nhất (nút / Ctrl+Z).
- **Thư viện**: thêm thủ công / nhanh / Excel-CSV, tìm kiếm, filter (đến hạn / chưa học / thành thạo / tag / từ loại), sửa/xóa, phân trang.
- **Auto-tag** (Gemini) + gợi ý chủ đề mới.
- **Cài đặt**: daily limit, interval, giọng TTS, theme Sepia/Dark, Gemini key/model, bật câu & max câu.
- **Backup**: export JSON đầy đủ (words + history + topics + settings); import merge hoặc replace; auto-backup hàng ngày; restore; export JSON/Excel/CSV sạch không kèm SRS hoặc chỉ từ chưa học.
- **PWA nhẹ**: manifest + service worker cache shell offline.
- **Hiệu năng**: load localStorage không block UI; dịch VI nền; lazy tab Library/Settings; dynamic `xlsx`.

## 2. Kiến trúc hệ thống

```
src/
  App.jsx              # shell, nav desktop/mobile, lazy tabs
  hooks/useVocab.js    # state + localStorage + backup/import
  components/
    StudySession.jsx   # dashboard + session flashcard/sentence
    WordList.jsx       # library + filters
    AddWord.jsx        # add / quick / auto-tag
    ImportExcelCSV.jsx # dynamic xlsx import
    Settings.jsx
    Dashboard.jsx
  utils/srs.js, tags.js, aiTagger.js
public/
  manifest.webmanifest, sw.js, logo.svg
```

- Data keys: `spacedrep_vocab_data`, `spacedrep_settings`, `spacedrep_review_history`, `spacedrep_topics`, backups.
- Theme: `data-theme="sepia" | "dark"` trên `<html>`.

## 3. Các component

| Module | Vai trò |
|--------|---------|
| `useVocab` | CRUD từ, settings, history, snapshot import/export, streak |
| `StudySession` | UI học, filter tag, undo, sentence skip/limit |
| `WordList` + `AddWord` | Thư viện & nhập từ |
| `ImportExcelCSV` | Parse Excel/CSV (lazy xlsx) |
| `Settings` | Theme, SRS, Gemini, data tools |
| `Dashboard` | Streak, mastered, accuracy 7 ngày |

## 4. Các task đã làm

### [2026-08-12] Add Explicit SRS Status Column & Expand Header Aliases for CSV/Excel `(FAST)`
- **Lane / Mode:** FEATURE FAST
- **Tóm tắt:** Bổ sung trực tiếp cột `SRS Status` (trạng thái "Chưa học", "Đang học", "Thành thạo") vào file xuất CSV, Excel và file mẫu CSV; đồng thời hỗ trợ nhận diện linh hoạt các tên cột SRS khác nhau (`srs`, `srs status`, `srs level`, `srs stage`, `srs count`) khi import.
- **Thay đổi chính:**
  - `DataModal.jsx`: Thêm cột `SRS Status` vào danh sách header & dữ liệu xuất file CSV (`handleExportCSV`) và Excel (`handleExportExcel`). Bổ sung `parseRepetitionVal` hỗ trợ đọc cả dạng số lẫn dạng văn bản trạng thái SRS ("Thành thạo" -> 3, "Đang học" -> 1, "Chưa học" -> 0) và mở rộng danh sách header SRS tương thích khi import.
  - `ImportExcelCSV.jsx`: Thêm cột `SRS Status` vào file mẫu CSV (`handleDownloadTemplate`). Thêm danh sách tên cột mở rộng `srs`, `srs status`, `srs stage`, `srs level`, `srs count`, `srs repetition` vào `REP_HEADERS` và cập nhật logic `parseRepetitionVal` khi import từ file.
- **Files / areas chạm:** `src/components/DataModal.jsx`, `src/components/ImportExcelCSV.jsx`, `README.md`
- **Ảnh hưởng README:** §1, §4
- **Verify:** Chạy lệnh `npm run build` thành công.

### [2026-08-11] Full SRS Information Export & Import for Excel, CSV and JSON `(FAST)`
- **Lane / Mode:** FEATURE FAST
- **Tóm tắt:** Bổ sung đầy đủ thông tin SRS (`repetition`, `interval`, `efactor`, `nextReviewDate`, `lastReviewed`) vào tệp xuất Excel, CSV và JSON; đồng thời hỗ trợ đọc và khôi phục tiến trình SRS khi import tệp Excel/CSV.
- **Thay đổi chính:**
  - `DataModal.jsx`: Cập nhật xuất Excel (`handleExportExcel`) và CSV (`handleExportCSV`) tự động bao gồm các cột SRS: `Repetition` (số lần ôn), `Interval (Days)` (khoảng cách ôn), `E-Factor` (hệ số EF), `Next Review Date` (ngày ôn tiếp), `Last Reviewed` (ngày ôn cuối).
  - `DataModal.jsx` & `ImportExcelCSV.jsx`: Cập nhật logic import file Excel/CSV tự động phát hiện và đọc thông tin SRS để khôi phục chính xác tiến độ học cũ thay vì reset về 0.
  - Vẫn duy trì nút/tùy chọn xuất file sạch ("Loại bỏ thông tin SRS") khi người dùng muốn xuất danh sách từ thuần túy.
- **Files / areas chạm:** `src/components/DataModal.jsx`, `src/components/ImportExcelCSV.jsx`, `README.md`
- **Ảnh hưởng README:** §1, §4
- **Verify:** Chạy lệnh `npm run build` thành công.

### [2026-08-11] Prioritized Randomization for Study Session Queue `(FAST)`
- **Lane / Mode:** FEATURE FAST
- **Tóm tắt:** Xáo trộn ngẫu nhiên thứ tự từ vựng cùng mốc hạn ôn trong phiên học SRS và xáo trộn trước khi cắt quota Daily Limit.
- **Thay đổi chính:**
  - Bổ sung hàm helper `shuffleArray` chuẩn Fisher-Yates trong `StudySession.jsx`.
  - Cập nhật `handleStartStudy`: Gom nhóm các từ đến hạn theo `nextReviewDate`, đảo ngẫu nhiên các từ trong cùng mốc hạn ôn trước khi ghép lại và áp dụng `dailyLimit`.
  - Thay thế ngẫu nhiên bằng `shuffleArray` cho cả chế độ Luyện tự do và bài tập Đặt câu.
- **Files / areas chạm:** `src/components/StudySession.jsx`, `README.md`
- **Ảnh hưởng README:** §1, §4
- **Verify:** Chạy lệnh `npm run build` thành công.

### [2026-08-08] Fix DataModal Excel Import Headers `(FAST)`
- **Lane / Mode:** FEATURE FAST
- **Tóm tắt:** Sửa lỗi tính năng Import "Ghi đè" trong Settings không nhận diện được các tên cột tuỳ biến.
- **Thay đổi chính:**
  - Cập nhật `DataModal.jsx`: Sử dụng chung logic parse tên cột linh hoạt (hỗ trợ `Example chunks`, `Meaning (EN)`, `Type`, `Tags`...) tương tự như giao diện nhập thêm từ mới.
- **Files / areas chạm:** `src/components/DataModal.jsx`
- **Ảnh hưởng README:** §4
- **Verify:** Chạy lệnh `npm run build` thành công.

### [2026-08-08] Fix Excel Import Logic & Headers Mapping `(FAST)`
- **Lane / Mode:** FEATURE FAST
- **Tóm tắt:** Fix lỗi Import Excel không update từ đã có và bổ sung header detection (`Meaning (EN/VI)`, `Type`, `Tags`) khớp chuẩn DataModal.
- **Thay đổi chính:**
  - Sửa `ImportExcelCSV.jsx`: Hỗ trợ thêm các headers từ DataModal export.
  - Sửa logic xử lý trùng lặp: Đổi `skipDuplicates` thành `updateDuplicates` (mặc định bật) để tự động merge field cũ và mới.
  - Sửa UI `ImportExcelCSV.jsx`: Thêm hiển thị trạng thái "Sẽ cập nhật".
  - Truyền `onUpdateWord` từ `AddWord.jsx` xuống `ImportExcelCSV.jsx` để cập nhật state.
- **Files / areas chạm:** `src/components/AddWord.jsx`, `src/components/ImportExcelCSV.jsx`
- **Ảnh hưởng README:** §4
- **Verify:** Chạy lệnh `npm run build` thành công.

### [2026-07-14] Performance + UX polish (giữ 2-grade) `(FULL)`
- **Lane / Mode:** FEATURE FULL
- **Tóm tắt:** Fix boot load, lazy bundle, UX học/thư viện/cài đặt, PWA, UI VI + theme + bottom nav; **không** đổi sang 4-grade.
- **Thay đổi chính:**
  - Boot: parse localStorage ngay, dịch VI background, skeleton, debounce save, reset `isReviewedToday` an toàn
  - Lazy Library/Settings; dynamic `xlsx`; 1 font family
  - Study: filter tag, skip/limit sentence, undo grade, progress bar (vẫn Quên/Dễ)
  - Data: full JSON backup, merge/replace import
  - UI: bottom nav mobile, theme toggle, bớt blur, chip filters, VI labels
  - PWA: manifest + SW
- **Files / areas chạm:** `useVocab.js`, `App.jsx`, `StudySession.jsx`, `WordList.jsx`, `Settings.jsx`, `ImportExcelCSV.jsx`, `index.css`, `index.html`, `main.jsx`, `public/*`, `README.md`
- **Ảnh hưởng README:** §1–5
- **Verify:** `npm run build`
- **Notes:** Grading vẫn 2 mode theo yêu cầu user.

## 5. Các task chưa làm

- IndexedDB khi data rất lớn
- Sync cloud (optional)
- Heatmap lịch sử dài hạn
- Modal confirm thay `window.confirm` toàn app
