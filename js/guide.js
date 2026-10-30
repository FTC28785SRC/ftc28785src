/* Interactive, reversible onboarding for the strategy planner and FTC studio. */
(function (root) {
  'use strict';

  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));
  const GUIDE_CHOICE_KEY = 'bbz-guide-choice-v1';
  const GUIDE_RETURN_KEY = 'bbz-guide-return-v1';
  const ROBOT_STATE_KEY = 'bbz-practice-sim-v1';
  const steps = [];
  const completed = new Set();
  const visited = new Set();
  let active = false;
  let tourFinished = false;
  let index = 0;
  let target = null;
  let highlighted = null;
  let stepBefore = null;
  let strategySnapshot = null;
  let robotStateSnapshot = null;
  let originalHash = '';
  let originalStudioView = '';
  let originalStrategyScreen = '';
  let originalFieldMode = '';
  let originalCamera = '';
  let canRestoreReload = false;
  let needsRestoreReload = false;
  let navigating = false;
  let waitTimer = 0;
  let resizeObserver = null;

  function add(step) {
    steps.push(Object.assign({ event: 'click', done: 'Đã nhận thao tác chính xác. Bạn có thể sang bước tiếp theo.' }, step));
  }

  function clickStep(targetSelector, title, purpose, instruction, verify, extra) {
    add(Object.assign({
      target: targetSelector, event: 'click', title, purpose, instruction, verify
    }, extra || {}));
  }

  function selectStep(targetSelector, title, purpose, instruction, verify, extra) {
    add(Object.assign({
      target: targetSelector, event: 'change', title, purpose, instruction,
      verify: verify || (() => true)
    }, extra || {}));
  }

  function screenStep(screen, title, purpose, instruction) {
    clickStep('.workspace-nav [data-screen="' + screen + '"]', title, purpose, instruction,
      () => !$('#' + screen + 'Panel').hidden);
  }

  function studioStep(view, title, purpose, instruction) {
    clickStep('.studio-tabs [data-view="' + view + '"]', title, purpose, instruction,
      () => !$('#view-' + view).hidden);
  }

  function strategySteps() {
    clickStep('#plannerField', 'Strategy · sân mô phỏng chiến thuật',
      'Strategy là nơi lập kế hoạch thi đấu BIOBUZZ, xem vị trí bốn robot và theo dõi diễn biến trên sân.',
      'Sân này hiển thị kế hoạch của hai liên minh cùng lúc. Các robot và bóng di chuyển theo hành động đã lập; bảng điểm bên cạnh cập nhật kết quả. Những bước kế tiếp sẽ giới thiệu cách chọn trận, tạo kế hoạch và chạy mô phỏng.');
    clickStep('#fieldWrap', 'FTC Blocks · sân mô phỏng robot',
      'FTC Blocks dùng chương trình dạng khối để điều khiển robot FTC; sân mô phỏng cho thấy robot thực hiện chương trình.',
      'Đây là sân FTC nhìn từ trên xuống. Chọn OpMode Tự động hoặc TeleOp rồi chạy thử để thấy robot và điểm số thay đổi. Strategy và FTC dùng chung sân hiển thị, nhưng chương trình và cách điều khiển khác nhau.');
    selectStep('#matchMode', 'Chọn chế độ trận đấu', 'Chọn quy mô buổi luyện tập hoặc cách lập kế hoạch.',
      'Danh sách quyết định những robot nào tham gia. Chế độ lập kế hoạch cả hai liên minh hiển thị bốn robot; chế độ một robot dùng để luyện tập riêng. Có thể đổi lại bất cứ lúc nào.');
    selectStep('#playingAlliance', 'Chọn liên minh của bạn', 'Đổi góc nhìn và kế hoạch theo liên minh Đỏ hoặc Xanh.',
      'Chọn Đỏ hoặc Xanh để xác định liên minh bạn đang lập kế hoạch. Màu robot và phần chỉnh sửa sẽ đổi theo lựa chọn; kế hoạch của liên minh còn lại vẫn được giữ.');
    selectStep('#defenseTactic', 'Chọn chiến thuật phòng thủ', 'Quyết định cách mô phỏng đối thủ phòng thủ.',
      'Mục này chọn cách robot đối thủ phản ứng khi mô phỏng. Nếu mới bắt đầu, có thể giữ lựa chọn mặc định; thiết lập này không thay thế kế hoạch của liên minh bạn.');
    clickStep('#demoBtn', 'Tạo trận mẫu', 'Tạo sẵn kế hoạch để bạn quan sát sân, các bước và điểm số.',
      'Nhấn “Thử trận mẫu” để tạo nhanh chuỗi hành động cho robot. Sau khi tạo xong, xem phần tóm tắt rồi nhấn “Phát kế hoạch” để quan sát robot trên sân. Đây là ví dụ có thể thay đổi, không ghi đè tệp đã lưu.',
      () => $('#status').textContent.indexOf('Đã tải trận mẫu') === 0,
      { waitFor: true, timeout: 60000, planMutation: true });
    selectStep('#matchMode', 'Thử chế độ đối thủ ngẫu nhiên', 'Tạo một đối thủ để so sánh chiến thuật.',
      'Chọn “Liên minh của bạn đối đầu với đối thủ ngẫu nhiên”. Website sẽ tạo đối thủ; sau đó nút “Thử đối thủ khác” cho phép sinh một lựa chọn mới.',
      element => element.value === 'opponent' &&
        !$('#randomOpponentBtn').disabled && $('#status').textContent.indexOf('Đối thủ ') === 0,
      { waitFor: true, timeout: 60000, planMutation: true,
        hint: 'Nếu website báo lỗi khi tạo đối thủ, hãy đọc thông báo trạng thái rồi bỏ qua hướng dẫn.' });
    selectStep('#matchMode', 'Thử luyện tập một robot', 'Ẩn các robot không tham gia để bạn tập trung vào một robot.',
      'Chọn “Luyện tập với một robot”. Bộ chọn robot sẽ xuất hiện bên cạnh.',
      element => element.value === 'single');
    selectStep('#singleRobot', 'Chọn robot luyện tập', 'Chọn Robot 1 hoặc Robot 2 trong liên minh của bạn.',
      'Đổi robot trong danh sách. Lựa chọn này áp dụng cho chế độ luyện tập một robot.');
    selectStep('#matchMode', 'Trở lại lập kế hoạch cả trận', 'Bật lại chế độ xem đầy đủ các liên minh và các robot.',
      'Chọn “Lập kế hoạch cho cả hai liên minh đối đầu” để tiếp tục khám phá chiến thuật.',
      element => element.value === 'competitive');
    clickStep('#watchPanel [data-field-mode="ftc"]', 'Sân mô phỏng FTC', 'Chuyển sân dùng chung sang hình mô phỏng robot FTC.',
      'Nhấn “Robot FTC + điều khiển”. Bạn sẽ thấy sân nhìn từ trên và các robot FTC.');
    clickStep('#viewTop', 'Góc nhìn sân FTC', 'Quan sát vị trí robot và các vật thể trên sân FTC.',
      'Chọn góc nhìn trên. Khu vực sân FTC sẽ hiện rõ; hai nút góc nhìn chiến lược có thể chuyển lại sân BIOBUZZ.');
    clickStep('#viewAngled', 'Góc nhìn chiến lược', 'Xem sân mô phỏng BIOBUZZ ở góc nghiêng.',
      'Nhấn “Khung 3D”. Bản đồ chiến lược sẽ xuất hiện trên cùng khu vực sân.');
    clickStep('#viewHives', 'Tập trung vào HIVE', 'Phóng khu vực HIVE để theo dõi các ô và bóng.',
      'Nhấn “Tập trung vào tổ”, sau đó quan sát sân được chuyển sang chế độ tập trung.');
    selectStep('#showDefenseSpots', 'Vị trí phòng thủ minh họa', 'Hiện hoặc ẩn các vị trí phòng thủ tham khảo.',
      'Bật ô “Hiển thị bốn vị trí chặn ví dụ trên sân”. Có thể tắt lại bằng chính ô này.',
      event => event.checked);
    selectStep('#playSpeed', 'Tốc độ phát kế hoạch', 'Điều chỉnh tốc độ xem diễn biến trận.',
      'Chọn một tốc độ khác 1×. Đây chỉ là tốc độ phát mô phỏng, không sửa các bước kế hoạch.');
    clickStep('#playBtn', 'Chạy kế hoạch', 'Phát lần lượt các hành động đã được lập và đồng hồ mô phỏng.',
      'Nhấn “Phát kế hoạch” để xem các robot thực hiện hành động theo đồng hồ trận. Dùng “Tạm dừng” để dừng xem; thanh thời gian và nút bước cho phép kiểm tra từng thời điểm.',
      () => document.body.classList.contains('is-playing'),
      { waitFor: true, timeout: 9000 });
    clickStep('#playBtn', 'Tạm dừng kế hoạch', 'Dừng tạm thời để xem sân hoặc đọc nhãn hành động.',
      'Nhấn nút tạm dừng. Trạng thái phát sẽ dừng và nút trở lại “Chạy kế hoạch”.',
      () => !document.body.classList.contains('is-playing'));
    clickStep('#stepFwd', 'Xem bước tiếp theo', 'Tiến từng sự kiện mà không cần phát toàn bộ kế hoạch.',
      'Nhấn “Bước tiếp theo”. Nhãn diễn biến và sân sẽ cập nhật theo bước mới.');
    clickStep('#stepBack', 'Xem bước trước', 'Quay lại sự kiện trước đó để so sánh kết quả.',
      'Nhấn “Lùi”. Đồng hồ và diễn biến sẽ lùi về bước trước.');
    add({
      target: '#playSlider', event: 'input', title: 'Thanh thời gian trận',
      purpose: 'Đi đến nhanh một vị trí trong kế hoạch đang phát.',
      instruction: 'Kéo thanh thời gian sang vị trí khác. Nhãn bước và sân sẽ chuyển theo vị trí mới.',
      capture: element => element.value,
      verify: (element, before) => element.value !== before
    });
    clickStep('#resetBtn', 'Khởi động lại lượt xem', 'Đưa trình phát về trạng thái đầu trận mà không xóa kế hoạch.',
      'Nhấn “Khởi động lại”. Trình phát sẽ trở về bước ban đầu; các hành động vẫn được giữ.');
    clickStep('#scoresPanel', 'Bảng điểm chi tiết', 'Xem điểm TỰ ĐỘNG, ĐIỀU KHIỂN, điểm xếp hạng và thống kê sân.',
      'Bảng điểm tách điểm TỰ ĐỘNG, ĐIỀU KHIỂN và tổng điểm, đồng thời cho biết trạng thái sân và các giả định mô phỏng. Dùng mục này để kiểm tra kết quả sau khi phát hoặc chỉnh sửa kế hoạch.');
    screenStep('watch', 'Quay lại sân đấu', 'Trở lại sân và khu vực chọn trận.',
      'Nhấn “Xem trận đấu”. Các nút điều khiển và tóm tắt trận xuất hiện lại.');
    screenStep('edit', 'Mở Strategy', 'Xây dựng kế hoạch theo từng robot và từng giai đoạn trận.',
      'Mở “Chỉnh sửa chiến lược”. Chọn liên minh, robot và giai đoạn trận; nhấn một hành động hoặc công thức để thêm vào làn. Mỗi làn là thứ tự hành động của một robot.');
    selectStep('#editorAlliance', 'Chọn kế hoạch liên minh', 'Chuyển giữa kế hoạch Đỏ và Xanh để xem hoặc chỉnh sửa.',
      'Chọn Đỏ hoặc Xanh. Đây là liên minh đang được chỉnh sửa; kế hoạch của liên minh còn lại vẫn nằm trên sân và không bị xóa.');
    selectStep('#paletteRobot', 'Chọn robot cần chỉnh sửa', 'Mỗi robot có chuỗi hành động riêng.',
      'Chọn Robot 1 hoặc Robot 2. Sau đó, hành động bạn thêm sẽ được đặt cho robot này, không ảnh hưởng làn của robot kia.');
    selectStep('#paletteSegment', 'Chọn giai đoạn trận', 'Tách hành động TỰ ĐỘNG và hai nửa ĐIỀU KHIỂN.',
      'Chọn TỰ ĐỘNG, 60 giây đầu hoặc 60 giây cuối của ĐIỀU KHIỂN. Danh sách hành động và làn bên dưới đổi theo giai đoạn đã chọn.');
    clickStep('#recipeLibrary .recipe-choice', 'Thêm một hành động Strategy', 'Chọn một chu kỳ dựng sẵn để thêm các hành động phù hợp vào kế hoạch robot.',
      'Các khối công thức giúp bắt đầu nhanh; có thể chỉnh sửa từng hành động sau đó.',
      () => true, { planMutation: true });
    selectStep('#lanes .card .card-quantity', 'Cấu hình số bóng', 'Chọn số bóng cho hành động đang giữ vật phẩm.',
      'Mở danh sách số bóng và chọn giá trị khác. Thẻ sẽ hiển thị lựa chọn mới.',
      (element, before) => element.value !== before,
      { capture: element => element.value, planMutation: true });
    clickStep('#lanes .card .icobtn[data-act="up"]:not(:disabled)', 'Sắp xếp thứ tự hành động', 'Thứ tự trong mỗi làn quyết định trình tự robot thực hiện việc.',
      'Nhấn mũi tên lên trên một thẻ không nằm đầu làn. Thẻ sẽ đổi vị trí trong cùng làn.',
      () => true,
      { optional: true, planMutation: true });
    clickStep('#lanes .card .icobtn-del', 'Xóa một hành động', 'Xóa một bước không cần thiết khỏi kế hoạch hiện tại.',
      'Nhấn dấu × trên một thẻ hành động. Việc này chỉ xóa bước đó; không xóa robot hay kế hoạch khác.',
      () => true,
      { optional: true, planMutation: true });
    clickStep('#recipeDetails', 'Công thức hành động tái sử dụng', 'Ghép các hành động thành chu kỳ có thể thêm vào kế hoạch.',
      'Mở “Hiển thị từng hành động”. Thư viện công thức và danh sách hành động chi tiết sẽ mở rộng.');
    selectStep('#recipeCategory', 'Lọc nhóm công thức', 'Thu hẹp thư viện theo HIVE, FLOWER, tiếp tế hoặc phòng thủ.',
      'Chọn một nhóm khác “Tất cả nhóm”. Danh sách khối công thức sẽ lọc theo nhóm.');
    selectStep('#recipeRepeat', 'Chọn số chu kỳ', 'Lặp lại chu kỳ để lập kế hoạch nhiều lượt thu thập và ghi điểm.',
      'Chọn một số chu kỳ khác. Khi thêm công thức, số lần lặp này sẽ được dùng.');
    selectStep('#recipeQuantity', 'Chọn số bóng mỗi chu kỳ', 'Giới hạn lượng bóng dùng trong mỗi lượt của công thức.',
      'Chọn một số bóng khác. Giới hạn tối đa và lượng robot đang giữ vẫn được áp dụng.');
    selectStep('#recipeFlower', 'Chọn FLOWER mục tiêu', 'Chỉ định mục tiêu cho công thức có ghi điểm vào FLOWER.',
      'Chọn một FLOWER khác. Khối công thức phù hợp sẽ dùng mục tiêu này.');
    clickStep('#recipeLibrary .recipe-choice', 'Thêm công thức vào kế hoạch', 'Thư viện thêm cả chuỗi hành động thay vì yêu cầu tự tạo từng thẻ.',
      'Chọn một khối trong “Khối có thể tái sử dụng”. Chuỗi sẽ xuất hiện trong danh sách công thức robot.',
      () => $$('#recipeList .recipe-block').length > (stepBefore || 0),
      { capture: () => $$('#recipeList .recipe-block').length, planMutation: true });
    clickStep('.timing-settings summary', 'Cài đặt thời gian nâng cao', 'Điều chỉnh thời gian ước tính để thử các giả định di chuyển và ghi điểm.',
      'Mở mục cài đặt nâng cao. Các trường thu thập, bắn, di chuyển, nghiêng HIVE và sức chứa sẽ hiện ra.');
    add({
      target: '.timing-grid', event: 'change', title: 'Điều chỉnh thời gian mô phỏng',
      purpose: 'Tinh chỉnh cách trình lập kế hoạch ước lượng thời gian hành động.',
      instruction: 'Thay đổi một trường thời gian rồi xem phần tóm tắt. Giá trị chỉ là giả định lập kế hoạch, không phải số đo robot thật.',
      capture: () => JSON.stringify($$('.timing-grid input').map(element => element.value)),
      verify: (element, before, event) => event.target.matches('.timing-grid input') &&
        event.target.checkValidity() &&
        JSON.stringify($$('.timing-grid input').map(input => input.value)) !== before,
      planMutation: true
    });
    screenStep('help', 'Cách chơi và thuật ngữ', 'Tra cứu cách dùng Strategy, luật mô phỏng và thuật ngữ sân.',
      'Mở “Cách chơi”. Phần này có hướng dẫn FTC Blocks, thuật ngữ, phòng thủ và giới hạn mô phỏng.');
    clickStep('.file-bar [data-file-action="download"]', 'Tải kế hoạch robot', 'Xuất tệp JSON riêng cho từng robot đã chọn.',
      'Mở cửa sổ tải kế hoạch. Có thể chọn robot, thêm tiền tố tên tệp, rồi tải xuống; trong bài học này hãy đóng cửa sổ mà không cần tải tệp.',
      () => !!$('#strategyDownloadDialog') && $('#strategyDownloadDialog').open);
    clickStep('#downloadClose', 'Đóng cửa sổ tải kế hoạch', 'Đóng hộp thoại mà không thay đổi kế hoạch đang có.',
      'Nhấn “Đóng” để trở về trang. Việc chưa tải xuống không ảnh hưởng dữ liệu.');
    clickStep('.file-bar [data-file-action="library"]', 'Mở thư viện kế hoạch đã tải lên', 'Chọn tệp JSON trên thiết bị và nạp vào một robot cụ thể.',
      'Mở thư viện tệp. Bạn có thể xem tệp đã chọn, chọn robot nhận, thêm hoặc xóa tệp khỏi danh sách tạm của thẻ trình duyệt.',
      () => !!$('#strategyFileDialog') && $('#strategyFileDialog').open);
    clickStep('#fileClose', 'Đóng thư viện kế hoạch', 'Thoát thư viện mà không nạp hoặc xóa tệp.',
      'Nhấn “Đóng”. Tải tệp chỉ thay thế robot khi bạn chủ động chọn tệp và nhấn nạp.');
  }

  function robotStudioSteps() {
    studioStep('build', 'Lắp ráp và cấu hình robot', 'Thiết lập kiểu truyền động, kích thước, cơ cấu và cảm biến.',
      'Mở “Lắp robot”. Các điều chỉnh ở đây tác động đến mô phỏng robot FTC, không sửa kế hoạch Strategy.');
    selectStep('#driveTune', 'Điều chỉnh tốc độ robot', 'Các thanh trượt tinh chỉnh tốc độ di chuyển, xoay, bắn và hút/nhả trong mô phỏng.',
      'Thay đổi một thanh trượt. Giá trị phần trăm và chuyển động mô phỏng sẽ được cập nhật.',
      (element, before) => element.value !== before,
      { capture: element => element.value, mutatesRobot: true });
    selectStep('#motorSel', 'Chọn loại động cơ', 'Đặt loại động cơ truyền động dùng trong mô hình vật lý.',
      'Chọn một loại động cơ khác. Cấu hình động cơ được áp dụng cho mô phỏng hiện tại.',
      null, { mutatesRobot: true });
    selectStep('#wheelSel', 'Chọn kích thước bánh xe', 'Thay đổi thông số bánh xe để điều chỉnh chuyển động robot.',
      'Chọn kích thước khác trong danh sách. Kích thước sẽ được dùng trong mô phỏng.',
      null, { mutatesRobot: true });
    clickStep('#driveList button', 'Chọn hệ truyền động', 'Hệ truyền động xác định bố trí và kiểu chuyển động cơ bản của robot.',
      'Chọn một cấu hình trong danh sách. Hệ truyền động quyết định cách robot di chuyển trên sân FTC; bản xem trước và bản đồ phần cứng sẽ cập nhật.',
      () => true, { mutatesRobot: true });
    clickStep('#paintList button', 'Chọn màu khung robot', 'Tùy chỉnh màu hiển thị robot trên sân.',
      'Chọn một màu khung khác. Robot xem trước và sân dùng màu mới.',
      () => true, { optional: true, mutatesRobot: true });
    clickStep('#toolList .tool input[type="checkbox"]', 'Thêm hoặc bỏ cơ cấu', 'Cấu hình các cơ cấu mà chương trình có thể điều khiển.',
      'Bật hoặc tắt một cơ cấu. Bản đồ phần cứng và các kiểm tra cấu hình sẽ cập nhật.',
      () => true, { optional: true, mutatesRobot: true });
    clickStep('#sensorList .tool input[type="checkbox"]', 'Cấu hình cảm biến', 'Thêm cảm biến để chương trình có thể đọc dữ liệu.',
      'Bật hoặc tắt một cảm biến. Tên thiết bị, loại và cổng sẽ được phản ánh trong bản đồ phần cứng.',
      () => true, { optional: true, mutatesRobot: true });
    clickStep('#partList button', 'Chọn bộ phận robot', 'Chọn một bộ phận để xem và sắp xếp trên robot.',
      'Chọn một bộ phận trong danh sách hoặc nhấp vào bản xem trước. Bộ phận được chọn sẽ được đánh dấu.',
      () => true, { optional: true });
    clickStep('#btnTurnPart', 'Xoay bộ phận đã chọn', 'Điều chỉnh hướng đặt của bộ phận trên robot mô phỏng.',
      'Sau khi chọn bộ phận, nhấn “Xoay bộ phận đã chọn”. Hướng trong bản xem trước sẽ thay đổi.',
      () => true, { optional: true, mutatesRobot: true });
    clickStep('[data-vm="top"]', 'Góc nhìn trên robot', 'Đổi bản xem trước robot sang góc nhìn từ trên.',
      'Chọn “Góc nhìn trên”, rồi dùng lại “Góc nhìn 3D” để quay lại chế độ phối cảnh.');
    clickStep('#btnResetLayout', 'Đặt lại bố cục bộ phận', 'Đưa các bộ phận về bố cục mặc định.',
      'Nút này chỉ đặt lại vị trí các bộ phận; không xóa chương trình FTC hay kế hoạch Strategy.',
      () => true, { optional: true, mutatesRobot: true });
    clickStep('#presetList button', 'Chọn mẫu robot dựng sẵn', 'Nạp một cấu hình mẫu để bắt đầu nhanh, rồi tiếp tục điều chỉnh riêng.',
      'Chọn một mẫu robot để nạp nhanh hệ truyền động và cơ cấu mẫu. Đây là cấu hình dùng cho mô phỏng FTC; cấu hình ban đầu sẽ được khôi phục khi kết thúc hướng dẫn.',
      () => true, { mutatesRobot: true });
    studioStep('drive', 'Trạm điều khiển robot', 'Chạy OpMode và theo dõi sân, điểm, nhật ký cùng telemetry.',
      'Trạm điều khiển là nơi chọn OpMode, vị trí xuất phát và chạy chương trình. Khi robot hoạt động, hãy theo dõi sân FTC, đồng hồ, điểm, telemetry và nhật ký.');
    selectStep('#startSel', 'Chọn vị trí xuất phát', 'Chọn nơi robot bắt đầu khi chạy chương trình.',
      'Chọn một trong các vị trí xuất phát. Robot sẽ được đặt tại vị trí đó khi chạy OpMode hoặc đặt lại sân; hãy chọn vị trí phù hợp với kế hoạch của bạn.',
      null, { mutatesRobot: true });
    clickStep('#allianceBlue', 'Chọn liên minh cho robot FTC', 'Đổi màu liên minh robot trong mô phỏng FTC.',
      'Chọn Liên minh xanh. Có thể trở lại Liên minh đỏ bằng nút bên cạnh.',
      () => $('#allianceBlue').getAttribute('aria-pressed') === 'true',
      { optional: true, mutatesRobot: true });
    selectStep('#autoSel', 'Chọn OpMode Tự động', 'Chọn chương trình chạy tự động trên Trạm điều khiển.',
      'Chọn một chương trình trong danh sách Tự động. “Chạy mục đã chọn” chạy riêng OpMode đang chọn; khi chọn “Chạy cả trận”, OpMode Tự động chạy trước.',
      (element, before) => element.value !== before,
      { capture: element => element.value, mutatesRobot: true });
    selectStep('#teleSel', 'Chọn OpMode TeleOp', 'Chọn chương trình điều khiển robot bằng tay cầm.',
      'Chọn một chương trình trong danh sách TeleOp. Chương trình này đọc tay cầm để điều khiển robot; khi chạy cả trận, nó bắt đầu sau giai đoạn Tự động.',
      (element, before) => element.value !== before,
      { capture: element => element.value, mutatesRobot: true });
    clickStep('#robotApp .speed[data-s="2"]', 'Tốc độ mô phỏng robot', 'Tăng tốc vòng lặp mô phỏng để thử OpMode nhanh hơn.',
      'Chọn 2×. Trạng thái tốc độ sẽ được đánh dấu ở thanh điều khiển.',
      () => $$('#robotApp .speed').some(button => button.dataset.s === '2' && button.getAttribute('aria-pressed') === 'true'),
      { mutatesRobot: true });
    clickStep('#robotApp .gamepad', 'Điều khiển bằng tay cầm trên màn hình', 'Các nút mô phỏng tương ứng với nút trên gamepad1; tay cầm thật được nhận diện khi kết nối.',
      'Nhấn một nút trong bảng tay cầm. Khi TeleOp đang chạy, chương trình có thể đọc trạng thái nút và cần điều khiển.');
    clickStep('#btnRun', 'Chạy OpMode đã chọn', 'Chạy riêng chương trình Tự động hoặc TeleOp đang chọn để thử nhanh.',
      'Nhấn “Chạy mục đã chọn” để thử riêng OpMode đang chọn, không chạy toàn bộ trận. Theo dõi trạng thái và nhật ký; nhấn “Dừng” để kết thúc.',
      () => /đang chạy/i.test($('#dsStatus').textContent),
      { waitFor: true, timeout: 5000, mutatesRobot: true });
    clickStep('#btnStop', 'Dừng OpMode', 'Dừng chương trình đang chạy và ngắt các cơ cấu.',
      'Nhấn “Dừng”. Trạng thái chạy sẽ kết thúc và robot không còn nhận lệnh từ OpMode.',
      () => !/đang chạy/i.test($('#dsStatus').textContent));
    clickStep('#btnMatch', 'Chạy cả trận FTC', 'Chạy TỰ ĐỘNG, thời gian chuyển tiếp rồi đến TELEOP theo đồng hồ trận.',
      'Nhấn “Chạy cả trận”. Bạn có thể dừng ngay ở bước kế tiếp; Trạm điều khiển cũng cho phép chạy hết thời gian.',
      () => $('#dsStatus').textContent.indexOf('Người điều khiển, hãy rời tay khỏi nút bấm.') === 0,
      { waitFor: true, timeout: 5000, mutatesRobot: true });
    clickStep('#btnStop', 'Dừng trận FTC', 'Kết thúc lượt luyện tập sớm mà không xóa cấu hình hay chương trình.',
      'Nhấn “Dừng”. Muốn bắt đầu lại từ đầu sân, dùng riêng nút “Đặt lại sân”.',
      () => $('#dsStatus').textContent.indexOf('Đã dừng.') === 0);
    studioStep('learn', 'Điều khiển và lập trình', 'Tạo chương trình bằng các khối FTC Blocks hoặc viết OnBotJava.',
      'Tại đây tạo hoặc chọn OpMode, xem ví dụ và chuyển giữa FTC Blocks với OnBotJava. Chương trình dùng tên thiết bị đã cấu hình trong mục Lắp robot.');
    clickStep('#btnExamples', 'Xem chương trình ví dụ', 'Nạp chương trình mẫu để học cấu trúc mà không phải bắt đầu từ trang trắng.',
      'Mở “Ví dụ”. Bảng sẽ cho biết ngôn ngữ, chế độ và mô tả của từng chương trình.',
      () => !$('#exPanel').hidden);
    clickStep('#btnNewBlocks', 'Tạo FTC Blocks mới', 'Tạo một OpMode Blocks mới để bắt đầu xếp lệnh.',
      'Nhấn “OpMode Blocks mới” để tạo chương trình dạng khối. Chọn loại Tự động hoặc TeleOp ở phần thông tin chương trình; sau đó mở tab FTC Blocks để ghép lệnh. Chương trình tạm sẽ được khôi phục khi kết thúc hướng dẫn.',
      () => $('#filePath').textContent.indexOf('FTC Blocks') === 0,
      { mutatesRobot: true });
    add({
      target: '#progName', event: 'input', title: 'Đặt tên OpMode',
      purpose: 'Tên giúp bạn nhận biết chương trình trong danh sách và lựa chọn chạy.',
      instruction: 'Nhập một tên ngắn cho OpMode mới. Tên sẽ xuất hiện trong danh sách chương trình.',
      verify: element => element.value.trim().length > 0,
      mutatesRobot: true
    });
    selectStep('#modeSel', 'Chọn Tự động hoặc TeleOp', 'Xác định chương trình chạy tự động hay khi người chơi điều khiển.',
      'Đổi chế độ trong danh sách. Danh sách chọn OpMode Tự động/TeleOp sẽ cập nhật theo loại chương trình.',
      null, { mutatesRobot: true });
    add({
      target: '#progGroup', event: 'input', title: 'Nhóm OpMode',
      purpose: 'Nhóm giúp sắp xếp các chương trình có liên quan.',
      instruction: 'Nhập hoặc chọn tên nhóm. Nhấn Enter hoặc rời khỏi ô để lưu nhóm.',
      verify: element => element.value.trim().length > 0,
      mutatesRobot: true
    });
    add({
      target: '#progDesc', event: 'input', title: 'Mô tả chương trình',
      purpose: 'Mô tả giúp bạn nhớ chương trình làm gì trong danh sách.',
      instruction: 'Nhập một mô tả ngắn. Nội dung sẽ xuất hiện cạnh tên OpMode.',
      verify: element => element.value.length > 0,
      mutatesRobot: true
    });
    clickStep('#tabBlocks', 'Mở FTC Blocks', 'FTC Blocks cho phép ghép lệnh bằng các khối trực quan.',
      'Chọn FTC Blocks để mở vùng làm việc. Chọn nhóm lệnh ở cạnh vùng này, kéo khối vào canvas rồi nối khối theo thứ tự thực hiện.');
    blockCategoryStep('OpMode tuyến tính', 'Khối OpMode tuyến tính', 'Nhóm này chứa điểm bắt đầu chương trình, chờ START, vòng lặp hoạt động và thời gian.',
      'Mở nhóm này để tìm các khối khung chương trình. Một OpMode thường khởi tạo thiết bị, chờ START, chạy lệnh khi chương trình còn hoạt động rồi kết thúc an toàn.');
    blockCategoryStep('Tay cầm', 'Khối tay cầm', 'Đọc cần analog và các nút trên gamepad1 hoặc gamepad2.',
      'Mở nhóm “Tay cầm” để xem khối đọc cần và nút. Trong TeleOp, đưa giá trị đọc được vào điều kiện hoặc lệnh động cơ để robot phản hồi thao tác người lái.');
    blockCategoryStep('Bộ chấp hành', 'Khối bộ chấp hành', 'Gửi lệnh đến động cơ và servo đã cấu hình trong Lắp robot.',
      'Mở nhóm này để điều khiển thiết bị đã cấu hình và đặt tên trong Lắp robot. Chọn nhóm con Động cơ DcMotor hoặc Servo để tìm lệnh tương ứng.');
    blockCategoryStep('Động cơ DcMotor', 'Khối động cơ DcMotor', 'Điều khiển công suất, chiều quay, encoder và chế độ chạy động cơ.',
      'Mở nhóm con “Động cơ DcMotor” để xem lệnh đặt và đọc thuộc tính động cơ.');
    blockCategoryStep('Servo', 'Khối Servo', 'Đặt hoặc đọc vị trí servo trong khoảng giá trị hỗ trợ.',
      'Mở nhóm con “Servo” để xem các khối dành cho cơ cấu servo.');
    blockCategoryStep('Cảm biến', 'Khối cảm biến', 'Đọc IMU hoặc cảm biến khoảng cách và đặt lại hướng IMU.',
      'Mở nhóm “Cảm biến” để xem khối đọc dữ liệu cảm biến.');
    blockCategoryStep('Thị giác máy tính', 'Khối thị giác máy tính', 'Các lệnh AprilTag cung cấp khả năng nhìn thấy tag, số lượng, khoảng cách và góc.',
      'Mở nhóm “Thị giác máy tính”, sau đó mở nhóm con AprilTag.');
    blockCategoryStep('AprilTag', 'Khối AprilTag', 'Đọc ID, khoảng cách, góc phương vị và số lượng tag quan sát được.',
      'Mở nhóm con “AprilTag” để xem các lệnh thị giác máy tính.');
    blockCategoryStep('Tiện ích', 'Khối tiện ích', 'Nhóm chứa các công cụ hỗ trợ như telemetry.',
      'Mở nhóm “Tiện ích”, sau đó mở nhóm con Telemetry.');
    blockCategoryStep('Telemetry', 'Khối Telemetry', 'Gửi số và văn bản đến Trạm điều khiển để theo dõi khi OpMode chạy.',
      'Mở nhóm con “Telemetry” để xem các khối thêm dữ liệu và cập nhật bảng telemetry.');
    blockCategoryStep('Điều kiện logic', 'Khối điều kiện logic', 'Dùng if, so sánh và phép logic để robot chọn hành động theo dữ liệu.',
      'Mở nhóm “Điều kiện logic” để xem các khối rẽ nhánh và điều kiện.');
    blockCategoryStep('Vòng lặp', 'Khối vòng lặp', 'Lặp lại thao tác theo số lần hoặc trong khi điều kiện còn đúng.',
      'Mở nhóm “Vòng lặp” để xem các khối lặp và dừng vòng lặp.');
    blockCategoryStep('Toán học', 'Khối toán học', 'Tính toán, giới hạn giá trị, làm tròn và lấy phần dư.',
      'Mở nhóm “Toán học” để xem các phép toán có thể nối vào khối điều khiển.');
    blockCategoryStep('Văn bản', 'Khối văn bản', 'Tạo văn bản để hiển thị lên telemetry hoặc dùng trong chương trình.',
      'Mở nhóm “Văn bản” để xem khối tạo chuỗi.');
    blockCategoryStep('Biến', 'Khối biến', 'Lưu giá trị để dùng lại trong các bước và vòng lặp của chương trình.',
      'Mở nhóm “Biến” để xem cách tạo và sử dụng biến.');
    blockCategoryStep('OpMode tuyến tính', 'Thêm khối đầu tiên', 'Khối từ flyout được kéo vào vùng làm việc rồi nối theo thứ tự thực thi.',
      'Mở lại “OpMode tuyến tính” để chọn một khối mẫu trong bước tiếp theo.');
    clickStep('#blocksRoot .blocklyFlyout .blocklyDraggable', 'Thêm khối vào chương trình', 'Khối được kéo từ ngăn công cụ vào vùng làm việc để tạo lệnh thật.',
      'Chọn hoặc kéo một khối từ ngăn công cụ. Số khối trong chương trình sẽ tăng; các thay đổi này sẽ được hoàn tác khi kết thúc tour.',
      () => blockCount() > (stepBefore || 0),
      { capture: () => blockCount(), mutatesRobot: true, waitFor: true, timeout: 3000 });
    clickStep('#btnViewJava', 'Xem Java được tạo', 'Kiểm tra mã Java tương ứng mà không rời khỏi FTC Blocks.',
      'Nhấn “Xem mã Java được tạo từ các khối”. Khung mã chỉ để xem và đối chiếu cách các khối được chuyển thành mã; quay lại FTC Blocks để tiếp tục chỉnh sửa bằng khối.',
      () => !$('#genJava').hidden);
    clickStep('#tabJava', 'Chuyển sang OnBotJava', 'OnBotJava là lựa chọn nhập mã trực tiếp thay vì xếp khối.',
      'Chọn tab OnBotJava. Trình soạn thảo văn bản sẽ hiện ra; tab Blocks giúp quay lại các khối.');
    clickStep('#tabBlocks', 'Quay lại FTC Blocks', 'Trở lại trình chỉnh sửa khối đã tạo.',
      'Chọn FTC Blocks. Các khối vừa thêm vẫn còn trong chương trình tạm.');
    clickStep('#btnToJava', 'Chép Blocks sang Java', 'Tạo một OpMode Java mới từ các khối hiện tại để tiếp tục chỉnh sửa bằng mã.',
      'Nhấn “Chép Blocks sang Java”. Một mục Java mới sẽ được tạo; tour sẽ khôi phục danh sách chương trình gốc khi kết thúc.',
      () => $('#filePath').textContent.indexOf('TeamCode') === 0,
      { mutatesRobot: true });
    clickStep('#btnDelete', 'Xóa OpMode đã chọn', 'Xóa một OpMode không cần nữa; xác nhận hai lần để tránh xóa nhầm.',
      'Vì đang chọn OpMode Java tạm, nhấn nút một lần để xác nhận ý định. Ở bước tiếp theo, nhấn lần nữa để xóa đúng mục tạm.');
    clickStep('#btnDelete', 'Xác nhận xóa OpMode tạm', 'Lần nhấn thứ hai xác nhận xóa OpMode đang chọn.',
      'Nhấn “Nhấn lần nữa để xóa”. Chương trình tạm sẽ biến mất khỏi danh sách; dữ liệu trước tour được khôi phục khi kết thúc.',
      () => $('#btnDelete').textContent === 'Xóa mục đã chọn',
      { mutatesRobot: true });
    studioStep('manual', 'Trợ giúp FTC', 'Tra cứu cấu hình robot, cách chạy OpMode và các phím điều khiển.',
      'Mở “Trợ giúp” trong Xưởng robot FTC. Phần này giải thích riêng cách dùng trạm và mô phỏng.');
  }

  function blockCount() {
    const workspace = root.Blockly && root.Blockly.getMainWorkspace && root.Blockly.getMainWorkspace();
    return workspace ? workspace.getAllBlocks(false).length : 0;
  }

  function toolboxRow(label) {
    const categoryLabel = $$('#blocksRoot .blocklyToolboxCategoryLabel')
      .find(element => element.textContent.trim() === label);
    const row = categoryLabel && categoryLabel.closest('.blocklyToolboxCategoryContainer[role="treeitem"]');
    return row && row.getBoundingClientRect().width > 0 ? row : null;
  }

  function blockCategoryStep(label, title, purpose, instruction) {
    clickStep(() => toolboxRow(label), title, purpose, instruction,
      row => row.getAttribute('aria-selected') === 'true');
  }

  strategySteps();
  robotStudioSteps();

  const coreStepRoutes = [
    ['Strategy · sân mô phỏng chiến thuật', { screen: 'watch', studio: 'drive', fieldMode: 'strategy', camera: 'viewAngled' }],
    ['Chọn chế độ trận đấu', { screen: 'watch', studio: 'drive', fieldMode: 'strategy', camera: 'viewAngled' }],
    ['Chọn liên minh của bạn', { screen: 'watch', studio: 'drive', fieldMode: 'strategy' }],
    ['Tạo trận mẫu', { screen: 'watch', studio: 'drive', fieldMode: 'strategy' }],
    ['Chạy kế hoạch', { screen: 'watch', studio: 'drive', fieldMode: 'strategy' }],
    ['Bảng điểm chi tiết', { screen: 'scores' }],
    ['Mở Strategy', { screen: 'edit' }],
    ['Thêm một hành động Strategy', { screen: 'edit' }],
    ['FTC Blocks · sân mô phỏng robot', { screen: 'watch', studio: 'learn', fieldMode: 'ftc', blocks: true }],
    ['Lắp ráp và cấu hình robot', { screen: 'watch', studio: 'build', fieldMode: 'ftc' }],
    ['Chọn mẫu robot dựng sẵn', { screen: 'watch', studio: 'build' }],
    ['Trạm điều khiển robot', { screen: 'watch', studio: 'drive', fieldMode: 'ftc' }],
    ['Chọn vị trí xuất phát', { screen: 'watch', studio: 'drive' }],
    ['Chọn OpMode Tự động', { screen: 'watch', studio: 'drive' }],
    ['Chọn OpMode TeleOp', { screen: 'watch', studio: 'drive' }],
    ['Chạy OpMode đã chọn', { screen: 'watch', studio: 'drive' }],
    ['Dừng OpMode', { screen: 'watch', studio: 'drive' }],
    ['Điều khiển và lập trình', { screen: 'watch', studio: 'learn' }],
    ['Tạo FTC Blocks mới', { screen: 'watch', studio: 'learn' }],
    ['Mở FTC Blocks', { screen: 'watch', studio: 'learn' }],
    ['Khối OpMode tuyến tính', { screen: 'watch', studio: 'learn', blocks: true }],
    ['Khối bộ chấp hành', { screen: 'watch', studio: 'learn', blocks: true }],
    ['Khối tay cầm', { screen: 'watch', studio: 'learn', blocks: true }],
    ['Xem Java được tạo', { screen: 'watch', studio: 'learn', blocks: true }],
    ['Trợ giúp FTC', { screen: 'watch', studio: 'manual' }]
  ];
  const stepsByTitle = new Map(steps.map(step => [step.title, step]));
  const coreSteps = coreStepRoutes.map(([title, route]) => {
    const step = stepsByTitle.get(title);
    if (!step) {
      console.error('Không tìm thấy bước hướng dẫn cốt lõi:', title);
      return null;
    }
    step.route = route;
    return step;
  }).filter(Boolean);
  steps.splice(0, steps.length, ...coreSteps);

  const welcome = document.createElement('dialog');
  welcome.className = 'guide-welcome';
  welcome.setAttribute('aria-labelledby', 'guideWelcomeTitle');
  welcome.innerHTML =
    '<div class="guide-welcome-row"><svg class="guide-welcome-bee" aria-hidden="true" viewBox="0 0 100 100"><use href="#i-bee"></use></svg>' +
    '<div><p class="studio-kicker">FTC BIOBUZZ · NGƯỜI BẠN ĐỒNG HÀNH</p><h1 id="guideWelcomeTitle">Bạn đã biết cách sử dụng trang web chưa?</h1>' +
    '<p>Xin chào! Mình sẽ cùng bạn khám phá Strategy, sân mô phỏng và FTC Blocks từng bước.</p></div></div>' +
    '<div class="guide-welcome-actions"><button type="button" class="btn" id="guideKnownBtn">Đã biết sử dụng</button>' +
    '<button type="button" class="btn guide-primary" id="guideStartBtn">Chưa biết · bắt đầu hướng dẫn</button></div>';
  document.body.appendChild(welcome);

  const spotlight = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  spotlight.classList.add('guide-spotlight');
  spotlight.setAttribute('aria-hidden', 'true');
  spotlight.hidden = true;
  const shade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  spotlight.appendChild(shade);
  document.body.appendChild(spotlight);

  const card = document.createElement('section');
  card.className = 'guide-card';
  card.hidden = true;
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'Hướng dẫn sử dụng tương tác');
  card.innerHTML =
    '<div class="guide-card-head"><svg class="guide-bee" aria-hidden="true" viewBox="0 0 100 100"><use href="#i-bee"></use></svg><h2 id="guideTitle"></h2></div>' +
    '<p class="guide-progress-label" id="guideProgressLabel"></p><div class="guide-progress" role="progressbar" aria-label="Tiến độ hướng dẫn" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>' +
    '<p class="guide-step-copy" id="guidePurpose"></p><p class="guide-instruction" id="guideInstruction"></p>' +
    '<p class="guide-result" id="guideResult" role="status" aria-live="polite"></p>' +
    '<div class="guide-controls"><button type="button" class="btn" id="guidePrevious">← Quay lại</button>' +
    '<div class="guide-controls-main"><button type="button" class="btn" id="guideSkipStep">Bỏ qua bước</button>' +
    '<button type="button" class="btn guide-primary" id="guideNext" disabled>Tiếp theo →</button></div></div>';
  document.body.appendChild(card);

  const skipAll = document.createElement('button');
  skipAll.type = 'button';
  skipAll.className = 'btn guide-skip-tour';
  skipAll.textContent = 'Bỏ qua hướng dẫn';
  skipAll.hidden = true;
  document.body.appendChild(skipAll);

  function hideGuideUi() {
    [spotlight, card, skipAll].forEach(element => {
      element.hidden = true;
      element.style.setProperty('display', 'none', 'important');
    });
  }

  function showGuideUi() {
    [spotlight, card, skipAll].forEach(element => {
      element.style.removeProperty('display');
      element.hidden = false;
    });
  }

  function setPreference(value) {
    try {
      root.localStorage.setItem(GUIDE_CHOICE_KEY, value);
    } catch (error) {
      console.warn('Không thể ghi nhớ lựa chọn hướng dẫn trong bộ nhớ trình duyệt.', error);
      try { root.sessionStorage.setItem(GUIDE_CHOICE_KEY, value); } catch (sessionError) {
        console.warn('Không thể lưu lựa chọn hướng dẫn trong phiên hiện tại.', sessionError);
      }
    }
  }

  function getPreference() {
    try { return root.localStorage.getItem(GUIDE_CHOICE_KEY) || root.sessionStorage.getItem(GUIDE_CHOICE_KEY); }
    catch (error) {
      console.warn('Không thể đọc lựa chọn hướng dẫn trong bộ nhớ trình duyệt.', error);
      try { return root.sessionStorage.getItem(GUIDE_CHOICE_KEY); } catch (sessionError) {
        console.warn('Không thể đọc lựa chọn hướng dẫn trong phiên hiện tại.', sessionError);
        return null;
      }
    }
  }

  function recoveryState() {
    return {
      strategy: strategySnapshot,
      finished: tourFinished,
      hash: originalHash,
      studioView: originalStudioView,
      strategyScreen: originalStrategyScreen,
      fieldMode: originalFieldMode,
      camera: originalCamera,
      robotState: robotStateSnapshot
    };
  }

  function begin() {
    try {
      strategySnapshot = JSON.parse(JSON.stringify(root.BBUI.exportStrategy()));
    } catch (error) {
      console.error('Không thể lưu trạng thái Strategy trước khi bắt đầu hướng dẫn.', error);
      window.alert('Chưa thể bắt đầu hướng dẫn vì kế hoạch đang được tính. Hãy đợi một chút rồi thử lại.');
      return;
    }
    try {
      robotStateSnapshot = root.localStorage.getItem(ROBOT_STATE_KEY);
      canRestoreReload = true;
    } catch (error) {
      console.warn('Không thể tạo bản khôi phục FTC cho hướng dẫn.', error);
      robotStateSnapshot = null;
      canRestoreReload = false;
    }
    originalHash = root.location.hash;
    originalStudioView = document.body.dataset.studioView || 'drive';
    const activeScreen = $('.workspace-nav [aria-pressed="true"]');
    originalStrategyScreen = activeScreen ? activeScreen.dataset.screen : 'watch';
    originalFieldMode = document.body.dataset.fieldMode || 'ftc';
    const activeCamera = originalFieldMode === 'strategy' ? $('.view-controls [aria-pressed="true"]') : null;
    originalCamera = activeCamera ? activeCamera.id : '';
    if (canRestoreReload) {
      try { root.sessionStorage.setItem(GUIDE_RETURN_KEY, JSON.stringify(recoveryState())); }
      catch (error) {
        console.warn('Không thể lưu bản khôi phục hướng dẫn trong phiên.', error);
        canRestoreReload = false;
      }
    }
    completed.clear();
    visited.clear();
    tourFinished = false;
    index = 0;
    setPreference('in-progress');
    welcome.close();
    showGuideUi();
    document.documentElement.classList.add('guide-instant');
    const watchButton = $('.workspace-nav [data-screen="watch"]');
    if (watchButton) watchButton.click();
    const driveButton = $('.studio-tabs [data-view="drive"]');
    if (driveButton) driveButton.click();
    const ftcButton = $('#watchPanel [data-field-mode="ftc"]');
    if (ftcButton && document.body.dataset.fieldMode !== 'ftc') ftcButton.click();
    active = true;
    document.body.classList.add('guide-active');
    renderStep();
  }

  function resolveTarget(step) {
    if (!step) return null;
    if (typeof step.target === 'function') return step.target();
    return $(step.target);
  }

  function navigateForStep(step) {
    const route = step.route;
    if (!route) return;
    navigating = true;
    try {
      const screenButton = $('.workspace-nav [data-screen="' + route.screen + '"]');
      if (screenButton && screenButton.getAttribute('aria-pressed') !== 'true' && root.BBEase) {
        root.BBEase.screen(route.screen, true);
      }
      if (route.studio && document.body.dataset.studioView !== route.studio) {
        const studioButton = $('.studio-tabs [data-view="' + route.studio + '"]');
        if (studioButton) studioButton.click();
      }
      if (route.fieldMode) {
        const fieldButton = $('#watchPanel [data-field-mode="' + route.fieldMode + '"]');
        if (fieldButton && document.body.dataset.fieldMode !== route.fieldMode) fieldButton.click();
      }
      if (route.camera) {
        const cameraButton = $('#' + route.camera);
        if (cameraButton) cameraButton.click();
      }
      if (route.blocks && $('#tabBlocks')) $('#tabBlocks').click();
    } finally {
      navigating = false;
    }
  }

  function detachHighlight() {
    if (highlighted) highlighted.classList.remove('guide-target');
    highlighted = null;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
  }

  function moveCardToTopLayer() {
    const modal = $$('dialog[open]').filter(dialog => dialog !== welcome).pop();
    if (modal) {
      if (!modal.contains(card)) modal.appendChild(card);
      if (!modal.contains(skipAll)) modal.appendChild(skipAll);
    } else {
      if (card.parentElement !== document.body) document.body.appendChild(card);
      if (skipAll.parentElement !== document.body) document.body.appendChild(skipAll);
    }
  }

  function updateGeometry() {
    if (!active) return;
    moveCardToTopLayer();
    const bounds = target && target.getBoundingClientRect();
    const visible = bounds && bounds.width > 0 && bounds.height > 0;
    const width = root.innerWidth;
    const height = root.innerHeight;
    spotlight.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    if (visible && !target.closest('dialog[open]')) {
      const pad = 8;
      const left = Math.max(0, bounds.left - pad);
      const top = Math.max(0, bounds.top - pad);
      const right = Math.min(width, bounds.right + pad);
      const bottom = Math.min(height, bounds.bottom + pad);
      shade.setAttribute('d', 'M0 0H' + width + 'V' + height + 'H0Z M' + left + ' ' + top +
        'H' + right + 'V' + bottom + 'H' + left + 'Z');
      placeCard(bounds, width, height);
    } else {
      shade.setAttribute('d', 'M0 0H' + width + 'V' + height + 'H0Z');
      const cardRect = card.getBoundingClientRect();
      card.style.left = Math.max(12, (width - cardRect.width) / 2) + 'px';
      card.style.top = Math.max(12, (height - cardRect.height) / 2) + 'px';
    }
  }

  function placeCard(bounds, viewportWidth, viewportHeight) {
    const rect = card.getBoundingClientRect();
    const margin = 12;
    const gap = 20;
    const candidates = [
      { left: bounds.right + gap, top: bounds.top + (bounds.height - rect.height) / 2 },
      { left: bounds.left - rect.width - gap, top: bounds.top + (bounds.height - rect.height) / 2 },
      { left: bounds.left + (bounds.width - rect.width) / 2, top: bounds.bottom + gap },
      { left: bounds.left + (bounds.width - rect.width) / 2, top: bounds.top - rect.height - gap }
    ];
    let best = null;
    candidates.forEach(candidate => {
      const left = Math.max(margin, Math.min(viewportWidth - rect.width - margin, candidate.left));
      const top = Math.max(margin, Math.min(viewportHeight - rect.height - margin, candidate.top));
      const overlaps = left < bounds.right && left + rect.width > bounds.left &&
        top < bounds.bottom && top + rect.height > bounds.top;
      const distance = Math.abs(left - candidate.left) + Math.abs(top - candidate.top) + (overlaps ? 10000 : 0);
      if (!best || distance < best.distance) best = { left, top, distance };
    });
    card.style.left = best.left + 'px';
    card.style.top = best.top + 'px';
  }

  function renderStep() {
    if (!active) return;
    if (index >= steps.length) {
      finishTour(true);
      return;
    }
    clearTimeout(waitTimer);
    detachHighlight();
    visited.add(index);
    const step = steps[index];
    navigateForStep(step);
    target = resolveTarget(step);
    $('#guideTitle', card).textContent = step.title;
    $('#guidePurpose', card).textContent = step.purpose;
    $('#guideInstruction', card).textContent = step.instruction +
      ' Bạn có thể bấm “Tiếp theo” bất cứ lúc nào.';
    const progress = Math.round(visited.size / steps.length * 100);
    $('#guideProgressLabel', card).textContent = 'Bước ' + (index + 1) + '/' + steps.length +
      ' · Đã xem ' + progress + '%';
    $('.guide-progress span', card).style.width = progress + '%';
    $('.guide-progress', card).setAttribute('aria-valuenow', String(progress));
    $('#guidePrevious', card).disabled = index === 0;
    $('#guideSkipStep', card).hidden = !step.optional;
    const next = $('#guideNext', card);
    next.disabled = false;
    next.textContent = index === steps.length - 1 ? 'Hoàn thành ✓' : 'Tiếp theo →';
    const result = $('#guideResult', card);
    result.textContent = completed.has(index) ? step.done : '';
    result.dataset.state = completed.has(index) ? 'done' : 'waiting';
    if ((step.mutatesRobot || step.planMutation) && !canRestoreReload) {
      result.textContent = 'Bộ nhớ an toàn không khả dụng. Hãy bỏ qua bước này để không thay đổi dữ liệu đã lưu.';
      result.dataset.state = 'waiting';
    }
    if (!target || target.hidden || target.closest('[hidden]')) {
      result.textContent = 'Không tìm thấy mục này trên màn hình hiện tại. Hãy bỏ qua bước hoặc quay lại mục trước.';
      result.dataset.state = 'waiting';
      $('#guideSkipStep', card).hidden = false;
      card.hidden = false;
      spotlight.hidden = false;
      updateGeometry();
      return;
    }
    card.hidden = false;
    spotlight.hidden = false;
    ensureTargetVisible();
    target.classList.add('guide-target');
    highlighted = target;
    if (root.ResizeObserver) {
      resizeObserver = new ResizeObserver(updateGeometry);
      resizeObserver.observe(target);
    }
    updateGeometry();
    requestAnimationFrame(updateGeometry);
    if (!completed.has(index)) {
      stepBefore = typeof step.capture === 'function' ? step.capture(target) : null;
    }
  }

  function eventIsInsideTarget(event) {
    if (!target) return false;
    return event.target === target || target.contains(event.target);
  }

  function completeCurrentStep() {
    if (!active || completed.has(index)) return;
    const step = steps[index];
    completed.add(index);
    $('#guideNext', card).disabled = false;
    $('#guideResult', card).textContent = step.done;
    $('#guideResult', card).dataset.state = 'done';
    const progress = Math.round(visited.size / steps.length * 100);
    $('#guideProgressLabel', card).textContent = 'Bước ' + (index + 1) + '/' + steps.length +
      ' · Đã xem ' + progress + '%';
    $('.guide-progress span', card).style.width = progress + '%';
    $('.guide-progress', card).setAttribute('aria-valuenow', String(progress));
  }

  function verifyEvent(event) {
    if (!active || completed.has(index) || !eventIsInsideTarget(event)) return;
    const step = steps[index];
    if (step.event !== event.type) return;
    if (step.mutatesRobot || step.planMutation) {
      if (!canRestoreReload) {
        event.preventDefault();
        event.stopImmediatePropagation();
        $('#guideResult', card).textContent = 'Không thể thực hiện bước này khi bộ nhớ an toàn không khả dụng. Hãy bỏ qua bước.';
        return;
      }
      needsRestoreReload = true;
    }
    const capture = stepBefore;
    const check = () => {
      if (!active || steps[index] !== step) return;
      let valid = false;
      try { valid = typeof step.verify !== 'function' || step.verify(target, capture, event); }
      catch (error) {
        console.error('Không thể kiểm tra thao tác hướng dẫn.', error);
        $('#guideResult', card).textContent = 'Chưa thể kiểm tra thao tác. Hãy thử lại hoặc bỏ qua bước.';
        return;
      }
      if (valid) {
        completeCurrentStep();
        return;
      }
      const elapsed = Date.now() - startedAt;
      if (step.waitFor && elapsed < (step.timeout || 5000)) {
        waitTimer = setTimeout(check, 120);
      } else {
        $('#guideResult', card).textContent = step.hint || 'Chưa thấy kết quả mong đợi. Hãy thử lại đúng mục đang phát sáng.';
        $('#guideResult', card).dataset.state = 'waiting';
      }
    };
    const startedAt = Date.now();
    setTimeout(check, 70);
  }

  function startAtCurrent() {
    if (!active) return;
    if (target && !target.closest('dialog[open]')) ensureTargetVisible();
    requestAnimationFrame(updateGeometry);
  }

  function ensureTargetVisible() {
    if (!target || target.closest('dialog[open]')) return;
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    const bounds = target.getBoundingClientRect();
    const margin = 20;
    if (bounds.top < margin) root.scrollBy(0, bounds.top - margin);
    else if (bounds.bottom > root.innerHeight - margin) {
      root.scrollBy(0, bounds.bottom - root.innerHeight + margin);
    }
  }

  function restoreStrategy() {
    if (!strategySnapshot) return;
    try {
      root.BBUI.importStrategy(strategySnapshot, { view: false });
    } catch (error) {
      console.error('Không thể khôi phục kế hoạch sau hướng dẫn.', error);
      const status = $('#status');
      if (status) {
        status.textContent = 'Chưa khôi phục được kế hoạch mẫu sau hướng dẫn. Hãy kiểm tra bảng điều khiển trình duyệt.';
        status.classList.add('is-warn');
      }
    }
  }

  function restoreNavigation() {
    const screenButton = $('.workspace-nav [data-screen="' + originalStrategyScreen + '"]');
    if (screenButton) screenButton.click();
    const viewButton = $('.studio-tabs [data-view="' + originalStudioView + '"]');
    if (viewButton) viewButton.click();
    if (originalCamera) {
      const cameraButton = $('#' + originalCamera);
      if (cameraButton) cameraButton.click();
    }
    const modeButton = $('#watchPanel [data-field-mode="' + originalFieldMode + '"]');
    if (modeButton) modeButton.click();
    if (originalHash) {
      try { root.history.replaceState(null, '', root.location.pathname + root.location.search + originalHash); }
      catch (error) { console.warn('Không thể khôi phục địa chỉ trang ban đầu.', error); }
    }
  }

  function restoreRobotStateAndReload() {
    if (!needsRestoreReload || !canRestoreReload) return false;
    try {
      root.sessionStorage.setItem(GUIDE_RETURN_KEY, JSON.stringify(recoveryState()));
      if (robotStateSnapshot === null) root.localStorage.removeItem(ROBOT_STATE_KEY);
      else root.localStorage.setItem(ROBOT_STATE_KEY, robotStateSnapshot);
      const nextHash = originalHash || '#' + originalStudioView;
      root.history.replaceState(null, '', root.location.pathname + root.location.search + nextHash);
      setTimeout(() => root.location.reload(), 2600);
      return true;
    } catch (error) {
      console.error('Không thể khôi phục cấu hình FTC sau hướng dẫn.', error);
      try { root.sessionStorage.removeItem(GUIDE_RETURN_KEY); } catch (cleanupError) {
        console.warn('Không thể xóa trạng thái khôi phục hướng dẫn.', cleanupError);
      }
      return false;
    }
  }

  function finishTour(isComplete) {
    if (!active) return;
    clearTimeout(waitTimer);
    tourFinished = isComplete;
    active = false;
    const stationStatus = $('#dsStatus');
    const stopButton = $('#btnStop');
    if (stationStatus && stopButton && /đang chạy|người điều khiển|tự động:/.test(stationStatus.textContent.toLowerCase())) {
      stopButton.click();
    }
    detachHighlight();
    $$('.guide-target').forEach(element => element.classList.remove('guide-target'));
    target = null;
    document.body.classList.remove('guide-active');
    document.documentElement.classList.remove('guide-instant');
    hideGuideUi();
    welcome.close();
    card.style.removeProperty('left');
    card.style.removeProperty('top');
    const didReload = restoreRobotStateAndReload();
    if (!didReload) {
      restoreStrategy();
      restoreNavigation();
      try { root.sessionStorage.removeItem(GUIDE_RETURN_KEY); }
      catch (error) { console.warn('Không thể xóa bản khôi phục hướng dẫn đã dùng.', error); }
    }
    setPreference(isComplete ? 'done' : 'skipped');
    if (isComplete) {
      welcome.classList.add('guide-congrats');
      welcome.innerHTML =
        '<div class="guide-finish"><svg class="guide-finish-bee" aria-hidden="true" viewBox="0 0 100 100"><use href="#i-bee"></use></svg>' +
        '<p class="guide-finish-badge">Đã hoàn thành hành trình</p><h1 id="guideWelcomeTitle">Chúc mừng!</h1>' +
        '<p class="guide-finish-copy">Bạn đã khám phá Strategy, sân mô phỏng và FTC Blocks. Giờ hãy tự tin bắt đầu kế hoạch của đội mình nhé!</p>' +
        '<button type="button" class="btn guide-primary" id="guideDoneBtn">Tiếp tục khám phá</button></div>';
      $('#guideDoneBtn', welcome).addEventListener('click', () => welcome.close());
      welcome.showModal();
    }
    if (didReload) return;
  }

  function restoreAfterReload() {
    let raw = null;
    try {
      raw = root.sessionStorage.getItem(GUIDE_RETURN_KEY);
    } catch (error) {
      console.warn('Không thể đọc trạng thái khôi phục hướng dẫn.', error);
      return;
    }
    if (!raw || raw === 'ready') return;
    try {
      const state = JSON.parse(raw);
      root.sessionStorage.removeItem(GUIDE_RETURN_KEY);
      originalHash = state.hash || '';
      originalStudioView = state.studioView || 'drive';
      originalStrategyScreen = state.strategyScreen || 'watch';
      originalFieldMode = state.fieldMode || 'ftc';
      originalCamera = state.camera || '';
      if (state.robotState === null) root.localStorage.removeItem(ROBOT_STATE_KEY);
      else if (typeof state.robotState === 'string') root.localStorage.setItem(ROBOT_STATE_KEY, state.robotState);
      if (state.strategy && root.BBUI) root.BBUI.importStrategy(state.strategy, { view: false });
      restoreNavigation();
    } catch (error) {
      console.error('Không thể khôi phục kế hoạch sau khi tải lại trang.', error);
      const status = $('#status');
      if (status) {
        status.textContent = 'Không thể tự khôi phục kế hoạch sau hướng dẫn. Hãy kiểm tra bảng điều khiển trình duyệt.';
        status.classList.add('is-warn');
      }
    }
  }

  function wire() {
    $('#guideKnownBtn').addEventListener('click', () => {
      setPreference('known');
      welcome.close();
    });
    $('#guideStartBtn').addEventListener('click', begin);
    $('#openGuideBtn').addEventListener('click', () => {
      welcome.classList.remove('guide-congrats');
      welcome.innerHTML =
        '<div class="guide-welcome-row"><svg class="guide-welcome-bee" aria-hidden="true" viewBox="0 0 100 100"><use href="#i-bee"></use></svg>' +
        '<div><p class="studio-kicker">FTC BIOBUZZ · NGƯỜI BẠN ĐỒNG HÀNH</p><h1 id="guideWelcomeTitle">Mở lại hướng dẫn sử dụng?</h1>' +
        '<p>Mình sẽ dẫn bạn qua Strategy, sân mô phỏng, lưu kế hoạch và FTC Blocks. Những thay đổi thực hành sẽ được khôi phục khi kết thúc.</p></div></div>' +
        '<div class="guide-welcome-actions"><button type="button" class="btn" id="guideKnownBtn">Để sau</button>' +
        '<button type="button" class="btn guide-primary" id="guideStartBtn">Bắt đầu từ đầu</button></div>';
      $('#guideKnownBtn', welcome).addEventListener('click', () => welcome.close());
      $('#guideStartBtn', welcome).addEventListener('click', begin);
      welcome.showModal();
    });
    $('#guidePrevious', card).addEventListener('click', () => {
      if (index > 0) { index--; renderStep(); }
    });
    $('#guideNext', card).addEventListener('click', () => {
      index++;
      renderStep();
    });
    $('#guideSkipStep', card).addEventListener('click', () => {
      completed.add(index);
      index++;
      renderStep();
    });
    skipAll.addEventListener('click', () => finishTour(false));
    document.addEventListener('click', event => {
      if (!active || navigating || event.target.closest('.guide-card') || event.target.closest('.guide-skip-tour')) return;
      if (!eventIsInsideTarget(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        $('#guideResult', card).textContent = 'Hãy thao tác trong vùng đang được làm nổi bật nhé.';
        $('#guideResult', card).dataset.state = 'waiting';
        return;
      }
      verifyEvent(event);
    }, true);
    document.addEventListener('change', event => verifyEvent(event), true);
    document.addEventListener('input', event => verifyEvent(event), true);
    document.addEventListener('scroll', startAtCurrent, true);
    root.addEventListener('resize', startAtCurrent);
    document.addEventListener('keydown', event => {
      if (!active) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        finishTour(false);
        return;
      }
      if (event.key === 'Tab' || event.target.closest('.guide-card')) return;
      if (target && (event.target === target || target.contains(event.target))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function init() {
    hideGuideUi();
    wire();
    restoreAfterReload();
    root.addEventListener('pagehide', () => {
      if (!active || !canRestoreReload) return;
      try {
        root.sessionStorage.setItem(GUIDE_RETURN_KEY, JSON.stringify(recoveryState()));
        if (robotStateSnapshot === null) root.localStorage.removeItem(ROBOT_STATE_KEY);
        else root.localStorage.setItem(ROBOT_STATE_KEY, robotStateSnapshot);
        if (originalHash) {
          root.history.replaceState(null, '', root.location.pathname + root.location.search + originalHash);
        }
      } catch (error) {
        console.error('Không thể tự khôi phục dữ liệu khi rời hướng dẫn.', error);
      }
    });
    const preference = getPreference();
    if (preference !== 'known' && preference !== 'done' && preference !== 'skipped' && preference !== 'in-progress') {
      welcome.showModal();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
