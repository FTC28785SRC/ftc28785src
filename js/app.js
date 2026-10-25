(function (root) {
  'use strict';

  var BBZ = root.BBZ;
  var stage = document.createElement('section');
  stage.id = 'robotApp';
  stage.hidden = true;
  stage.setAttribute('aria-label', 'Xưởng robot FTC');
  stage.innerHTML =
    '<nav class="studio-tabs" aria-label="Các mục trong Xưởng robot FTC">' +
      '<button type="button" class="tab btn" data-view="drive">Trạm điều khiển</button>' +
      '<button type="button" class="tab btn" data-view="build">Lắp robot</button>' +
      '<button type="button" class="tab btn" data-view="learn">Điều khiển &amp; lập trình</button>' +
      '<button type="button" class="tab btn" data-view="tutorial">Hướng dẫn</button>' +
      '<button type="button" class="tab btn" data-view="manual">Trợ giúp</button>' +
    '</nav>' +
    '<main class="studio-views">' +
      '<section id="view-home" class="studio-view"></section>' +
      '<section id="view-drive" class="studio-view" hidden>' +
        '<div class="studio-toolbar">' +
          '<label>OpMode Tự động <select id="autoSel"></select></label>' +
          '<label>OpMode TeleOp <select id="teleSel"></select></label>' +
          '<label>Vị trí xuất phát <select id="startSel"></select></label>' +
          '<button type="button" class="btn btn-primary" id="btnRun">Chạy mục đã chọn</button>' +
          '<button type="button" class="btn" id="btnMatch">Chạy cả trận</button>' +
          '<button type="button" class="btn" id="btnStop">Dừng</button>' +
          '<button type="button" class="btn" id="btnReset">Đặt lại sân</button>' +
        '</div>' +
        '<div class="studio-layout">' +
          '<section class="studio-card"><div class="studio-toolbar">' +
            '<button type="button" class="btn" id="allianceRed">Liên minh đỏ</button><button type="button" class="btn" id="allianceBlue">Liên minh xanh</button>' +
            '<button type="button" class="btn speed" data-s="1">1×</button><button type="button" class="btn speed" data-s="2">2×</button><button type="button" class="btn speed" data-s="4">4×</button>' +
            '<span id="phase">Sẵn sàng</span><strong id="clock">0:00</strong></div>' +
            '<div id="fieldWrap"><canvas id="field" aria-label="Mô phỏng sân FTC BIOBUZZ nhìn từ trên cao"></canvas></div>' +
            '<div class="studio-score"><span>TỰ ĐỘNG <strong id="autoScore">0</strong></span><span>ĐIỀU KHIỂN <strong id="teleopScore">0</strong></span><span>Số lần nghiêng <strong id="tips">0</strong></span><span>Đang giữ <strong id="held">0</strong></span></div>' +
            '<div class="total-score-card" aria-live="polite"><span>TỔNG ĐIỂM</span><strong id="score">0</strong><span>ROBOT FTC</span></div>' +
            '<p id="scoreHint" class="hint"></p><table class="score-breakdown"><tbody id="scoreBody"></tbody></table><p id="rpHint" class="hint"></p>' +
          '</section>' +
          '<aside class="studio-card">' +
            '<h2>Trạm điều khiển</h2><p id="dsStatus" role="status">Sẵn sàng</p>' +
            '<div class="controller-select"><button type="button" class="btn" data-pt="0">Tay cầm 1</button><button type="button" class="btn" data-pt="1">Tay cầm 2</button><button type="button" class="btn" id="btnSwapPads">Đổi tay cầm</button><span id="padStatus"></span></div>' +
            '<div class="gamepad">' +
              '<div class="stick" id="stickL" aria-label="Cần trái"><span class="knob"></span></div>' +
              '<div class="pad-buttons">' +
                '<button type="button" class="pb" data-pad="y">Y</button><button type="button" class="pb" data-pad="x">X</button><button type="button" class="pb" data-pad="b">B</button><button type="button" class="pb" data-pad="a">A</button>' +
                '<button type="button" class="pb" data-pad="dpad_up">↑</button><button type="button" class="pb" data-pad="dpad_left">←</button><button type="button" class="pb" data-pad="dpad_down">↓</button><button type="button" class="pb" data-pad="dpad_right">→</button>' +
                '<button type="button" class="pb" data-pad="left_bumper">LB</button><button type="button" class="pb" data-pad="right_bumper">RB</button>' +
              '</div>' +
              '<div class="stick" id="stickR" aria-label="Cần phải"><span class="knob"></span></div>' +
            '</div>' +
            '<h3>Dữ liệu telemetry</h3><ul id="telemetry"></ul><h3>Nhật ký chạy</h3><ol id="log"></ol>' +
            '<p id="driverMessage" role="status"></p>' +
          '</aside>' +
        '</div>' +
      '</section>' +
      '<section id="view-build" class="studio-view" hidden>' +
        '<div class="studio-toolbar"><label>Tên robot <input id="botName" maxlength="40"></label><button type="button" class="btn" id="btnResetBot">Đặt lại robot</button></div>' +
        '<div class="studio-layout build-layout">' +
          '<section class="studio-card"><h2>Hệ truyền động</h2><div id="driveList" class="drive-list"></div>' +
            '<label>Loại động cơ <select id="motorSel"></select></label><label>Kích thước bánh xe <select id="wheelSel"></select></label>' +
            '<label>Chiều rộng <input type="range" id="widthRange" min="12" max="18" step=".5"><output id="widthOut"></output></label>' +
            '<label>Chiều dài <input type="range" id="lengthRange" min="12" max="18" step=".5"><output id="lengthOut"></output></label>' +
            '<label id="realisticBox"><input type="checkbox" id="realistic"> Phản hồi động cơ thực tế</label>' +
            '<h3>Màu khung</h3><div id="paintList" class="paint-list"></div></section>' +
          '<section class="studio-card"><h2>Xem trước robot</h2><div class="preview-tools"><button type="button" class="btn" data-vm="3d">Góc nhìn 3D</button><button type="button" class="btn" data-vm="top">Góc nhìn trên</button><button type="button" class="btn" id="btnTurnPart">Xoay bộ phận đã chọn</button><button type="button" class="btn" id="btnResetLayout">Đặt lại bố cục</button></div>' +
            '<canvas id="preview" width="720" height="720" tabindex="0" aria-label="Mô hình robot tương tác. Kéo để xoay hoặc sắp xếp các bộ phận."></canvas>' +
            '<p id="layoutMsg" role="status"></p><div id="partList" class="part-list"></div><h3>Mẫu robot</h3><div id="presetList" class="preset-list"></div></section>' +
          '<aside class="studio-card"><h2>Cơ cấu và cảm biến</h2><div id="toolList" class="tool-list"></div><h3>Cảm biến</h3><div id="sensorList" class="tool-list"></div>' +
            '<h3>Tên thiết bị</h3><p id="nameMsg" role="status"></p><div class="table-scroll"><table><thead><tr><th>Thiết bị</th><th>Loại</th><th>Cổng</th><th>Tên đã cấu hình</th></tr></thead><tbody id="hwNames"></tbody></table></div>' +
            '<h3>Kiểm tra robot</h3><ul id="checks"></ul></aside>' +
        '</div>' +
      '</section>' +
      '<section id="view-learn" class="studio-view" hidden>' +
        '<div class="studio-toolbar"><button type="button" class="btn" id="tabBlocks">FTC Blocks</button><button type="button" class="btn" id="tabJava">OnBotJava</button><button type="button" class="btn" id="btnNewBlocks">OpMode Blocks mới</button><button type="button" class="btn" id="btnNewJava">OpMode Java mới</button><button type="button" class="btn" id="btnExamples" aria-expanded="false">Ví dụ</button><button type="button" class="btn" id="btnCopyOp">Nhân bản</button><button type="button" class="btn" id="btnDelete">Xóa mục đã chọn</button></div>' +
        '<section id="exPanel" hidden><h2>Chương trình mẫu</h2><div id="exBody"></div></section>' +
        '<div class="studio-layout editor-layout" id="editorLayout">' +
          '<section class="studio-card"><h2 id="opTitle">OpMode</h2><div class="table-scroll"><table><thead><tr><th>Thứ tự</th><th>Tên</th><th>Chế độ</th><th>Mô tả</th></tr></thead><tbody id="opBody"></tbody></table></div><datalist id="groupList"></datalist></section>' +
          '<section class="studio-card"><p id="filePath"></p><div class="studio-toolbar"><label>Tên <input id="progName" maxlength="40"></label><label>Chế độ <select id="modeSel"><option value="teleop">TeleOp</option><option value="auto">Tự động</option></select></label><label>Nhóm <input id="progGroup" list="groupList"></label></div>' +
            '<label>Mô tả <input id="progDesc" maxlength="140"></label>' +
            '<div id="blocksPane"><div id="blocksRoot"></div></div>' +
            '<div id="javaPane"><div class="code-editor-toolbar"><span>Mã nguồn OnBotJava</span><button type="button" class="btn" id="btnExpandCode" aria-pressed="false">Mở rộng khung mã</button></div><div class="code-editor"><pre id="gutter" aria-hidden="true"></pre><textarea id="code" spellcheck="false" aria-label="Trình soạn thảo OnBotJava"></textarea><span id="errLine" hidden></span></div></div>' +
            '<button type="button" class="btn" id="btnViewJava" aria-expanded="false">Xem mã Java được tạo từ các khối</button><pre id="genJava" hidden></pre><button type="button" class="btn" id="btnToJava">Chép Blocks sang Java</button>' +
          '</section>' +
          '<aside class="studio-card"><h2>Bản đồ phần cứng</h2><div class="table-scroll"><table><thead><tr><th>Thiết bị</th><th>Tên</th><th>Giá trị</th></tr></thead><tbody id="hwBody"></tbody></table></div><h2>Lỗi và kết quả</h2><p id="console" role="status"></p></aside>' +
        '</div>' +
      '</section>' +
      '<section id="view-tutorial" class="studio-view studio-guide" hidden>' +
        '<header class="studio-page-head"><p class="studio-kicker">FTC BIOBUZZ · VIDEO HƯỚNG DẪN</p><h1>Hướng dẫn</h1><p>Xem video hướng dẫn, sau đó làm theo ba bước để xây dựng, kiểm tra và lưu kế hoạch robot.</p></header>' +
        '<div class="studio-guide-video"></div>' +
        '<div class="studio-guide-steps"><article><span>01</span><h2>Bắt đầu với trận đấu</h2><p>Chọn liên minh và robot của bạn, sau đó thử một trận mẫu để xem kế hoạch hoàn chỉnh hoạt động.</p></article><article><span>02</span><h2>Theo dõi và so sánh</h2><p>Dùng trình phát để theo dõi từng robot, sau đó xem điểm số và các cảnh báo về thời gian hoặc luật.</p></article><article><span>03</span><h2>Tùy chỉnh chiến thuật</h2><p>Chỉnh sửa các bước của robot, chạy thử toàn trận và lưu chiến thuật khi đã sẵn sàng.</p></article></div>' +
        '<p class="studio-guide-link">Cần tìm hiểu các nút điều khiển, thuật ngữ hoặc cách khắc phục sự cố? <button type="button" class="btn" data-open-view="manual">Mở trợ giúp</button></p>' +
      '</section>' +
      '<section id="view-manual" class="studio-view studio-guide" hidden>' +
        '<header class="studio-page-head"><p class="studio-kicker">XƯỞNG ROBOT FTC</p><h1>Trợ giúp</h1><p>Tra cứu nhanh cách thiết lập robot, chạy OpMode và điều khiển mô phỏng sân đấu.</p></header>' +
        '<div class="studio-guide-steps"><article><span>01</span><h2>Lắp ráp và cấu hình</h2><p>Chọn hệ truyền động và cơ cấu trong mục Lắp robot. Đặt tên thiết bị trùng với tên được dùng trong chương trình.</p></article><article><span>02</span><h2>Tạo chương trình</h2><p>Mở Điều khiển &amp; lập trình để tạo OpMode Tự động hoặc TeleOp. Có thể xem FTC Blocks dưới dạng mã Java được tạo; Java được chạy bằng trình thông dịch mô phỏng.</p></article><article><span>03</span><h2>Chạy trận đấu</h2><p>Chạy cả trận sẽ khởi động OpMode Tự động, tạm dừng trong thời gian chuyển tiếp FTC, rồi chạy OpMode TeleOp đã chọn. Chạy mục đã chọn chỉ khởi động OpMode tương ứng.</p></article></div>' +
        '<section class="studio-help-card"><h2>Sử dụng FTC Blocks</h2><ol><li>Trong mục <strong>Lắp robot</strong>, thêm động cơ, servo và cảm biến cần dùng; đặt tên thiết bị trước khi lập trình.</li><li>Mở <strong>Điều khiển &amp; lập trình</strong>, chọn <strong>FTC Blocks</strong> rồi nhấn <strong>OpMode Blocks mới</strong>. Chọn chế độ Tự động hoặc TeleOp.</li><li>Kéo khối từ danh mục bên trái vào vùng làm việc và nối chúng theo thứ tự. Khối ghi chú chỉ dành cho người đọc; robot không chạy khối này.</li><li>Đặt các lệnh khởi tạo trước khối <code>waitForStart</code>. Các lệnh sau đó chỉ chạy khi OpMode bắt đầu; đặt vòng lặp điều khiển trong điều kiện <code>opModeIsActive</code>.</li><li>Dùng <strong>Ví dụ</strong> để nạp chương trình mẫu. Xem <strong>Xem mã Java được tạo từ các khối</strong> để kiểm tra mã; <strong>Chép Blocks sang Java</strong> sẽ chuyển nội dung sang trình soạn thảo Java.</li><li>Chọn OpMode và nhấn <strong>Chạy mục đã chọn</strong> hoặc <strong>Chạy cả trận</strong>. Kết quả, telemetry và lỗi hiển thị cạnh sân.</li></ol><p>Tên API như <code>runOpMode</code>, <code>waitForStart</code>, <code>Power</code> và <code>gamepad1</code> được giữ nguyên vì chúng phải khớp với FTC SDK và mã Java. Các chương trình ở đây chỉ chạy trong mô phỏng, không được nạp lên robot thật.</p></section>' +
        '<section class="studio-help-card"><h2>Điều khiển robot</h2><p>Dùng phím WASD hoặc phím mũi tên, tay cầm trên màn hình hoặc tay cầm PS5/tay cầm thi đấu đã kết nối theo cấu hình tiêu chuẩn. Nhấn Dừng để dừng OpMode; Đặt lại sân để đưa robot và các phần tử sân về trạng thái ban đầu.</p><p>Các API SDK không được hỗ trợ sẽ được báo là lỗi mã. Mô hình sân chỉ ước tính chuyển động robot và tương tác trong trò chơi.</p></section>' +
        '<p class="studio-guide-link">Bạn muốn xem hướng dẫn trực quan? <button type="button" class="btn" data-open-view="tutorial">Mở hướng dẫn</button></p>' +
      '</section>' +
      '<section id="view-legal" class="studio-view" hidden><h1>Thông tin về mô phỏng</h1><p>Đây là mô phỏng giáo dục chạy cục bộ. Chuyển động và tương tác trên sân chỉ là ước tính; trình thông dịch Java hỗ trợ một tập con an toàn của các API FTC SDK.</p></section>' +
    '</main>' +
    '<div id="countOverlay" hidden><strong id="countNum"></strong></div><div id="toast" role="status" hidden></div>';

  var style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'css/app.css?v=tutorial-page-4';
  document.head.appendChild(style);
  var boardWrap = document.querySelector('#watchPanel .board-wrap');
  var board = document.querySelector('#watchPanel .board');
  var fieldWrap = stage.querySelector('#fieldWrap');
  var fieldSvg = document.getElementById('fieldSvg');
  var driveView = stage.querySelector('#view-drive');
  var driveLayout = driveView.querySelector('.studio-layout');
  var driveToolbar = driveView.querySelector('.studio-toolbar');
  var driveCard = driveLayout.firstElementChild;
  var driverStation = driveLayout.querySelector('aside');
  var fieldControls = driveCard.querySelector('.studio-toolbar');
  if (!boardWrap || !board || !fieldWrap || !fieldSvg) {
    throw new Error('Không thể tích hợp Xưởng robot FTC: thiếu sân ở mục Xem trận đấu.');
  }
  if (!driveLayout || !driveToolbar || !driveCard || !driverStation || !fieldControls) {
    throw new Error('Không thể tích hợp Xưởng robot FTC: các điều khiển của Trạm điều khiển chưa đầy đủ.');
  }

  var fieldMode = document.createElement('div');
  fieldMode.className = 'shared-field-mode';
  fieldMode.setAttribute('role', 'group');
  fieldMode.setAttribute('aria-label', 'Sân đấu dùng chung');
  fieldMode.innerHTML =
    '<strong>Sân đấu dùng chung</strong>' +
    '<button type="button" class="btn" data-field-mode="ftc" aria-pressed="true">Robot FTC + điều khiển</button>' +
    '<button type="button" class="btn" data-field-mode="strategy" aria-pressed="false">Phát chiến lược</button>' +
    '<span>Đổi chế độ hiển thị ngay tại mục Xem trận đấu.</span>';
  var scoreHeading = document.createElement('h2');
  scoreHeading.textContent = 'Điểm FTC trực tiếp';
  var plannerField = document.createElement('div');
  plannerField.id = 'plannerField';
  plannerField.appendChild(fieldSvg);
  board.appendChild(plannerField);
  board.appendChild(fieldWrap);
  var sharedFieldLayout = document.createElement('div');
  sharedFieldLayout.className = 'shared-field-layout';
  var liveScore = document.createElement('div');
  liveScore.className = 'shared-field-score';
  ['.studio-score', '.total-score-card', '#scoreHint', '#scoreBody', '#rpHint'].forEach(function (selector) {
    var item = stage.querySelector(selector);
    if (item) liveScore.appendChild(item.closest('table') || item);
  });
  liveScore.insertBefore(scoreHeading, liveScore.firstChild);
  boardWrap.insertBefore(sharedFieldLayout, board);
  sharedFieldLayout.append(board, liveScore);
  driveCard.remove();
  driveLayout.replaceChildren(driverStation);
  driveView.insertBefore(driveToolbar, driveLayout);
  driveView.classList.add('integrated-station');
  boardWrap.insertBefore(fieldMode, sharedFieldLayout);
  boardWrap.insertBefore(fieldControls, sharedFieldLayout);
  boardWrap.appendChild(stage);
  stage.hidden = false;
  var tutorialVideo = document.getElementById('videoTutorial');
  if (tutorialVideo) {
    tutorialVideo.closest('.welcome').classList.remove('welcome-with-video');
    stage.querySelector('.studio-guide-video').appendChild(tutorialVideo);
  }
  document.body.dataset.fieldMode = 'ftc';
  document.body.dataset.appView = 'integrated';

  function setFieldMode(mode) {
    document.body.dataset.fieldMode = mode;
    fieldMode.querySelectorAll('[data-field-mode]').forEach(function (item) {
      item.setAttribute('aria-pressed', String(item.dataset.fieldMode === mode));
    });
    if (mode === 'ftc') {
      window.dispatchEvent(new Event('bbz-resize-field'));
    }
  }
  fieldMode.addEventListener('click', function (event) {
    var button = event.target.closest('[data-field-mode]');
    if (button) setFieldMode(button.dataset.fieldMode);
  });
  var overheadButton = document.getElementById('viewTop');
  var strategyCameraButtons = ['viewAngled', 'viewHives'].map(function (id) {
    return document.getElementById(id);
  });
  if (!overheadButton || strategyCameraButtons.some(function (button) { return !button; })) {
    throw new Error('Cannot connect the shared field camera controls.');
  }
  overheadButton.textContent = 'Góc nhìn trên · sân FTC';
  overheadButton.addEventListener('click', function () { setFieldMode('ftc'); });
  strategyCameraButtons.forEach(function (button) {
    button.addEventListener('click', function () { setFieldMode('strategy'); });
  });
  ['#playBtn', '#stepBack', '#stepFwd', '#playSlider', '#resetBtn'].forEach(function (selector) {
    var control = document.querySelector(selector);
    if (control) {
      var showStrategy = function () { setFieldMode('strategy'); };
      control.addEventListener('click', showStrategy);
      control.addEventListener('input', showStrategy);
    }
  });
  ['#btnRun', '#btnMatch'].forEach(function (selector) {
    stage.querySelector(selector).addEventListener('click', function () { setFieldMode('ftc'); });
  });

  document.querySelector('#view-home').innerHTML = BBZ.Home.markup();

  document.querySelectorAll('[data-open-view]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.closest('#helpPanel') && window.BBEase) window.BBEase.screen('watch', false);
      var tab = document.querySelector('.studio-tabs [data-view="' + button.dataset.openView + '"]');
      if (tab) tab.click();
    });
  });

  if (!BBZ.World || !BBZ.Java || !BBZ.Bot3D || !BBZ.Blocks || !BBZ.Blocks.ready) {
    document.querySelector('#view-home').insertAdjacentHTML('beforeend',
      '<p class="studio-error" role="alert">Không tải được mô-đun mô phỏng robot hoặc thư viện Blockly cục bộ. Hãy kiểm tra bảng điều khiển trình duyệt và đường dẫn tài nguyên.</p>');
  }
})(window);
