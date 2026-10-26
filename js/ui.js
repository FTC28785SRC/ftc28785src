/* =====================================================================
   BIOBUZZ Alliance Match Planner — ui.js
   ---------------------------------------------------------------------
   The planning half: action palette, per-robot phase lanes, drag-and-drop
   plus a full click/keyboard path, the scoreboard, and match playback.
   ===================================================================== */
(function (root) {
  'use strict';

  var R = root.BBRules;
  var SIM = root.BBScoring;
  var FIELD = root.BBField;
  var startAudio = new root.Audio(encodeURI('FIRST Tech Challenge FTC Match Timer (DECODE) - STRΛTOS.mp3'));
  startAudio.preload = 'none';
  function playStartAudio() {
    startAudio.currentTime = 0;
    try {
      var playback = startAudio.play();
      if (playback && typeof playback.then === 'function') {
        return playback.then(function () { return true; }).catch(function (error) { reportAudioError(error); return false; });
      }
      return Promise.resolve(true);
    } catch (error) {
      reportAudioError(error);
      return Promise.resolve(false);
    }
  }
  function stopStartAudio() {
    startAudio.pause();
    startAudio.currentTime = 0;
  }
  function reportAudioError(error) {
    console.error('Không thể phát âm thanh bắt đầu trận FTC.', error);
    var message = 'Không thể phát âm thanh bắt đầu trận. Hãy kiểm tra tệp âm thanh và thử lại.';
    var status = [document.getElementById('dsStatus'), document.getElementById('status')].find(function (node) {
      return node && node.getClientRects().length;
    });
    if (status) status.textContent = message;
  }

  /* ---------------- plan state ---------------- */
  var uidSeq = 1;
  function uid() { return 'a' + (uidSeq++); }

  var plan = {
    alliance: 'red',
    robots: [newRobot(), newRobot()]
  };
  function newRobot() {
    return { zones: { auto: [], teleopEarly: [], teleopLate: [] } };
  }

  var plans = { red: plan, blue: { alliance: 'blue', robots: [newRobot(), newRobot()] } };
  var match = null;
  var settings = Object.assign({}, root.BBWorld.defaults);
  function simOptions(){
    var mode=$('#matchMode').value,c=$('#playingAlliance').value;
    return Object.assign({},settings,{demoDefense:$('#defenseTactic').value,activeRobots:mode==='single'?[c+'-'+$('#singleRobot').value]:mode==='alliance'?[c+'-0',c+'-1']:['red-0','red-1','blue-0','blue-1']});
  }
  var result = null;          // latest simulate() output
  var eventByUid = {};
  var play = { idx: -1, timer: null, running: false, starting: false };

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------- helpers ---------------- */
  function zoneMeta(key) {
    for (var i = 0; i < R.ZONES.length; i++) { if (R.ZONES[i].key === key) { return R.ZONES[i]; } }
    return null;
  }

  function canAdd(robotIdx, zoneKey, type) {
    var def = R.ACTIONS[type];
    if(!simOptions().activeRobots.includes(plan.alliance+'-'+robotIdx))return {ok:false,why:'Robot này không hoạt động ở chế độ đã chọn.'};
    if (!def) { return { ok: false, why: 'Hành động không xác định.' }; }
    if (def.zones.indexOf(zoneKey) < 0) {
      return { ok: false, why: 'Không thể đặt "' + def.label + '" vào ' + zoneMeta(zoneKey).name + '.' };
    }
    if (def.once === 'auto') {
      if (plan.robots[robotIdx].zones.auto.some(function (a) { return a.type === type; })) {
        return { ok: false, why: 'Robot ' + (robotIdx + 1) + ' đã có "' + def.label + '" trong TỰ ĐỘNG — thành tích này chỉ được thực hiện một lần.' };
      }
    }
    if (def.once === 'teleop') {
      var dup = ['teleopEarly', 'teleopLate'].some(function (z) {
        return plan.robots[robotIdx].zones[z].some(function (a) { return a.type === type; });
      });
      if (dup) {
        return { ok: false, why: 'Robot ' + (robotIdx + 1) + ' đã có "' + def.label + '" trong ĐIỀU KHIỂN — thành tích này chỉ được thực hiện một lần.' };
      }
    }
    return { ok: true };
  }

  function defaultFlower(type) {
    if (!result) { return 1; }
    var f = result.final.flowers;
    var i;
    if (type === 'flowerNectar') {
      for (i = 0; i < 4; i++) { if (!f[i].bottomBonus) { return i + 1; } }
      return 1;
    }
    for (i = 0; i < 4; i++) { if (f[i].owned) { return i + 1; } }
    return 1;
  }

  function makeAction(type) {
    var a = { uid: uid(), type: type };
    if (R.ACTIONS[type].needsFlower) { a.flower = defaultFlower(type); }
    return a;
  }

  function findAction(u) {
    for (var ri = 0; ri < plan.robots.length; ri++) {
      for (var zk in plan.robots[ri].zones) {
        var list = plan.robots[ri].zones[zk];
        for (var i = 0; i < list.length; i++) {
          if (list[i].uid === u) { return { robot: ri, zone: zk, index: i, action: list[i] }; }
        }
      }
    }
    return null;
  }

  function say(msg, kind) {
    var n = $('#status');
    n.textContent = msg;
    n.className = 'status' + (kind ? ' is-' + kind : '');
    clearTimeout(say._t);
    say._t = setTimeout(function () { n.textContent = ''; n.className = 'status'; }, 6000);
  }

  /* ---------------- mutations ---------------- */
  function addAction(robotIdx, zoneKey, type, atIndex, opts) {
    var chk = canAdd(robotIdx, zoneKey, type);
    if (!chk.ok) { say(chk.why, 'warn'); return null; }
    var a = makeAction(type);
    var list = plan.robots[robotIdx].zones[zoneKey];
    var i = (atIndex == null || atIndex > list.length) ? list.length : Math.max(0, atIndex);
    list.splice(i, 0, a);
    refresh({ preview: a.uid });
    if (!opts || !opts.quiet) {
      say(R.ACTIONS[type].label + ' → Robot ' + (robotIdx + 1) + ', ' + zoneMeta(zoneKey).name + '.');
    }
    return a;
  }

  function removeAction(u) {
    var loc = findAction(u);
    if (!loc) { return; }
    plan.robots[loc.robot].zones[loc.zone].splice(loc.index, 1);
    refresh({});
    say('Đã xóa "' + R.ACTIONS[loc.action.type].label + '".');
  }

  function moveWithin(u, delta) {
    var loc = findAction(u);
    if (!loc) { return; }
    var list = plan.robots[loc.robot].zones[loc.zone];
    var j = loc.index + delta;
    if (j < 0 || j >= list.length) { return; }
    list.splice(loc.index, 1);
    list.splice(j, 0, loc.action);
    refresh({ focus: u });
    say('Đã chuyển "' + R.ACTIONS[loc.action.type].label + '" đến vị trí ' + (j + 1) + '.');
  }

  function relocate(u, robotIdx, zoneKey, atIndex) {
    var loc = findAction(u);
    if (!loc) { return; }
    if (loc.robot === robotIdx && loc.zone === zoneKey) {
      var list = plan.robots[robotIdx].zones[zoneKey];
      list.splice(loc.index, 1);
      var t = atIndex == null ? list.length : Math.max(0, Math.min(list.length, atIndex > loc.index ? atIndex - 1 : atIndex));
      list.splice(t, 0, loc.action);
      refresh({ focus: u });
      return;
    }
    var def = R.ACTIONS[loc.action.type];
    if (def.zones.indexOf(zoneKey) < 0) {
      say('Không thể đặt "' + def.label + '" vào ' + zoneMeta(zoneKey).name + '.', 'warn');
      return;
    }
    // re-check "once" constraints against the destination, ignoring itself
    plan.robots[loc.robot].zones[loc.zone].splice(loc.index, 1);
    var chk = canAdd(robotIdx, zoneKey, loc.action.type);
    if (!chk.ok) {
      plan.robots[loc.robot].zones[loc.zone].splice(loc.index, 0, loc.action);
      say(chk.why, 'warn');
      return;
    }
    var dl = plan.robots[robotIdx].zones[zoneKey];
    dl.splice(atIndex == null ? dl.length : Math.max(0, Math.min(dl.length, atIndex)), 0, loc.action);
    refresh({ focus: u, preview: u });
    say('Đã chuyển "' + def.label + '" sang Robot ' + (robotIdx + 1) + ', ' + zoneMeta(zoneKey).name + '.');
  }

  function clearAll() {
    plan.robots = [newRobot(), newRobot()];
    refresh({});
    say('Đã xóa kế hoạch của liên minh ' + (plan.alliance === 'red' ? 'ĐỎ' : 'XANH').toLowerCase() + '. Kế hoạch của liên minh còn lại vẫn được giữ nguyên.');
  }

  function revealDemoField() {
    requestAnimationFrame(function () {
      if(root.BBEase)root.BBEase.screen('watch',false);
      var board=$('#watchPanel .board-wrap');
      board.setAttribute('tabindex','-1');
      board.scrollIntoView({block:'start'});
      board.focus({preventScroll:true});
    });
  }

  /* Both alliance plans are replaced together by the worked match. */
  async function randomOpponent(){
    var requested=simOptions(),button=$('#randomOpponentBtn'),c=$('#playingAlliance').value==='red'?'blue':'red';
    if(button.disabled)return;button.disabled=true;
    try{var generated=await root.BBDemo.generate(uid,requested,plans);if(JSON.stringify(requested)!==JSON.stringify(simOptions()))throw new Error('Thiết lập trận đấu đã thay đổi; hãy tạo lại kế hoạch cho đối thủ.');var combined=Object.assign({},plans);combined[c]=generated.plans[c];
      for(var repair=0;repair<200;repair++){
        var trial=root.BBMatch.simulate(combined,requested,false),bad=Object.entries(trial.results[c].flags).find(entry=>entry[1].blocked||entry[1].illegal);
        if(!bad)break;
        combined[c].robots.forEach(r=>Object.keys(r.zones).forEach(z=>{r.zones[z]=r.zones[z].filter(a=>a.uid!==bad[0]);}));
      }
      plans[c]=combined[c];plan=plans[plan.alliance];if(root.BBEase)root.BBEase.loaded('Đối thủ đã sẵn sàng',generated.strategies);refresh({});revealDemoField();say('Đối thủ ' + (c === 'red' ? 'ĐỎ' : 'XANH') + ': ' + generated.strategies[c] + '. Kế hoạch của bạn được giữ nguyên; hãy xem các cảnh báo thời gian của trận này.');}
    catch(e){say(e.message,'warn');}finally{button.disabled=false;}
  }
  async function loadDemo() {
    if($('#matchMode').value==='opponent'){await randomOpponent();return;}
    var button=$('#demoBtn'),requested=simOptions();
    if(button.disabled)return;
    button.disabled=true;button.textContent='Đang tạo…';
    say('Đang tìm một trận đấu khả thi khác…');
    try {
      var generated=await (requested.activeRobots.length<4?root.BBDemo.generatePractice(uid,requested):root.BBDemo.generate(uid,requested,plans));
      if(JSON.stringify(requested)!==JSON.stringify(simOptions()))throw new Error('Thiết lập thời gian đã thay đổi trong lúc tạo trận. Hãy nhấn Tải kế hoạch mẫu lần nữa để dùng thiết lập mới.');
      var selected=plan.alliance;plans=generated.plans;plan=plans[selected];
      if(root.BBEase)root.BBEase.loaded('Trận mẫu đã sẵn sàng',generated.strategies);
      refresh({});
      revealDemoField();
      say('Đã tải trận mẫu ' + generated.seed + ' · ĐỎ ' + match.results.red.matchTotal + ' – XANH ' + match.results.blue.matchTotal + ' · ' + (generated.strategies ? ('ĐỎ ' + generated.strategies.red + ' / XANH ' + generated.strategies.blue) : 'chiến thuật đa dạng') + ' · các kế hoạch đang hoạt động đáp ứng kiểm tra thời gian, số bóng và luật mô phỏng. Nhấn lại để tạo trận khác.');
    } catch(error){say(error.message);}
    finally{button.disabled=false;button.textContent='Thử trận mẫu khác';}
  }

  /* =====================================================================
     RENDER
     ===================================================================== */
  function icon(id, cls) {
    return '<svg class="ico ' + (cls || '') + '" aria-hidden="true" focusable="false"><use href="#' + id + '"></use></svg>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function buildPalette() {
    ['auto', 'teleop'].forEach(function (group) {
      var host = $('#palette-' + group);
      host.innerHTML = '';
      R.PALETTE[group].forEach(function (type) {
        var def = R.ACTIONS[type];
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pal-card el-' + (def.element || 'none');
        b.draggable = true;
        b.dataset.type = type;
        b.dataset.group = group;
        b.title = def.help;
        b.innerHTML =
          '<span class="pal-icon">' + icon(def.icon) + '</span>' +
          '<span class="pal-text"><span class="pal-title">' + esc(def.label) + '</span>' +
          '<span class="pal-value">' + esc(def.value) + '</span></span>' +
          '<span class="pal-tag">' + esc(def.tag) + '</span>';
        host.appendChild(b);
      });
    });
  }

  function buildLanes() {
    var host = $('#lanes');
    host.innerHTML = '';
    plan.robots.forEach(function (rb, ri) {
      var lane = document.createElement('section');
      lane.className = 'lane';lane.dataset.robot=ri;
      if(!simOptions().activeRobots.includes(plan.alliance+'-'+ri)){lane.innerHTML='<h3>Liên minh '+(plan.alliance === 'red' ? 'ĐỎ' : 'XANH')+' · Robot '+(ri+1)+' — không hoạt động</h3><p>Kế hoạch đã lưu vẫn được giữ. Hãy đổi chế độ trận đấu để sử dụng robot này.</p>';host.appendChild(lane);return;}
      lane.innerHTML = '<h3 class="lane-title">' + icon('i-robot') + ' Liên minh ' + (plan.alliance === 'red' ? 'ĐỎ' : 'XANH') + ' · Robot ' + (ri + 1) + '</h3>';
      R.ZONES.forEach(function (z) {
        var zn = document.createElement('div');
        zn.className = 'zone zone-' + z.key;
        zn.dataset.robot = ri;
        zn.dataset.zone = z.key;
        var opts = Object.keys(R.ACTIONS).filter(function (t) {
          return R.ACTIONS[t].zones.indexOf(z.key) >= 0;
        }).map(function (t) {
          var d = R.ACTIONS[t];
          var illegalHere = d.lateOnly && z.key !== 'teleopLate';
          return '<option value="' + t + '"' + (illegalHere ? ' class="opt-illegal"' : '') + '>' +
                 esc(d.label) + (illegalHere ? ' — ⚠ không hợp lệ trước 60 giây cuối' : '') + '</option>';
        }).join('');
        zn.innerHTML =
          '<header class="zone-head">' +
            '<span class="zone-name">' + esc(z.name) + '</span>' +
            '<span class="zone-clock">' + esc(z.clock) + '</span>' +
          '</header>' +
          '<p class="zone-blurb">' + esc(z.blurb) + '</p>' +
          '<ol class="lane-list" data-robot="' + ri + '" data-zone="' + z.key + '"></ol>' +
          '<div class="zone-add">' +
            '<label class="vh" for="add-' + ri + '-' + z.key + '">Hành động cần thêm cho Robot ' + (ri + 1) + ' · ' + esc(z.name) + '</label>' +
            '<select id="add-' + ri + '-' + z.key + '" class="zone-add-select">' + opts + '</select>' +
            '<button type="button" class="btn btn-add zone-add-btn">Thêm</button>' +
          '</div>';
        lane.appendChild(zn);
        if (z.key === 'auto') {
          var tr = document.createElement('p');
          tr.className = 'transition-note';
          tr.textContent = 'Giai đoạn chuyển tiếp 8 giây — sổ tay quy định các hoạt động trong giai đoạn này; công cụ không đặt hành động tại đây.';
          lane.appendChild(tr);
        }
      });
      host.appendChild(lane);
    });
  }

  function heldBadge(ev) {
    if (!ev || !ev.snapshot || !ev.snapshot.robots[ev.robot]) { return ''; }
    var h = ev.matchSnapshot[ev.alliance].robots[ev.robot];
    return '<span class="badge badge-hold">đang giữ ' + h.heldPollen + 'P · ' + h.heldNectar + 'N</span>';
  }

  function cardBadges(a, flags) {
    var f = flags[a.uid] || {};
    var def = R.ACTIONS[a.type];
    var ev = eventByUid[a.uid];
    var out = [];
    if (f.duration != null) { out.push('<span class="badge badge-mute">' + f.duration.toFixed(1) + ' giây · di chuyển ' + (f.travelSeconds || 0).toFixed(1) + ' giây · chờ ' + (f.waitSeconds || 0).toFixed(1) + ' giây</span>'); }
    if (f.overrun) { out.push('<span class="badge badge-warn">QUÁ THỜI GIAN</span>'); }
    if (f.illegal) {
      out.push('<span class="badge badge-bad">' + (f.rule ? esc(f.rule) + ' · ' : '') + 'bị phạt</span>');
    }
    if (f.blocked) { out.push('<span class="badge badge-warn">không thể thực hiện · không tính điểm</span>'); }
    if (f.ignored) { out.push('<span class="badge badge-bad">trùng lặp · đã bỏ qua</span>'); }
    if(f.trafficSeconds)out.push('<span class="badge badge-mute">Cản trở di chuyển '+f.trafficSeconds.toFixed(1)+' giây</span>');
    if(f.defense)out.push('<span class="badge badge-mute">Chặn lối · gây chậm '+(f.delayCausedSeconds||0).toFixed(1)+' giây</span>');
    if(f.defenseDelaySeconds)out.push('<span class="badge badge-mute">Đã nhường '+f.defenseDelaySeconds.toFixed(1)+' giây</span>');
    if (f.collected) {
      out.push('<span class="badge badge-good">+1 ' + esc(f.collected.toUpperCase()) + '</span>');
    }
    if (f.tipped) { out.push('<span class="badge badge-tip">TỔ NGHIÊNG · +20</span>'); }
    if (f.spilledNectar) {
      out.push('<span class="badge badge-mute">' + f.spilledNectar + ' NECTAR rơi ra sàn</span>');
    }
    if (f.bottomBonus) { out.push('<span class="badge badge-good">thưởng đáy · +5</span>'); }
    if (f.claimedOwnership && !f.bottomBonus) { out.push('<span class="badge badge-good">giành quyền sở hữu</span>'); }
    if (ev && ev.fx && ev.fx.kind === 'hive' && !f.tipped) {
      out.push('<span class="badge badge-mute">Ô đã nạp ' + ev.matchSnapshot[ev.alliance].fill + '/' + R.HIVE.threshold + '</span>');
    }
    // what the robot is carrying after this step — the point of the inventory model
    if (ev && def.element && !f.blocked) { out.push(heldBadge(ev)); }
    return out.join('');
  }

  function renderCards() {
    var flags = result.flags;
    plan.robots.forEach(function (rb, ri) {
      R.ZONES.forEach(function (z) {
        var ol = $('.lane-list[data-robot="' + ri + '"][data-zone="' + z.key + '"]');
        if (!ol) { return; }
        ol.innerHTML = '';
        var list = rb.zones[z.key];
        if (!list.length) {
          var empty = document.createElement('li');
          empty.className = 'lane-empty';
          empty.textContent = 'Chưa có bước nào. Chọn một hành động bên dưới rồi nhấn Thêm, hoặc nhấp vào hành động trong mục “Thêm bước”.';
          ol.appendChild(empty);
          return;
        }
        list.forEach(function (a, i) {
          var def = R.ACTIONS[a.type];
          var f = flags[a.uid] || {};
          var li = document.createElement('li');
          li.className = 'card el-' + (def.element || 'none') + (def.collects ? ' is-collect' : '') +
                         (f.illegal ? ' is-illegal' : '') + (f.blocked ? ' is-blocked' : '') +
                         (f.ignored ? ' is-ignored' : '');
          li.draggable = true;
          li.tabIndex = 0;
          li.dataset.uid = a.uid;
          li.setAttribute('aria-label', def.label + ', vị trí ' + (i + 1) + ' trên ' + list.length +
                          ', Robot ' + (ri + 1) + ' · ' + z.name +
                          (f.illegal ? '. Cảnh báo: điểm phạt được cộng cho đối thủ.' : '') +
                          (f.blocked ? '. Cảnh báo: không thể thực hiện ở bước này, không được tính điểm.' : ''));
          var flowerSel = '';
          if(a.type==='defendLane'){
            flowerSel+='<label class="card-option">Mức độ <select class="card-defense-level" data-uid="'+a.uid+'">'+[['low','Thấp · 1 giây'],['medium','Vừa · 1,5 giây'],['high','Cao · 2 giây']].map(function(o){return '<option value="'+o[0]+'"'+((a.defenseLevel||'high')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>';
            flowerSel+='<label class="card-option">Vị trí chặn <select class="card-defense" data-uid="'+a.uid+'">'+['Vị trí 1 · trái / xa','Vị trí 2 · trái / gần','Vị trí 3 · phải / xa','Vị trí 4 · phải / gần'].map(function(name,n){return '<option value="'+n+'"'+((a.lane||0)===n?' selected':'')+'>'+name+'</option>';}).join('')+'</select></label>';
          }
          if (def.element) {
            flowerSel += '<label class="card-option">Số bóng <select class="card-quantity" data-uid="' + a.uid + '" aria-label="Số lượng bóng">' + [1,2,3,4].map(function(n){return '<option value="'+n+'"'+((a.quantity||1)===n?' selected':'')+'>'+n+'</option>';}).join('') + '</select></label>';
          }
          if (def.collects && !def.needsFlower) {
            flowerSel += '<label class="card-option">Nguồn bóng <select class="card-source" data-uid="'+a.uid+'" aria-label="Nguồn thu thập">' + [['nearest','Gần nhất có thể lấy'],['spill','Bóng rơi từ tổ']].concat(def.collects==='nectar'?[['loading','Khu nạp']]:[]).map(function(o){return '<option value="'+o[0]+'"'+((a.source||'nearest')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>';
          }
          if (def.needsFlower) {
            flowerSel += '<label class="vh" for="fl-' + a.uid + '">Chọn FLOWER</label>' +
              '<select class="card-flower" id="fl-' + a.uid + '" data-uid="' + a.uid + '">' +
              [1, 2, 3, 4].map(function (n) {
                return '<option value="' + n + '"' + (a.flower === n ? ' selected' : '') + '>FLOWER ' + n + '</option>';
              }).join('') + '</select>';
          }
          li.innerHTML =
            '<span class="card-step">' + (i + 1) + '</span>' +
            '<span class="card-icon">' + icon(def.icon) + '</span>' +
            '<span class="card-main">' +
              '<span class="card-title">' + esc(def.label) + '</span>' +
              '<span class="card-badges">' + cardBadges(a, flags) + '</span>' +
              (f.illegal ? '<span class="card-warn">' + icon('i-warn') + ' ' + esc(f.message) + '</span>' : '') +
              (f.blocked ? '<span class="card-note">' + icon('i-warn') + ' ' + esc(f.message) + '</span>' : '') +
              (f.ignored ? '<span class="card-warn">' + icon('i-warn') + ' ' + esc(f.ignored) + '</span>' : '') +
            '</span>' +
            '<span class="card-options">' + flowerSel + '</span>' +
            '<span class="card-tools">' +
              '<button type="button" class="icobtn" data-act="up" data-uid="' + a.uid + '" title="Chuyển lên trước" aria-label="Chuyển ' + esc(def.label) + ' lên trước">▲</button>' +
              '<button type="button" class="icobtn" data-act="down" data-uid="' + a.uid + '" title="Chuyển xuống sau" aria-label="Chuyển ' + esc(def.label) + ' xuống sau">▼</button>' +
              (f.illegal && def.lateOnly ? '<button type="button" class="icobtn icobtn-fix" data-act="fix" data-uid="' + a.uid + '" title="Chuyển sang 60 giây cuối của ĐIỀU KHIỂN" aria-label="Chuyển ' + esc(def.label) + ' sang 60 giây cuối">↷</button>' : '') +
              '<button type="button" class="icobtn icobtn-del" data-act="del" data-uid="' + a.uid + '" title="Xóa" aria-label="Xóa ' + esc(def.label) + '">✕</button>' +
            '</span>';
          ol.appendChild(li);
        });
      });
    });
  }

  function bar(value, threshold) {
    return Math.max(0, Math.min(100, (value / threshold) * 100)).toFixed(1);
  }

  function renderScore(snap, isLive) {
    var r = result;
    var autoPts = isLive ? snap.liveAuto : r.autoPoints;
    var teleopPts = isLive ? snap.liveTeleop : r.teleopPoints;
    $('#scoreAuto').textContent = autoPts;
    $('#scoreTeleop').textContent = teleopPts;
    $('#scoreTotal').textContent = autoPts + teleopPts;
    $('#scoreLiveTag').hidden = !isLive;

    var mk = function (rows) {
      return rows.map(function (b) {
        return '<tr' + (b.n ? '' : ' class="is-zero"') + '><th scope="row">' + esc(b.label) + '</th>' +
               '<td class="num">' + b.n + '</td><td class="num mute">×' + b.each + '</td>' +
               '<td class="num strong">' + b.pts + '</td></tr>';
      }).join('');
    };
    $('#breakAuto').innerHTML = mk(r.breakdown.auto);
    $('#breakTeleop').innerHTML = mk(r.breakdown.teleop);

    // ranking points
    var rp = r.rp;
    var set = function (pfx, o, unit) {
      $('#' + pfx + 'Val').textContent = o.value + ' / ' + o.threshold + ' ' + unit;
      $('#' + pfx + 'Bar').style.width = bar(o.value, o.threshold) + '%';
      $('#' + pfx + 'Row').classList.toggle('is-earned', o.earned);
      $('#' + pfx + 'Chk').textContent = o.earned ? '✓ đạt · +1 ĐX' : '';
    };
    set('swarm', rp.swarm, 'pts');
    set('poll1', rp.pollinator1, 'TIPS');
    set('poll2', rp.pollinator2, 'TIPS');
    $('#rpTotal').textContent = rp.total;

    // penalties this plan concedes
    var pen = $('#penaltyBox');
    if (r.opponentFoulPoints > 0) {
      pen.hidden = false;
      $('#penaltyText').innerHTML =
        '<strong>' + r.opponentFoulPoints + ' điểm được cộng cho liên minh đối thủ.</strong> ' +
        r.counts.illegalFlowerNectar + ' × LỖI NẶNG (' + R.FOULS.MAJOR + ' điểm mỗi lỗi) do ' +
        'đưa NECTAR vào FLOWER trước 60 giây cuối — ' + esc(R.RULES.G410.code) + '.';
    } else {
      pen.hidden = true;
    }

    // advisory: elements sitting in flowers you do not own
    var adv = $('#advisoryBox');
    var msgs = [];
    if (r.unownedFlowerElements > 0) {
      var one = r.unownedFlowerElements === 1;
      msgs.push(r.unownedFlowerElements + ' bóng đang nằm trong ' + (one ? 'FLOWER' : 'các FLOWER') +
        ' mà liên minh của bạn không sở hữu, nên không ghi điểm cho đội bạn. ' +
        'Liên minh có NECTAR nằm cao nhất sẽ sở hữu hoa. Hãy xem kế hoạch của đối thủ trước khi chọn mục tiêu cuối cùng.');
    }
    var unstocked = r.counts.unstockedPollen + r.counts.unstockedNectar;
    if (unstocked > 0) {
      msgs.push(unstocked + ' hành động bắn hoặc ghi điểm bằng bóng mà robot không giữ tại thời điểm đó (' +
        r.counts.unstockedPollen + ' POLLEN, ' + r.counts.unstockedNectar + ' NECTAR), nên không được tính điểm. ' +
        'Hãy thêm hành động Thu thập trước mỗi lần. Khi bắt đầu trận, mỗi robot có sẵn ' +
        R.INVENTORY.pollenPreloadedPerRobot + ' POLLEN và không có NECTAR.');
    }
    if (r.counts.unavailableNectar > 0) {
      msgs.push(r.counts.unavailableNectar + ' hành động Thu thập NECTAR không có bóng để lấy tại thời điểm đó. ' +
        R.NECTAR_FLOW.reservePerAlliance + ' NECTAR dự trữ của liên minh được phát ra mỗi lần TỔ NGHIÊNG và phát hết khi trận còn 60 giây, ' +
        'vì vậy chưa thể lấy NECTAR trước lần nghiêng tổ đầu tiên.');
    }
    adv.hidden = msgs.length === 0;
    $('#advisoryText').innerHTML = msgs.map(esc).join('<br>');
  }

  function renderStats(snap) {
    $('#statTips').textContent = snap.tips;
    $('#statFill').textContent = snap.fill + ' / ' + R.HIVE.threshold;
    $('#statCell').textContent = snap.cellCount;
    $('#statCellUp').textContent = snap.cellUp === 0 ? 'CELL A' : 'CELL B';
    $('#statGarden').textContent = snap.garden;
    $('#statNectarPlay').textContent = snap.nectarInPlay;
    $('#statNectarReserve').textContent = snap.nectarReserve;
    $('#statNectarLoose').textContent = snap.nectarLoose;
    var fl = snap.flowers.map(function (f, i) {
      var n = f.pollen + f.nectar;
      return '<li class="fl' + (f.owned ? ' is-owned' : '') + '">' +
        '<span class="fl-n">H' + (i + 1) + '</span>' +
        '<span class="fl-own">' + (f.owner ? (f.owner === 'red' ? 'ĐỎ' : 'XANH') : (n ? 'chưa có chủ' : '—')) + '</span>' +
        '<span class="fl-count">' + n + '</span>' +
        '<span class="fl-bonus">' + (f.bottomBonus ? '+5' : '') + '</span></li>';
    }).join('');
    $('#flowerStats').innerHTML = fl;
    var rs = snap.robots.map(function (rb, i) {
      var pill = function (on, label) { return '<span class="pill' + (on ? ' is-on' : '') + '">' + label + '</span>'; };
      return '<li><span class="rs-name">Robot ' + (i + 1) + '</span>' +
        pill(rb.leave, 'RỜI TƯỜNG') + pill(rb.parkAuto, 'ĐỖ TĐ') + pill(rb.parkTeleop, 'ĐỖ ĐK') +
        '<span class="rs-hold" title="Các bóng robot đang giữ">' +
          '<span class="hold-p">' + rb.heldPollen + 'P</span>' +
          '<span class="hold-n">' + rb.heldNectar + 'N</span>' +
        '</span></li>';
    }).join('');
    $('#robotStats').innerHTML = rs;
  }

  /* ---------------- master refresh ---------------- */
  function refresh(opts) {
    opts = opts || {};
    stopPlayback(true);
    match = root.BBMatch.simulate(plans, simOptions());
    result = match.results[plan.alliance];
    result.events = match.events.map(function (e) {
      return Object.assign({}, e, { snapshot: e.matchSnapshot[plan.alliance] });
    });
    $('#editingAlliance').textContent = 'Kế hoạch liên minh ' + (plan.alliance === 'red' ? 'ĐỎ' : 'XANH');
    renderTiming();
    $('#selectedScoreTitle').textContent = 'Chi tiết điểm liên minh ' + (plan.alliance === 'red' ? 'ĐỎ' : 'XANH');
    $('#clearBtn').textContent = 'Xóa kế hoạch ' + (plan.alliance === 'red' ? 'ĐỎ' : 'XANH');
    $('#editorAlliance').value=plan.alliance;
    buildLanes();
    eventByUid = {};
    result.events.forEach(function (e) { if (e.uid) { eventByUid[e.uid] = e; } });

    renderCards();
    renderScore(result.final, false);
    renderStats(result.final);
    renderPlayback();

    FIELD.clearFx();
    FIELD.renderMatch(match.final, 'final');
    renderMatchScore(match.final, false);

    if(root.BBEase)root.BBEase.update(match,plans,plan.alliance);
    if(root.BBRecipes)root.BBRecipes.render();
    if (opts.focus) {
      var card = $('.card[data-uid="' + opts.focus + '"]');
      if (card) { card.focus(); }
    }
  }

  /* =====================================================================
     PLAYBACK
     ===================================================================== */
  function renderPlayback() {
    var n = result.events.some(function (e) { return e.kind === 'action'; }) ? result.events.length : 0;
    var sl = $('#playSlider');
    sl.max = String(Math.max(0, n));
    sl.value = String(play.idx + 1);
    sl.disabled = n === 0;
    $('#playBtn').disabled = n === 0;
    $('#stepBack').disabled = n === 0;
    $('#stepFwd').disabled = n === 0;
    updatePlayLabel();
  }
  function updatePlayLabel() {
    var n = result.events.some(function (e) { return e.kind === 'action'; }) ? result.events.length : 0;
    if (play.idx < 0) {
      $('#playLabel').textContent = n ? 'Sẵn sàng · đã lên kế hoạch ' + n + ' bước' : 'Chưa có hành động nào trong kế hoạch';
      updateClock(0);
      $('#phaseTrack').dataset.phase = '';
      return;
    }
    var ev = result.events[play.idx];
    var phaseName = ev.kind !== 'action' ? ev.label
      : zoneMeta(ev.zone).name;
    updateClock(ev.time);
    $('#playLabel').textContent = ev.time.toFixed(1) + ' giây · Bước ' + (play.idx + 1) + '/' + n + ' · ' +
      (ev.kind !== 'action' ? ev.label : 'Liên minh ' + (ev.alliance === 'red' ? 'ĐỎ' : 'XANH') + ' · Robot ' + (ev.robot + 1) + ' · ' + phaseName + ' · ' + R.ACTIONS[ev.type].label);
    $('#phaseTrack').dataset.phase = ev.time < 30 ? 'auto' : ev.time < 38 ? '' : ev.time < 98 ? 'teleopEarly' : 'teleopLate';
    $('#playSlider').value = String(play.idx + 1);
  }

  function showStep(i, animate, resume) {
    var n = result.events.some(function (e) { return e.kind === 'action'; }) ? result.events.length : 0;
    play.idx = Math.max(-1, Math.min(n - 1, i));
    if (play.idx < 0) {
      FIELD.clearFx();
      FIELD.renderMatch(match.initial, 'auto');
      renderMatchScore(match.initial, true);
      renderScore(result.initial, true);
      renderStats(result.initial);
      updatePlayLabel();
      highlightCard(null);
      return 0;
    }
    var ev = result.events[play.idx];
    var phase = ev.kind === 'boundary' ? 'teleop' : ev.phase;
    var wait = 0;
    if (animate) {
      var prev = play.idx > 0 ? result.events[play.idx - 1].snapshot : result.initial;
      if (!resume) FIELD.renderMatch(play.idx > 0 ? result.events[play.idx - 1].matchSnapshot : match.initial, phase);
      wait = FIELD.playEvent(ev, phase, Number($('#playSpeed').value), updateClock, finishEvent);
    } else {
      FIELD.clearFx();
      FIELD.renderMatch(ev.matchSnapshot, phase);
    }
    function finishEvent() {
      var isLive=play.idx<n-1;
      renderMatchScore(ev.matchSnapshot,isLive);renderScore(ev.snapshot,isLive);renderStats(ev.snapshot);
      updatePlayLabel();
    }
    if(!animate)finishEvent();
    highlightCard(ev.uid||null);
    return wait;
  }

  function highlightCard(u) {
    $$('.card.is-playing').forEach(function (c) { c.classList.remove('is-playing'); });
    if (!u) { return; }
    var c = $('.card[data-uid="' + u + '"]');
    if (c) {
      c.classList.add('is-playing');
    }
  }

  function startPlayback() {
    if (!result.events.length || play.running || play.starting) { return; }
    play.starting = true;
    $('#playBtn').textContent = 'Đang đồng bộ âm thanh...';
    playStartAudio().then(function () {
      if (!play.starting) return;
      play.starting = false;
      play.running = true;
      $('#playBtn').textContent = '⏸ Tạm dừng';
      $('#playBtn').setAttribute('aria-label', 'Tạm dừng phát lại');
      document.body.classList.add('is-playing');
      if (play.idx >= result.events.length - 1) { play.idx = -1; showStep(-1, false); }
      if (play.pausedMid) { play.pausedMid=false; var wait=showStep(play.idx,true,true); play.timer=setTimeout(tick,Math.max(16,wait)); } else tick();
    });
  }
  function tick() {
    if (!play.running) { return; }
    if (play.idx >= result.events.length - 1) { finishPlayback(); return; }
    var wait = showStep(play.idx + 1, true);
    play.timer = setTimeout(tick, Math.max(16, wait));
  }
  function finishPlayback() {
    play.running = false;
    clearTimeout(play.timer);
    stopStartAudio();
    FIELD.clearFx();
    $('#playBtn').textContent = '▶ Chạy kế hoạch';
    $('#playBtn').setAttribute('aria-label', 'Chạy kế hoạch');
    document.body.classList.remove('is-playing');
      FIELD.renderMatch(match.final, 'final');
      renderMatchScore(match.final, false);
      renderScore(result.final, false);
      renderStats(result.final);
      highlightCard(null);
      play.idx = result.events.length - 1;
      updatePlayLabel();
  }
  function stopPlayback(silent) {
    play.pausedMid=false;
    play.starting = false;
    play.running = false;
    clearTimeout(play.timer);
    stopStartAudio();
    play.idx = -1;
    var b = $('#playBtn');
    if (b) { b.textContent = '▶ Chạy kế hoạch'; b.setAttribute('aria-label', 'Chạy kế hoạch'); }
    document.body.classList.remove('is-playing');
    if (!silent) { highlightCard(null); }
  }

  /* =====================================================================
     DRAG AND DROP  (mouse path; every action also has a click/key path)
     ===================================================================== */
  var drag = { mode: null, type: null, uid: null };
  var marker = null;

  function ensureMarker() {
    if (!marker) {
      marker = document.createElement('li');
      marker.className = 'drop-marker';
      marker.setAttribute('aria-hidden', 'true');
    }
    return marker;
  }
  function clearMarker() {
    if (marker && marker.parentNode) { marker.parentNode.removeChild(marker); }
  }
  function indexFor(ol, y) {
    var cards = $$('.card', ol);
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { return i; }
    }
    return cards.length;
  }

  function wireDnD() {
    document.addEventListener('dragstart', function (e) {
      var pal = e.target.closest ? e.target.closest('.pal-card') : null;
      var card = e.target.closest ? e.target.closest('.card') : null;
      if (pal) {
        drag = { mode: 'new', type: pal.dataset.type, uid: null };
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', 'bb-new:' + pal.dataset.type);
        pal.classList.add('is-dragging');
        document.body.classList.add('is-dragging-new');
      } else if (card) {
        drag = { mode: 'move', type: null, uid: card.dataset.uid };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'bb-move:' + card.dataset.uid);
        card.classList.add('is-dragging');
        document.body.classList.add('is-dragging-move');
      }
    });

    document.addEventListener('dragend', function () {
      $$('.is-dragging').forEach(function (n) { n.classList.remove('is-dragging'); });
      $$('.zone.is-over').forEach(function (n) { n.classList.remove('is-over'); });
      document.body.classList.remove('is-dragging-new', 'is-dragging-move');
      $('#bin').classList.remove('is-over');
      clearMarker();
      drag = { mode: null, type: null, uid: null };
    });

    document.addEventListener('dragover', function (e) {
      if (!drag.mode) { return; }
      var bin = e.target.closest ? e.target.closest('#bin') : null;
      if (bin && drag.mode === 'move') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        bin.classList.add('is-over');
        clearMarker();
        return;
      }
      $('#bin').classList.remove('is-over');
      var zone = e.target.closest ? e.target.closest('.zone') : null;
      if (!zone) { clearMarker(); return; }
      var type = drag.mode === 'new' ? drag.type : (findAction(drag.uid) || {}).action;
      type = drag.mode === 'new' ? drag.type : (type ? type.type : null);
      if (!type) { return; }
      var allowed = R.ACTIONS[type].zones.indexOf(zone.dataset.zone) >= 0;
      if (!allowed) { zone.classList.add('is-over', 'is-bad'); clearMarker(); e.dataTransfer.dropEffect = 'none'; return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = drag.mode === 'new' ? 'copy' : 'move';
      $$('.zone.is-over').forEach(function (n) { n.classList.remove('is-over', 'is-bad'); });
      zone.classList.add('is-over');
      var ol = $('.lane-list', zone);
      var idx = indexFor(ol, e.clientY);
      var m = ensureMarker();
      var cards = $$('.card', ol);
      var empty = $('.lane-empty', ol);
      if (empty) { empty.style.display = 'none'; }
      if (idx >= cards.length) { ol.appendChild(m); } else { ol.insertBefore(m, cards[idx]); }
    });

    document.addEventListener('dragleave', function (e) {
      var zone = e.target.closest ? e.target.closest('.zone') : null;
      if (zone && !zone.contains(e.relatedTarget)) { zone.classList.remove('is-over', 'is-bad'); }
    });

    document.addEventListener('drop', function (e) {
      if (!drag.mode) { return; }
      var bin = e.target.closest ? e.target.closest('#bin') : null;
      if (bin && drag.mode === 'move') { e.preventDefault(); removeAction(drag.uid); return; }
      var zone = e.target.closest ? e.target.closest('.zone') : null;
      if (!zone) { return; }
      e.preventDefault();
      var ol = $('.lane-list', zone);
      var idx = marker && marker.parentNode === ol ? Array.prototype.indexOf.call(ol.children, marker) : indexFor(ol, e.clientY);
      // the marker occupies a slot; count only real cards before it
      var before = 0;
      for (var i = 0; i < idx; i++) { if (ol.children[i].classList.contains('card')) { before++; } }
      clearMarker();
      var ri = parseInt(zone.dataset.robot, 10);
      var zk = zone.dataset.zone;
      if (drag.mode === 'new') { addAction(ri, zk, drag.type, before); }
      else { relocate(drag.uid, ri, zk, before); }
    });
  }

  /* =====================================================================
     CLICK / KEYBOARD PATHS
     ===================================================================== */
  function wireClicks() {
    // palette click -> add to the chosen target
    document.addEventListener('click', function (e) {
      var pal = e.target.closest ? e.target.closest('.pal-card') : null;
      if (pal) {
        var ri = parseInt($('#paletteRobot').value, 10);
        var zk = pal.dataset.group === 'auto' ? 'auto' : $('#paletteSegment').value;
        addAction(ri, zk, pal.dataset.type, null);
        return;
      }
      var addBtn = e.target.closest ? e.target.closest('.zone-add-btn') : null;
      if (addBtn) {
        var zone = addBtn.closest('.zone');
        var sel = $('.zone-add-select', zone);
        addAction(parseInt(zone.dataset.robot, 10), zone.dataset.zone, sel.value, null);
        return;
      }
      var tool = e.target.closest ? e.target.closest('.icobtn') : null;
      if (tool) {
        var u = tool.dataset.uid;
        if (tool.dataset.act === 'up') { moveWithin(u, -1); }
        else if (tool.dataset.act === 'down') { moveWithin(u, 1); }
        else if (tool.dataset.act === 'del') { removeAction(u); }
        else if (tool.dataset.act === 'fix') {
          var loc = findAction(u);
          if (loc) { relocate(u, loc.robot, 'teleopLate', null); }
        }
        return;
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target.matches('.card-quantity, .card-source, .card-defense, .card-defense-level')) {
        var changed = findAction(e.target.dataset.uid);
        if (changed) { if (e.target.matches('.card-quantity')) changed.action.quantity = Number(e.target.value); else if(e.target.matches('.card-defense-level'))changed.action.defenseLevel=e.target.value;else if(e.target.matches('.card-defense'))changed.action.lane=Number(e.target.value);else changed.action.source=e.target.value; refresh({}); }
        return;
      }
      var fs = e.target.closest ? e.target.closest('.card-flower') : null;
      if (fs) {
        var loc = findAction(fs.dataset.uid);
        if (loc) { loc.action.flower = parseInt(fs.value, 10); refresh({ preview: fs.dataset.uid }); }
      }
    });

    // keyboard on a focused card
    document.addEventListener('keydown', function (e) {
      var card = e.target.closest ? e.target.closest('.card') : null;
      if (!card || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { return; }
      var u = card.dataset.uid;
      if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); moveWithin(u, -1); }
      else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); moveWithin(u, 1); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeAction(u); }
    });

    // palette cards must respond to Enter/Space as buttons do — they are <button>s, so this is free.

    $('#editorAlliance').addEventListener('change',function(){selectEditor(this.value);});
    $('#clearBtn').addEventListener('click', clearAll);
    $('#demoBtn').addEventListener('click', loadDemo);
    ['matchMode','playingAlliance','singleRobot','defenseTactic'].forEach(id=>$('#'+id).addEventListener('change',function(){
      $('#singleRobotLabel').hidden=$('#matchMode').value!=='single';
      $('#randomOpponentBtn').hidden=$('#matchMode').value!=='opponent';
      $('.board-sub').textContent=$('#matchMode').selectedOptions[0].textContent+' / '+$('#playingAlliance').value.toUpperCase();
      $('#modeNote').textContent=$('#matchMode').value==='single'||$('#matchMode').value==='alliance'?'Chế độ luyện tập: các robot không hoạt động sẽ bị ẩn. POLLEN nạp sẵn của chúng được đặt trên sàn. Kế hoạch đã lưu được giữ lại khi đổi chế độ.':'Hai liên minh thi đấu với nhau. Va chạm nhẹ khiến robot phải đổi vị trí và ngắm lại; bóng bắn trượt không tự động bị trừ điểm. Khi tạo đối thủ, kế hoạch của bạn được giữ nguyên; hãy kiểm tra cảnh báo xung đột tài nguyên dùng chung.';
      if(id==='playingAlliance'||id==='matchMode'||id==='singleRobot'){plan=plans[$('#playingAlliance').value];FIELD.setAlliance(plan.alliance);document.documentElement.setAttribute('data-alliance',plan.alliance);$('#paletteRobot').value=$('#matchMode').value==='single'?$('#singleRobot').value:'0';}
      refresh({});
      if(id==='matchMode'&&this.value==='opponent')randomOpponent();
    }));
    $('#randomOpponentBtn').addEventListener('click',randomOpponent);
    Object.keys(settings).forEach(function(key){$('#'+key).addEventListener('change',function(){var input=this;if(!input.checkValidity()){input.reportValidity();return;}settings[key]=Number(input.value);refresh({});});});
    $('#viewAngled').addEventListener('click', function () { FIELD.setView('angled'); });
    $('#viewHives').addEventListener('click', function () { FIELD.setView('hives'); });
    $('#viewTop').addEventListener('click', function () { FIELD.setView('top'); });

    $('#playBtn').addEventListener('click', function () {
      if (play.running || play.starting) { finishPlaybackQuiet(); play.pausedMid=true; } else { startPlayback(); }
    });
    $('#stepBack').addEventListener('click', function () { finishPlaybackQuiet(); showStep(play.idx - 1, false); });
    $('#stepFwd').addEventListener('click', function () { finishPlaybackQuiet(); showStep(play.idx + 1, true); });
    $('#resetBtn').addEventListener('click', function () { finishPlaybackQuiet(); showStep(-1, false); });
    $('#playSlider').addEventListener('input', function (e) {
      finishPlaybackQuiet();
      showStep(parseInt(e.target.value, 10) - 1, false);
    });
  }
  function finishPlaybackQuiet() {
    play.pausedMid=false;
    play.starting = false;
    play.running = false;
    clearTimeout(play.timer);
    stopStartAudio();
    FIELD.clearFx();
    $('#playBtn').textContent = '▶ Chạy kế hoạch';
    $('#playBtn').setAttribute('aria-label', 'Chạy kế hoạch');
    document.body.classList.remove('is-playing');
  }

  function selectEditor(color) {
    plan = plans[color];
    document.documentElement.setAttribute('data-alliance', color);
    FIELD.setAlliance(color);
    refresh({});
    say('Đang chỉnh sửa liên minh ' + (color === 'red' ? 'ĐỎ' : 'XANH') + '. Kế hoạch của cả hai liên minh vẫn được giữ và hiển thị trên sân.');
  }

  function updateClock(t) {
    var end=t<30?30:t<38?38:158,remain=Math.max(0,end-t),title=t<30?'TỰ ĐỘNG':t<38?'CHUYỂN TIẾP':t<158?'ĐIỀU KHIỂN':'KẾT THÚC TRẬN';
    $('#matchClock').textContent=title+' · còn '+Math.floor(remain/60)+':'+String(Math.ceil(remain%60)).padStart(2,'0');
  }
  function renderTiming() {
    var lines=[];
    ['red','blue'].forEach(function(c){match.usage[c].forEach(function(u,i){lines.push('<div><strong>'+(c==='red'?'ĐỎ':'XANH')+' · Robot '+(i+1)+'</strong> TỰ ĐỘNG '+(u.auto||0).toFixed(1)+'/30 giây hoạt động · ĐIỀU KHIỂN '+(u.teleop||0).toFixed(1)+'/120 giây hoạt động · Phút đầu '+(u.teleopEarly||0).toFixed(1)+'/60 giây · Phút cuối '+(u.teleopLate||0).toFixed(1)+'/60 giây</div>');});});
    var failures=Object.values(match.results).reduce(function(n,r){return n+Object.values(r.flags).filter(f=>f.blocked).length;},0);
    lines.push('<p>'+failures+' hành động bị chặn hoặc quá thời gian. Chỉ các hành động có thể thực hiện và đã hoàn tất mới ảnh hưởng đến số bóng và điểm số.</p>');
    $('#timingSummary').innerHTML=lines.join('');
  }

  function renderMatchScore(s, live) {
    ['red', 'blue'].forEach(function (c) {
      $('#' + c + 'MatchScore').textContent = s[c].matchTotal;
      $('#' + c + 'MatchMeta').textContent = s[c].tips + ' lần nghiêng tổ · ' + s[c].foulCredit + ' điểm phạt được cộng';
      $('#' + c + 'HiveReadout').textContent = 'Ô ' + (s[c].cellUp ? 'B' : 'A') + ' hướng lên · đã nạp ' + s[c].fill + '/40 · bên trong có ' + s[c].cellCount;
    });
    var lead = s.red.matchTotal - s.blue.matchTotal;
    $('#matchOutcome').textContent = (live ? 'Kết quả hiện tại: ' : 'Kết quả dự kiến: ') + (lead === 0 ? 'hòa' : 'liên minh ' + (lead > 0 ? 'ĐỎ' : 'XANH') + ' dẫn ' + Math.abs(lead) + ' điểm');
    $('#outcomeRP').textContent = result.rp.outcome + ' ĐXH · kế hoạch cuối';
  }

  /* =====================================================================
     BOOT
     ===================================================================== */
  function init() {
    FIELD.mount($('#fieldSvg'));
    FIELD.setAlliance(plan.alliance);
    document.documentElement.setAttribute('data-alliance', plan.alliance);
    buildPalette();
    buildLanes();
    wireDnD();
    wireClicks();
    // fill in the numbers that are quoted in prose so nothing is hard-coded twice
    $$('[data-fill]').forEach(function (n) {
      var path = n.dataset.fill.split('.');
      var v = R;
      path.forEach(function (p) { v = v[p]; });
      n.textContent = v;
    });
    refresh({});
    say('Bắt đầu bằng cách thử trận mẫu hoặc mở mục Chỉnh sửa chiến thuật để thêm bước đầu tiên.');
  }

  function exportStrategy() {
    if ($('#demoBtn').disabled || $('#randomOpponentBtn').disabled) throw new Error('Hãy chờ tạo xong trận mẫu trước khi lưu.');
    return root.BBStrategyState.normalize({
      schemaVersion:1, plans:plans, settings:settings,
      setup:{matchMode:$('#matchMode').value, playingAlliance:$('#playingAlliance').value,
        singleRobot:$('#singleRobot').value, defenseTactic:$('#defenseTactic').value},
      editor:{alliance:plan.alliance, robot:$('#paletteRobot').value, phase:$('#paletteSegment').value}
    });
  }

  function importStrategy(snapshot, options) {
    options = options || {};
    if ($('#demoBtn').disabled || $('#randomOpponentBtn').disabled) throw new Error('Hãy chờ tạo xong trận mẫu trước khi tải chiến thuật.');
    const saved = root.BBStrategyState.normalize(snapshot);
    if (options.editor) saved.editor = options.editor;
    for (const color of ['red','blue']) saved.plans[color].robots.forEach(robot =>
      Object.values(robot.zones).forEach(actions => actions.forEach(action => { action.uid = uid(); })));
    const mode = saved.setup.matchMode, color = saved.setup.playingAlliance;
    // Validate/simulate before replacing the current work. Never trigger opponent generation on restore.
    root.BBMatch.simulate(saved.plans, Object.assign({}, saved.settings, {
      demoDefense:saved.setup.defenseTactic,
      activeRobots:mode === 'single' ? [color+'-'+saved.setup.singleRobot] :
        mode === 'alliance' ? [color+'-0',color+'-1'] : ['red-0','red-1','blue-0','blue-1']
    }), false);
    stopPlayback(true);
    plans = saved.plans;
    settings = saved.settings;
    plan = plans[saved.editor.alliance];
    Object.entries(saved.setup).forEach(([key,value]) => { $('#'+key).value = value; });
    Object.entries(settings).forEach(([key,value]) => { $('#'+key).value = value; });
    $('#paletteRobot').value = saved.editor.robot;
    $('#paletteSegment').value = saved.editor.phase;
    $('#singleRobotLabel').hidden = mode !== 'single';
    $('#randomOpponentBtn').hidden = mode !== 'opponent';
    $('.board-sub').textContent = $('#matchMode').selectedOptions[0].textContent+' / '+(color==='red'?'ĐỎ':'XANH');
    document.documentElement.setAttribute('data-alliance', plan.alliance);
    FIELD.setAlliance(plan.alliance);
    root.BBEase.loaded('Đã tải chiến thuật đã lưu', null, options.view);
    refresh({});
    say(options.view === 'edit' ? 'Đã tải công thức robot. Hãy xem lại hoặc chỉnh sửa, sau đó chọn Chạy thử cả trận.' : 'Đã khôi phục chiến thuật. Nhấn Chạy kế hoạch để thử hoặc chỉnh sửa kế hoạch của một trong hai liên minh.');
  }

  function exportRobotStrategy(color, index) {
    if ($('#demoBtn').disabled || $('#randomOpponentBtn').disabled) throw new Error('Hãy chờ tạo xong trận mẫu trước khi tải xuống.');
    return root.BBStrategyState.normalizeRobot({schemaVersion:2,kind:'dragonflow-robot-strategy',alliance:color,robotIndex:index,robot:plans[color]?.robots[index]});
  }
  function importRobotStrategy(payload, color, index, options) {
    if (!['red','blue'].includes(color) || ![0,1].includes(index)) throw new Error('Hãy chọn robot nhận hợp lệ.');
    const robot = root.BBStrategyState.normalizeRobot(payload).robot;
    const current = exportStrategy();
    current.plans[color].robots[index] = robot;
    // Preserve all other robot plans, match setup and shared timing assumptions.
    const phase = ['auto','teleopEarly','teleopLate'].find(key => robot.zones[key].length) || 'auto';
    importStrategy(current, {view:options?.keepView ? false : 'edit', editor:{alliance:color,robot:String(index),phase:phase}});
  }

  function clearRecipes(scope) {
    if (!['robot','all'].includes(scope)) return false;
    if ($('#demoBtn').disabled || $('#randomOpponentBtn').disabled) {
      say('Hãy chờ tạo xong trận mẫu trước khi xóa các công thức.', 'warn');
      return false;
    }
    if (scope === 'all') {
      ['red','blue'].forEach(color => { plans[color].robots = [newRobot(),newRobot()]; });
    } else {
      plan.robots[Number($('#paletteRobot').value)] = newRobot();
    }
    refresh({});
    return true;
  }

  root.BBUI = { init: init, clearRecipes:clearRecipes, exportRobotStrategy:exportRobotStrategy, importRobotStrategy:importRobotStrategy, exportStrategy:exportStrategy, importStrategy:importStrategy, get recipeFlags(){return result?result.flags:{};}, recipeCommit: function(actions) {
    var ri=Number($("#paletteRobot").value), zone=$("#paletteSegment").value;
    if(!simOptions().activeRobots.includes(plan.alliance+"-"+ri)){say("Robot này không hoạt động ở chế độ đã chọn.","warn");return false;}
    var once=new Set(),previous=plan.robots[ri].zones[zone];
    for(var a of actions){var def=R.ACTIONS[a.type];if(!def||((!def.zones.includes(zone)||(def.lateOnly&&zone!=="teleopLate"))&&!previous.some(old=>old.uid===a.uid))){say("Khối này không khả dụng trong giai đoạn này.","warn");return false;}
      if(def.once){if(once.has(a.type)){say("Công thức này lặp lại một thành tích chỉ được thực hiện một lần.","warn");return false;}once.add(a.type);
        if(def.once==="teleop"&&plan.robots[ri].zones[zone==="teleopEarly"?"teleopLate":"teleopEarly"].some(x=>x.type===a.type)){say("Robot này đã có thành tích đó trong giai đoạn điều khiển còn lại.","warn");return false;}}}
    plan.robots[ri].zones[zone]=actions.map(a=>Object.assign({},a,{uid:a.uid||uid()}));refresh({});return true;
  }, get _plan() { return plan; }, get _plans() { return plans; }, _simulate: function () { return root.BBMatch.simulate(plans, simOptions()); } };
  root.BBZStartAudio = { play: playStartAudio, stop: stopStartAudio };
})(typeof window !== 'undefined' ? window : globalThis);
/* Page controls: editor, driver station, gamepads and Build Bot. */
(function () {
'use strict';
const BBZ = window.BBZ, h = BBZ.h, J = BBZ.Java;
const $ = (id) => document.getElementById(id);
const KEY = 'bbz-practice-sim-v1';
const STEP = 1 / 120;
const MAX_PROGRAMS = 30, MAX_CODE = 60000;
const playStartAudio = () => window.BBZStartAudio.play();
const stopStartAudio = () => window.BBZStartAudio.stop();

const state = { robot: BBZ.defaultRobot(), programs: [], open: 0, auto: -1, tele: -1, speed: 1 };
let world = null;
let runner = null, runProg = null, started = false, startAt = 0, stopReq = false, matchOn = false;
let errInfo = null;              // { line, progId }
let pid = 1;

/* ---------- storage ---------- */
const cleanName = (s, def) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').slice(0, 40).trim() : '') || def || 'Chương trình mới';
/* Converts Blocks programs from the old editor into Java op modes. */
function convertLegacy(p) {
  const name = cleanName(p.name), mode = p.mode === 'auto' ? 'auto' : 'teleop', group = cleanGroup(p.group);
  let code;
  try { code = BBZ.Blocks.legacyJava({ name, mode, group, blocks: BBZ.Blocks.legacySanitize(p.blocks) }, state.robot); }
  catch (e) { code = '// This op mode was made with the old Blocks editor and could not be converted:\n// ' + String(e && e.message ? e.message : e).replace(/[\r\n]/g, ' ') + '\n'; }
  return { id: pid++, name: cleanName(name.slice(0, 26) + ' (was Blocks)'), lang: 'java', mode, group, desc: cleanDesc(p.desc), code: code.slice(0, MAX_CODE), blocks: [] };
}
function cleanProgram(p) {
  if (!p || typeof p !== 'object') return null;
  const lang = p.lang === 'blocks' ? 'blocks' : 'java';
  if (lang === 'blocks' && Array.isArray(p.blocks)) return convertLegacy(p);
  return {
    id: pid++, name: cleanName(p.name), lang, mode: p.mode === 'auto' ? 'auto' : 'teleop', group: cleanGroup(p.group), desc: cleanDesc(p.desc),
    code: lang === 'java' && typeof p.code === 'string' ? p.code.slice(0, MAX_CODE) : '',
    blocks: lang === 'blocks' ? BBZ.Blocks.sanitize(p.blocks) : [],
    ex: (typeof p.ex === 'string' && /^[a-z-]{1,30}$/.test(p.ex)) ? p.ex : '', sig: (typeof p.sig === 'string' && /^[0-9a-z]{1,16}$/.test(p.sig)) ? p.sig : ''
  };
}
/* A short fingerprint of a program's contents. */
function sigOf(p) {
  const s = p.lang === 'java' ? p.code : JSON.stringify(p.blocks);
  let a = 2166136261;
  for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619); }
  return (a >>> 0).toString(36) + s.length.toString(36);
}
const isPure = (p) => !!(p.ex && p.sig && sigOf(p) === p.sig);
function seed() {
  const list = BBZ.Samples.list(state.robot);
  state.programs = ['java-full', 'java-tip', 'blocks-full', 'blocks-tip'].map((id) => fromExample(list.find((e) => e.id === id)));
  normalise();
  state.open = 0; state.auto = state.programs.findIndex((p) => p.mode === 'auto'); state.tele = 0;
}
const cleanGroup = (s) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>"]/g, '').slice(0, 24).trim() : '') || 'Chương trình của tôi';
const cleanDesc = (s) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').slice(0, 140) : '');
function load() {
  let raw = null;
  try { raw = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
  if (raw && typeof raw === 'object') {
    state.robot = BBZ.sanitizeRobot(raw.robot);
    BBZ.Blocks.useRobot(state.robot);            /* block dropdowns must know this bot's device names before programs are read */
    if (Array.isArray(raw.programs)) state.programs = raw.programs.slice(0, MAX_PROGRAMS).map(cleanProgram).filter(Boolean); normalise();
    const idx = (v) => (typeof v === 'number' && Number.isInteger(v) && v >= -1 && v < state.programs.length) ? v : -1;
    state.open = Math.max(0, idx(raw.open)); state.auto = idx(raw.auto); state.tele = idx(raw.tele);
    state.speed = raw.speed === 2 || raw.speed === 4 ? raw.speed : 1;
  }
  if (!state.programs.length) seed();
  else renewOldExamples();
  fixMatchPicks();
}
/* Moves example op modes saved by an earlier version into an "Older versions" group. */
function renewOldExamples() {
  let list = null;
  const fresh = [];
  state.programs.forEach((p) => {
    if (p.ex || p.group !== 'Examples') return;
    list = list || BBZ.Samples.list(state.robot);
    const ex = list.find((e) => e.name === p.name && e.lang === p.lang);
    if (!ex || ex.why || state.programs.length + fresh.length >= MAX_PROGRAMS) return;
    try { fresh.push({ at: p, prog: fromExample(ex) }); } catch (e) { return; }
    p.name = cleanName(p.name.slice(0, 34) + ' (old)'); p.group = 'Older versions';
  });
  fresh.forEach((f) => { state.programs.splice(state.programs.indexOf(f.at), 0, f.prog); });
  if (fresh.length) normalise();
}
function fixMatchPicks() {
  const ok = (i, mode) => i >= 0 && state.programs[i] && state.programs[i].mode === mode;
  if (!ok(state.auto, 'auto')) state.auto = state.programs.findIndex((p) => p.mode === 'auto');
  if (!ok(state.tele, 'teleop')) state.tele = state.programs.findIndex((p) => p.mode === 'teleop');
  if (state.open >= state.programs.length) state.open = 0;
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({
        robot: state.robot, open: state.open, auto: state.auto, tele: state.tele, speed: state.speed,
        programs: state.programs.map((p) => ({ name: p.name, lang: p.lang, mode: p.mode, group: p.group, desc: p.desc, code: p.code, blocks: p.blocks, ex: p.ex || '', sig: p.sig || '' }))
      }));
    } catch (e) { /* storage can be unavailable; the page still works */ }
  }, 350);
}

let toastTimer = 0;
function notify(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
}

/* ---------- colours for the canvas, read from the theme tokens ---------- */
let col = null;
function readColors() {
  const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue(n).trim() || '#888';
  col = {
    bg: g('--sunk'), tile: g('--tile'), tileLine: g('--tile-line'), tileText: g('--tile-text'), wall: g('--wall'), muted: g('--muted'),
    red: g('--red'), blue: g('--blue'), pollen: g('--pollen'), ballEdge: g('--ball-edge'), hive: g('--hive'), accent: g('--honey'),
    body: g('--body'), part: g('--part'), wheel: g('--wheel'), wheelMark: g('--wheel-mark'), good: g('--good'), warn: g('--warn'),
    petal: g('--petal'), flowerCore: g('--flower-core'), meterBg: g('--meter-bg')
  };
}

/* ---------- telemetry, gamepads and hardware map handed to student code ---------- */
const tele = { pending: [], shown: null, dirty: true, update() { this.shown = this.pending.slice(0, 30); this.pending = []; this.dirty = true; } };
const PAD_KEYS = ['left_stick_x', 'left_stick_y', 'right_stick_x', 'right_stick_y', 'left_trigger', 'right_trigger', 'a', 'b', 'x', 'y',
  'left_bumper', 'right_bumper', 'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right', 'start', 'back', 'left_stick_button', 'right_stick_button', 'guide', 'touchpad'];
const ANALOG = { left_stick_x: 1, left_stick_y: 1, right_stick_x: 1, right_stick_y: 1, left_trigger: 1, right_trigger: 1 };
const blankPad = () => { const p = {}; PAD_KEYS.forEach((k) => { p[k] = ANALOG[k] ? 0 : false; }); return p; };
const pad = blankPad(), pad2 = blankPad();
function padApi(src) {
  const F = Object.create(null);
  PAD_KEYS.forEach((k) => { F[k] = () => src[k]; });
  F.cross = F.a; F.circle = F.b; F.square = F.x; F.triangle = F.y;
  F.options = F.start; F.share = F.back; F.ps = F.guide;                  /* the PlayStation names for the same buttons */
  return { __t: 'Gamepad', __f: F, __m: Object.create(null) };
}
const KIND_OF = { DcMotor: 'motor', DcMotorEx: 'motor', DcMotorSimple: 'motor', Servo: 'servo', IMU: 'imu', DistanceSensor: 'distance', Rev2mDistanceSensor: 'distance', WebcamName: 'camera', CameraName: 'camera' };
const KIND_LABEL = { motor: 'động cơ', servo: 'servo', imu: 'IMU', distance: 'cảm biến khoảng cách', camera: 'webcam' };
/* The vision objects student code gets from AprilTagProcessor and VisionPortal, shaped like the FTC SDK ones. */
function tagObject(d) {
  const P = Object.create(null), F = Object.create(null), MD = Object.create(null);
  P.range = () => d.range; P.bearing = () => d.bearing; P.yaw = () => d.yaw; P.x = () => d.x; P.y = () => d.y; P.z = () => 0;
  P.elevation = () => 0; P.pitch = () => 0; P.roll = () => 0;
  MD.id = () => d.id; MD.name = () => d.name; MD.tagsize = () => 4;
  const pose = { __t: 'AprilTagPoseFtc', __f: P, __m: Object.create(null) }, meta = { __t: 'AprilTagMetadata', __f: MD, __m: Object.create(null) };
  F.id = () => d.id; F.ftcPose = () => pose; F.metadata = () => meta; F.decisionMargin = () => 80;
  return { __t: 'AprilTagDetection', __f: F, __m: Object.create(null), __s: () => 'AprilTag ' + d.id };
}
function visionStatics(cls, name, a) {
  if (cls === 'AprilTagProcessor' && name === 'easyCreateWithDefaults') {
    const M = Object.create(null);
    const list = () => {
      const items = world.tagDetections().map(tagObject), L = Object.create(null);
      L.size = () => items.length; L.isEmpty = () => items.length === 0;
      L.get = (x) => { const i = x[0]; if (typeof i !== 'number' || i < 0 || i >= items.length) throw new Error('Danh sách có ' + items.length + ' kết quả nhận diện nên get(' + i + ') nằm ngoài phạm vi. Hãy kiểm tra size() trước.'); return items[i]; };
      return { arr: items, __t: 'List', __m: L, __s: () => items.length + ' AprilTag detection(s)' };
    };
    M.getDetections = list; M.getFreshDetections = list; M.setDecimation = () => undefined;
    return { __t: 'AprilTagProcessor', __m: M };
  }
  if (cls === 'VisionPortal' && name === 'easyCreateWithDefaults') {
    if (!a[0] || a[0].__t !== 'WebcamName') throw new Error('VisionPortal.easyCreateWithDefaults cần webcam ở tham số đầu tiên, ví dụ hardwareMap.get(WebcamName.class, "' + state.robot.names.camera + '").');
    if (!a[1] || a[1].__t !== 'AprilTagProcessor') throw new Error('VisionPortal.easyCreateWithDefaults cần AprilTagProcessor làm tham số thứ hai.');
    const M = Object.create(null);
    M.close = () => undefined; M.stopStreaming = () => undefined; M.resumeStreaming = () => undefined; M.setProcessorEnabled = () => undefined;
    M.getCameraState = () => 'STREAMING';
    return { __t: 'VisionPortal', __m: M };
  }
  return undefined;
}
function getDevice(cls, name) {
  if (typeof name !== 'string') throw new Error('hardwareMap.get cần tên thiết bị đặt trong dấu ngoặc kép, ví dụ hardwareMap.get(DcMotor.class, "fl").');
  let d = world.device(name);
  if (!d && name === 'Webcam 1') d = world.device(state.robot.names.camera);          // the usual name on a real robot
  if (!d && KIND_OF[cls] === 'camera' && !state.robot.tools.camera) throw new Error('Robot chưa có webcam. Hãy bật "Webcam (AprilTags)" trong mục Cảm biến ở tab Lắp robot rồi chạy lại.');
  if (!d) throw new Error('Robot không có thiết bị tên "' + name + '". Các thiết bị hiện có: ' + BBZ.deviceList(state.robot).map((x) => x.name).join(', ') + '. Tên phải khớp chính xác với mục Lắp robot, kể cả chữ hoa.');
  if (cls) {
    const want = KIND_OF[cls];
    if (!want) throw new Error('Mô phỏng không có loại thiết bị ' + cls + '. Hãy dùng DcMotor, Servo, IMU, DistanceSensor hoặc WebcamName.');
    if (want !== d.kind) throw new Error('"' + name + '" là ' + KIND_LABEL[d.kind] + ', nhưng chương trình đang yêu cầu ' + cls + '.');
  }
  return d.api;
}
function makeHost() {
  const t0 = world.time;
  const say = (text) => { if (tele.pending.length < 40) tele.pending.push(String(text).slice(0, 160)); };
  const TM = Object.create(null);
  TM.addData = (a, ints) => {
    const v = (a.length > 2 && typeof a[1] === 'string') ? J.javaFormat(a[1], a.slice(2), ints.slice(2)) : J.jstr(a[1], ints[1]);
    say(J.jstr(a[0], ints[0]) + ' : ' + v); return null;
  };
  TM.addLine = (a, ints) => { say(a.length ? J.jstr(a[0], ints[0]) : ''); return null; };
  TM.update = () => { tele.update(); return true; };
  TM.clear = () => { tele.pending = []; };
  TM.clearAll = TM.clear;
  TM.setAutoClear = () => undefined; TM.speak = () => undefined; TM.setMsTransmissionInterval = () => undefined;
  const sub = (cls) => { const M = Object.create(null); M.get = (a) => getDevice(cls, a[0]); return { __t: 'DeviceMapping', __m: M }; };
  const HM = Object.create(null), HF = Object.create(null);
  HM.get = (a) => a.length >= 2 ? getDevice(a[0] && a[0].name, a[1]) : getDevice(null, a[0]);
  HF.dcMotor = () => sub('DcMotor'); HF.servo = () => sub('Servo');
  return {
    now: () => world.time - t0,
    isStarted: () => started,
    isStopRequested: () => stopReq,
    statics: visionStatics,
    requestStop: () => { stopReq = true; },
    log: (s) => addLog('info', 'Printed: ' + String(s).slice(0, 200)),
    flushTelemetry: () => { if (tele.pending.length) tele.update(); },
    telemetry: { __t: 'Telemetry', __m: TM },
    hardwareMap: { __t: 'HardwareMap', __m: HM, __f: HF },
    gamepad1: padApi(pad), gamepad2: padApi(pad2)
  };
}

/* ---------- running programs ---------- */
const openProg = () => state.programs[state.open] || null;
function setStatus(s) { $('dsStatus').textContent = s; }
function clearError() {
  errInfo = null;
  const c = $('console'); c.className = 'console'; c.textContent = 'Không phát hiện lỗi. Lỗi trong mã sẽ hiện ở đây kèm số dòng.';
  $('errLine').hidden = true;
}
function showError(e, prog) {
  prog = prog || runProg || openProg();
  const line = e && e.line ? e.line : 0, msg = (e && e.message) ? e.message : String(e);
  let text;
  if (prog && prog.lang === 'blocks') text = line ? 'Lỗi trong khối (dòng ' + line + ' của mã Java được tạo): ' + msg : msg;
  else text = (line ? 'Dòng ' + line + ': ' : '') + msg;
  if (prog && prog !== openProg()) text = 'Trong "' + prog.name + '": ' + text;
  const c = $('console'); c.className = 'console is-bad'; c.textContent = text;
  errInfo = (prog && prog.lang === 'java' && line) ? { line, progId: prog.id } : null;
  if (errInfo && prog === openProg()) { const ta = $('code'); ta.scrollTop = Math.max(0, (line - 6) * 20); }
  placeErrLine();
  addLog('foul', 'Chương trình đã dừng: ' + text);
}
function placeErrLine() {
  const el = $('errLine'), p = openProg();
  if (!errInfo || !p || p.id !== errInfo.progId || p.lang !== 'java') { el.hidden = true; return; }
  const y = 10 + (errInfo.line - 1) * 20 - $('code').scrollTop;
  if (y < -20 || y > $('code').clientHeight) { el.hidden = true; return; }
  el.hidden = false; el.style.top = y + 'px';
}
function startOpMode(prog) {
  endOpMode();
  clearError();
  let src;
  try { src = prog.lang === 'java' ? prog.code : BBZ.Blocks.generate(prog, state.robot); }
  catch (e) { showError(e, prog); return false; }
  world.newOpMode();
  tele.pending = []; tele.shown = null; tele.dirty = true;
  started = false; stopReq = false; startAt = world.time + 0.35;
  try { runner = J.start(src, makeHost()); }
  catch (e) { runner = null; showError(e, prog); return false; }
  runProg = prog; world.enabled = true;
  return true;
}
function endOpMode() {
  cancelCountdown();
  runner = null; runProg = null; started = false;
  if (world) world.stopActuators();
}
/* Ends a practice run. */
function endPractice() {
  if (world.mode !== 'practice' && world.mode !== 'autotest') return false;
  world.practiceDone();
  return true;
}
function runOpen() {
  const p = openProg();
  if (!p) return;
  /* An autonomous run always begins from a fresh field. */
  const fresh = p.mode === 'auto';
  if (matchOn || world.mode === 'over' || fresh) { endOpMode(); world.reset(); clearLog(); rebuildHw(); }
  matchOn = false;
  world.mode = fresh ? 'autotest' : 'practice';            /* an autonomous run on its own is scored as AUTO */
  if (startOpMode(p)) { playStartAudio(); setStatus('Đang chạy "' + p.name + '"' + (fresh ? ' từ vị trí xuất phát' : '') + '. Nhấn Dừng khi bạn muốn kết thúc.'); addLog('info', 'Đã chạy ' + p.name + (fresh ? ' trên sân mới (luyện tập, không tính giờ).' : ' (luyện tập, không tính giờ).')); }
  else { stopStartAudio(); world.mode = 'idle'; setStatus('Chương trình gặp sự cố. Hãy kiểm tra thông báo bên dưới trình soạn thảo.'); }
}
const sfx = (name) => { try { if (BBZ.Sound) BBZ.Sound.play(name); } catch (e) { /* sound is optional */ } };
let countTimer = 0;
function cancelCountdown() {
  if (countTimer) { clearTimeout(countTimer); countTimer = 0; }
  const o = $('countOverlay');
  if (o) o.hidden = true;
}
/* Shows a big number over the field and replays its pop animation. */
function showCount(text) {
  const o = $('countOverlay'), n = $('countNum');
  if (!o || !n) return;
  n.textContent = text;
  o.hidden = false;
  n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
}
/* Competition-style start: the field resets, "3, 2, 1" counts down with beeps, then the charge call starts AUTO. */
function runMatch() {
  playStartAudio();
  endOpMode();
  world.reset(); clearLog(); rebuildHw();
  matchOn = false; world.mode = 'idle';
  /* The op mode open in the editor plays in the match: as the autonomous or as the TeleOp, whichever it is. */
  const openNow = openProg(), at = state.programs.indexOf(openNow);
  if (openNow && at >= 0) {
    if (openNow.mode === 'auto') state.auto = at; else state.tele = at;
    matchList($('autoSel'), 'auto', state.auto); matchList($('teleSel'), 'teleop', state.tele); save();
  }
  const teleNow = state.programs[state.tele];
  setStatus('Người điều khiển, hãy rời tay khỏi nút bấm. TỰ ĐỘNG bắt đầu sau đếm ngược.' + (teleNow ? ' TELEOP sẽ chạy "' + teleNow.name + '".' : ''));
  let n = 3;
  const tick = () => {
    countTimer = 0;
    if (n === 0) {
      beginMatch();
      showCount('GO!'); sfx('charge');
      countTimer = setTimeout(cancelCountdown, 700);
      return;
    }
    showCount(String(n)); sfx('count');
    n--;
    countTimer = setTimeout(tick, 1000);
  };
  tick();
}
function beginMatch() {
  matchOn = true; world.mode = 'auto'; world.clock = 30;
  const p = state.programs[state.auto];
  addLog('info', 'Trận đấu bắt đầu. TỰ ĐỘNG: 30 giây, không có điều khiển từ người chơi.');
  if (p) {
    const keep = countTimer;                 /* starting an op mode clears timers; keep the one hiding "GO!" */
    countTimer = 0;
    const ok = startOpMode(p);
    countTimer = keep;
    if (!ok) { stopStartAudio(); matchOn = false; world.mode = 'idle'; setStatus('Chương trình Tự động gặp sự cố. Hãy sửa rồi thử lại.'); return; }
    setStatus('TỰ ĐỘNG: đang chạy "' + p.name + '".');
  } else setStatus('TỰ ĐỘNG: chưa chọn chương trình, robot sẽ chờ.');
}
function onPhase() {
  if (world.mode === 'transition') {
    endOpMode();
    addLog('info', 'Đã hết TỰ ĐỘNG. Nghỉ 8 giây: robot không được di chuyển.'); sfx('buzzer');
    setStatus('Chuẩn bị cho TELEOP. Người điều khiển sẵn sàng.');
  } else if (world.mode === 'teleop') {
    const p = state.programs[state.tele];
    addLog('info', 'TELEOP: 2 phút. Người điều khiển bắt đầu điều khiển robot.'); sfx('charge');
    if (p && startOpMode(p)) setStatus('TELEOP: đang chạy "' + p.name + '". Bắt đầu điều khiển!');
    else setStatus(p ? 'Chương trình TeleOp gặp sự cố. Đồng hồ trận đấu vẫn chạy.' : 'TELEOP: chưa chọn chương trình TeleOp.');
  } else if (world.mode === 'over') {
    endOpMode(); matchOn = false;
    stopStartAudio();
    const s = world.score();
    sfx('buzzerLong');
    addLog('good', 'Trận đấu kết thúc. Điểm cuối: ' + s.total + ', số lần nghiêng HIVE: ' + s.tips + '.');
    setStatus('Trận đấu kết thúc. Tổng điểm: ' + s.total + '. Nhấn Đặt lại sân để chơi lại.');
  }
}
function stopAll() {
  const was = runner || matchOn || countTimer;
  stopStartAudio();
  endOpMode();
  if (matchOn) { matchOn = false; addLog('info', 'Trận đấu đã dừng sớm.'); }
  endPractice();
  if (world.mode !== 'over') world.mode = 'idle';
  if (was) setStatus('Đã dừng. Sân giữ nguyên trạng thái; nhấn Đặt lại sân để bắt đầu mới.');
}
function resetField() {
  stopStartAudio();
  endOpMode(); matchOn = false;
  world.reset(); clearLog(); rebuildHw();
  tele.pending = []; tele.shown = null; tele.dirty = true;
  setStatus('Đã đặt lại sân. Chọn chương trình rồi nhấn Chạy.');
}

function simStep() {
  if (runner) {
    if (!started && world.time >= startAt) started = true;
    try {
      if (runner.step(world.time)) {
        const name = runProg ? runProg.name : 'Program';
        endOpMode();
        stopStartAudio();
        if (endPractice()) setStatus('"' + name + '" đã chạy xong.' + (world.autoDone ? ' Xem điểm đã ghi trên bảng điểm.' : ''));
        addLog('info', name + ' đã chạy đến cuối mã.');
      } else if (stopReq) { endOpMode(); endPractice(); stopStartAudio(); setStatus('Chương trình yêu cầu dừng.'); }
    } catch (e) {
      const prog = runProg;
      endOpMode();
      endPractice();
      stopStartAudio();
      showError(e, prog);
      setStatus('Chương trình đã dừng do có lỗi.');
    }
  }
  world.step(STEP);
  if (world.phaseChanged) { world.phaseChanged = false; onPhase(); }
}

/* ---------- log ---------- */
const logItems = [];
function addLog(kind, text) {
  logItems.unshift({ kind, text, t: world ? world.time : 0 });
  if (logItems.length > 60) logItems.pop();
  renderLog();
}
function clearLog() { logItems.length = 0; renderLog(); }
function renderLog() {
  const ul = $('log'); ul.textContent = '';
  if (!logItems.length) { ul.append(h('li', { text: 'Chưa có hoạt động nào.' })); return; }
  logItems.forEach((it) => ul.append(h('li', { class: 'k-' + it.kind }, h('time', { text: it.t.toFixed(1) + 's' }), it.text)));
}

/* ---------- instruments ---------- */
let hwRows = [];
function rebuildHw() {
  const tb = $('hwBody'); tb.textContent = ''; hwRows = [];
  BBZ.deviceList(state.robot).forEach((d) => {
    const fill = h('i'), bar = h('div', { class: 'bar' + (d.kind === 'motor' ? ' mid' : '') }, fill), val = h('td', { class: 'num mono' });
    const out = d.kind === 'motor' || d.kind === 'servo' ? bar : h('span', { class: 'hint', text: d.kind === 'imu' ? 'heading' : d.kind === 'camera' ? 'tags in view' : 'distance' });
    tb.append(h('tr', null, h('td', { class: 'mono', text: d.name }), h('td', null, out), val));
    hwRows.push({ d, fill, val, dev: (world.device(d.name) || {}).dev });
  });
}
function updateHw() {
  hwRows.forEach((r) => {
    if (r.d.kind === 'motor' && r.dev) {
      const u = BBZ.clamp(r.dev.u, -1, 1);
      r.fill.style.left = (u >= 0 ? 50 : 50 + u * 50) + '%'; r.fill.style.width = Math.abs(u) * 50 + '%';
      r.val.textContent = r.dev.position() + ' ticks';
    } else if (r.d.kind === 'servo' && r.dev) {
      r.fill.style.left = '0'; r.fill.style.width = r.dev.actual * 100 + '%';
      r.val.textContent = r.dev.actual.toFixed(2);
    } else if (r.d.kind === 'imu') r.val.textContent = world.yawDeg().toFixed(1) + '°';
    else if (r.d.kind === 'distance') r.val.textContent = world.distanceIn().toFixed(1) + ' in';
    else if (r.d.kind === 'camera') { const seen = world.tagDetections(); r.val.textContent = seen.length ? 'ID ' + seen.map((t) => t.id).join(', ') : 'none'; }
  });
}
const PHASE = { idle: 'READY', practice: 'PRACTICE', autotest: 'AUTO TEST', auto: 'AUTO', transition: 'PAUSE', teleop: 'TELEOP', over: 'FINAL' };
let lastHeld = '';
const heard = { endgame: false, beep: 0 };
function updateHud() {
  const s = world.score();
  $('autoScore').textContent = String(s.autoTotal);
  $('teleopScore').textContent = String(s.teleopTotal);
  $('phase').textContent = world.mode === 'teleop' && world.clock <= 60 ? 'ENDGAME' : PHASE[world.mode];
  let clock = '–:––';
  if (world.mode === 'auto' || world.mode === 'transition' || world.mode === 'teleop') { const t = Math.max(0, Math.ceil(world.clock)); clock = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  else if (world.mode === 'over') clock = '0:00';
  $('clock').textContent = clock;
  $('score').textContent = String(s.total);
  $('tips').textContent = String(s.tips);
  const heldKey = world.robot.held.map((b) => b.type).join('');
  if (heldKey !== lastHeld || !$('held').childNodes.length) {
    lastHeld = heldKey;
    const el = $('held'); el.textContent = '';
    for (let i = 0; i < 4; i++) el.append(h('i', { class: 'dot ' + (heldKey[i] ? 'dot-' + heldKey[i] : 'dot-none') }));
  }
  if (tele.dirty) {
    tele.dirty = false;
    $('telemetry').textContent = tele.shown === null ? 'Nothing yet. Use telemetry.addData(...) then telemetry.update().' : (tele.shown.join('\n') || '(empty)');
  }
  updateHw();
  const tb = $('scoreBody'); tb.textContent = '';
  s.items.forEach((it) => tb.append(h('tr', null, h('td', { text: it.label }), h('td', { class: 'num', text: it.n + ' × ' + it.each }), h('td', { class: 'num', text: String(it.pts) }))));
  tb.append(h('tr', { class: 'total' }, h('td', { text: 'Total' }), h('td'), h('td', { class: 'num', text: String(s.total) })));
  $('scoreHint').textContent = world.mode === 'over' ? 'Final' : 'If the match ended now';
  $('rpHint').textContent = 'Tips: ' + s.tips + ' (4 earns POLLINATOR 1, 7 earns POLLINATOR 2). LEAVE + PARK points: ' + s.swarm + ' of the 16 your alliance needs for SWARM.' +
    (world.fouls ? ' Fouls a referee would call: ' + world.fouls + '.' : '');
  if (world.events.length) world.events.splice(0).forEach((ev) => { addLog(ev.kind, ev.text); if (ev.text.indexOf('HIVE TIP') === 0) sfx('tip'); else if (ev.kind === 'foul') sfx('error'); });
  if (world.endgame && !heard.endgame) sfx('endgame');
  heard.endgame = world.endgame;
  const beep = world.mode === 'transition' ? Math.ceil(world.clock) : 0;
  if (beep && beep <= 3 && beep !== heard.beep) sfx('count');
  heard.beep = beep;
}

/* ---------- gamepad input ---------- */
const keys = Object.create(null), vbtn = Object.create(null), vstick = { lx: 0, ly: 0, rx: 0, ry: 0 };
const KEYMAP = { KeyQ: 'left_bumper', KeyE: 'right_bumper', KeyZ: 'left_trigger', KeyC: 'right_trigger', KeyK: 'a', KeyL: 'b', KeyJ: 'x', KeyI: 'y',
  KeyT: 'dpad_up', KeyG: 'dpad_down', KeyF: 'dpad_left', KeyH: 'dpad_right' };
const DRIVE_KEYS = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
/* Reads up to two controllers: the first is gamepad1 and the second is gamepad2. */
const padPair = [pad, pad2];
let screenTo = 0, swapPads = false, padSeen = '';
const HW_BUTTONS = ['a', 'b', 'x', 'y', 'left_bumper', 'right_bumper', null, null, 'back', 'start', 'left_stick_button', 'right_stick_button', 'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right', 'guide', 'touchpad'];
function readControllers() {
  const found = [];
  try {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gps.length && found.length < 2; i++) {
      const g = gps[i];
      if (!g || !g.connected || !g.buttons || g.buttons.length < 10 || !g.axes || g.axes.length < 4) continue;
      const dz = (v) => Math.abs(v) < 0.08 ? 0 : v, s = { name: String(g.id || 'Controller').replace(/\s*\(.*$/, '').slice(0, 36) || 'Controller', b: {} };
      s.lx = dz(g.axes[0] || 0); s.ly = dz(g.axes[1] || 0); s.rx = dz(g.axes[2] || 0); s.ry = dz(g.axes[3] || 0);
      s.lt = g.buttons[6] ? g.buttons[6].value || 0 : 0; s.rt = g.buttons[7] ? g.buttons[7].value || 0 : 0;
      HW_BUTTONS.forEach((n, j) => { if (n && g.buttons[j] && g.buttons[j].pressed) s.b[n] = true; });
      found.push(s);
    }
  } catch (e) { /* the Gamepad API can be blocked; keyboard and on-screen controls still work */ }
  if (swapPads && found.length === 2) found.reverse();
  return found;
}
function showControllers(found) {
  const key = found.map((f) => f.name).join('|') + '/' + screenTo + '/' + swapPads;
  if (key === padSeen) return;
  padSeen = key;
  const el = $('padStatus');
  if (el) el.textContent = found.length
    ? found.map((f, i) => 'Controller ' + (i + 1) + ' (' + f.name + ') is gamepad' + (i + 1)).join('. ') + '.' + (found.length < 2 ? ' Connect a second one and press a button on it for gamepad2.' : '')
    : 'Chưa tìm thấy tay cầm. Hãy kết nối tay cầm hoặc ghép nối Bluetooth rồi nhấn một nút bất kỳ. Tay cầm thứ nhất sẽ là gamepad1, tay cầm thứ hai là gamepad2.';
  document.querySelectorAll('[data-pt]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.pt === screenTo)));
  const sw = $('btnSwapPads'); if (sw) sw.disabled = found.length < 2;
}
function pollPad() {
  const k = (c) => keys[c] ? 1 : 0;
  const scr = { lx: k('KeyD') - k('KeyA') + vstick.lx, ly: k('KeyS') - k('KeyW') + vstick.ly, rx: k('ArrowRight') - k('ArrowLeft') + vstick.rx, ry: k('ArrowDown') - k('ArrowUp') + vstick.ry, b: {} };
  Object.keys(KEYMAP).forEach((c) => { if (keys[c]) scr.b[KEYMAP[c]] = true; });
  Object.keys(vbtn).forEach((n) => { if (vbtn[n]) scr.b[n] = true; });
  scr.lt = scr.b.left_trigger ? 1 : 0; scr.rt = scr.b.right_trigger ? 1 : 0;
  const found = readControllers();
  const live = !(world.mode === 'auto' || world.mode === 'transition' || world.mode === 'autotest');
  const c1 = (v) => BBZ.clamp(v, -1, 1);
  let lit = scr.b;
  for (let i = 0; i < 2; i++) {
    const a = i === screenTo ? scr : null, h = found[i] || null, p = padPair[i];
    const sum = (key) => (a ? a[key] : 0) + (h ? h[key] : 0), b = Object.assign({}, a ? a.b : null, h ? h.b : null);
    p.left_stick_x = live ? c1(sum('lx')) : 0; p.left_stick_y = live ? c1(sum('ly')) : 0;
    p.right_stick_x = live ? c1(sum('rx')) : 0; p.right_stick_y = live ? c1(sum('ry')) : 0;
    p.left_trigger = live ? Math.max(a ? a.lt : 0, h ? h.lt : 0) : 0; p.right_trigger = live ? Math.max(a ? a.rt : 0, h ? h.rt : 0) : 0;
    PAD_KEYS.forEach((n) => { if (!ANALOG[n]) p[n] = live && b[n] === true; });
    if (i === screenTo) { lit = b; if (h) { if (h.lt > 0.5) lit.left_trigger = true; if (h.rt > 0.5) lit.right_trigger = true; } }
  }
  document.querySelectorAll('.pb').forEach((el) => { el.classList.toggle('is-down', lit[el.dataset.pad] === true); });
  showControllers(found);
}
function wireInput() {
  document.querySelectorAll('[data-pt]').forEach((b) => b.addEventListener('click', () => { screenTo = +b.dataset.pt === 1 ? 1 : 0; padSeen = ''; }));
  if ($('btnSwapPads')) $('btnSwapPads').addEventListener('click', () => { swapPads = !swapPads; padSeen = ''; notify(swapPads ? 'Swapped: the second controller is now gamepad1.' : 'Back to normal: the first controller is gamepad1.'); });
  window.addEventListener('gamepadconnected', () => { padSeen = ''; });
  window.addEventListener('gamepaddisconnected', () => { padSeen = ''; });
  window.addEventListener('keydown', (e) => {
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (KEYMAP[e.code] || DRIVE_KEYS[e.code]) { keys[e.code] = true; if (!$('view-drive').hidden) e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { delete keys[e.code]; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach((c) => { delete keys[c]; }); });
  document.querySelectorAll('.pb').forEach((el) => {
    const n = el.dataset.pad;
    const up = () => { vbtn[n] = false; };
    el.addEventListener('pointerdown', (e) => { vbtn[n] = true; try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } e.preventDefault(); });
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') { vbtn[n] = true; e.preventDefault(); } });
    el.addEventListener('keyup', up); el.addEventListener('blur', up);
  });
  const stick = (el, ax, ay) => {
    const knob = el.querySelector('.knob');
    let active = false;
    const set = (e) => {
      const r = el.getBoundingClientRect(), R = r.width / 2;
      let x = (e.clientX - r.left - R) / (R * 0.7), y = (e.clientY - r.top - R) / (R * 0.7);
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      vstick[ax] = x; vstick[ay] = y;
      knob.style.transform = 'translate(' + (x * R * 0.55) + 'px,' + (y * R * 0.55) + 'px)';
    };
    const end = () => { active = false; vstick[ax] = 0; vstick[ay] = 0; knob.style.transform = ''; };
    el.addEventListener('pointerdown', (e) => { active = true; try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } set(e); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (active) set(e); });
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  };
  stick($('stickL'), 'lx', 'ly'); stick($('stickR'), 'rx', 'ry');
}

/* ---------- program editor (laid out like the FTC Robot Controller programming pages) ---------- */
function fillSelect(sel, items, value) {
  sel.textContent = '';
  items.forEach((it) => sel.append(h('option', { value: String(it[0]) }, it[1])));
  sel.value = String(value);
}
/* Keeps every group's op modes next to each other, in the order the groups first appear. */
function normalise() {
  const order = [];
  state.programs.forEach((p) => { if (order.indexOf(p.group) < 0) order.push(p.group); });
  state.programs = state.programs.map((p, i) => ({ p, i })).sort((a, b) => (order.indexOf(a.p.group) - order.indexOf(b.p.group)) || (a.i - b.i)).map((x) => x.p);
}
/* Runs a change to the op mode list, then points "open" and the match picks back at the same op modes. */
function withPrograms(fn) {
  const ids = [openProg(), state.programs[state.auto], state.programs[state.tele]].map((p) => (p ? p.id : -1));
  fn();
  normalise();
  const at = (id) => state.programs.findIndex((p) => p.id === id);
  state.open = Math.max(0, at(ids[0])); state.auto = at(ids[1]); state.tele = at(ids[2]);
  fixMatchPicks(); renderProgramLists(); save();
}
function fromExample(ex) {
  const p = { id: pid++, name: ex.name, lang: ex.lang, mode: ex.mode, group: 'Examples', desc: ex.desc,
    code: ex.lang === 'java' ? ex.make() : '', blocks: ex.lang === 'blocks' ? BBZ.Blocks.sanitize(ex.make()) : [], ex: ex.id, sig: '' };
  p.sig = sigOf(p);
  return p;
}
function matchList(sel, mode, value) {
  sel.textContent = '';
  sel.append(h('option', { value: '-1' }, 'Không có'));
  let cur = null, grp = null;
  state.programs.forEach((p, i) => {
    if (p.mode !== mode) return;
    if (p.group !== cur) { cur = p.group; grp = h('optgroup', { label: ({ Examples: 'Ví dụ', 'My Op Modes': 'Chương trình của tôi', 'Older versions': 'Phiên bản cũ' }[cur] || cur) }); sel.append(grp); }
    grp.append(h('option', { value: String(i) }, p.name + (p.lang === 'blocks' ? ' (FTC Blocks)' : '')));
  });
  sel.value = String(value);
}
function orderButtons(noUp, noDown, up, down, what) {
  return h('span', { class: 'ord' },
    h('button', { type: 'button', disabled: noUp, title: 'Move up', 'aria-label': 'Move ' + what + ' up', onclick: up }, '▲'),
    h('button', { type: 'button', disabled: noDown, title: 'Move down', 'aria-label': 'Move ' + what + ' down', onclick: down }, '▼'));
}
const lastOpen = { java: -1, blocks: -1 };
function openById(id) {
  const i = state.programs.findIndex((p) => p.id === id);
  if (i < 0) return;
  state.open = i; renderProgramLists(); renderEditor(); save();
}
/* Moves all of group `a` so it sits just before group `b`. */
function moveGroup(a, b) {
  withPrograms(() => {
    const block = state.programs.filter((p) => p.group === a), rest = state.programs.filter((p) => p.group !== a);
    const i = rest.findIndex((p) => p.group === b);
    if (i < 0) return;
    state.programs = rest.slice(0, i).concat(block, rest.slice(i));
  });
}
function swapProg(p, q) {
  withPrograms(() => {
    const i = state.programs.indexOf(p), j = state.programs.indexOf(q);
    if (i < 0 || j < 0) return;
    state.programs[i] = q; state.programs[j] = p;
  });
}
function renderProgramLists() {
  const cur = openProg(), lang = cur ? cur.lang : 'java';
  $('tabBlocks').setAttribute('aria-selected', String(lang === 'blocks'));
  $('tabJava').setAttribute('aria-selected', String(lang === 'java'));
  $('opTitle').textContent = lang === 'blocks' ? 'OpMode Blocks của tôi' : 'OpMode OnBotJava của tôi';
  const tb = $('opBody'); tb.textContent = '';
  const mine = state.programs.filter((p) => p.lang === lang), groups = [];
  mine.forEach((p) => { if (groups.indexOf(p.group) < 0) groups.push(p.group); });
  groups.forEach((g, gi) => {
    const rows = mine.filter((p) => p.group === g);
    tb.append(h('tr', { class: 'op-group' },
      h('td', null, orderButtons(gi === 0, gi === groups.length - 1, () => moveGroup(g, groups[gi - 1]), () => moveGroup(groups[gi + 1], g), 'group ' + g)),
      h('td', { colspan: '3' }, h('b', { text: 'Nhóm: ' + ({ Examples: 'Ví dụ', 'My Op Modes': 'Chương trình của tôi', 'Older versions': 'Phiên bản cũ' }[g] || g) }), h('span', { class: 'hint', text: '   ' + rows.length + ' OpMode' }))));
    rows.forEach((p, ri) => {
      const open = p === cur;
      tb.append(h('tr', { class: 'op-row' + (open ? ' is-open' : '') },
        h('td', null, orderButtons(ri === 0, ri === rows.length - 1, () => swapProg(p, rows[ri - 1]), () => swapProg(p, rows[ri + 1]), p.name)),
        h('td', null, h('button', { type: 'button', class: 'op-name', 'aria-current': open ? 'true' : null, onclick: () => openById(p.id) }, p.name)),
        h('td', null, h('span', { class: 'op-pill ' + p.mode, text: p.mode === 'auto' ? 'Tự động' : 'TeleOp' })),
        h('td', { class: 'op-desc', text: p.desc || '(chưa có mô tả)' })));
    });
  });
  matchList($('autoSel'), 'auto', state.auto);
  matchList($('teleSel'), 'teleop', state.tele);
  const dl = $('groupList'); dl.textContent = '';
  const all = [];
  state.programs.forEach((p) => { if (all.indexOf(p.group) < 0) all.push(p.group); });
  all.forEach((g) => dl.append(h('option', { value: g })));
}
function renderExamples() {
  const tb = $('exBody');
  if (!tb) return;
  tb.textContent = '';
  BBZ.Samples.list(state.robot).forEach((ex) => {
    const add = ex.why ? h('span', { class: 'hint', text: ex.why }) : h('button', { type: 'button', class: 'rc-btn', 'aria-label': 'Thêm ' + ex.name, onclick: () => addExample(ex.id) }, 'Thêm');
    tb.append(h('tr', null,
      h('td', null, h('b', { text: ex.name })),
      h('td', null, h('span', { class: 'op-pill ' + ex.lang, text: ex.lang === 'java' ? 'Java' : 'FTC Blocks' }), ' ', h('span', { class: 'op-pill ' + ex.mode, text: ex.mode === 'auto' ? 'Tự động' : 'TeleOp' })),
      h('td', { class: 'op-desc', text: ex.desc }),
      h('td', null, add)));
  });
}
function updateGutter() {
  const n = Math.min(5000, $('code').value.split('\n').length);
  let s = '';
  for (let i = 1; i <= n; i++) s += i + '\n';
  $('gutter').textContent = s;
  $('gutter').scrollTop = $('code').scrollTop;
}
function refreshGenJava() {
  const p = openProg(), pre = $('genJava');
  if (!p || p.lang !== 'blocks' || pre.hidden) return;
  try { pre.textContent = BBZ.Blocks.generate(p, state.robot); }
  catch (e) { pre.textContent = '// Chưa thể chuyển các khối này thành Java:\n// ' + e.message; }
}
const blocksApi = { changed() { save(); refreshGenJava(); }, notify };
function setFilePath(p) {
  $('filePath').textContent = p.lang === 'java' ? 'TeamCode / org.firstinspires.ftc.teamcode / ' + BBZ.Blocks.className(p.name) + '.java' : 'FTC Blocks / ' + p.name + '.blk';
}
function renderEditor() {
  const p = openProg();
  if (!p) return;
  lastOpen[p.lang] = p.id;
  $('progName').value = p.name; $('modeSel').value = p.mode; $('progGroup').value = p.group; $('progDesc').value = p.desc;
  setFilePath(p);
  const java = p.lang === 'java';
  $('javaPane').hidden = !java; $('blocksPane').hidden = java;
  if (java) { $('code').value = p.code; $('code').scrollTop = 0; updateGutter(); }
  else { BBZ.Blocks.resetCursor(); BBZ.Blocks.render($('blocksRoot'), p, state.robot, blocksApi); refreshGenJava(); }
  placeErrLine();
  try { window.dispatchEvent(new Event('bbz-editor')); } catch (e) { /* ignore */ }
}
const BLANK_JAVA = ['package org.firstinspires.ftc.teamcode;', '', 'import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;', 'import com.qualcomm.robotcore.eventloop.opmode.TeleOp;', '',
  '@TeleOp(name = "OpMode mới")', 'public class MyOpMode extends LinearOpMode {', '', '    @Override', '    public void runOpMode() {',
  '        // Khai báo động cơ và servo tại đây.', '', '        telemetry.addData("Status", "Sẵn sàng");', '        telemetry.update();', '', '        waitForStart();', '',
  '        while (opModeIsActive()) {', '            // Các lệnh điều khiển được lặp lại tại đây.', '', '            telemetry.update();', '        }', '    }', '}', ''].join('\n');
function pushProgram(p) {
  if (state.programs.length >= MAX_PROGRAMS) { notify('Bạn có thể lưu tối đa ' + MAX_PROGRAMS + ' OpMode. Hãy xóa một chương trình trước.'); return; }
  let name = cleanName(p.name), k = 2;
  while (state.programs.some((x) => x.name === name)) name = cleanName(p.name).slice(0, 36) + ' ' + (k++);
  p.name = name; p.id = pid++; p.group = cleanGroup(p.group); p.desc = cleanDesc(p.desc);
  withPrograms(() => { state.programs.push(p); });
  openById(p.id);
  notify('Đã thêm "' + name + '".');
}
function addBlank(lang) {
  pushProgram(lang === 'java'
    ? { name: 'OpMode mới', lang: 'java', mode: 'teleop', group: 'Chương trình của tôi', desc: '', code: BLANK_JAVA, blocks: [] }
    : { name: 'Blocks mới', lang: 'blocks', mode: 'teleop', group: 'Chương trình của tôi', desc: '', code: '', blocks: BBZ.Blocks.blank() });
}
function addExample(id) {
  const ex = BBZ.Samples.list(state.robot).find((e) => e.id === id);
  if (!ex || ex.why) return;
  pushProgram(fromExample(ex));
}
function showLang(lang) {
  const cur = openProg();
  if (cur && cur.lang === lang) return;
  const back = state.programs.find((p) => p.id === lastOpen[lang]) || state.programs.find((p) => p.lang === lang);
  if (back) openById(back.id); else addBlank(lang);
}
let delArmed = 0;
function wireEditor() {
  $('tabBlocks').addEventListener('click', () => showLang('blocks'));
  $('tabJava').addEventListener('click', () => showLang('java'));
  $('btnNewBlocks').addEventListener('click', () => addBlank('blocks'));
  $('btnNewJava').addEventListener('click', () => addBlank('java'));
  $('btnExamples').addEventListener('click', () => {
    const panel = $('exPanel'); panel.hidden = !panel.hidden;
    $('btnExamples').setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) renderExamples();
  });
  $('btnCopyOp').addEventListener('click', () => {
    const p = openProg(); if (!p) return;
    pushProgram({ name: p.name + ' - bản sao', lang: p.lang, mode: p.mode, group: p.group, desc: p.desc, code: p.code, blocks: BBZ.Blocks.sanitize(p.blocks) });
  });
  $('progName').addEventListener('input', (e) => { const p = openProg(); if (!p) return; p.name = cleanName(e.target.value, 'Chương trình mới'); renderProgramLists(); setFilePath(p); refreshGenJava(); save(); });
  $('progName').addEventListener('blur', (e) => { const p = openProg(); if (p) e.target.value = p.name; });
  $('progGroup').addEventListener('change', (e) => { const p = openProg(); if (!p) return; withPrograms(() => { p.group = cleanGroup(e.target.value); }); e.target.value = p.group; refreshGenJava(); });
  $('progDesc').addEventListener('input', (e) => { const p = openProg(); if (!p) return; p.desc = cleanDesc(e.target.value); save(); });
  $('progDesc').addEventListener('change', () => renderProgramLists());
  $('modeSel').addEventListener('change', (e) => { const p = openProg(); if (!p) return; p.mode = e.target.value === 'auto' ? 'auto' : 'teleop'; fixMatchPicks(); renderProgramLists(); refreshGenJava(); save(); });
  $('autoSel').addEventListener('change', (e) => { state.auto = +e.target.value; save(); });
  $('teleSel').addEventListener('change', (e) => { state.tele = +e.target.value; save(); });
  $('btnDelete').addEventListener('click', () => {
    if (state.programs.length <= 1) { notify('Cần giữ lại ít nhất một OpMode.'); return; }
    const btn = $('btnDelete');
    if (Date.now() > delArmed) { delArmed = Date.now() + 3500; btn.textContent = 'Nhấn lần nữa để xóa'; setTimeout(() => { btn.textContent = 'Xóa mục đã chọn'; }, 3500); return; }
    delArmed = 0; btn.textContent = 'Xóa mục đã chọn';
    const gone = openProg();
    if (!gone) return;
    if (runProg === gone) stopAll();
    withPrograms(() => { state.programs = state.programs.filter((p) => p !== gone); });
    openById((state.programs.find((p) => p.lang === gone.lang) || state.programs[0]).id);
    notify('Đã xóa "' + gone.name + '".');
  });
  const ta = $('code');
  ta.addEventListener('input', () => {
    const p = openProg(); if (!p || p.lang !== 'java') return;
    if (ta.value.length > MAX_CODE) { ta.value = ta.value.slice(0, MAX_CODE); notify('Đã đạt giới hạn độ dài chương trình.'); }
    p.code = ta.value; updateGutter(); save();
    if (errInfo && errInfo.progId === p.id) { errInfo = null; placeErrLine(); }
  });
  ta.addEventListener('scroll', () => { $('gutter').scrollTop = ta.scrollTop; placeErrLine(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    const s = ta.selectionStart, en = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
    ta.selectionStart = ta.selectionEnd = s + 4;
    ta.dispatchEvent(new Event('input'));
  });
  $('btnViewJava').addEventListener('click', () => {
    const pre = $('genJava'); pre.hidden = !pre.hidden;
    $('btnViewJava').setAttribute('aria-expanded', String(!pre.hidden));
    $('btnViewJava').textContent = pre.hidden ? 'Xem mã Java được tạo từ các khối' : 'Ẩn mã Java';
    refreshGenJava();
  });
  $('btnExpandCode').addEventListener('click', (e) => {
    const expanded = $('editorLayout').classList.toggle('code-expanded');
    e.currentTarget.setAttribute('aria-pressed', String(expanded));
    e.currentTarget.textContent = expanded ? 'Thu nhỏ khung mã' : 'Mở rộng khung mã';
    if (expanded) $('code').focus();
  });
  $('btnToJava').addEventListener('click', () => {
    const p = openProg(); if (!p || p.lang !== 'blocks') return;
    let code;
    try { code = BBZ.Blocks.generate(p, state.robot); } catch (e) { showError(e, p); return; }
    pushProgram({ name: p.name + ' (Java)', lang: 'java', mode: p.mode, group: p.group, desc: p.desc, code, blocks: [] });
  });
}

/* ---------- driver station ---------- */
function renderStation() {
  const c = state.robot;
  $('allianceRed').setAttribute('aria-pressed', String(c.alliance === 'red'));
  $('allianceBlue').setAttribute('aria-pressed', String(c.alliance === 'blue'));
  fillSelect($('startSel'), Object.keys(BBZ.START_SPOTS).map((k) => [k, BBZ.START_SPOTS[k].label]), c.start);
  document.querySelectorAll('.speed').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.s === state.speed)));
}
function wireStation() {
  $('btnRun').addEventListener('click', runOpen);
  $('btnMatch').addEventListener('click', runMatch);
  $('btnStop').addEventListener('click', stopAll);
  $('btnReset').addEventListener('click', resetField);
  const side = (a) => () => { state.robot.alliance = a; applyRobot(false); };
  $('allianceRed').addEventListener('click', side('red'));
  $('allianceBlue').addEventListener('click', side('blue'));
  $('startSel').addEventListener('change', (e) => { state.robot.start = e.target.value; applyRobot(false); });
  document.querySelectorAll('.speed').forEach((b) => b.addEventListener('click', () => { state.speed = +b.dataset.s || 1; renderStation(); save(); }));
}

/* ---------- build bot ---------- */
/* Example op modes nobody has edited are rewritten whenever the bot changes, so they always fit its parts and names. */
function refreshExamples() {
  let list = null, n = 0;
  state.programs.forEach((p) => {
    if (!isPure(p)) return;
    list = list || BBZ.Samples.list(state.robot);
    const ex = list.find((e) => e.id === p.ex);
    if (!ex || ex.why) return;
    try {
      if (ex.lang === 'java') p.code = ex.make(); else p.blocks = BBZ.Blocks.sanitize(ex.make());
      p.desc = ex.desc; p.sig = sigOf(p); n++;
    } catch (e) { /* keep the old copy if the example cannot be rebuilt */ }
  });
  return n;
}
function applyRobot(rerenderBuild) {
  state.robot = BBZ.sanitizeRobot(state.robot);
  BBZ.Blocks.useRobot(state.robot);
  endOpMode(); matchOn = false;
  world = new BBZ.World(state.robot);
  refreshExamples();
  clearLog(); rebuildHw(); renderStation(); renderExamples();
  tele.pending = []; tele.shown = null; tele.dirty = true;
  setStatus('Field reset for your bot. Pick a program and press Run.');
  if (rerenderBuild !== false) renderBuild();
  else { drawPreview(); renderChecks(); }
  renderProgramLists();
  const p = openProg();
  if (p && p.lang === 'blocks') { BBZ.Blocks.render($('blocksRoot'), p, state.robot, blocksApi); refreshGenJava(); }
  else if (p && $('code').value !== p.code) { $('code').value = p.code; updateGutter(); try { window.dispatchEvent(new Event('bbz-editor')); } catch (e) { /* ignore */ } }
  save();
}
/* Show where each device would plug in on a real Control Hub. */
function portOf(d, i, kindIndex) {
  if (d.kind === 'motor') return (kindIndex < 4 ? 'Hub điều khiển' : 'Hub mở rộng') + ' · động cơ ' + (kindIndex < 4 ? kindIndex : kindIndex - 4);
  if (d.kind === 'servo') return 'Hub điều khiển · servo ' + kindIndex;
  if (d.kind === 'imu') return 'Bus I2C 0 (tích hợp sẵn)';
  if (d.kind === 'distance') return 'Bus I2C 1';
  return 'USB';
}
const TYPE_LABEL = { motor: 'DcMotor', servo: 'Servo', imu: 'IMU', distance: 'DistanceSensor', camera: 'Webcam' };
/* Changes a device name everywhere it is used: Java text and the dropdowns inside saved Blocks programs. */
function renameEverywhere(from, to) {
  const re = new RegExp('(^|[^A-Za-z0-9_])' + from + '(?![A-Za-z0-9_])', 'g');
  let n = 0;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o.fields && typeof o.fields === 'object') Object.keys(o.fields).forEach((k) => { if (k.indexOf('DEVICE') === 0 && o.fields[k] === from) { o.fields[k] = to; n++; } });
    Object.keys(o).forEach((k) => { if (k !== 'fields') walk(o[k]); });
  };
  state.programs.forEach((p) => {
    if (isPure(p)) return;                                   // untouched examples are rebuilt from scratch instead
    if (p.lang === 'java') { const next = p.code.replace(re, (m, a) => { n++; return a + to; }); p.code = next.slice(0, MAX_CODE); }
    else walk(p.blocks);
  });
  return n;
}
function renderChecks() {
  const c = state.robot, devs = BBZ.deviceList(c), motors = devs.filter((d) => d.kind === 'motor').length, servos = devs.filter((d) => d.kind === 'servo').length;
  const speed = BBZ.topSpeed(c);
  const ul = $('checks'); ul.textContent = '';
  const li = (pill, cls, text) => ul.append(h('li', null, h('span', { class: 'pill' + (cls ? ' ' + cls : ''), text: pill }), h('span', { text })));
  li('OK', '', 'Đang sử dụng ' + motors + ' trên 8 động cơ (luật R503).');
  li('OK', '', 'Đang sử dụng ' + servos + ' trên 8 servo (luật R503).');
  li('OK', '', 'Kích thước khởi đầu ' + c.width + ' × ' + c.length + ' inch nằm gọn trong khối 18 inch (luật R102).');
  li('INFO', 'info', 'Dẫn động ' + BBZ.DRIVES[c.drive].label + ': tốc độ tối đa khoảng ' + speed.toFixed(0) + ' inch/giây (' + (speed / 12).toFixed(1) + ' foot/giây), ' + BBZ.ticksPerInch(c).toFixed(1) + ' xung mã hóa mỗi inch.');
  const claw = c.tools.intake && c.kit.intake === 'claw';
  li('INFO', 'info', 'Robot mang được tối đa 4 vật phẩm cùng lúc (luật G407).' + (c.tools.intake ? (claw ? ' Robot dùng càng gắp bắt đầu với 3 vật phẩm để còn chỗ gắp thêm một vật.' : '') : ' Không có cơ cấu hút, robot chỉ dùng được 4 POLLEN nạp sẵn.'));
  if (c.tools.intake) li('INFO', 'info', BBZ.KITS.intake[c.kit.intake].label + ' đặt ở ' + BBZ.FACE_NAME[c.layout.intake.face] + '.');
  if (c.tools.launcher) li('INFO', 'info', BBZ.KITS.launcher[c.kit.launcher].label + ' phóng về ' + BBZ.FACE_NAME[c.layout.launcher.face] + '.' + (c.layout.launcher.face ? ' Chương trình cần xoay mặt đó về phía mục tiêu.' : ''));
  if (c.tools.lift) li('INFO', 'info', BBZ.KITS.lift[c.kit.lift].label + ': nâng cao ' + BBZ.liftMax(c) + ' inch, ' + BBZ.liftTicksPerInch(c).toFixed(1) + ' xung mã hóa mỗi inch. Vật phẩm rơi khỏi ' + BBZ.FACE_NAME[c.layout.lift.face] + '.');
  if (!c.tools.launcher && !c.tools.lift) li('INFO', 'info', 'Không có bộ phóng hay bộ nâng, robot chỉ có thể đẩy hoặc mang vật phẩm rồi đỗ.');
}

/* The preview is also the layout editor, where parts are picked and dragged. */
let pickKey = '', dragKey = '';
const PREVIEW_SPAN = 26;                                    // inches shown across the preview
function drawBot(cv, cfg, pick, label) {
  if (!col) readColors();
  const ctx = cv.getContext('2d'), px = cv.width, k = px / PREVIEW_SPAN;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = col.tile; ctx.fillRect(0, 0, px, px);
  ctx.setTransform(k, 0, 0, -k, px / 2, px / 2);
  ctx.strokeStyle = col.tileLine; ctx.lineWidth = 0.15; ctx.setLineDash([0.6, 0.6]); ctx.strokeRect(-9, -9, 18, 18); ctx.setLineDash([]);
  ctx.rotate(Math.PI / 2);
  if (!cfg.cad || !BBZ.CAD3D || !BBZ.CAD3D.drawTop(ctx, cfg)) {
    BBZ.drawRobot(ctx, cfg, { held: ['P', 'P', 'P'], lift: 8, spin: 0.6, roll: 0, claw: 0.2, cata: 0 }, col, pick);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (label) { ctx.fillStyle = col.tileText; ctx.font = '600 ' + Math.round(px / 30) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FRONT', px / 2, px / 24); }
}
/* The big picture shows either a 3D model you can turn, or the flat top view where parts are dragged about. */
let view3d = true, turning = false, spinRaf = 0, spinAt = 0;
const mainView = { yaw: -0.9, pitch: 0.62 };
const has3d = () => !!(BBZ.Bot3D && view3d);
function drawPreview() {
  if (has3d()) { if (!col) readColors(); BBZ.Bot3D.draw($('preview'), state.robot, { yaw: mainView.yaw, pitch: mainView.pitch, pick: pickKey, label: true, cad: !!(state.robot.cad && BBZ.CAD3D.active), colors: col }); }
  else drawBot($('preview'), state.robot, pickKey, true);
}
/* The 3D model turns slowly by itself while the Build Bot tab is open. */
let calmMotion = false;
try { calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { calmMotion = false; }
function spinTick(ts) {
  spinRaf = 0;
  if (!has3d() || calmMotion || turning || $('view-build').hidden || document.hidden) return;
  if (ts - spinAt >= 33) { mainView.yaw -= Math.min(0.1, (ts - spinAt) / 1000) * 0.22; spinAt = ts; drawPreview(); }
  spinRaf = window.requestAnimationFrame(spinTick);
}
function startSpin() { if (!spinRaf && has3d() && !calmMotion) { spinAt = window.performance.now(); spinRaf = window.requestAnimationFrame(spinTick); } }
function setViewMode(on) {
  view3d = on;
  document.querySelectorAll('[data-vm]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.vm === '3d') === on)));
  $('preview').style.cursor = on ? 'grab' : 'default';
  describePick(); drawPreview(); startSpin();
}
/* A small 3D picture that can be turned by dragging it. */
function mini3d(cv, cfg, only) {
  if (!BBZ.Bot3D) { drawBot(cv, cfg, '', false); return; }
  const view = { yaw: -0.9, pitch: 0.6 };
  const paint = () => { if (!col) readColors(); BBZ.Bot3D.draw(cv, cfg, { yaw: view.yaw, pitch: view.pitch, only, colors: col }); };
  BBZ.Bot3D.orbit(cv, view, paint);
  paint();
}
/* Turns a pointer position on the preview into robot inches (+x front, +y left). */
function previewPoint(e) {
  const cv = $('preview'), r = cv.getBoundingClientRect(), k = r.width / PREVIEW_SPAN;
  const X = (e.clientX - r.left - r.width / 2) / k, Y = -(e.clientY - r.top - r.height / 2) / k;
  return { x: Y, y: -X };
}
function partAt(pt) {
  const c = state.robot;
  let best = '', bd = 1e9;
  BBZ.partList(c).forEach((p) => {
    let d;
    if (p.edge) {
      const a = p.face * Math.PI / 2, along = -(pt.x - p.x) * Math.sin(a) + (pt.y - p.y) * Math.cos(a), out = (pt.x - p.x) * Math.cos(a) + (pt.y - p.y) * Math.sin(a);
      const span = (p.face % 2 === 0 ? c.width : c.length) / 2;
      d = (Math.abs(along) < span && out > -2 && out < 3.4) ? Math.abs(out) : 1e9;
    } else { d = Math.hypot(pt.x - p.x, pt.y - p.y); if (d > p.r + 1.2) d = 1e9; }
    if (d < bd) { bd = d; best = p.key; }
  });
  return best;
}
function movePart(key, pt) {
  const c = state.robot, L = c.layout[key], hl = c.length / 2, hw = c.width / 2;
  if (BBZ.PARTS[key].edge) L.face = Math.abs(pt.x) / hl >= Math.abs(pt.y) / hw ? (pt.x >= 0 ? 0 : 2) : (pt.y >= 0 ? 1 : 3);
  else { L.u = BBZ.clamp(pt.x / Math.max(1, hl - 2.6), -1, 1); L.v = BBZ.clamp(pt.y / Math.max(1, hw - 3.4), -1, 1); }
}
function describePick() {
  const c = state.robot, msg = $('layoutMsg'), P = BBZ.PARTS[pickKey];
  $('btnTurnPart').disabled = !(P && P.turns);
  if (has3d()) {
    msg.textContent = (P ? P.label + ' được viền vàng' + (P.turns ? ' và hướng về ' + BBZ.FACE_NAME[c.layout[pickKey].face] + '. ' : '. ') : 'Kéo hình để quan sát robot từ mọi phía. ') +
      'Để di chuyển bộ phận, hãy chuyển sang Góc nhìn trên' + (P ? ' hoặc dùng các phím mũi tên.' : '.');
    return;
  }
  if (!P) { msg.textContent = 'Nhấp vào một bộ phận trong hình hoặc chọn từ danh sách, sau đó kéo đến vị trí mong muốn.'; return; }
  const L = c.layout[pickKey];
  msg.textContent = 'Đã chọn ' + P.label + (P.turns ? ', đang hướng về ' + BBZ.FACE_NAME[L.face] + '.' : '.') +
    (P.edge ? ' Kéo sang cạnh khác của robot.' : ' Kéo bộ phận hoặc dùng phím mũi tên.') + (P.turns ? ' Nút Xoay sẽ đổi hướng của bộ phận.' : '');
}
function renderPartButtons() {
  const box = $('partList'); box.textContent = '';
  BBZ.partList(state.robot).forEach((p) => box.append(h('button', { type: 'button', 'aria-pressed': String(p.key === pickKey), onclick: () => { pickKey = p.key; renderPartButtons(); describePick(); drawPreview(); } }, p.label)));
}
function renderPresets() {
  const box = $('presetList'); box.textContent = '';
  BBZ.PRESETS.forEach((p) => {
    const cv = h('canvas', { width: 260, height: 260, role: 'img', 'aria-label': 'Mô hình 3D của ' + p.name + '. Kéo để xoay.' });
    box.append(h('div', { class: 'preset' }, cv,
      h('b', { text: p.name }), h('span', { class: 'cat-chip', text: p.style }), h('span', { class: 'hint', text: p.blurb }),
      h('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Dùng ' + p.name, onclick: () => {
        state.robot = BBZ.presetRobot(p.id, state.robot.alliance); pickKey = '';
        applyRobot(); notify('Đã tải "' + p.name + '". Bạn có thể tùy chỉnh robot này theo ý mình.');
        try { $('view-build').scrollIntoView({ block: 'start' }); } catch (e) { /* ignore */ }
      } }, 'Dùng robot này')));
    mini3d(cv, BBZ.presetRobot(p.id, state.robot.alliance));
  });
}
function renderBuild() {
  const c = state.robot;
  $('botName').value = c.name;
  [['drive', 'driveTune'], ['turn', 'turnTune'], ['shooter', 'shooterTune'], ['intake', 'intakeTune']].forEach(([key, id]) => {
    $(id).value = c.tuning[key];
    $(id + 'Out').textContent = c.tuning[key] + '%';
  });
  $('btnRemoveCad').hidden = !c.cad;
  $('btnRotateCad').hidden = !c.cad;
  $('btnRotateCad').textContent = 'Xoay hướng CAD: ' + (c.cadFacing * 90) + '°';
  $('cadStatus').textContent = c.cad && BBZ.CAD3D.active ? 'Đang dùng mô hình ' + c.cad + ' cho xem trước và sân mô phỏng. Các bộ phận CAD không tự chuyển động riêng.' :
    c.cad ? 'Không thể khôi phục mô hình ' + c.cad + ' từ bộ nhớ của trình duyệt này.' :
      'Mô hình CAD được dùng làm hình hiển thị; điều khiển và cơ cấu vẫn chạy theo mô phỏng.';
  const dl = $('driveList'); dl.textContent = '';
  Object.keys(BBZ.DRIVES).forEach((k) => {
    const d = BBZ.DRIVES[k];
    const pic = h('canvas', { class: 'thumb3d wide', width: 220, height: 150, 'aria-hidden': 'true' });
    dl.append(h('button', { type: 'button', 'aria-pressed': String(c.drive === k), onclick: () => { c.drive = k; applyRobot(); } }, pic, h('b', { text: d.label }), h('span', { class: 'hint', text: d.blurb })));
    if (BBZ.Bot3D) { const demo = BBZ.sanitizeRobot(Object.assign({}, c, { drive: k })); BBZ.Bot3D.draw(pic, demo, { only: 'drive', colors: col }); }
  });
  const pl = $('paintList'); pl.textContent = '';
  Object.keys(BBZ.PAINTS).forEach((k) => pl.append(h('button', { type: 'button', class: 'swatch', style: 'background:' + BBZ.PAINTS[k], title: 'Màu khung ' + k, 'aria-label': 'Màu khung ' + k, 'aria-pressed': String(c.paint === k), onclick: () => { c.paint = k; applyRobot(); } })));
  fillSelect($('motorSel'), Object.keys(BBZ.MOTORS).map((k) => [k, BBZ.MOTORS[k].label]), c.motor);
  fillSelect($('wheelSel'), Object.keys(BBZ.WHEELS).map((k) => [k, BBZ.WHEELS[k].label]), c.wheel);
  $('widthRange').value = c.width; $('lengthRange').value = c.length;
  $('widthOut').textContent = c.width + ' in'; $('lengthOut').textContent = c.length + ' in';
  $('realistic').checked = c.realistic;
  $('realisticBox').classList.toggle('is-on', c.realistic);
  const tl = $('toolList'), sl = $('sensorList'); tl.textContent = ''; sl.textContent = '';
  Object.keys(BBZ.TOOLS).forEach((t) => {
    const tool = BBZ.TOOLS[t], id = 'tool-' + t, kits = BBZ.KITS[t];
    const cb = h('input', { type: 'checkbox', id, checked: c.tools[t], onchange: (e) => { c.tools[t] = e.target.checked; applyRobot(); } });
    const uses = BBZ.toolRoles(c, t).map((r) => BBZ.ROLES[r].kind === 'motor' ? '1 động cơ' : BBZ.ROLES[r].kind === 'servo' ? '1 servo' : '1 cảm biến').join(' + ');
    const label = h('label', { for: id }, h('b', { text: tool.label }), h('span', { class: 'hint', text: tool.blurb }), h('span', { class: 'uses', text: 'Sử dụng: ' + uses }));
    const card = h('div', { class: 'tool' + (c.tools[t] ? ' is-on' : '') }, cb, label);
    if (BBZ.Bot3D) {
      const pic = h('canvas', { class: 'thumb3d', width: 180, height: 180, role: 'img', 'aria-label': 'Mô hình 3D của ' + tool.label + '. Kéo để xoay.' });
      card.append(pic);
      mini3d(pic, c, t === 'imu' ? 'hub' : t);
    }
    if (kits) {
      const sel = h('select', { id: 'kit-' + t, 'aria-label': 'Loại ' + tool.label, disabled: !c.tools[t], onchange: (e) => { c.kit[t] = e.target.value; applyRobot(); } });
      Object.keys(kits).forEach((k) => sel.append(h('option', { value: k }, kits[k].label)));
      sel.value = c.kit[t];
      card.append(h('div', { class: 'kit' }, h('span', { class: 'field-label', text: 'Type' }), sel, h('span', { class: 'hint', text: kits[c.kit[t]].blurb })));
    }
    ((t === 'imu' || t === 'distance' || t === 'camera') ? sl : tl).append(card);
  });
  const tb = $('hwNames'); tb.textContent = '';
  const count = {};
  BBZ.deviceList(c).forEach((d, i) => {
    const ki = count[d.kind] = (count[d.kind] === undefined ? 0 : count[d.kind] + 1);
    const inp = h('input', { type: 'text', class: 'name-in', id: 'name-' + d.role, value: d.name, maxlength: 24, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Name for ' + d.label });
    inp.addEventListener('change', () => {
      const v = inp.value.trim(), msg = $('nameMsg');
      if (v === c.names[d.role]) return;
      const clash = BBZ.deviceList(c).some((x) => x.role !== d.role && x.name === v);
      if (!BBZ.validName(v) || clash) {
        inp.value = c.names[d.role]; inp.classList.add('is-bad');
        msg.textContent = clash ? '"' + v + '" is already used by another part. Every name must be different.' : '"' + v + '" cannot be used. Start with a letter, then letters, numbers or _ only, and avoid Java words like "int" or "power".';
        setTimeout(() => inp.classList.remove('is-bad'), 1500);
        return;
      }
      const n = renameEverywhere(c.names[d.role], v);
      msg.textContent = 'Renamed to "' + v + '".' + (n ? ' Your op modes were updated in ' + n + ' place' + (n === 1 ? '' : 's') + ' to match.' : ' Blocks and examples now use the new name.');
      c.names[d.role] = v; applyRobot();
      const again = $('name-' + d.role); if (again) { try { again.focus(); } catch (e) { /* ignore */ } }
    });
    tb.append(h('tr', null, h('td', { text: d.label }), h('td', { class: 'mono', text: TYPE_LABEL[d.kind] }), h('td', { class: 'hint', text: portOf(d, i, ki) }), h('td', null, inp)));
  });
  renderPartButtons(); describePick(); renderChecks(); drawPreview(); renderPresets();
}
/* Ready-made naming styles teams commonly use for the drive motors. */
const NAME_SETS = {
  short: { fl: 'fl', fr: 'fr', bl: 'bl', br: 'br', left: 'leftDrive', right: 'rightDrive' },
  long: { fl: 'frontLeft', fr: 'frontRight', bl: 'backLeft', br: 'backRight', left: 'leftDrive', right: 'rightDrive' },
  sdk: { fl: 'leftFront', fr: 'rightFront', bl: 'leftBack', br: 'rightBack', left: 'left_drive', right: 'right_drive' }
};
function wireBuild() {
  const c = () => state.robot;
  [['drive', 'driveTune'], ['turn', 'turnTune'], ['shooter', 'shooterTune'], ['intake', 'intakeTune']].forEach(([key, id]) => {
    const input = $(id);
    input.addEventListener('input', () => {
      c().tuning[key] = +input.value;
      $(id + 'Out').textContent = input.value + '%';
    });
    input.addEventListener('change', () => applyRobot(false));
  });
  $('cadFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const status = $('cadStatus');
    status.textContent = 'Đang đọc và kiểm tra mô hình CAD...';
    try {
      const mesh = await BBZ.CAD3D.read(file);
      await BBZ.CAD3D.save(mesh);
      BBZ.CAD3D.active = mesh;
      c().cad = mesh.name;
      c().cadFacing = 0;
      applyRobot();
      status.textContent = 'Đã tải ' + mesh.name + '. Xoay hình để xem trước; mô hình sẽ theo robot trên sân.';
    } catch (error) {
      console.error('Không thể tải mô hình CAD.', error);
      status.textContent = error && error.message ? error.message : 'Không thể đọc mô hình CAD.';
    } finally {
      event.target.value = '';
    }
  });
  $('btnRemoveCad').addEventListener('click', async () => {
    try {
      await BBZ.CAD3D.remove();
      c().cad = '';
      c().cadFacing = 0;
      applyRobot();
    } catch (error) {
      console.error('Không thể xóa mô hình CAD đã lưu.', error);
      $('cadStatus').textContent = error && error.message ? error.message : 'Không thể xóa mô hình CAD.';
    }
  });
  $('btnRotateCad').addEventListener('click', () => {
    c().cadFacing = (c().cadFacing + 1) % 4;
    applyRobot(false);
    $('btnRotateCad').textContent = 'Xoay hướng CAD: ' + (c().cadFacing * 90) + '°';
  });
  $('botName').addEventListener('change', (e) => { c().name = e.target.value; applyRobot(); });
  $('motorSel').addEventListener('change', (e) => { c().motor = e.target.value; applyRobot(); });
  $('wheelSel').addEventListener('change', (e) => { c().wheel = e.target.value; applyRobot(); });
  const size = (key, out) => (e) => { c()[key] = parseFloat(e.target.value); $(out).textContent = c()[key] + ' in'; drawPreview(); };
  $('widthRange').addEventListener('input', size('width', 'widthOut'));
  $('lengthRange').addEventListener('input', size('length', 'lengthOut'));
  $('widthRange').addEventListener('change', () => applyRobot());
  $('lengthRange').addEventListener('change', () => applyRobot());
  $('realistic').addEventListener('change', (e) => { c().realistic = e.target.checked; applyRobot(); });
  $('btnResetBot').addEventListener('click', () => { state.robot = BBZ.presetRobot('bee', c().alliance); pickKey = ''; applyRobot(); notify('Back to the starter bot.'); });
  document.querySelectorAll('[data-names]').forEach((b) => b.addEventListener('click', () => {
    const set = NAME_SETS[b.dataset.names], roles = BBZ.driveRoles(c());
    if (!set) return;
    const taken = BBZ.deviceList(c()).filter((d) => roles.indexOf(d.role) < 0).map((d) => d.name);
    if (roles.some((r) => taken.indexOf(set[r]) >= 0)) { $('nameMsg').textContent = 'One of those names is already used by another part, so nothing was changed.'; return; }
    /* renames through temporary names so two swapped names cannot collide */
    let n = 0;
    roles.forEach((r, i) => { n += renameEverywhere(c().names[r], 'zzTmpName' + i); });
    roles.forEach((r, i) => { renameEverywhere('zzTmpName' + i, set[r]); c().names[r] = set[r]; });
    $('nameMsg').textContent = 'Drive motors renamed to ' + roles.map((r) => set[r]).join(', ') + '.' + (n ? ' Your op modes were updated to match.' : '');
    applyRobot();
  }));

  /* layout editor */
  const cv = $('preview');
  document.querySelectorAll('[data-vm]').forEach((b) => b.addEventListener('click', () => setViewMode(b.dataset.vm === '3d')));
  let turnX = 0, turnY = 0;
  cv.addEventListener('pointerdown', (e) => {
    if (has3d()) {
      turning = true; turnX = e.clientX; turnY = e.clientY; cv.style.cursor = 'grabbing';
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      e.preventDefault(); return;
    }
    const key = partAt(previewPoint(e));
    pickKey = key; dragKey = key;
    if (key) { try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } sfx('lift'); }
    renderPartButtons(); describePick(); drawPreview();
    e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => {
    if (has3d()) {
      if (!turning) return;
      mainView.yaw -= (e.clientX - turnX) * 0.011; mainView.pitch = BBZ.clamp(mainView.pitch + (e.clientY - turnY) * 0.008, 0.18, 1.4);
      turnX = e.clientX; turnY = e.clientY; drawPreview();
      return;
    }
    if (!dragKey) { cv.style.cursor = partAt(previewPoint(e)) ? 'grab' : 'default'; return; }
    cv.style.cursor = 'grabbing';
    movePart(dragKey, previewPoint(e)); drawPreview();
  });
  const drop = () => {
    if (turning) { turning = false; cv.style.cursor = 'grab'; return; }      /* stays where you left it; it only spins again after a tab change */
    if (!dragKey) return;
    dragKey = ''; sfx('snap'); applyRobot();
  };
  cv.addEventListener('pointerup', drop); cv.addEventListener('pointercancel', drop);
  cv.addEventListener('dblclick', () => { if (pickKey && !has3d()) $('btnTurnPart').click(); });
  cv.addEventListener('keydown', (e) => {
    const P = BBZ.PARTS[pickKey], L = P && c().layout[pickKey];
    if (!P) return;
    const step = { ArrowUp: [0.1, 0], ArrowDown: [-0.1, 0], ArrowLeft: [0, 0.1], ArrowRight: [0, -0.1] }[e.key];
    if (step) {
      if (P.edge) L.face = { ArrowUp: 0, ArrowLeft: 1, ArrowDown: 2, ArrowRight: 3 }[e.key];
      else { L.u = BBZ.clamp(L.u + step[0], -1, 1); L.v = BBZ.clamp(L.v + step[1], -1, 1); }
      e.preventDefault(); applyRobot();
    } else if (e.key === 'r' || e.key === 'R') { $('btnTurnPart').click(); e.preventDefault(); }
  });
  $('btnTurnPart').addEventListener('click', () => {
    const P = BBZ.PARTS[pickKey];
    if (!P || !P.turns) return;
    c().layout[pickKey].face = (c().layout[pickKey].face + 1) % 4; sfx('snap'); applyRobot();
  });
  $('btnResetLayout').addEventListener('click', () => { c().layout = BBZ.defaultLayout(); applyRobot(); notify('Every part is back in its usual place.'); });
}

/* ---------- navigation and the frame loop ---------- */
const VIEWS = ['home', 'drive', 'build', 'learn', 'tutorial', 'manual', 'legal'];
function showView(name, fromHash) {
  if (VIEWS.indexOf(name) < 0 || name === 'home') name = 'drive';
  document.body.dataset.studioView = name;
  const was = VIEWS.find((v) => !$('view-' + v).hidden);
  VIEWS.forEach((v) => { $('view-' + v).hidden = v !== name; });
  if (was !== name) {
    /* the new tab glides in from the side it sits on in the tab bar */
    const el = $('view-' + name);
    el.classList.remove('view-in', 'from-left');
    void el.offsetWidth;
    if (was && VIEWS.indexOf(name) < VIEWS.indexOf(was)) el.classList.add('from-left');
    el.classList.add('view-in');
  }
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === name)));
  if (name === 'build') { renderBuild(); startSpin(); }
  if (name === 'drive') { resizeField(); updateGutter(); }
  if (!fromHash) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ } }
}
function resizeField() {
  const wrap = $('fieldWrap'), cv = $('field'), w = wrap.clientWidth;
  if (!w) return;
  const px = Math.round(Math.min(1400, w * Math.min(2, window.devicePixelRatio || 1)));
  if (cv.width !== px) { cv.width = px; cv.height = px; }
}
let last = 0, acc = 0, hudAt = 0;
function frame(ts) {
  window.requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts;
  pollPad();
  acc += dt * state.speed;
  let n = 0;
  while (acc >= STEP && n < 30) { simStep(); acc -= STEP; n++; }
  if (n === 30) acc = 0;
  if (document.body.dataset.fieldMode === 'ftc' && $('fieldWrap').clientWidth) {
    if (!col) readColors();
    BBZ.drawField($('field').getContext('2d'), world, $('field').width, col);
    if (ts - hudAt > 100) { hudAt = ts; updateHud(); }
  }
}

/* Runs a program on a private copy of the field with nobody at the controls and reports what happened. */
BBZ.dryRun = (src, cfg, mode, seconds, pads) => {
  const keep = { world, started, startAt, stopReq, robot: state.robot, pending: tele.pending, shown: tele.shown };
  const out = { error: null, finished: false };
  try {
    state.robot = cfg; world = new BBZ.World(cfg);
    world.mode = mode === 'auto' ? 'auto' : 'practice'; world.clock = 30; world.enabled = true;
    started = false; stopReq = false; startAt = 0.35;
    let r = J.start(src, makeHost());
    while (world.time < seconds) {
      if (!started && world.time >= startAt) started = true;
      if (pads) { const want = pads(world.time, world) || {}, two = want.two || {}; PAD_KEYS.forEach((k) => { pad[k] = want[k] !== undefined ? want[k] : (ANALOG[k] ? 0 : false); pad2[k] = two[k] !== undefined ? two[k] : (ANALOG[k] ? 0 : false); }); }
      if (r && (r.step(world.time) || stopReq)) { r = null; out.finished = true; world.stopActuators(); }
      world.step(STEP);
      if (world.phaseChanged) { world.phaseChanged = false; r = null; world.stopActuators(); }
    }
    const s = world.score();
    out.score = s.total; out.tips = s.tips; out.items = s.items.filter((i) => i.n).map((i) => i.label + ' x' + i.n);
    out.x = +world.robot.x.toFixed(1); out.y = +world.robot.y.toFixed(1); out.deg = +(world.robot.th * 180 / Math.PI).toFixed(0);
    out.fouls = world.fouls; out.held = world.robot.held.length; out.world = world;
    if (pads) PAD_KEYS.forEach((k) => { pad[k] = ANALOG[k] ? 0 : false; pad2[k] = ANALOG[k] ? 0 : false; }); out.tele = (tele.shown || []).slice(0, 6);
  } catch (e) { out.error = (e && e.line ? 'line ' + e.line + ': ' : '') + (e && e.message ? e.message : String(e)); }
  world = keep.world; started = keep.started; startAt = keep.startAt; stopReq = keep.stopReq; state.robot = keep.robot;
  tele.pending = keep.pending; tele.shown = keep.shown; tele.dirty = true;
  return out;
};
BBZ.colors = () => { readColors(); return col; };
BBZ.currentRobot = () => state.robot;
async function init() {
  load();
  if (state.robot.cad) {
    try {
      BBZ.CAD3D.active = await BBZ.CAD3D.restore();
      if (!BBZ.CAD3D.active) throw new Error('Không tìm thấy dữ liệu mô hình CAD đã lưu trên thiết bị này.');
    } catch (error) {
      console.error('Không thể khôi phục mô hình CAD.', error);
      $('cadStatus').textContent = error && error.message ? error.message : 'Không thể khôi phục mô hình CAD.';
    }
  }
  readColors();
  world = new BBZ.World(state.robot);
  wireInput(); wireEditor(); wireStation(); wireBuild();
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  renderProgramLists(); renderEditor(); renderStation(); rebuildHw(); renderLog(); clearError();
  showView((window.location.hash || '').replace('#', '') || 'drive', true);
  if (window.ResizeObserver) new ResizeObserver(resizeField).observe($('fieldWrap')); else window.addEventListener('resize', resizeField);
  window.addEventListener('bbz-resize-field', resizeField);
  const retheme = () => { readColors(); if (!$('view-build').hidden) drawPreview(); };
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme); } catch (e) { /* older browsers */ }
  try { new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] }); } catch (e) { /* ignore */ }
  window.requestAnimationFrame(frame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
