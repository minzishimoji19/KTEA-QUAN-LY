# BÁO CÁO KIỂM TOÁN BẢO MẬT TOÀN DIỆN (SECURITY AUDIT) — KTEA CRM
**Giai đoạn:** Phase 1 — Security Audit & Đánh giá rủi ro trước khi triển khai bảo mật  
**Hệ thống:** KTEA Customer Management & Intelligence Workspace  
**Thời điểm thực hiện:** Tháng 10/2026  
**Trạng thái:** Hoàn tất kiểm toán mã nguồn thực tế — Sẵn sàng cho Phase 2 (Triển khai)

---

## 1. TỔNG QUAN KIẾN TRÚC & MÔ HÌNH BẢO MẬT ĐÃ THỐNG NHẤT

### 1.1. Kiến trúc phân tán hiện tại
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, triển khai trên **Vercel** (`https://ktea-quan-ly.vercel.app`).
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, triển khai trên **Render** (`https://*.onrender.com`).
- **Database:** MySQL trên **Aiven Cloud** (kết nối qua SSL/TLS với `DATABASE_URL`).
- **Mô hình kết nối:** Cross-Site / Cross-Origin giữa hai domain độc lập (`.vercel.app` gọi `.onrender.com`).

### 1.2. Mô hình bảo mật đã thống nhất (Security Paradigm)
1. **Mã truy cập chung (Shared Access Gate):** 
   - Sử dụng một mã truy cập bảo mật chung để vào CRM.
   - Không tạo tài khoản riêng, không phân quyền role/permission phức tạp, không mở form đăng ký người dùng.
2. **Xác thực toàn bộ tầng nghiệp vụ (Zero Trust ở Backend):** 
   - Backend Express phải xác thực và bảo vệ mọi yêu cầu nghiệp vụ, không tin cậy frontend.
3. **Cơ chế Phiên bảo mật (Stateless Signed Session Cookie):** 
   - Sử dụng cookie `HttpOnly`, `Secure`, và `SameSite` phù hợp (hỗ trợ cross-site Vercel <-> Render).
   - Mã truy cập và session secret được lưu hoàn toàn trong biến môi trường phía backend, tuyệt đối không gửi xuống trình duyệt.
4. **Phòng vệ chủ động:** 
   - Giới hạn số lần thử đăng nhập (Rate Limiting chống Brute-force).
   - Cơ chế hết hạn phiên tự động và nút khóa phiên/đăng xuất ngay lập tức.
   - Tuyệt đối không để lộ thông tin kết nối CSDL và dữ liệu nhạy cảm của khách hàng ra môi trường công cộng.

---

## 2. DANH SÁCH 61 API HIỆN TẠI & PHÂN LOẠI PUBLIC / CẦN BẢO VỆ

Toàn bộ hệ thống Backend có **61 endpoints** phân bố trên 17 tệp route (được mount tại `/` và `/api` qua `backend/src/app.ts` và `backend/src/routes/index.ts`).

| Nhóm chức năng | Endpoint | Phương thức | Hiện trạng thực tế | Phân loại mục tiêu | Ghi chú & Đánh giá rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hạ tầng / Health** | `/health` & `/api/health` | `GET` | **Public** | **Public** | Phục vụ Render Health Check & Uptime Ping. Cần ẩn thông báo lỗi chi tiết khi CSDL degraded. |
| **Quản trị dữ liệu** | `/api/data/export` | `GET` | **Public** (Không auth) | **Protected** | **CỰC KỲ NGUY HIỂM:** Xuất toàn bộ CSDL khách hàng dạng file JSON không cần xác thực. |
| **Quản trị dữ liệu** | `/api/data/status` | `GET` | **Public** | **Protected** | Lộ tổng số lượng bản ghi của 10 bảng và trạng thái seed demo. |
| **Khách hàng** | `/api/customers` | `GET`, `POST` | **Public** | **Protected** | Lộ toàn bộ danh bạ khách hàng; cho phép tạo mới tùy ý. |
| **Khách hàng (Bulk)** | `/api/customers/bulk-action`| `POST` | **Public** | **Protected** | Cho phép đổi trạng thái, gán nhãn, **xóa vĩnh viễn hàng loạt khách hàng**. |
| **Khách hàng (Chi tiết)** | `/api/customers/:id` | `GET`, `PATCH`, `DELETE` | **Public** | **Protected** | Đọc, chỉnh sửa, xóa khách hàng. |
| **Khách hàng (Quan hệ)** | `/api/customers/:id/cases` | `GET`, `POST` | **Public** | **Protected** | Danh sách & tạo hồ sơ vay của khách hàng. |
| **Khách hàng (Quan hệ)** | `/api/customers/:id/needs` | `GET`, `POST` | **Public** | **Protected** | Danh sách & tạo nhu cầu của khách hàng. |
| **Khách hàng (Quan hệ)** | `/api/customers/:id/activities` | `GET`, `POST` | **Public** | **Protected** | Dòng thời gian lịch sử tương tác khách hàng. |
| **Khách hàng (Quan hệ)** | `/api/customers/:id/notes` | `GET`, `POST` | **Public** | **Protected** | Xem và thêm ghi chú nội bộ. |
| **Khách hàng (Quan hệ)** | `/api/customers/:id/push-records` | `GET`, `POST` | **Public** | **Protected** | Lịch sử chuyển tiếp khách hàng sang đối tác. |
| **Khách hàng (Quan hệ)** | `/api/customers/:id/recommendations` | `GET` | **Public** | **Protected** | Danh sách sản phẩm được AI/Rule Engine gợi ý. |
| **Khách hàng (Tags)** | `/api/customers/:id/tags/:tagId` | `POST`, `DELETE` | **Public** | **Protected** | Gắn nhãn hoặc gỡ nhãn khách hàng. |
| **Hồ sơ vay (Cases)** | `/api/cases/:id` | `GET`, `PATCH`, `DELETE` | **Public** | **Protected** | Xem, sửa thông tin, xóa hồ sơ vay. |
| **Hồ sơ vay (Cases)** | `/api/cases/:id/product` | `PATCH` | **Public** | **Protected** | Chọn gói sản phẩm tài chính cho hồ sơ. |
| **Hồ sơ vay (Cases)** | `/api/cases/:id/progress` | `PATCH` | **Public** | **Protected** | Chuyển giai đoạn xử lý hồ sơ vay. |
| **Hồ sơ vay (Cases)** | `/api/cases/:id/reject` | `POST` | **Public** | **Protected** | Đánh dấu từ chối hồ sơ kèm lý do. |
| **Nguồn khách hàng** | `/api/customer-sources` | `GET`, `POST` | **Public** | **Protected** | Danh sách & tạo mới nguồn khách hàng. |
| **Nguồn khách hàng** | `/api/customer-sources/:id` | `GET`, `PATCH`, `DELETE` | **Public** | **Protected** | Xem, sửa, xóa nguồn khách hàng. |
| **Người phụ trách** | `/api/caretakers` | `GET`, `POST` | **Public** | **Protected** | Danh sách & tạo người chăm sóc (Ktea, mfast...). |
| **Người phụ trách** | `/api/caretakers/:id` | `GET`, `PATCH`, `DELETE` | **Public** | **Protected** | Xem, sửa, xóa người chăm sóc. |
| **Nhu cầu (Needs)** | `/api/needs/:id` | `PATCH`, `DELETE` | **Public** | **Protected** | Cập nhật hoặc xóa nhu cầu tài chính. |
| **Ghi chú (Notes)** | `/api/notes/:id` | `PATCH`, `DELETE` | **Public** | **Protected** | Chỉnh sửa hoặc xóa ghi chú. |
| **Nhãn (Tags)** | `/api/tags` | `GET`, `POST` | **Public** | **Protected** | Danh sách & tạo mới danh mục nhãn. |
| **Nhãn (Tags)** | `/api/tags/:id` | `PATCH`, `DELETE` | **Public** | **Protected** | Sửa hoặc xóa nhãn hệ thống. |
| **Lịch chăm sóc** | `/api/follow-ups` | `GET`, `POST` | **Public** | **Protected** | Danh sách & tạo mới lịch hẹn chăm sóc. |
| **Lịch chăm sóc (Bulk)**| `/api/follow-ups/bulk` | `POST` | **Public** | **Protected** | Tạo lịch hẹn hàng loạt. |
| **Lịch chăm sóc (Bulk)**| `/api/follow-ups/bulk-complete` | `POST` | **Public** | **Protected** | Đánh dấu hoàn thành hàng loạt lịch hẹn. |
| **Lịch chăm sóc (Bulk)**| `/api/follow-ups/bulk-delete` | `POST` | **Public** | **Protected** | Xóa hàng loạt lịch chăm sóc. |
| **Lịch chăm sóc (Đơn)** | `/api/follow-ups/:id` | `PATCH`, `DELETE` | **Public** | **Protected** | Cập nhật trạng thái hoặc xóa lịch hẹn. |
| **Sản phẩm (Catalog)** | `/api/products` | `GET`, `POST` | **Public** | **Protected** | Danh mục gói vay, thẻ tín dụng. |
| **Sản phẩm (Catalog)** | `/api/products/:id` | `PATCH`, `DELETE` | **Public** | **Protected** | Cập nhật cấu hình sản phẩm hoặc xóa. |
| **Chuyển khách (Push)** | `/api/push-records` | `GET` | **Public** | **Protected** | Danh sách toàn bộ lịch sử đẩy khách. |
| **Chuyển khách (Push)** | `/api/push-records/:id` | `PATCH` | **Public** | **Protected** | Cập nhật trạng thái chuyển khách. |
| **Gợi ý (Rule Engine)**| `/api/recommendations` | `GET` | **Public** | **Protected** | Danh sách gợi ý cơ hội bán chéo. |
| **Gợi ý (Rule Engine)**| `/api/recommendations/generate` | `POST` | **Public** | **Protected** | Chạy thuật toán quét toàn bộ CSDL và tạo gợi ý. |
| **Gợi ý (Rule Engine)**| `/api/recommendations/:id` | `GET` | **Public** | **Protected** | Chi tiết một gợi ý. |
| **Gợi ý (Rule Engine)**| `/api/recommendations/:id/review` | `PATCH` | **Public** | **Protected** | Đánh dấu đã xem gợi ý. |
| **Gợi ý (Rule Engine)**| `/api/recommendations/:id/dismiss` | `PATCH` | **Public** | **Protected** | Bỏ qua gợi ý. |
| **Gợi ý (Rule Engine)**| `/api/recommendations/:id/push` | `POST` | **Public** | **Protected** | Chuyển đổi gợi ý thành đơn đẩy khách đối tác. |
| **Báo cáo phân tích** | `/api/analytics/foundation` | `GET` | **Public** | **Protected** | Dữ liệu nền tảng vòng đời khách hàng. |
| **Báo cáo phân tích** | `/api/analytics/overview` | `GET` | **Public** | **Protected** | Chỉ số tổng quan kinh doanh. |
| **Báo cáo phân tích** | `/api/analytics/customers`| `GET` | **Public** | **Protected** | Phân tích tập khách hàng, tăng trưởng. |
| **Báo cáo phân tích** | `/api/analytics/cases` | `GET` | **Public** | **Protected** | Phân tích tỷ lệ duyệt/từ chối hồ sơ vay. |
| **Báo cáo phân tích** | `/api/analytics/needs` | `GET` | **Public** | **Protected** | Phân tích nhu cầu sản phẩm tài chính. |
| **Báo cáo phân tích** | `/api/analytics/push` | `GET` | **Public** | **Protected** | Phân tích hiệu quả chuyển đổi đối tác. |
| **Dashboard** | `/api/dashboard` | `GET` | **Public** | **Protected** | Bảng điều khiển vận hành tổng thể. |
| **Cài đặt hệ thống** | `/api/settings` | `GET` | **Public** | **Protected** | Đọc cấu hình hệ thống, trọng số thuật toán. |
| **Cài đặt hệ thống** | `/api/settings/general` | `PATCH` | **Public** | **Protected** | Cập nhật tên ứng dụng, định dạng ngày. |
| **Cài đặt hệ thống** | `/api/settings/needs` | `PATCH` | **Public** | **Protected** | Cập nhật danh mục nhóm nhu cầu. |
| **Cài đặt hệ thống** | `/api/settings/needs/:code` | `DELETE` | **Public** | **Protected** | Xóa nhóm nhu cầu. |
| **Cài đặt hệ thống** | `/api/settings/statuses` | `PATCH` | **Public** | **Protected** | Cập nhật trạng thái vòng đời nghiệp vụ. |
| **Cài đặt hệ thống** | `/api/settings/recommendations` | `PATCH` | **Public** | **Protected** | Chỉnh sửa trọng số tính điểm gợi ý bán chéo. |
| **Web Push Key** | `/api/notifications/vapid-public-key` | `GET` | **Public** | **Protected** | Lấy VAPID Public Key để đăng ký Service Worker. |
| **Web Push Đăng ký** | `/api/notifications/subscribe` | `POST` | Yêu cầu `passkey` tự tạo | **Protected** | Đăng ký thiết bị nhận push notification. |
| **Web Push Hủy** | `/api/notifications/unsubscribe` | `POST` | **Public** (Không auth) | **Protected** | Hủy thiết bị nhận thông báo. |
| **Web Push Danh sách**| `/api/notifications/subscriptions`| `GET`, `POST`| Yêu cầu `passkey` tự tạo | **Protected** | Lấy danh sách thiết bị đã đăng ký của nhân sự. |
| **Web Push Test** | `/api/notifications/test` | `POST` | Yêu cầu `passkey` tự tạo | **Protected** | Gửi thông báo thử nghiệm tới thiết bị. |
| **Web Push Cron** | `/api/notifications/cron-worker` | `POST`, `GET` | Kiểm tra `x-cron-secret` hoặc `passkey` | **Dedicated Token** | Tác vụ tự động quét nhắc lịch. Cần bảo vệ nghiêm ngặt bằng `x-cron-secret`. |
| **Auth Gateway (Mới)**| `/api/auth/login` | `POST` | *Chưa có* | **Public (Rate Limited)** | Nhận mã truy cập chung, kiểm tra rate limit, cấp cookie HttpOnly. |
| **Auth Gateway (Mới)**| `/api/auth/session` | `GET` | *Chưa có* | **Public** | Kiểm tra trạng thái phiên (`{ authenticated: boolean }`). |
| **Auth Gateway (Mới)**| `/api/auth/logout` | `POST` | *Chưa có* | **Protected / Public** | Hủy cookie phiên làm việc ngay lập tức. |

---

## 3. ĐÁNH GIÁ CƠ CHẾ BẢO MẬT: ĐÃ CÓ VS CÒN THIẾU

### 3.1. Những cơ chế đã có (Strengths)
1. **Kiểm tra dữ liệu đầu vào (Input Validation):** Hầu như toàn bộ request body, query parameters và URL path parameters đều được định nghĩa schema chặt chẽ bằng thư viện `zod` thông qua middleware `validateRequest` (`backend/src/middleware/validate.ts`).
2. **Chống SQL Injection hiệu quả:** Đa số các thao tác dữ liệu dùng Prisma Client. Những vị trí dùng truy vấn raw (`backend/src/repositories/customer.repository.ts:57-80` và `backend/src/services/followUp.service.ts:209`) đều sử dụng Tagged Template Literals của Prisma (`prisma.$queryRaw`...``), được tự động tham số hóa (Prepared Statements), không bị nối chuỗi SQL thủ công.
3. **CORS Whitelist tên miền cụ thể:** Tệp `backend/src/config/cors.ts` định cấu hình whitelist nguồn gọi từ `localhost`, `https://ktea-quan-ly.vercel.app` và regex các bản xem trước Vercel (`https://ktea-quan-ly-*.vercel.app`).
4. **Bảo toàn dữ liệu khi xóa (Cascading Business Safety):** Các service `customer.service.ts` và `bulkAction.service.ts` có cơ chế kiểm tra mối quan hệ nghiệp vụ, kiên quyết chặn xóa khách hàng nếu đã phát sinh hồ sơ vay, lịch chăm sóc hoặc ghi chú nội bộ.
5. **Git Hygiene:** Tệp `.gitignore` chặn toàn bộ `.env`. Lịch sử commit sạch, không phát hiện việc vô tình đẩy file `.env` lên remote repository.

### 3.2. Những cơ chế còn thiếu (Critical Gaps)
1. **Hoàn toàn không có Authentication Middleware phía Backend:** Không có middleware chặn và kiểm tra token/cookie trước khi chuyển tiếp yêu cầu đến các controller nghiệp vụ (`backend/src/middleware` chỉ có `errorHandler.ts` và `validate.ts`).
2. **Chưa có hệ thống quản lý Phiên (Session) & Access Gate:** Chưa có các endpoint đăng nhập, kiểm tra phiên, đăng xuất; chưa cài đặt `cookie-parser`.
3. **Thiếu cơ chế Rate Limiting (Chống Brute-force & DoS):** Chưa cài đặt `express-rate-limit`. Bất kỳ ai cũng có thể gửi hàng nghìn request/giây để quét dữ liệu hoặc dò tìm mã truy cập.
4. **Cấu hình CORS chưa hỗ trợ Cookies (`credentials: false`):** Dòng 80 tại `backend/src/config/cors.ts` đặt `credentials: false`, khiến trình duyệt chặn toàn bộ việc gửi và nhận cookie cross-site giữa Vercel và Render.
5. **Frontend không truyền Cookie Credentials:** `apiClient.ts` và hàm `exportData` trong `settingsService.ts` chưa bật `credentials: 'include'` trong các lệnh `fetch()`.
6. **Frontend thiếu Access Gate UI:** Chưa có màn hình khóa yêu cầu nhập mã truy cập chung; chưa có auth guard để bảo vệ giao diện khi chưa đăng nhập.
7. **Thiếu Security Headers (Helmet):** Chưa có CSP, HSTS, X-Frame-Options (chống Clickjacking), X-Content-Type-Options.
8. **Thiếu cơ chế phòng chống CSRF:** Khi dùng cookie cross-origin (`SameSite=None`), trình duyệt gửi cookie tự động trong các request cross-site; cần có cơ chế Custom Header bắt buộc để ngăn chặn hoàn toàn tấn công CSRF.
9. **Thiếu thiết lập `trust proxy` trong Express:** Render sử dụng reverse proxy; nếu thiếu `app.set('trust proxy', 1)`, Express không xác định đúng giao thức `req.secure` (HTTPS) và IP client thực sự cho Rate Limiting.

---

## 4. CHI TIẾT CÁC LỖ HỔNG & NGUY CƠ THEO MỨC ĐỘ ƯU TIÊN

### 🔴 MỨC ĐỘ CRITICAL

#### Issue 1: 100% API nghiệp vụ và dữ liệu khách hàng hoàn toàn mở (Unauthenticated Access)
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/routes/index.ts:26-46`
- **Mô tả:** Toàn bộ route nghiệp vụ được mount trực tiếp vào Express router mà không qua bất kỳ middleware kiểm tra xác thực nào.
- **Tác động:** Bất kỳ ai biết được địa chỉ backend trên Render (`https://*.onrender.com`) đều có thể gọi trực tiếp API để lấy toàn bộ danh sách khách hàng, số điện thoại, hồ sơ vay và ghi chú mật.

#### Issue 2: Lỗ hổng rò rỉ toàn bộ CSDL qua `/api/data/export`
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** 
  - `backend/src/controllers/settings.controller.ts:111-133`
  - `backend/src/services/dataGovernance.service.ts:143-218`
  - `backend/src/routes/data.routes.ts:7`
- **Mô tả:** Endpoint `GET /api/data/export` thực hiện truy vấn và gom toàn bộ dữ liệu của 10 bảng (bao gồm bảng khách hàng với đầy đủ thông tin cá nhân) vào một file JSON duy nhất để trả về. Endpoint này hoàn toàn không có cơ chế bảo vệ.
- **Tác động:** Một lệnh `curl https://<backend-url>/api/data/export` đơn giản sẽ tải xuống toàn bộ CSDL của doanh nghiệp mà không để lại danh tính kẻ tải.

#### Issue 3: Endpoint xóa hàng loạt `/api/customers/bulk-action` không có bảo vệ
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** 
  - `backend/src/routes/customer.routes.ts:67`
  - `backend/src/services/bulkAction.service.ts:200-265`
- **Mô tả:** Bất kỳ ai gửi payload `{ action: 'DELETE_CUSTOMERS', customerIds: [...] }` đều có thể kích hoạt xóa vĩnh viễn hàng loạt khách hàng (những khách hàng tiềm năng chưa có hồ sơ vay hoặc ghi chú).
- **Tác động:** Nguy cơ bị phá hoại, xóa sạch tập data khách hàng tiềm năng chỉ bằng một lệnh POST duy nhất.

#### Issue 4: Secrets và Passkey fallback mặc định bị gán cứng trong mã nguồn
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/config/env.ts:12-16`
- **Mô tả:** Tệp `env.ts` sử dụng hàm `.default(...)` với các chuỗi giá trị cụ thể cho `PUSH_AUTH_PASSKEY` (`'ktea-crm-2026'`), `CRON_SECRET` (`'ktea-cron-secret-2026'`) và `VAPID_PRIVATE_KEY`.
- **Tác động:** Nếu trên Render người vận hành quên cấu hình biến môi trường, hệ thống sẽ tự động dùng các secret mặc định này, cho phép bất kỳ ai đọc mã nguồn cũng có thể chiếm quyền kích hoạt cron hoặc đăng ký push.

---

### 🟠 MỨC ĐỘ HIGH

#### Issue 5: Thiếu Rate Limiting hoàn toàn
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/app.ts`
- **Mô tả:** Chưa cài đặt thư viện `express-rate-limit`.
- **Tác động:** Khi triển khai Access Gate với một mã truy cập chung, nếu không có Rate Limiting, kẻ tấn công có thể chạy script brute-force hàng nghìn mã mỗi phút để bẻ khóa. Ngoài ra hệ thống dễ bị tê liệt bởi các đợt DoS vào các API tính toán nặng như `/api/recommendations/generate`.

#### Issue 6: Lỗ hổng bypass xác thực tại `/api/notifications/cron-worker` ngoài production
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/controllers/pushNotification.controller.ts:57`
- **Mô tả:** Điều kiện kiểm tra:
  ```ts
  if (!isCronAuthorized && !isPasskeyAuthorized && env.NODE_ENV === 'production') {
    throw new UnauthorizedError('Unauthorized cron execution request');
  }
  ```
- **Tác động:** Nếu biến `NODE_ENV` bị thiếu hoặc đặt khác `'production'`, bất kỳ ai cũng có thể kích hoạt gửi thông báo hàng loạt mà không cần cung cấp bất kỳ mã khóa bí mật nào.

#### Issue 7: Endpoint hủy đăng ký Push `/api/notifications/unsubscribe` không xác thực
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/controllers/pushNotification.controller.ts:24-28`
- **Mô tả:** Endpoint này nhận `endpoint` từ request body và xóa subscription trong CSDL mà không kiểm tra người gửi là ai.
- **Tác động:** Kẻ xấu có thể vô hiệu hóa tính năng nhận thông báo của các thiết bị chuyên viên vận hành.

#### Issue 8: Lưu passkey thông báo dưới dạng plain text trong `localStorage`
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `frontend/src/features/settings/NotificationSettings.tsx:28, 47`
- **Mô tả:** `localStorage.setItem('ktea_push_passkey', passkey)` lưu trữ khóa bí mật trực tiếp trong trình duyệt.
- **Tác động:** Dễ bị đánh cắp bởi các extension độc hại hoặc mã script độc nếu có lỗi XSS. Cần chuyển việc cấp quyền push notification về cho phiên đăng nhập CRM chung.

---

### 🟡 MỨC ĐỘ MEDIUM

#### Issue 9: CORS bị bypass bởi các công cụ phi trình duyệt (Non-browser clients)
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/config/cors.ts:61-63`
- **Mô tả:** Dòng lệnh:
  ```ts
  if (!requestOrigin) {
    return callback(null, true);
  }
  ```
  Cho phép mọi request không có header `Origin` (như curl, Postman, Python script) đi qua. CORS bản chất là cơ chế an toàn do trình duyệt thi hành, không thay thế được Authentication ở backend.

#### Issue 10: Rò rỉ thông tin kết nối CSDL tại `/health`
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/utils/db.ts:29`
- **Mô tả:** Khi kết nối đến MySQL trên Aiven bị lỗi, chuỗi `error.message` của Prisma được trả thẳng về cho client ở endpoint `/health`.
- **Tác động:** Có thể để lộ hostname Aiven, username hoặc cấu trúc port mạng nội bộ.

#### Issue 11: File cấu hình cài đặt lưu trên ephemeral storage của container Render
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/repositories/settings.repository.ts:7-8`
- **Mô tả:** Cài đặt ứng dụng (trọng số gợi ý, nhóm nhu cầu) được lưu vào tệp cục bộ `backend/data/settings.json`.
- **Tác động:** Trên Render, mỗi lần service restart hoặc redeploy, ổ đĩa tạm thời của container sẽ bị reset, làm mất các tùy chỉnh cấu hình người dùng đã lưu.

---

### 🔵 MỨC ĐỘ LOW

#### Issue 12: Thiếu bộ bảo vệ HTTP Security Headers (Helmet)
- **Tình trạng:** Đã xác minh thực tế.
- **Mô tả:** Chưa cấu hình các header an toàn như `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

#### Issue 13: Metadata lỗi ràng buộc CSDL (P2002/P2025) được trả về client
- **Tình trạng:** Đã xác minh thực tế.
- **Vị trí mã nguồn:** `backend/src/middleware/errorHandler.ts:44, 48`
- **Mô tả:** Trả về `prismaErr.meta` cho client khi trùng lặp dữ liệu, tiết lộ tên trường dữ liệu nội bộ (`target: ['phone']`).

---

## 5. THIẾT KẾ TRIỂN KHAI ACCESS GATE CHO VERCEL + RENDER

### 5.1. Bản chất kết nối mạng
- Frontend nằm tại `https://ktea-quan-ly.vercel.app` (domain `.vercel.app`).
- Backend nằm tại `https://ktea-crm-api.onrender.com` (domain `.onrender.com`).
- Đây là kịch bản **Cross-Site Cookie**.

### 5.2. Giải pháp Cookie Phiên an toàn (Stateless Signed Session)

```
[Trình duyệt Frontend]                                     [Render Backend API]
        |                                                           |
        |--- 1. POST /api/auth/login { accessCode } --------------->|
        |                                                           | (Rate Limit: 5 lần/15 phút)
        |                                                           | (So sánh timingSafeEqual)
        |<-- 2. 200 OK + Set-Cookie: ktea_session=... -------------| (Ký HMAC-SHA256 với SESSION_SECRET)
        |       (HttpOnly; Secure; SameSite=None; Max-Age=7 ngày)   |
        |                                                           |
        |--- 3. GET /api/customers (Kèm Cookie + X-KTEA-REQUEST) -->|
        |                                                           | (Xác minh chữ ký & CSRF Header)
        |<-- 4. 200 OK [Danh bạ khách hàng] ------------------------|
```

1. **Thuộc tính Cookie bắt buộc:**
   - `HttpOnly: true` (chống đánh cắp cookie qua mã JavaScript / XSS).
   - `Secure: true` (bắt buộc giao thức HTTPS).
   - `SameSite: 'none'` (cho phép truyền qua lại giữa Vercel và Render).
   - *Khi chạy dưới môi trường Local (HTTP):* Tự động chuyển thành `SameSite: 'lax'`, `Secure: false`.
2. **Cấu hình CORS phía Backend:**
   - `credentials: true` trong `corsOptions`.
   - `app.set('trust proxy', 1)` trong Express để nhận diện đúng client IP và giao thức HTTPS từ reverse proxy của Render.
3. **Cơ chế chống CSRF triệt để bằng Custom Header:**
   - Mọi request từ `apiClient` trên frontend bắt buộc đính kèm header: `X-KTEA-REQUEST: 1`.
   - Middleware `requireAuth` ở backend kiểm tra sự hiện diện của header này. Do các hình thức tấn công CSRF thông thường (form HTML, thẻ image) không thể tự ý đính kèm custom header qua cross-site mà không vượt qua CORS preflight (`OPTIONS`), hệ thống được bảo vệ 100% trước CSRF.
4. **Cơ chế Token Phiên Stateless (HMAC-SHA256):**
   - Không cần lưu session vào CSDL (giảm độ trễ, không tốn dung lượng).
   - Payload: `{ authenticated: true, iat: number, exp: number }`.
   - Chữ ký: `HMAC_SHA256(payload, SESSION_SECRET)`.
   - Hạn dùng: **7 ngày** (tự động hết hạn nếu không hoạt động).
5. **Cơ chế chống Brute-force (Rate Limiting):**
   - `/api/auth/login`: Tối đa **5 lần thử sai trong 15 phút** trên mỗi địa chỉ IP. Vượt quá sẽ trả về `429 Too Many Requests`.
   - Các API nghiệp vụ: Tối đa **120 requests/phút** trên mỗi IP để ngăn cào dữ liệu tự động.

---

## 6. KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC & BÀI TEST XÁC MINH (PHASE 2)

### 6.1. Các bước thực hiện

#### Bước 1: Dependencies & Biến môi trường
- Cài đặt: `cookie-parser`, `@types/cookie-parser`, `express-rate-limit`, `helmet`.
- Cập nhật `backend/src/config/env.ts`:
  - `CRM_ACCESS_CODE`: Mã truy cập chung (bắt buộc, tối thiểu 8 ký tự).
  - `SESSION_SECRET`: Khóa bí mật dùng để ký phiên (bắt buộc, tối thiểu 32 ký tự).
  - Loại bỏ các fallback string mặc định của passkey và cron secret.

#### Bước 2: Xây dựng Module Session & Middleware Auth
- Tạo `backend/src/utils/session.ts`: Các hàm ký và giải mã session token bằng thuật toán HMAC-SHA256.
- Tạo `backend/src/middleware/auth.ts`: Middleware `requireAuth` kiểm tra cookie và header chống CSRF.
- Tạo `backend/src/middleware/rateLimiter.ts`: Định nghĩa bộ giới hạn rate limit cho đăng nhập và API chung.
- Tạo `backend/src/controllers/auth.controller.ts`:
  - `POST /api/auth/login`: Xác thực mã truy cập bằng `crypto.timingSafeEqual`, cấp cookie phiên.
  - `GET /api/auth/session`: Trả về `{ authenticated: boolean }`.
  - `POST /api/auth/logout`: Xóa cookie phiên.

#### Bước 3: Gắn Middleware bảo vệ các Route
- Cấu hình `backend/src/routes/index.ts`:
  - Public: `/health`, `/auth/login`, `/auth/session`.
  - Cron Worker: `/notifications/cron-worker` (yêu cầu nghiêm ngặt header `x-cron-secret`).
  - Gắn `router.use(requireAuth)` cho toàn bộ các route còn lại.

#### Bước 4: Tinh chỉnh CORS, Error Handling & Health Check
- Cập nhật `backend/src/config/cors.ts`: Đặt `credentials: true`.
- Cập nhật `backend/src/controllers/health.controller.ts`: Che giấu chi tiết lỗi CSDL khi degraded.
- Kích hoạt `helmet()` và `app.set('trust proxy', 1)` trong `backend/src/app.ts`.

#### Bước 5: Xây dựng Access Gate trên Frontend
- Xây dựng `AuthContext` và hook `useAuth`:
  - Khi tải trang, kiểm tra `GET /api/auth/session`.
  - Nếu chưa đăng nhập: Hiển thị màn hình khóa nhập mã truy cập (thiết kế phong cách dark glassmorphism đồng bộ với giao diện KTEA).
  - Nếu đã đăng nhập: Hiển thị giao diện làm việc bình thường.
- Bổ sung nút **"Khóa phiên / Đăng xuất"** tại góc chân Sidebar (`frontend/src/layouts/Sidebar.tsx`).

#### Bước 6: Cập nhật HTTP Client Frontend
- Trong `frontend/src/services/apiClient.ts`:
  - Thêm `credentials: 'include'` cho mọi request `fetch()`.
  - Bổ sung header `X-KTEA-REQUEST: '1'`.
  - Bắt lỗi HTTP `401 Unauthorized` để tự động đưa người dùng về màn hình nhập mã truy cập khi phiên hết hạn.
- Trong `frontend/src/services/settingsService.ts`: Bổ sung `credentials: 'include'` cho hàm `exportData`.

---

### 6.2. Bộ bài kiểm thử xác minh (Verification Test Suite)

| Mã kiểm thử | Tình huống kiểm tra | Thao tác thực hiện | Kết quả kỳ vọng |
| :---: | :--- | :--- | :--- |
| **TC-01** | Chưa đăng nhập gọi API nhạy cảm | Gọi trực tiếp `GET /api/customers` hoặc `GET /api/data/export` qua `curl` | Nhận mã lỗi `401 Unauthorized`, không có dữ liệu nào bị lộ. |
| **TC-02** | Chống dò mã truy cập (Brute-force) | Nhập sai mã truy cập 6 lần liên tiếp tại `/api/auth/login` | Từ lần thứ 6, hệ thống trả về `429 Too Many Requests` và khóa tạm thời 15 phút. |
| **TC-03** | Đăng nhập hợp lệ | Nhập đúng `CRM_ACCESS_CODE` | Nhận HTTP 200 và header `Set-Cookie: ktea_session=...; HttpOnly; Secure; SameSite=None`. |
| **TC-04** | Truy cập dữ liệu sau khi đăng nhập | Truy cập trang Dashboard và Khách hàng trên trình duyệt | Các API trả về HTTP 200, dữ liệu hiển thị mượt mà. |
| **TC-05** | Kiểm tra phòng chống CSRF | Gửi request có cookie hợp lệ nhưng cố tình bỏ header `X-KTEA-REQUEST` | Bị từ chối với mã lỗi `403 Forbidden`. |
| **TC-06** | Đăng xuất / Khóa phiên | Nhấn nút Đăng xuất trên thanh Sidebar | Cookie bị xóa, UI chuyển ngay về màn hình khóa; các request sau đó nhận `401`. |
| **TC-07** | Tác vụ tự động Web Push Cron | Gửi request tới `/api/notifications/cron-worker` kèm header `x-cron-secret` hợp lệ | Thực thi gửi nhắc lịch hẹn thành công mà không cần cookie đăng nhập của người dùng. |
| **TC-08** | Xuất dữ liệu CSDL sau khi đăng nhập | Nhấn nút Xuất CSDL trong tab Cài đặt | Tải xuống file JSON dữ liệu bình thường. |

---

## 7. RỦI RO ĐỐI VỚI CHỨC NĂNG ĐANG CHẠY & BIỆN PHÁP PHÒNG NGỪA

1. **Rủi ro Safari/iOS chặn Third-Party Cookies (ITP):**
   - *Hiện tượng:* Trình duyệt Safari trên iPhone/Mac có cơ chế Intelligent Tracking Prevention chặn cookie giữa hai domain khác gốc (`.vercel.app` và `.onrender.com`).
   - *Biện pháp giải quyết:* Cấu hình tính năng Vercel Rewrites trong `frontend/vercel.json`: chuyển tiếp `/api/:path*` sang Render backend. Khi đó từ góc nhìn trình duyệt, Frontend và Backend cùng chung một domain (`https://ktea-quan-ly.vercel.app`), cookie hoạt động ổn định 100% trên mọi thiết bị.
2. **Rủi ro gián đoạn Web Push Cron Job:**
   - *Hiện tượng:* Các dịch vụ cron định kỳ bên ngoài (như cron-job.org hoặc GitHub Actions) không có phiên đăng nhập của người dùng.
   - *Biện pháp giải quyết:* Duy trì cơ chế xác thực riêng biệt qua header `x-cron-secret` cho endpoint cron worker.
3. **Rủi ro Render Health Check bị từ chối:**
   - *Biện pháp giải quyết:* Đảm bảo endpoint `/health` và `/api/health` nằm độc lập bên ngoài middleware `requireAuth`.

---

## 8. KẾT LUẬN & TRẠNG THÁI HIỆN TẠI

- Giai đoạn **Phase 1: Security Audit** đã hoàn thành 100% mục tiêu đề ra.
- Toàn bộ rủi ro, điểm yếu và giải pháp kiến trúc đã được lập hồ sơ rõ ràng, không làm xáo trộn mã nguồn đang hoạt động.
- Hệ thống đã sẵn sàng để chuyển sang **Phase 2: Triển khai Access Gate & Bảo vệ Backend** khi có sự chấp thuận.
