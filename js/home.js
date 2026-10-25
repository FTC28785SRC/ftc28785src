 (function (root) {
  'use strict';
  var BBZ = root.BBZ = root.BBZ || {};

  function homeMarkup() {
    return '<section class="studio-home">' +
      '<p class="studio-kicker">XƯỞNG ROBOT FTC</p>' +
      '<h1>Lắp robot, viết OpMode và thử nghiệm ngay trên sân.</h1>' +
      '<p>Lắp ráp và lập trình robot, chạy TỰ ĐỘNG và TELEOP, rồi so sánh chiến lược trong cùng không gian Xem trận đấu.</p>' +
      '<div class="studio-home-actions">' +
        '<button type="button" class="btn btn-primary" data-open-view="build">Lắp robot</button>' +
        '<button type="button" class="btn" data-open-view="learn">Điều khiển &amp; lập trình</button>' +
        '<button type="button" class="btn" data-open-view="drive">Mở trạm điều khiển</button>' +
      '</div>' +
      '<ul><li>Cấu hình robot và tên cổng được lưu cục bộ trong trình duyệt này.</li>' +
        '<li>Chương trình chỉ chạy trong mô phỏng; chúng không được biên dịch hoặc gửi tới FTC Robot Controller.</li>' +
        '<li>Mô hình sân ước tính chuyển động, vật thể trò chơi, cơ cấu và va chạm.</li></ul>' +
      '</section>';
  }

  BBZ.Home = { markup: homeMarkup };
})(window);
