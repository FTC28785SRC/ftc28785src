/* Recipe blocks expand to ordinary actions; the existing simulator remains authoritative. */
(function(root) {
    'use strict';
    var $ = s => document.querySelector(s)
      , R = root.BBRules
      , serial = 0
      , drag = null;
    var library = [{
        id: 'opening',
        name: 'Đợt bắn mở màn',
        quantity: 4,
        note: 'Rời tường và bắn bốn quả POLLEN đã nạp sẵn.',
        steps: ['leave', 'hivePollen']
    }, {
        id: 'ground',
        name: 'Chu kỳ từ sàn lên HIVE',
        note: 'Thu thập POLLEN trên sàn, di chuyển đến HIVE rồi bắn.',
        steps: ['collectPollenGround', 'hivePollen']
    }, {
        id: 'spill',
        name: 'Thu hồi bóng rơi từ HIVE',
        note: 'Thu thập POLLEN đã rơi và ổn định sau khi HIVE nghiêng, rồi bắn lại. Cần có bóng rơi để thu thập.',
        steps: ['collectPollenGround', 'hivePollen'],
        source: 'spill'
    }, {
        id: 'flowerHive',
        name: 'Chu kỳ từ FLOWER lên HIVE',
        note: 'Lấy POLLEN có thể tiếp cận ở đáy FLOWER đã chọn rồi bắn vào HIVE.',
        steps: ['collectPollenFlower', 'hivePollen']
    }, {
        id: 'nectarHive',
        name: 'Chu kỳ NECTAR lên HIVE',
        note: 'Thu thập NECTAR đã được giải phóng của liên minh bạn rồi bắn. Cần có NECTAR.',
        steps: ['collectNectar', 'hiveNectar']
    }, {
        id: 'claim',
        name: 'Giành quyền sở hữu FLOWER',
        note: 'Thu thập một NECTAR sẵn có của liên minh và đặt vào FLOWER đã chọn. Chỉ thực hiện trong phút cuối.',
        steps: ['collectNectar', 'flowerNectar'],
        quantity: 1
    }, {
        id: 'fill',
        name: 'Đổ POLLEN vào FLOWER',
        note: 'Thu thập POLLEN trên sàn và đổ vào FLOWER đã chọn. Điểm số phụ thuộc vào quyền sở hữu.',
        steps: ['collectPollenGround', 'flowerPollen']
    }, {
        id: 'disrupt',
        name: 'Ghi điểm, gây gián đoạn, rút lui',
        note: 'Thu thập POLLEN, bắn rồi thử đẩy nhẹ khi đối thủ đang bắn. Chỉ trong TELEOP; hành động có thể bị bỏ qua.',
        steps: ['collectPollenGround', 'hivePollen', 'defendShooter']
    }, {
        id: 'autoPark',
        name: 'Kết thúc TỰ ĐỘNG bằng cách đỗ',
        note: 'Đặt sau các chu kỳ TỰ ĐỘNG. Thời gian di chuyển vẫn được tính.',
        steps: ['parkAuto']
    }, {
        id: 'park',
        name: 'Kết thúc trận bằng cách đỗ',
        note: 'Đặt ở cuối phút TELEOP cuối cùng.',
        steps: ['parkTeleop'],
        last: true
    }];
    library.forEach(b => {
        b.category = ['opening', 'autoPark', 'park'].includes(b.id) ? 'Mở đầu & kết thúc' : ['claim', 'fill'].includes(b.id) ? 'Kiểm soát FLOWER' : b.id === 'disrupt' ? 'Phòng thủ' : 'Chu kỳ HIVE';
    }
    );
    library.push({
        id: 'heldPollen',
        category: 'Mở đầu & kết thúc',
        name: 'Bắn POLLEN đang giữ',
        note: 'Bắn POLLEN robot đang mang. Không cần thu thập; hữu ích sau một chu kỳ chưa hoàn tất.',
        steps: ['hivePollen']
    }, {
        id: 'spillNectar',
        category: 'Thu hồi & tiếp tế',
        name: 'Thu hồi NECTAR bị rơi',
        note: 'Thu thập NECTAR của liên minh đã rơi và ổn định sau khi HIVE nghiêng, rồi bắn lại.',
        steps: ['collectNectar', 'hiveNectar'],
        source: 'spill'
    }, {
        id: 'loadingHive',
        category: 'Thu hồi & tiếp tế',
        name: 'Chu kỳ NECTAR từ KHU NẠP',
        note: 'Thu thập NECTAR đã được giải phóng ở KHU NẠP rồi bắn vào HIVE.',
        steps: ['collectNectar', 'hiveNectar'],
        source: 'loading'
    }, {
        id: 'spillFlower',
        category: 'Thu hồi & tiếp tế',
        name: 'Đưa POLLEN rơi vào FLOWER',
        note: 'Thu hồi POLLEN từ HIVE đã nghiêng và đặt vào FLOWER đã chọn.',
        steps: ['collectPollenGround', 'flowerPollen'],
        source: 'spill'
    }, {
        id: 'spillClaim',
        category: 'Thu hồi & tiếp tế',
        name: 'Giành FLOWER bằng NECTAR thu hồi',
        note: 'Dùng một NECTAR của liên minh đã rơi từ HIVE để giành FLOWER đã chọn. Chỉ trong phút cuối.',
        steps: ['collectNectar', 'flowerNectar'],
        source: 'spill',
        quantity: 1
    }, {
        id: 'claimFill',
        category: 'Kiểm soát FLOWER',
        name: 'Giành quyền sở hữu rồi đổ đầy',
        note: 'Đặt một NECTAR của liên minh, sau đó thu thập POLLEN trên sàn và đổ vào FLOWER đó. Chỉ trong phút cuối; quyền sở hữu có thể thay đổi.',
        steps: [{
            type: 'collectNectar',
            quantity: 1
        }, {
            type: 'flowerNectar',
            quantity: 1
        }, 'collectPollenGround', 'flowerPollen']
    }, {
        id: 'fillClaim',
        category: 'Kiểm soát FLOWER',
        name: 'Đổ đầy rồi xác lập quyền sở hữu',
        note: 'Đổ POLLEN trên sàn vào trước, sau đó đặt NECTAR của liên minh lên trên. Chỉ trong phút cuối.',
        steps: ['collectPollenGround', 'flowerPollen', {
            type: 'collectNectar',
            quantity: 1
        }, {
            type: 'flowerNectar',
            quantity: 1
        }]
    }, {
        id: 'twoClaims',
        category: 'Kiểm soát FLOWER',
        name: 'Giành hai FLOWER liền kề',
        note: 'Thu thập và đặt một NECTAR vào FLOWER đã chọn, rồi lặp lại với FLOWER kế tiếp theo số. Chỉ trong phút cuối.',
        steps: [{
            type: 'collectNectar',
            quantity: 1
        }, {
            type: 'flowerNectar',
            quantity: 1
        }, {
            type: 'collectNectar',
            quantity: 1
        }, {
            type: 'flowerNectar',
            quantity: 1,
            nextFlower: true
        }]
    }, {
        id: 'flowerTransfer',
        category: 'Kiểm soát FLOWER',
        name: 'Chuyển POLLEN giữa các FLOWER',
        note: 'Lấy POLLEN có thể tiếp cận ở đáy FLOWER đã chọn và đổ vào FLOWER kế tiếp theo số. Kiểm tra quyền sở hữu trước khi thực hiện.',
        steps: ['collectPollenFlower', {
            type: 'flowerPollen',
            nextFlower: true
        }]
    }, {
        id: 'alternating',
        category: 'Kết hợp ghi điểm',
        name: 'Luân phiên POLLEN và NECTAR vào HIVE',
        note: 'Thực hiện chu kỳ POLLEN trên sàn, sau đó là chu kỳ NECTAR đã giải phóng. Nguồn tài nguyên sẵn có vẫn giới hạn cả hai.',
        steps: ['collectPollenGround', 'hivePollen', 'collectNectar', 'hiveNectar']
    }, {
        id: 'hiveFlower',
        category: 'Kết hợp ghi điểm',
        name: 'Bắn vào HIVE rồi đến FLOWER',
        note: 'Bắn một lô POLLEN trên sàn vào HIVE, sau đó thu thập lô khác để đưa vào FLOWER đã chọn.',
        steps: ['collectPollenGround', 'hivePollen', 'collectPollenGround', 'flowerPollen']
    }, {
        id: 'flowerHiveClaim',
        category: 'Kết hợp ghi điểm',
        name: 'Lấy POLLEN từ FLOWER, ghi điểm HIVE rồi giành FLOWER',
        note: 'Bắn POLLEN có thể tiếp cận từ FLOWER vào HIVE, sau đó đặt một NECTAR đã giải phóng vào FLOWER đó. Chỉ trong phút cuối.',
        steps: ['collectPollenFlower', 'hivePollen', {
            type: 'collectNectar',
            quantity: 1
        }, {
            type: 'flowerNectar',
            quantity: 1
        }]
    }, {
        id: 'lightBlock',
        category: 'Phòng thủ',
        name: 'Ghi điểm, chặn lối trong thời gian ngắn',
        note: 'Hoàn tất một chu kỳ POLLEN vào HIVE, chặn một vị trí di chuyển khoảng một giây rồi rút lui. Chỉ trong TELEOP.',
        steps: ['collectPollenGround', 'hivePollen', {
            type: 'defendLane',
            defenseLevel: 'low',
            lane: 0
        }]
    }, {
        id: 'strongBlock',
        category: 'Phòng thủ',
        name: 'Ghi điểm, tranh chấp lối di chuyển',
        note: 'Hoàn tất một chu kỳ POLLEN vào HIVE, chặn một vị trí di chuyển tối đa hai giây rồi rút lui. Chỉ trong TELEOP.',
        steps: ['collectPollenGround', 'hivePollen', {
            type: 'defendLane',
            defenseLevel: 'high',
            lane: 2
        }]
    }, {
        id: 'disruptRecover',
        category: 'Phòng thủ',
        name: 'Gây gián đoạn rồi tiếp tục ghi điểm',
        note: 'Bắn một lô POLLEN đã thu thập, thử gây gián đoạn ngắn khi đối thủ bắn, rút lui rồi thực hiện chu kỳ POLLEN tiếp theo. Chỉ trong TELEOP.',
        steps: ['collectPollenGround', 'hivePollen', 'defendShooter', 'collectPollenGround', 'hivePollen']
    });
    function stepType(step) {
        return typeof step === 'string' ? step : step.type;
    }
    function available(b, zone) {
        return (!b.last || zone === 'teleopLate') && b.steps.every(step => {
            var d = R.ACTIONS[stepType(step)];
            return d.zones.includes(zone) && (!d.lateOnly || zone === 'teleopLate');
        }
        );
    }
    function expand(id, options) {
        var b = library.find(b => b.id === id);
        if (!b)
            throw Error('Không tìm thấy khối hành động.');
        return b.steps.map(step => {
            var type = stepType(step)
              , a = typeof step === 'string' ? {
                type: type
            } : Object.assign({}, step)
              , def = R.ACTIONS[type];
            if (def.element)
                a.quantity = a.quantity || b.quantity || options.quantity;
            if (def.needsFlower)
                a.flower = a.nextFlower ? options.flower % 4 + 1 : options.flower;
            delete a.nextFlower;
            if (type === 'collectPollenGround' || type === 'collectNectar')
                a.source = b.source || 'nearest';
            return a;
        }
        );
    }
    // Existing demo/manual plans become readable blocks without rewriting their actions.
    function groups(actions) {
        var out = [];
        for (var i = 0; i < actions.length; ) {
            var a = actions[i], n = 1, title;
            if (a.recipeId) {
                while (i + n < actions.length && actions[i + n].recipeId === a.recipeId)
                    n++;
                title = a.recipeName;
            } else {
                var b = library.find(b => b.steps.length > 1 && b.steps.every( (t, k) => typeof t === 'string' && actions[i + k] && !actions[i + k].recipeId && actions[i + k].type === t) && (!b.source || a.source === b.source) && !(b.id === 'ground' && a.source === 'spill'));
                if (b) {
                    n = b.steps.length;
                    title = b.name;
                } else
                    title = R.ACTIONS[a.type].label;
            }
            out.push({
                name: title,
                actions: actions.slice(i, i + n)
            });
            i += n;
        }
        return out;
    }
    root.BBRecipeModel = {
        library: library,
        available: available,
        expand: expand,
        groups: groups
    };
    if (typeof document === 'undefined')
        return;
    var host = document.createElement('section');
    host.className = 'recipe-builder';
    host.setAttribute('aria-labelledby', 'recipeTitle');
    host.innerHTML = '<h2 id="recipeTitle">Xây dựng công thức chiến thuật</h2><p>Chọn liên minh, robot và giai đoạn ở phía trên. Thêm các khối hành động bên dưới, sắp xếp thứ tự rồi chạy thử trận đấu. Mỗi robot có công thức riêng.</p><div class="recipe-options"><label>Nhóm hành động <select id="recipeCategory"><option value="all">Tất cả nhóm</option>' + ['Mở đầu & kết thúc', 'Chu kỳ HIVE', 'Thu hồi & tiếp tế', 'Kiểm soát FLOWER', 'Kết hợp ghi điểm', 'Phòng thủ'].map(c => '<option>' + c + '</option>').join('') + ' </select></label><label>Số chu kỳ cần thêm <select id="recipeRepeat">' + [1, 2, 3, 4, 5, 6].map(n => '<option>' + n + '</option>').join('') + '</select></label><label>Số bóng mỗi chu kỳ <select id="recipeQuantity">' + [4, 3, 2, 1].map(n => '<option>' + n + '</option>').join('') + '</select></label><label>FLOWER mục tiêu <select id="recipeFlower">' + [1, 2, 3, 4].map(n => '<option value="' + n + '">FLOWER ' + n + '</option>').join('') + '</select></label></div><p class="fine">Thời gian di chuyển được tự động tính. Khối sử dụng tối đa số bóng đã chọn; nguồn tài nguyên và giới hạn bốn bóng vẫn được áp dụng. Giành quyền sở hữu FLOWER cần một NECTAR. Khối mở đầu và đỗ chỉ được thêm một lần.</p><div class="recipe-workspace"><section class="recipe-shelf" aria-labelledby="recipeShelfTitle"><h3 id="recipeShelfTitle">Khối có thể tái sử dụng</h3><p id="recipeCatalogHint" class="fine"></p><div class="recipe-library" id="recipeLibrary" tabindex="0" aria-label="Thư viện khối hành động"></div></section><section class="recipe-canvas" aria-labelledby="recipeContext"><h3 id="recipeContext"></h3><div class="recipe-tools"><button type="button" class="btn" id="recipeClearRobot">Xóa công thức robot</button></div><p class="fine">Xóa toàn bộ công thức TỰ ĐỘNG và hai giai đoạn TELEOP của robot này. Các tệp đã tải lên vẫn được giữ.</p><p>Kéo khối vào đây để thêm vào cuối, hoặc thả lên một khối trong công thức để chèn vào trước. Trên điện thoại hoặc bằng bàn phím, hãy dùng nút di chuyển lên/xuống.</p><ol id="recipeList" class="recipe-list"></ol><p id="recipeFeedback" role="status"></p><button class="btn btn-primary" id="recipeTest">Chạy thử cả trận</button> <button class="btn" id="recipeDetails" aria-expanded="false">Hiển thị từng hành động</button></section></div>';
    $('.builder-grid').before(host);
    var detailed = $('.builder-grid');
    detailed.id = 'recipeActionDetails';
    detailed.hidden = true;
    $('#recipeDetails').setAttribute('aria-controls', detailed.id);
    function actions() {
        return root.BBUI._plan.robots[Number($('#paletteRobot').value)].zones[$('#paletteSegment').value];
    }
    function commit(list, message) {
        if (root.BBUI.recipeCommit(list))
            $('#recipeFeedback').textContent = message;
        else
            $('#recipeFeedback').textContent = $('#status').textContent;
    }
    function add(id, before) {
        var b = library.find(b => b.id === id)
          , zone = $('#paletteSegment').value;
        if (!available(b, zone))
            return;
        var count = b.steps.some(t => R.ACTIONS[stepType(t)].once) ? 1 : Number($('#recipeRepeat').value)
          , added = [];
        for (var i = 0; i < count; i++) {
            var key = 'recipe-' + Date.now() + '-' + (++serial);
            expand(id, {
                quantity: Number($('#recipeQuantity').value),
                flower: Number($('#recipeFlower').value)
            }).forEach(a => added.push(Object.assign(a, {
                recipeId: key,
                recipeName: b.name
            })));
        }
        var list = groups(actions())
          , at = before == null ? actions().length : list.slice(0, before).reduce( (n, g) => n + g.actions.length, 0)
          , next = actions().slice();
        next.splice(at, 0, ...added);
        commit(next, 'Đã thêm ' + count + ' khối "' + b.name + '". Hãy xem lại cảnh báo trước khi dựa vào điểm số.');
        $('#recipeLibrary [data-recipe="' + id + '"]')?.focus({
            preventScroll: true
        });
    }
    function change(index, kind, target) {
        var list = groups(actions())
          , g = list[index];
        if (!g)
            return;
        if (kind === 'delete')
            list.splice(index, 1);
        if (kind === 'copy') {
            var key = 'recipe-' + Date.now() + '-' + (++serial);
            list.splice(index + 1, 0, {
                name: g.name,
                actions: g.actions.map(a => Object.assign({}, a, {
                    uid: undefined,
                    recipeId: key,
                    recipeName: g.name
                }))
            });
        }
        if (kind === 'move') {
            if (target < 0 || target > list.length)
                return;
            list.splice(index, 1);
            if (target > index)
                target--;
            list.splice(target, 0, g);
        }
        commit(list.flatMap(g => g.actions), 'Đã cập nhật công thức. Cả bốn kế hoạch robot đã được mô phỏng lại.');
    }
    function render() {
        $('#recipeFeedback').textContent = '';
        var zone = $('#paletteSegment').value
          , gs = groups(actions());
        $('#recipeContext').textContent = 'Liên minh ' + (root.BBUI._plan.alliance === 'red' ? 'ĐỎ' : 'XANH') + ' · Robot ' + (Number($('#paletteRobot').value) + 1) + ' / ' + $('#paletteSegment').selectedOptions[0].text + ' / ' + gs.length + ' khối';
        var choices = library.filter(b => available(b, zone) && ($('#recipeCategory').value === 'all' || b.category === $('#recipeCategory').value));
        $('#recipeCatalogHint').textContent = choices.length + ' khối phù hợp với giai đoạn và nhóm đã chọn. Cuộn thư viện để xem thêm; nhấn vào khối để thêm.';
        var lib = $('#recipeLibrary');
        lib.replaceChildren();
        choices.forEach(b => {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'recipe-choice';
            button.draggable = true;
            button.dataset.recipe = b.id;
            var strong = document.createElement('strong');
            strong.textContent = b.name;
            var text = document.createElement('span');
            text.textContent = b.note;
            var family = document.createElement('small');
            family.textContent = b.category;
            button.append(family, strong, text);
            lib.append(button);
        }
        );
        var ol = $('#recipeList');
        ol.replaceChildren();
        gs.forEach( (g, i) => {
            var li = document.createElement('li');
            li.draggable = true;
            li.dataset.block = i;
            li.className = 'recipe-block';
            var title = document.createElement('strong');
            title.textContent = (i + 1) + '. ' + g.name;
            li.append(title);
            var info = document.createElement('p');
            info.textContent = g.actions.map(a => R.ACTIONS[a.type].label + (a.quantity ? ' (tối đa ' + a.quantity + ')' : '') + (a.flower ? ' / FLOWER ' + a.flower : '') + (a.source === 'spill' ? ' / bóng rơi từ HIVE' : a.source === 'loading' ? ' / KHU NẠP' : '') + (a.defenseLevel ? ' / phòng thủ ' + (a.defenseLevel === 'low' ? 'nhẹ' : 'mạnh') : '')).join(' \u2192 ');
            li.append(info);
            var flags = root.BBUI.recipeFlags || {}
              , issues = g.actions.filter(a => flags[a.uid] && (flags[a.uid].blocked || flags[a.uid].illegal || flags[a.uid].overrun || flags[a.uid].ignored));
            if (issues.length) {
                var warning = document.createElement('p');
                warning.className = 'recipe-warning';
                warning.textContent = issues.length + ' hành động có cảnh báo: ' + Array.from(new Set(issues.map(a => flags[a.uid].message || 'Hãy kiểm tra thời gian, vật phẩm đang giữ hoặc luật trong phần hành động chi tiết.'))).join(' ');
                li.append(warning);
            }
            var timing = document.createElement('p');
            timing.textContent = 'Thời gian mô phỏng khối: ' + g.actions.reduce( (sum, a) => sum + (flags[a.uid]?.duration || 0), 0).toFixed(1) + ' giây (đã tính thời gian di chuyển và chờ).';
            li.append(timing);
            var tools = document.createElement('div');
            tools.className = 'recipe-tools';
            [['up', 'Di chuyển lên'], ['down', 'Di chuyển xuống'], ['copy', 'Lặp lại khối'], ['delete', 'Xóa']].forEach( ([act,label]) => {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'btn';
                b.textContent = label;
                b.dataset.blockAction = act;
                b.disabled = (act === 'up' && i === 0) || (act === 'down' && i === gs.length - 1);
                tools.append(b);
            }
            );
            li.append(tools);
            ol.append(li);
        }
        );
        if (!gs.length) {
            var empty = document.createElement('li');
            empty.className = 'recipe-empty';
            empty.textContent = 'Công thức của bạn sẽ bắt đầu ở đây. Nhấn hoặc kéo một khối vào từ thư viện phía trên.';
            ol.append(empty);
        }
    }
    host.addEventListener('click', e => {
        var choice = e.target.closest('[data-recipe]');
        if (choice) {
            add(choice.dataset.recipe);
            return;
        }
        var tool = e.target.closest('[data-block-action]');
        if (tool) {
            var i = Number(tool.closest('[data-block]').dataset.block)
              , act = tool.dataset.blockAction;
            change(i, act === 'up' || act === 'down' ? 'move' : act, act === 'up' ? i - 1 : i + 2);
            var next = $('#recipeList').children[Math.min(i, $('#recipeList').children.length - 1)];
            next?.querySelector('button:not(:disabled)')?.focus();
        }
    }
    );
    host.addEventListener('dragstart', e => {
        if (e.target.closest('button[data-block-action]')) {
            e.preventDefault();
            return;
        }
        var choice = e.target.closest('[data-recipe]')
          , block = e.target.closest('[data-block]');
        drag = choice ? {
            id: choice.dataset.recipe
        } : block ? {
            index: Number(block.dataset.block)
        } : null;
        if (drag) {
            e.dataTransfer.setData('text/plain', 'dragonflow-recipe');
            e.dataTransfer.effectAllowed = choice ? 'copy' : 'move';
        }
    }
    );
    host.addEventListener('dragover', e => {
        if (drag && e.target.closest('#recipeList')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = drag.id ? 'copy' : 'move';
        }
    }
    );
    host.addEventListener('drop', e => {
        if (!drag || !e.target.closest('#recipeList'))
            return;
        e.preventDefault();
        var block = e.target.closest('[data-block]')
          , at = block ? Number(block.dataset.block) : groups(actions()).length;
        if (drag.id)
            add(drag.id, at);
        else
            change(drag.index, 'move', at);
        drag = null;
    }
    );
    host.addEventListener('dragend', () => {
        drag = null;
    }
    );
    function clear(scope) {
        if (root.BBUI.clearRecipes(scope)) {
            $('#recipeFeedback').textContent = scope === 'all' ? 'Đã xóa công thức của cả bốn robot. Thêm một khối để bắt đầu xây dựng lại.' : 'Đã xóa toàn bộ công thức của robot này. Thêm một khối để bắt đầu xây dựng lại.';
        } else
            $('#recipeFeedback').textContent = $('#status').textContent;
    }
    $('#recipeClearRobot').onclick = () => clear('robot');
    $('#recipeDetails').onclick = function() {
        detailed.hidden = !detailed.hidden;
        this.setAttribute('aria-expanded', String(!detailed.hidden));
        this.textContent = detailed.hidden ? 'Hiển thị từng hành động' : 'Ẩn từng hành động';
    }
    ;
    $('#recipeTest').onclick = () => {
        root.BBEase.screen('watch', true);
        $('#resetBtn').click();
        $('#playBtn').click();
    }
    ;
    document.addEventListener('change', e => {
        if (['paletteRobot', 'paletteSegment', 'recipeCategory'].includes(e.target.id))
            render();
    }
    );
    root.BBRecipes = {
        render: render
    };
    render();
}
)(typeof window === 'undefined' ? globalThis : window);
