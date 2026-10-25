# Trình mô phỏng chiến lược FTC BIOBUZZ

## Xuất bản bằng GitHub Pages

1. Đẩy mã nguồn lên GitHub trên nhánh `main`.
2. Trong repository, mở **Settings → Pages**.
3. Ở mục **Build and deployment**, chọn **GitHub Actions** làm nguồn triển khai.
4. Workflow sẽ tự động xuất bản sau mỗi lần đẩy mã lên `main`. Bạn cũng có thể chạy thủ công tại **Actions → Deploy static site to GitHub Pages → Run workflow**.

Đây là website tĩnh: workflow chỉ xuất bản `index.html`, `css/` và `js/`, không cài thêm gói hay thay đổi trình mô phỏng. Các đường dẫn tài nguyên tương đối hoạt động trên cả địa chỉ GitHub Pages của repository và tên miền riêng.
