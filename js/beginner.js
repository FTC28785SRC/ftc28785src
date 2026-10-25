(function(root) {
    'use strict';
    var $ = s => document.querySelector(s)
      , demoTitle = ''
      , strategies = null
      , activeProcess = 'explore';
    function screen(name, focus) {
        if (!['watch', 'edit', 'scores', 'help'].includes(name))
            return;
        var keepWatch = document.body.dataset.appView === 'integrated' && ['edit', 'scores'].includes(name);
        ['watch', 'edit', 'scores', 'help'].forEach(key => {
            $('#' + key + 'Panel').hidden = key !== name && !(keepWatch && key === 'watch');
        });
        document.querySelectorAll('.workspace-nav [data-screen]').forEach(b => b.setAttribute('aria-pressed', b.dataset.screen === name));
        if (root.BBAnalytics)
            root.BBAnalytics.view(name);
        if (focus) {
            var panel = $('#' + name + 'Panel');
            panel.scrollIntoView({
                block: 'start'
            });
            panel.focus({
                preventScroll: true
            });
        }
    }
    function init() {
        var anchor = $('.orientation-key');
        ['.match-clock', '.playbar', '#playLabel'].forEach(selector => anchor.before($(selector)));
        var builder = $('#builder');
        builder.id = 'editPanel';
        builder.tabIndex = -1;
        var targets = $('.pal-target');
        targets.classList.add('edit-targets');
        $('.editor-switch').after(targets);
        ['paletteRobot', 'paletteSegment'].forEach(id => $('#' + id).addEventListener('change', filter));
        var scoreLabel = document.createElement('p');
        scoreLabel.className = 'setup-note';
        scoreLabel.textContent = 'Điểm chi tiết theo liên minh được chọn trong phần Lập kế hoạch để xem hoặc chỉnh sửa trong Chỉnh sửa chiến lược.';
        $('.scorewrap').prepend(scoreLabel);
        $('#watchPanel').tabIndex = -1;
        var score = $('.scorewrap')
          , match = $('.match-card')
          , main = $('main');
        score.id = 'scoresPanel';
        score.tabIndex = -1;
        main.insertBefore(score, builder);
        var side = document.createElement('aside');
        side.className = 'watch-summary';
        side.appendChild(match);
        side.insertAdjacentHTML('beforeend', '<section class="plan-preview"><h2>Kế hoạch thi đấu của bạn</h2><p>Mỗi robot có chuỗi hành động riêng và hoạt động cùng lúc.</p><div id="planOverview"></div><button class="btn btn-primary" data-screen="edit">Xem và chỉnh sửa kế hoạch →</button><button class="btn" data-screen="scores">Tìm hiểu cách tính điểm →</button></section>');
        $('#watchPanel').appendChild(side);
        var help = document.createElement('section');
        help.id = 'helpPanel';
        help.tabIndex = -1;
        help.className = 'help-panel';
        help.innerHTML = '<h2>Bắt đầu với trận đấu đầu tiên qua ba bước</h2><div class="help-grid">' + '<article><h3>1. Tải kế hoạch mẫu</h3><p>Chọn liên minh và robot của bạn, sau đó nhấn <strong>Thử trận mẫu</strong>. Công cụ sẽ tạo kế hoạch hành động cho robot. Thử trận mẫu khác để khám phá những chiến thuật khác nhau.</p></article>' + '<article><h3>2. Theo dõi diễn biến</h3><p>Nhấn <strong>Chạy kế hoạch</strong>. Bạn có thể tạm dừng, chuyển sang bước tiếp theo hoặc kéo thanh thời gian. R1 và R2 là robot của liên minh đỏ; B1 và B2 thuộc liên minh xanh. Chọn <strong>Góc nhìn từ trên</strong> để quan sát chuyển động trên sân.</p></article>' + '<article><h3>3. Tùy chỉnh chiến thuật</h3><p>Mở <strong>Chỉnh sửa chiến thuật</strong>, chọn robot và giai đoạn, rồi thêm các nhóm hành động như thu thập rồi bắn hoặc chặn lối rồi rút lui. Chọn số bóng, mục tiêu FLOWER và số lần lặp trước khi thêm. Sắp xếp lại hoặc lặp nhóm hành động, rồi nhấn <strong>Chạy thử cả trận</strong>. Mở <strong>Hiển thị từng hành động</strong> để chỉnh sửa chi tiết.</p></article></div>' + '<h2>Các thuật ngữ trên sân</h2><dl class="glossary"><dt>POLLEN</dt><dd>Bóng màu vàng. Mỗi robot bắt đầu với bốn quả; có thể thu thập thêm trên sàn hoặc lấy POLLEN ở đáy FLOWER.</dd><dt>NECTAR</dt><dd>Bóng màu đỏ hoặc xanh. Robot chỉ được ghi điểm bằng NECTAR của liên minh mình. Chỉ được đưa NECTAR vào FLOWER trong 60 giây cuối.</dd><dt>HIVE và Ô</dt><dd>HIVE là mục tiêu có các Ô để bắn bóng vào. Đủ bóng có thể làm HIVE nghiêng, khiến bóng rơi ra sàn để robot thu thập.</dd><dt>FLOWER</dt><dd>Mục tiêu ghi điểm dạng ống. Số bóng và NECTAR nằm trên cùng quyết định quyền sở hữu và điểm số.</dd><dt>TỰ ĐỘNG</dt><dd>Giai đoạn 30 giây đầu, robot chạy chương trình tự động. Tiếp theo là giai đoạn chuyển tiếp kéo dài 8 giây.</dd><dt>ĐIỀU KHIỂN</dt><dd>Giai đoạn người chơi điều khiển robot kéo dài 120 giây, gồm hai nửa 60 giây liên tục.</dd><dt>Chu kỳ hành động</dt><dd>Thu thập bóng, di chuyển đến vị trí ghi điểm, rồi bắn hoặc đặt bóng. Mỗi lần di chuyển và thu thập đều tốn thời gian.</dd><dt>Cảnh báo</dt><dd>Thẻ cảnh báo cho biết vấn đề về số bóng đang giữ, thời gian, đường di chuyển hoặc luật. Hãy xử lý trước khi dựa vào điểm dự đoán.</dd></dl>' + '<h2>Hai cách phòng thủ khác nhau</h2><div class="help-grid"><article><h3>Chặn lối di chuyển</h3><p>Robot tạm thời đứng trên đường đi của đối thủ. Trên sân không có làn di chuyển chính thức được đánh dấu. Đối thủ có thể đi vòng hoặc chờ; nếu đường đi của họ không bị cản thì hành động này không gây chậm trễ.</p><div class="route-example"><span>Đối thủ →</span><strong>■ Robot chặn</strong><span>↗ Đi vòng → Mục tiêu</span></div><p>Chọn vị trí chặn trên thẻ hành động. Trong phần xem sân, bật các điểm minh họa và chọn góc nhìn từ trên. Màu vàng biểu thị robot đang chặn trong tối đa hai giây; sau đó robot rút lui.</p></article><article><h3>Đẩy nhẹ khi đối thủ đang bắn</h3><p>Sau khi robot của bạn hoàn tất lượt bắn vào HIVE, robot phòng thủ có thể tiếp cận đối thủ đang bắn. Nếu đường tiếp cận thông thoáng, robot thực hiện một cú đẩy nhẹ; đối thủ phải đổi vị trí và ngắm lại. Nếu không tiếp cận được, hành động sẽ bị bỏ qua.</p><p>Hành động đẩy chỉ là ước tính mô phỏng. Nó không tự động khiến đối thủ bắn trượt hoặc bị trừ điểm. Robot cần thêm thời gian để rút lui và nhường đường.</p></article></div>';
        var reference = document.createElement('details');
        reference.className = 'action-reference';
        var title = document.createElement('summary');
        title.textContent = 'Mỗi hành động làm gì?';
        reference.appendChild(title);
        Object.values(root.BBRules.ACTIONS).forEach(def => {
            var heading = document.createElement('h3')
              , text = document.createElement('p');
            heading.textContent = def.label;
            text.textContent = def.help;
            reference.append(heading, text);
        }
        );
        help.appendChild(reference);
        main.appendChild(help);
        help.appendChild($('.notes'));
        var actions = $('#demoActions');
        actions.appendChild($('#demoBtn'));
        actions.appendChild($('#randomOpponentBtn'));
        actions.insertAdjacentHTML('beforeend', '<button class="btn btn-outline-glow welcome-build-cta" data-screen="edit">Xây dựng chiến lược của riêng tôi <span aria-hidden="true">→</span></button>');
        $('#welcomeRunBtn').addEventListener('click', function() {
            if ($('#playBtn').disabled)
                return;
            screen('watch', false);
            $('#playBtn').click();
        });
        $('#playSpeed').addEventListener('change', updateDuration);
        document.querySelectorAll('.process-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var action = card.dataset.action;
                if (action === 'demo') {
                    activeProcess = 'explore';
                    updateProcessCards();
                    ($('#matchMode').value === 'opponent' ? $('#randomOpponentBtn') : $('#demoBtn')).click();
                } else if (action === 'edit') {
                    activeProcess = 'build';
                    updateProcessCards();
                    screen('edit', true);
                } else if (action === 'run' && !$('#welcomeRunBtn').disabled) {
                    activeProcess = 'compare';
                    updateProcessCards();
                    $('#welcomeRunBtn').click();
                }
            });
        });
        $('#editPanel .builder-head').appendChild($('#clearBtn'));
        var theme = document.createElement('label');
        theme.className = 'theme-choice';
        theme.innerHTML = 'Giao diện <select id="themeChoice"><option value="system">Hệ thống</option><option value="dark" selected>Tối</option><option value="light">Sáng</option></select>';
        var headerActions = document.createElement('div');
        headerActions.className = 'header-actions';
        var contacts = document.createElement('nav');
        contacts.className = 'header-contacts';
        contacts.setAttribute('aria-label', 'Liên hệ Science Robotics Club');
        document.querySelectorAll('.team-contact-links a').forEach(function(source) {
            var platform = source.classList.contains('contact-instagram') ? 'instagram' : source.classList.contains('contact-facebook') ? 'facebook' : 'email';
            var link = source.cloneNode(true);
            link.className = 'header-contact contact-' + platform;
            link.querySelector('.contact-copy').remove();
            link.querySelector('.contact-arrow').remove();
            link.title = {
                instagram: 'Instagram',
                facebook: 'Facebook',
                email: 'Email'
            }[platform] + ': ' + source.querySelector('.contact-handle').textContent;
            contacts.appendChild(link);
        });
        headerActions.append(contacts, theme);
        $('.topbar-id').after(headerActions);
        var systemTheme = matchMedia('(prefers-color-scheme: dark)');
        function applyTheme() {
            var choice = $('#themeChoice').value;
            document.documentElement.dataset.theme = choice === 'system' ? (systemTheme.matches ? 'dark' : 'light') : choice;
        }
        applyTheme();
        $('#themeChoice').addEventListener('change', applyTheme);
        systemTheme.addEventListener('change', function() {
            if ($('#themeChoice').value === 'system')
                applyTheme();
        });
        document.addEventListener('click', function(e) {
            var b = e.target.closest('[data-screen]');
            if (b) {
                if (b.dataset.screen === 'edit') {
                    activeProcess = 'build';
                    updateProcessCards();
                }
                screen(b.dataset.screen, true);
            }
            if (e.target.closest('#playBtn') && !$('#playBtn').disabled) {
                activeProcess = 'compare';
                updateProcessCards();
            }
        });
        screen('watch', false);
        $('.skip').href = '#editPanel';
        $('#showDefenseSpots').addEventListener('change', function() {
            root.BBField.showDefenseSpots(this.checked);
        });
        updateDuration();
        measureFps();
    }
    function updateProcessCards() {
        document.querySelectorAll('.process-card').forEach(function(card) {
            var active = card.dataset.processStep === activeProcess;
            card.classList.toggle('is-active', active);
            if (active)
                card.setAttribute('aria-current', 'step');
            else
                card.removeAttribute('aria-current');
            card.querySelector('.process-badge').textContent = active ? 'Đang hoạt động' : card.dataset.processStep === 'compare' ? ($('#welcomeRunBtn').disabled ? 'Sẵn sàng' : 'Có thể chạy') : 'Tiếp theo';
        });
    }
    function updateDuration() {
        var speed = Number($('#playSpeed').value) || 1;
        var match = root.BBRules.MATCH;
        var seconds = Math.round((match.autoSeconds + match.transitionSeconds + match.teleopSeconds) / speed);
        $('#telemetryDuration').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' · ' + speed + '×';
    }
    function measureFps() {
        var frames = 0
          , lastSample = 0;
        document.addEventListener('visibilitychange', function() {
            frames = 0;
            lastSample = 0;
            $('#telemetryFps').textContent = document.hidden ? '—' : 'Đang đo';
        });
        if (document.hidden)
            $('#telemetryFps').textContent = '—';
        function sample(now) {
            frames += 1;
            if (!lastSample)
                lastSample = now;
            if (now - lastSample >= 1000) {
                $('#telemetryFps').textContent = document.hidden ? '—' : Math.round(frames * 1000 / (now - lastSample)) + ' FPS';
                frames = 0;
                lastSample = now;
            }
            requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
    }
    function filter() {
        var robot = $('#paletteRobot').value
          , zone = $('#paletteSegment').value;
        document.querySelectorAll('#lanes > .lane').forEach(lane => {
            lane.hidden = lane.dataset.robot !== robot;
            lane.querySelectorAll('.zone').forEach(z => z.hidden = z.dataset.zone !== zone);
        }
        );
        ['auto', 'teleop'].forEach(key => {
            $('#palette-' + key).hidden = (zone === 'auto') !== (key === 'auto');
            $('#palette-' + key).previousElementSibling.hidden = $('#palette-' + key).hidden;
        }
        );
    }
    function loaded(title, labels, view) {
        demoTitle = title;
        strategies = labels;
        if (view !== false)
            screen(view || 'watch', false);
    }
    function update(match, plans, color) {
        var mode = $('#matchMode').value
          , own = $('#playingAlliance').value
          , practice = mode === 'single' || mode === 'alliance';
        $('#editorAlliance').disabled = practice;
        $('#editorContext').textContent = color === own ? 'Các bước của liên minh bạn. Thay đổi sẽ được áp dụng trong lần chạy kế hoạch tiếp theo.' : 'Các bước của đối thủ. Liên minh của bạn vẫn là ' + (own === 'red' ? 'ĐỎ' : 'XANH') + '.';
        var count = 0
          , host = $('#planOverview');
        host.replaceChildren();
        ['red', 'blue'].forEach(c => plans[c].robots.forEach( (r, i) => {
            if (match.final[c].robots[i].active === false)
                return;
            var article = document.createElement('article');
            article.className = 'robot-preview ' + c;
            var heading = document.createElement('h3');
            heading.textContent = (c === 'red' ? 'ĐỎ' : 'XANH') + ' · Robot ' + (i + 1) + (c === own ? ' · robot của bạn' : ' · đối thủ');
            article.appendChild(heading);
            ['auto', 'teleopEarly', 'teleopLate'].forEach(z => {
                var list = r.zones[z] || [];
                count += list.length;
                var line = document.createElement('p');
                line.textContent = ({
                    auto: 'TỰ ĐỘNG',
                    teleopEarly: '60 giây đầu',
                    teleopLate: '60 giây cuối'
                }[z]) + ': ' + (list.length ? list.length + ' bước · ' + list.slice(0, 2).map(a => root.BBRules.ACTIONS[a.type].label).join(' → ') + (list.length > 2 ? ' → …' : '') : 'Chưa có bước nào');
                var link = document.createElement('button');
                link.className = 'preview-edit';
                link.textContent = 'Chỉnh sửa các bước này';
                link.addEventListener('click', function() {
                    $('#editorAlliance').value = c;
                    $('#editorAlliance').dispatchEvent(new Event('change',{
                        bubbles: true
                    }));
                    $('#paletteRobot').value = String(i);
                    $('#paletteSegment').value = z;
                    filter();
                    if (root.BBRecipes)
                        root.BBRecipes.render();
                    screen('edit', true);
                });
                line.appendChild(link);
                article.appendChild(line);
            }
            );
            host.appendChild(article);
        }
        ));
        filter();
        $('#stepCount').textContent = count ? '(' + count + ')' : '';
        var progress = Math.min(count, 96);
        $('#planProgressLabel').textContent = count + ' / 96 bước';
        $('#planProgress').setAttribute('aria-valuenow', String(progress));
        $('#planProgressFill').style.width = Math.min(progress / 96 * 100, 100) + '%';
        $('#welcomeRunBtn').disabled = count === 0 || $('#playBtn').disabled;
        activeProcess = count ? 'build' : 'explore';
        updateProcessCards();
        var failures = Object.values(match.results).reduce( (n, r) => n + Object.values(r.flags).filter(f => f.blocked || f.illegal).length, 0);
        $('#demoSummary').textContent = count ? (demoTitle ? demoTitle + '. ' : 'Chiến thuật đã sẵn sàng. ') + count + ' bước. ' + (failures ? failures + ' bước có cảnh báo, cần xem lại trong mục Chỉnh sửa chiến thuật. ' : '') + 'Nhấn Chạy kế hoạch để xem mô phỏng hoặc mở Chỉnh sửa chiến thuật để thay đổi các bước.' : 'Chưa có bước nào. Hãy thử một trận mẫu hoặc tạo chu kỳ thu thập và ghi điểm đầu tiên.';
        $('#modeNote').textContent = practice ? 'Bạn điều khiển liên minh ' + (own === 'red' ? 'ĐỎ' : 'XANH') + ' ' + (mode === 'single' ? '· Robot ' + (+$('#singleRobot').value + 1) : '· Robot 1 và 2') + '. Các robot còn lại không tham gia chế độ luyện tập này.' : mode === 'opponent' ? 'Bạn điều khiển liên minh ' + (own === 'red' ? 'ĐỎ' : 'XANH') + '. Tạo đối thủ khác sẽ giữ nguyên kế hoạch của liên minh bạn.' : 'Liên minh của bạn là ' + (own === 'red' ? 'ĐỎ' : 'XANH') + '. Hai liên minh cùng thi đấu; bạn có thể xem và chỉnh sửa kế hoạch của cả hai trong mục Chỉnh sửa chiến thuật.';
        $('#demoBtn').textContent = mode === 'opponent' ? 'Tạo kế hoạch đối thủ' : demoTitle ? 'Thử trận mẫu khác' : 'Thử trận mẫu';
        $('#demoBtn').hidden = mode === 'opponent';
        $('#randomOpponentBtn').hidden = mode !== 'opponent';
        if (mode === 'opponent' && !count)
            $('#demoSummary').textContent = 'Hãy tạo kế hoạch cho liên minh của bạn trong mục Chỉnh sửa chiến thuật, rồi thử đấu với đối thủ ngẫu nhiên. Kế hoạch của bạn sẽ được giữ nguyên.';
    }
    root.BBEase = {
        init: init,
        update: update,
        loaded: loaded,
        screen: screen
    };
}
)(window);
