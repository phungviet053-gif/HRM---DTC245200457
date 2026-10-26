# BÁO CÁO ĐỒ ÁN — ĐỀ 10: HỆ THỐNG QUẢN LÝ NHÂN SỰ (HRM)

> Mẫu nội dung để phát triển thành báo cáo tối thiểu 10 trang. Thay toàn bộ phần trong ngoặc vuông và chèn ảnh chụp thực tế từ máy của bạn.

## Bìa
- Trường: [Tên trường]
- Khoa: [Tên khoa]
- Học phần: [Tên học phần]
- Đề tài: Hệ thống Quản lý Nhân sự (HRM)
- Sinh viên: [Họ tên]
- Mã số sinh viên: [MSSV]
- Giảng viên hướng dẫn: [Tên giảng viên]
- [Địa điểm], [Năm]

## 1. Giới thiệu
Trình bày nhu cầu quản lý hồ sơ nhân viên, phòng ban và chấm công. Mục tiêu của đề tài là triển khai ứng dụng web nhỏ gọn bằng Docker Compose, đồng thời thực hành reverse proxy, giám sát, tập trung log và hardening.

## 2. Phạm vi chức năng
- Quản lý hồ sơ nhân viên: thêm, xem, sửa và xóa.
- Quản lý phòng ban: thêm, xem, sửa và xóa.
- Chấm công theo ngày: thêm/cập nhật, xem và xóa giờ vào, giờ ra, ghi chú.
- Dashboard thống kê số nhân viên, phòng ban và bản ghi chấm công hôm nay.

## 3. Kiến trúc hệ thống
Mô tả các container: Nginx, Node.js/Express, PostgreSQL, pgAdmin, Prometheus, Grafana, Loki, Promtail, cAdvisor, Node Exporter, Nginx Exporter, PostgreSQL Exporter. PostgreSQL có role quản trị riêng, role ứng dụng giới hạn quyền thao tác dữ liệu và role giám sát riêng cho exporter.

**[Chèn Hình 1: sơ đồ kiến trúc hệ thống tự vẽ]**

## 4. Thiết kế cơ sở dữ liệu
- `departments`: thông tin phòng ban.
- `employees`: mã nhân viên, họ tên, email, điện thoại, chức vụ, phòng ban.
- `attendance`: nhân viên, ngày, giờ vào/ra, ghi chú.
Khóa ngoại liên kết nhân viên với phòng ban và bản ghi chấm công với nhân viên.

**[Chèn Hình 2: sơ đồ ERD]**

## 5. Triển khai ứng dụng và cơ sở dữ liệu
Mô tả Dockerfile, các service trong `docker-compose.yml`, network và volume. Ghi lại các lệnh chạy thật và kết quả.

**[Chèn Hình 3: docker compose ps]**
**[Chèn Hình 4: trang tổng quan HRM]**
**[Chèn Hình 5: danh sách nhân viên / phòng ban / chấm công]**
**[Chèn Hình 6: kết nối pgAdmin tới PostgreSQL]**

## 6. Nginx reverse proxy
Nginx tiếp nhận HTTP ở cổng 8080 và chuyển tiếp yêu cầu tới ứng dụng hoặc các công cụ nội bộ qua đường dẫn. Các header cấu hình gồm X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy và Content-Security-Policy.

**[Chèn Hình 7: cấu hình Nginx và trang web qua localhost:8080]**
**[Chèn Hình 8: kết quả kiểm tra response headers]**

## 7. Giám sát Prometheus và Grafana
Prometheus thu thập metrics theo chu kỳ 15 giây. cAdvisor cung cấp số liệu container, Node Exporter cung cấp metrics hệ điều hành, Nginx Exporter cung cấp metrics web server và PostgreSQL Exporter cung cấp metrics database. Grafana dùng để truy vấn và trực quan hóa.

Ví dụ PromQL: `up`, `container_memory_usage_bytes`, `rate(container_cpu_usage_seconds_total[5m])`, `pg_up`.

**[Chèn Hình 9: Prometheus Targets với các target UP]**
**[Chèn Hình 10: Grafana Explore hoặc dashboard có dữ liệu]**

## 8. Tập trung log với Loki và Promtail
Promtail thu thập log container Docker và gửi tới Loki. Người vận hành tìm kiếm log bằng LogQL trong Grafana Explore.

Truy vấn thử:
```logql
{service="app"}
{service="app"} |= "error"
{container=~".*nginx.*"}
```
Ghi rõ truy vấn nào trả về dữ liệu và điều chỉnh label dựa trên môi trường chạy thực tế.

**[Chèn Hình 11: LogQL query 1]**
**[Chèn Hình 12: LogQL query 2 hoặc 3]**

## 9. Hardening và an toàn hệ thống
Nêu network nội bộ, không publish cổng DB ra host, app chạy non-root, read-only filesystem, loại bỏ Linux capabilities, no-new-privileges, mật khẩu cấu hình qua `.env`, `.env` bị loại khỏi Git, role PostgreSQL giới hạn quyền và security headers Nginx. Nêu rõ giới hạn: cAdvisor và Docker socket của Promtail có quyền truy cập rộng; Nginx mẫu dùng HTTP chứ chưa bật HTTPS tự ký (security headers đã được bật).

**[Chèn Hình 13: docker-compose phần hardening và .gitignore]**

## 10. Kiểm thử và đánh giá
Lập bảng test case thực tế, gồm thao tác, kết quả mong đợi, kết quả quan sát và trạng thái đạt/chưa đạt. Không tự ghi “đạt” nếu chưa chạy kiểm thử.

## 11. Hạn chế và hướng phát triển
Có thể bổ sung đăng nhập/ phân quyền, sửa thông tin nhân viên, xuất báo cáo, HTTPS, secrets management, cảnh báo Prometheus, dashboard Grafana riêng và backup PostgreSQL.

## 12. Kết luận
Tổng kết kết quả thực tế đạt được, các kiến thức học được và các vấn đề cần cải thiện.

## Tài liệu tham khảo
- Tài liệu Docker Compose: https://docs.docker.com/compose/
- Tài liệu PostgreSQL: https://www.postgresql.org/docs/
- Tài liệu Nginx: https://nginx.org/en/docs/
- Tài liệu Prometheus: https://prometheus.io/docs/
- Tài liệu Grafana Loki và LogQL: https://grafana.com/docs/loki/latest/
