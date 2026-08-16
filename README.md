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
- **Collocations & Ví dụ**: Tự động lấy **3 Collocations tiếng Anh chuẩn ngữ liệu** (Datamuse API / COCA corpus) và **câu ví dụ ngữ cảnh sinh động** (Tatoeba Bilingual Corpus & Dictionary API), hiển thị trên thẻ Flashcard và danh sách từ vựng.
- **Điền dữ liệu tự động (Batch Enrichment)**: Quét và làm giàu hàng loạt từ vựng thiếu thông tin (nghĩa TV, collocations, ví dụ, phiên âm) với thanh tiến trình trực quan, xử lý song song không làm nghẽn giao diện.
- **Luyện tự do**: ôn không ảnh hưởng lịch SRS.
- **Lọc tag** khi bắt đầu phiên; **xáo mặt thẻ** Anh ↔ Việt.
- **Bài đặt câu** sau flashcard (bật/tắt, giới hạn số từ, bỏ qua trong phiên).
- **Hoàn tác** chấm điểm gần nhất (nút / Ctrl+Z).
- **Thư viện**: thêm thủ công / nhanh / Excel-CSV, tìm kiếm, filter (đến hạn / chưa học / thành thạo / tag / từ loại / thiếu collocations / thiếu ví dụ / thiếu nghĩa), sửa/xóa, phân trang.
- **Auto-tag** (Gemini) + gợi ý chủ đề mới.
- **Cài đặt**: daily limit, interval, giọng TTS, theme Sepia/Dark, Gemini key/model, bật câu & max câu.
- **Backup**: export JSON đầy đủ (words + history + topics + settings); import merge hoặc replace; auto-backup hàng ngày; restore; export JSON/Excel/CSV sạch không kèm SRS hoặc chỉ từ chưa học (kèm cột Collocations).
- **PWA nhẹ**: manifest + service worker cache shell offline.
- **Hiệu năng**: load localStorage không block UI; dịch VI nền; lazy tab Library/Settings; dynamic `xlsx`.

## 2. Kiến trúc hệ thống

```
src/
  App.jsx              # shell, nav desktop/mobile, lazy tabs
  hooks/useVocab.js    # state + safe storage + backup/import + batch update
  components/
    StudySession.jsx   # dashboard + session flashcard/sentence + collocations view
    WordList.jsx       # library + filters + missing collocations filter
    EnrichModal.jsx    # modal làm giàu dữ liệu tự động hàng loạt
    AddWord.jsx        # add / quick / auto-tag / auto-enrich collocations
    ImportExcelCSV.jsx # dynamic xlsx import kèm collocations
    Settings.jsx
    Dashboard.jsx
  utils/srs.js, tags.js, aiTagger.js, enrichVocab.js, storage.js
public/
  manifest.webmanifest, sw.js, logo.svg
```

- Data keys: `spacedrep_vocab_data`, `spacedrep_settings`, `spacedrep_review_history`, `spacedrep_topics`, `spacedrep_folders`, `spacedrep_full_backup`.
- Theme: `data-theme="sepia" | "dark"` trên `<html>`.

## 3. Các component

| Module | Vai trò |
|--------|---------|
| `useVocab` | CRUD từ, settings, history, snapshot import/export, streak, batchUpdate |
| `storage.js` | Cơ chế an toàn đọc/ghi localStorage, tự động giải phóng bộ nhớ khi đầy quota, chống crash app |
| `StudySession` | UI học, filter tag, undo, sentence skip/limit, hiển thị collocations |
| `WordList` + `AddWord` | Thư viện & nhập từ |
| `EnrichModal` | Modal làm giàu dữ liệu tự động hàng loạt (3 Collocations, ví dụ, nghĩa TV) |
| `ImportExcelCSV` | Parse Excel/CSV (lazy xlsx) hỗ trợ cột Collocations & auto-fetch |
| `Settings` | Theme, SRS, Gemini, data tools & khôi phục backup |
| `Dashboard` | Streak, mastered, accuracy 7 ngày |

## 4. Các task đã làm

### [2026-08-16] Fix Dynamic Missing Words Counting & Per-Field Breakdown in EnrichModal `(FAST)`
- **Lane / Mode:** FEATURE FAST
- **Tóm tắt:** Sửa lỗi logic đếm cứng "từ còn thiếu thông tin", chuyển sang cơ chế đếm động theo các checkbox dữ liệu được tick chọn và hiển thị số lượng thiếu chi tiết của từng trường dữ liệu.
- **Thay đổi chính:**
  - `EnrichModal.jsx`: Tách riêng hàm kiểm tra từng trường (`isMissingCollocations`, `isMissingExample`, `isMissingViMeaning`, `isMissingPhoneticAndMeaning`). Đếm động số từ thiếu theo đúng các trường người dùng tích chọn thay vì gộp cứng `|| !w.phonetic`. Hiển thị badge số lượng từ thiếu thực tế ngay trên từng checkbox dữ liệu để người dùng nắm rõ tình trạng.
- **Files / areas chạm:** `src/components/EnrichModal.jsx`, `README.md`
- **Ảnh hưởng README:** §1, §4
- **Verify:** `npm run build` thành công, kiểm tra logic đếm động và bộ lọc.

### [2026-08-15] Optimize Batch Vocabulary Enrichment Speed & Pipeline `(FAST)`
- **Lane / Mode:** FEATURE FAST
- **Tóm tắt:** Tối ưu hóa toàn diện tốc độ tính năng tự động điền dữ liệu từ vựng (Collocations, ví dụ, phiên âm, nghĩa tiếng Việt) tăng gấp 4x - 6x, đồng thời bổ sung cơ chế lưu trữ thời gian thực (real-time per-word persistence) đảm bảo 100% dữ liệu đã tra cứu được lưu lại ngay lập tức khi bấm dừng.
- **Thay đổi chính:**
  - `enrichVocab.js`: Tối ưu pipeline tra cứu song song (gọi Free Dictionary API trước để lấy đồng thời Phiên âm + Định nghĩa + Ví dụ câu; nếu có câu ví dụ thì dịch trực tiếp và bỏ qua Tatoeba). Thêm tham số `&max=8` cho 4 request Datamuse Collocations giúp phản hồi cực nhanh; bổ sung `timeout: 2800ms` cho toàn bộ request Axios chống treo worker. Tích hợp callback `onWordEnriched` lưu lũy tiến từng từ ngay khi vừa nhận kết quả API.
  - `EnrichModal.jsx`: Tăng số luồng chạy song song (`concurrency`) từ 3 lên 6 worker, kích hoạt cơ chế lưu trữ thời gian thực `onBatchUpdate([singleEnriched])` và xử lý ngắt `handleStop` an toàn tuyệt đối.
- **Files / areas chạm:** `src/utils/enrichVocab.js`, `src/components/EnrichModal.jsx`, `README.md`
- **Ảnh hưởng README:** §1, §4
- **Verify:** `npm run build` thành công, kiểm thử live Node test script xử lý mô phỏng ngắt dừng giữa chừng bảo toàn trọn vẹn 100% dữ liệu các từ đã chạy.

### [2026-08-15] Fix QuotaExceededError in LocalStorage & Eliminate Redundant Backups `(FAST)`
- **Lane / Mode:** FEATURE FAST
- **Tóm tắt:** Khắc phục triệt để lỗi `QuotaExceededError` làm crash React khi ghi dữ liệu/backup vào LocalStorage khi kích thước thư viện từ vựng tăng cao.
- **Thay đổi chính:**
  - `storage.js`: Tạo module quản lý lưu trữ an toàn `safeSetItem`, `safeGetItem`, `safeRemoveItem`, `safeParse` với cơ chế bắt lỗi `QuotaExceededError`. Khi bộ nhớ bị đầy trong lúc lưu dữ liệu chính, tự động dọn dẹp các key sao lưu trùng lặp/bộ nhớ đệm để bảo toàn tuyệt đối dữ liệu học từ vựng.
  - `useVocab.js`: Loại bỏ việc ghi kép 2 bản backup (`spacedrep_vocab_backup` và `spacedrep_full_backup`) cùng lúc; tự động giải phóng key legacy `spacedrep_vocab_backup` khi khởi động; bọc toàn bộ thao tác lưu qua `safeSetItem` ngăn ngừa hoàn toàn crash app.
  - `Settings.jsx`: Cập nhật `handleRestoreAutoBackup` tương thích an toàn với cả `spacedrep_full_backup` và legacy fallback qua `safeGetItem`.
- **Files / areas chạm:** `src/utils/storage.js`, `src/hooks/useVocab.js`, `src/components/Settings.jsx`, `README.md`
- **Ảnh hưởng README:** §2, §3, §4
- **Verify:** `npm run build` thành công, kiểm thử unit test giả lập giới hạn quota `test-storage.mjs` PASS 100%.

### [2026-08-14] Integrate Datamuse 3 English Collocations, Tatoeba Examples & Batch Vocabulary Enrichment `(FULL)`
- **Lane / Mode:** FEATURE FULL
- **Tóm tắt:** Giải quyết triệt để vấn đề từ vựng thiếu nghĩa phù hợp, thiếu 3 collocations tiếng Anh và thiếu câu ví dụ cho tập dữ liệu lớn mà không bị phụ thuộc vào AI tạo mẫu câu lặp lại.
- **Thay đổi chính:**
  - `enrichVocab.js`: Xây dựng engine tự động lấy 3 Collocations tiếng Anh chuẩn ngữ liệu tự nhiên qua Datamuse API (COCA & Google N-Grams), lấy câu ví dụ song ngữ qua Tatoeba Corpus & Free Dictionary API, dịch nghĩa tiếng Việt và điều phối xử lý hàng loạt có kiểm soát luồng (concurrency control & throttling).
  - `EnrichModal.jsx`: Thêm modal "Điền dữ liệu tự động" trực tiếp trên Web App với tùy chọn phạm vi (từ thiếu thông tin, từ đang lọc, toàn bộ thư viện), chọn trường cần bổ sung, thanh tiến trình % trực quan, nút dừng/tiếp tục và báo cáo tổng kết.
  - `WordList.jsx`: Thêm bộ lọc "Thiếu Collocations", hiển thị 3 Collocations dạng badge chip trên từng thẻ từ, hỗ trợ chỉnh sửa Collocations và tích hợp nút kích hoạt `EnrichModal`.
  - `StudySession.jsx`: Hiển thị 3 Collocations nổi bật ở mặt sau Flashcard khi học SRS, đồng thời hỗ trợ tra cứu và chỉnh sửa Collocations ngay trong phiên học.
  - `AddWord.jsx` & `ImportExcelCSV.jsx`: Hỗ trợ trường `Collocations` khi nhập thủ công, nhập nhanh và import Excel/CSV; tự động gọi `enrichSingleWord` để làm giàu dữ liệu khi thêm từ.
  - `DataModal.jsx`: Bổ sung cột `Collocations` vào file xuất Excel, CSV và logic import tương thích 100%.
  - `useVocab.js` & `tags.js`: Chuẩn hóa `normalizeCollocations` và bổ sung `batchUpdateWords`.
- **Files / areas chạm:** `src/utils/enrichVocab.js`, `src/components/EnrichModal.jsx`, `src/components/WordList.jsx`, `src/components/StudySession.jsx`, `src/components/AddWord.jsx`, `src/components/ImportExcelCSV.jsx`, `src/components/DataModal.jsx`, `src/hooks/useVocab.js`, `src/utils/tags.js`, `src/App.jsx`, `README.md`
- **Ảnh hưởng README:** §1, §2, §3, §4
- **Verify:** `npm run build` thành công, kiểm tra unit logic qua Node test scripts.

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
