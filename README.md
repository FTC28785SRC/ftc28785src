# Trình mô phỏng chiến lược FTC BIOBUZZ

## Xuất bản bằng GitHub Pages

1. Đẩy mã nguồn lên GitHub trên nhánh `main`.
2. Trong repository, mở **Settings → Pages**.
3. Ở mục **Build and deployment**, chọn **GitHub Actions** làm nguồn triển khai.
4. Workflow sẽ tự động xuất bản sau mỗi lần đẩy mã lên `main`. Bạn cũng có thể chạy thủ công tại **Actions → Deploy static site to GitHub Pages → Run workflow**.

Đây là website tĩnh: workflow chỉ xuất bản `index.html`, `css/` và `js/`, không cài thêm gói hay thay đổi trình mô phỏng. Các đường dẫn tài nguyên tương đối hoạt động trên cả địa chỉ GitHub Pages của repository và tên miền riêng.

## Mô hình CAD và thông số robot

Trong mục **Lắp robot**, có thể tải mô hình **GLB, OBJ hoặc STL** để xem trước ở chế độ 3D hoặc nhìn từ trên. Mô hình được lưu cục bộ trong trình duyệt, hiển thị theo vị trí và hướng của robot trên sân mô phỏng; có thể xoay hướng CAD theo từng góc 90 độ. File STEP/STP và các định dạng khác cần được xuất sang một trong ba định dạng được hỗ trợ trước khi tải lên. Mô hình CAD chỉ thay hình hiển thị, không tự tạo cơ cấu, va chạm hay bộ phận chuyển động riêng.

Các cơ cấu, cảm biến, hệ truyền động và tay cầm vẫn dùng mô phỏng robot có sẵn. Bốn thanh **Thông số mô phỏng** điều chỉnh tốc độ di chuyển, xoay, bắn và hút/nhả trong khoảng 25–175%; 100% là mặc định. Khi phát lại chiến lược, chuyển động bắt đầu sau khi âm thanh bắt đầu phát để đồng bộ phần mở đầu.
