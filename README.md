# Hệ thống Quản lý Nhân sự (HRM) — Docker Compose

> Đồ án mẫu phục vụ học tập. Trước khi nộp, hãy đổi mật khẩu, cập nhật thông tin sinh viên, tự chạy thử, chụp ảnh màn hình thực tế và đẩy repository lên GitHub.

## 1. Công nghệ
- Ứng dụng: Node.js + Express
- Cơ sở dữ liệu: PostgreSQL 16
- Công cụ quản trị DB: pgAdmin 4
- Reverse proxy: Nginx (security headers)
- Giám sát: Prometheus, Grafana, cAdvisor, Node Exporter, Nginx Exporter, PostgreSQL Exporter
- Log tập trung: Promtail + Loki; truy vấn LogQL qua Grafana Explore
- Tất cả thành phần chạy bằng Docker Compose.

## 2. Chuẩn bị
Cài Docker Desktop (Windows/macOS) hoặc Docker Engine + Compose plugin (Linux). Mở Docker Desktop và chờ trạng thái Running.

Trong VS Code, mở thư mục `HRM_Docker_Project`. Tạo file `.env` bằng cách sao chép `.env.example`, rồi thay mọi giá trị `replace_with_...` bằng mật khẩu riêng, ngẫu nhiên, tối thiểu 32 ký tự chữ và số. Không commit `.env` lên GitHub. Compose từ chối khởi chạy nếu thiếu các giá trị bắt buộc.

Trước lần chạy đầu, mở PowerShell tại thư mục dự án và chạy `.\pgadmin\configure-pgpass.ps1`. Script tạo file `.pgpass` local bị Git ignore, giới hạn quyền file trong volume pgAdmin, đăng ký server và khởi động pgAdmin/PostgreSQL; sau đó chạy `docker compose up -d --build` để khởi chạy toàn bộ stack. Chạy lại script nếu thay đổi `DB_PASSWORD`.

`HTTP_PORT` mặc định là `8080`; nếu cổng đó đã được ứng dụng khác sử dụng, đổi thành cổng trống (ví dụ `8082`) trong `.env`. Các URL dưới đây dùng cổng mặc định.

PostgreSQL khởi tạo bằng tài khoản quản trị `hrm_admin`; ứng dụng dùng tài khoản hạn chế `hrm_app`, còn PostgreSQL Exporter dùng tài khoản chỉ có quyền giám sát `hrm_monitor`. pgAdmin kết nối bằng `hrm_app` để xem/sửa dữ liệu ứng dụng; không dùng tài khoản quản trị trong ứng dụng.

> Cấu hình role và schema trong `database/init.sql` chỉ được chạy khi volume PostgreSQL được tạo lần đầu. Nếu đã chạy bản cấu hình cũ với volume dữ liệu, không xóa volume tùy tiện; hãy sao lưu dữ liệu và thực hiện migration role/schema trước khi cập nhật.

## 3. Khởi chạy
```bash
docker compose config
docker compose up -d --build
docker compose ps
```
Lần đầu tải image có thể mất vài phút.

## 4. Địa chỉ truy cập
- HRM: http://localhost:8080/
- Nhân viên: http://localhost:8080/employees
- Phòng ban: http://localhost:8080/departments
- Chấm công: http://localhost:8080/attendance
- pgAdmin: http://localhost:8080/pgadmin/
- Grafana: http://localhost:8080/grafana/
- Prometheus: http://localhost:8080/prometheus/
- Loki API readiness: http://localhost:8080/loki/ready

Grafana đăng nhập bằng `GRAFANA_USER` / `GRAFANA_PASSWORD` trong `.env`. pgAdmin dùng `PGADMIN_EMAIL` / `PGADMIN_PASSWORD`.

### Kết nối pgAdmin tới PostgreSQL
Server **HRM PostgreSQL** được đăng ký tự động từ `pgadmin/servers.json`. Mở **Servers → HRM PostgreSQL** trong Object Explorer; kết nối dùng passfile riêng có quyền `0600`, vì vậy pgAdmin không hỏi mật khẩu database.

Thông số kết nối: host `db`, port `5432`, database `hrm`, user `hrm_app`. Tài khoản ứng dụng chỉ có quyền thao tác dữ liệu HRM, không phải PostgreSQL superuser.

## 5. Chức năng HRM
- Xem/thêm/sửa/xóa nhân viên; kiểm tra mã nhân viên và email không trùng.
- Xem/thêm/sửa/xóa phòng ban; khi xóa phòng ban, nhân viên liên quan được chuyển về trạng thái chưa phân phòng.
- Ghi nhận, cập nhật và xóa giờ vào/ra theo ngày; mỗi nhân viên có tối đa một bản ghi/ngày (ghi lại cùng ngày sẽ cập nhật).
- Trang tổng quan hiển thị số nhân viên, phòng ban và lượt chấm công hôm nay.
- Endpoint kiểm tra sức khỏe ứng dụng: `/health`.

## 6. Giám sát Prometheus + Grafana
Trong Prometheus, vào **Status → Targets**; các target chính gồm `prometheus`, `cadvisor`, `node-exporter`, `postgres`. Một số target cần chờ vài chu kỳ scrape mới hiện trạng thái UP.
Trong Grafana, datasource Prometheus và Loki cùng dashboard **HRM - Tổng quan hệ thống** được provision tự động. Mở **Dashboards → HRM → HRM - Tổng quan hệ thống** để xem trạng thái target, PostgreSQL, kết nối Nginx, CPU host, CPU/bộ nhớ container và log ứng dụng Loki. Prometheus scrape Nginx Exporter (metrics web server), cAdvisor, Node Exporter và PostgreSQL Exporter. Có thể tạo dashboard mới và thêm panel bằng các truy vấn ví dụ:
- `up`
- `container_memory_usage_bytes`
- `rate(container_cpu_usage_seconds_total[5m])`
- `pg_up`
- `nginx_connections_active`

Nếu target PostgreSQL exporter không lên, kiểm tra `docker compose logs postgres-exporter db`.

## 7. Loki + LogQL
Mở Grafana → Explore → chọn datasource **Loki**. Thử các truy vấn sau (có thể cần đợi log phát sinh):
```logql
{service="app"}
{service="app"} |= "error"
{container=~".*nginx.*"}
```
Tạo hoạt động trên website để phát sinh log, ví dụ thêm nhân viên hoặc chấm công. Lưu ý label phụ thuộc metadata Docker Compose và có thể khác giữa môi trường; dùng nút label browser trong Explore để xem label đang có. Nếu chưa thấy log, kiểm tra `docker compose logs promtail loki`.

## 8. Nginx reverse proxy và hardening
- Trình duyệt truy cập qua Nginx tại cổng 8080; ứng dụng, DB và công cụ quản trị không publish cổng riêng ra host.
- `backend` là internal network, DB chỉ nhận kết nối từ các container thuộc network này.
- App chạy bằng user `node`, `read_only: true`, `cap_drop: ALL`, `no-new-privileges` và `/tmp` tạm thời.
- Các response headers được cấu hình trong `nginx/default.conf`.
- `.env` được loại khỏi Git bằng `.gitignore`.
- Tách network frontend/backend/monitoring để giảm giao tiếp không cần thiết; trang trạng thái Nginx chạy trên cổng nội bộ 8081 và không được publish lên host.

**Lưu ý trung thực khi báo cáo:** cAdvisor cần quyền truy cập thông tin host/container rộng nên đang dùng `privileged: true`; đây là ngoại lệ giám sát, không phải hardening tối đa. Trong môi trường production, đánh giá lại quyền cAdvisor, Docker socket của Promtail, TLS, secrets management, giới hạn tài nguyên và cập nhật phiên bản image.

Nginx hiện dùng HTTP để thuận tiện chạy demo local và security headers cơ bản; HTTPS tự ký chưa được bật trong cấu hình mẫu. Đề bài cho phép HTTPS tự ký **hoặc** security headers cơ bản, vì vậy cấu hình hiện tại đáp ứng lựa chọn security headers. Nếu giảng viên yêu cầu HTTPS, hãy bổ sung chứng chỉ tự ký và listener 443.

## 9. GitHub và commit theo mốc
Tạo repository GitHub bằng mã số sinh viên theo yêu cầu giảng viên. Ví dụ tên repository: `MSSV-hrm-docker`.

```bash
git init
git add .
git commit -m "Initial commit: HRM app and Docker Compose"
git branch -M main
git remote add origin https://github.com/<USERNAME>/<REPOSITORY>.git
git push -u origin main
```

Sau đó chia commit rõ ràng theo tiến độ:
```bash
git add nginx docker-compose.yml
git commit -m "Commit 1: configure Nginx reverse proxy and security headers"
git add prometheus grafana
git commit -m "Commit 2: add Prometheus and Grafana monitoring"
git add loki promtail
git commit -m "Commit 3: add Loki Promtail centralized logging"
```
Đây là ví dụ minh họa. Hãy commit theo đúng trình tự bạn thực sự thực hiện; không tạo lịch sử giả.

## 10. Kiểm tra lỗi
```bash
docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 nginx
docker compose logs --tail=100 db
docker compose logs --tail=100 loki promtail
docker compose down
```
Nếu đổi mật khẩu DB sau lần khởi tạo đầu tiên mà giữ volume cũ, PostgreSQL không tự đổi mật khẩu trong dữ liệu hiện hữu. Với dữ liệu demo có thể xóa toàn bộ dữ liệu bằng `docker compose down -v` rồi `docker compose up -d --build` — **lệnh này xóa dữ liệu trong volume**, chỉ chạy khi chấp nhận mất dữ liệu.

## 11. Bố cục báo cáo tối thiểu 10 trang
1. Bìa: trường, khoa, học phần, đề tài, sinh viên, MSSV, giảng viên, năm học.
2. Mục lục.
3. Mục tiêu và phạm vi hệ thống.
4. Kiến trúc tổng quan (vẽ sơ đồ từ trình duyệt → Nginx → app → PostgreSQL; Prometheus/Grafana và Promtail/Loki).
5. Thiết kế cơ sở dữ liệu (departments, employees, attendance).
6. Triển khai ứng dụng và Docker Compose.
7. Nginx reverse proxy và security headers (ảnh cấu hình + kiểm tra header).
8. Prometheus/Grafana (ảnh Targets UP, dashboard).
9. Loki/Promtail/LogQL (ảnh 2–3 truy vấn thực chạy).
10. Hardening, kiểm thử, kết quả, hạn chế và hướng phát triển.
11. Kết luận và tài liệu tham khảo.

Chụp ảnh từ môi trường đã chạy thật, không dùng ảnh minh họa giả làm kết quả. Bổ sung tên/MSSV và mô tả theo thực nghiệm của bạn.
