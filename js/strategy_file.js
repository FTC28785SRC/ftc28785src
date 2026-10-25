/* Local JSON files only: no accounts, database, network requests or persistent storage. */
(function(root) {
  'use strict';
  const MAX_BYTES = 1000000, MAX_FILES = 50;
  function encode(snapshot) {
    const clean = root.BBStrategyState.normalizeRobot(snapshot);
    let text = JSON.stringify(clean, null, 2);
    if (new TextEncoder().encode(text).length > MAX_BYTES) text = JSON.stringify(clean);
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Chiến thuật này vượt quá giới hạn tệp 1 MB.');
    return text;
  }
  function decode(text) {
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Hãy chọn tệp JSON nhỏ hơn 1 MB.');
    let parsed;
    try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch (_) { throw new Error('Tệp này không phải JSON hợp lệ. Hãy chọn tệp chiến thuật đã tải từ Dragonflow.'); }
    return root.BBStrategyState.normalizeRobot(parsed);
  }
  function filename(alliance, index, prefix = '') {
    if (!['red','blue'].includes(alliance) || ![0,1].includes(index)) throw new Error('Hãy chọn robot hợp lệ.');
    const safePrefix = prefix.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0,60).trim();
    return (safePrefix ? safePrefix + '-' : '') + (alliance === 'red' ? 'Red' : 'Blue') + '-Robot-' + (index + 1) + '.json';
  }
  function destination(name, snapshot) {
    // Supports optional prefixes and browser duplicate suffixes such as " (1)".
    const match = name.match(/(?:^|[-_ ])(red|blue)[-_ ]robot[-_ ]([12])(?: \(\d+\))?\.json$/i);
    return match ? {alliance:match[1].toLowerCase(),robotIndex:Number(match[2])-1,from:'filename'} :
      {alliance:snapshot.alliance,robotIndex:snapshot.robotIndex,from:'file data'};
  }
  root.BBStrategyFiles = {encode, decode, filename, destination};
  if (typeof document === 'undefined') return;
  const $ = selector => document.querySelector(selector);
  const entries = [];
  let selected = null, reading = false, uploadGeneration = 0, loadedWhileOpen = false;
  const bar = document.createElement('section');
  bar.className = 'file-bar';
  bar.setAttribute('aria-label', 'Lưu và mở tệp chiến thuật');
  const robotOptions = ['red','blue'].flatMap(color => [0,1].map(index => ({color,index,label:(color === 'red' ? 'Đỏ' : 'Xanh')+' · Robot '+(index+1)})));
  const downloads = '<button class="btn" data-file-action="download">Tải kế hoạch robot</button>';
  const clearPlans = '<button type="button" class="btn" data-file-action="clear-plans" title="Xóa kế hoạch của cả bốn robot. Các tệp đã tải lên vẫn được giữ.">Xóa kế hoạch của cả bốn robot</button>';
  bar.innerHTML = '<div><strong>Lưu riêng kế hoạch của từng robot</strong><p>Mỗi tệp JSON chứa kế hoạch TỰ ĐỘNG và ĐIỀU KHIỂN của một robot. Tải lên nhiều tệp và chọn robot nhận từng kế hoạch. Không cần tài khoản.</p></div>' +
    '<div class="file-actions">'+downloads+'<button class="btn" data-file-action="library">Chiến thuật đã tải lên <span class="file-count">(0)</span></button>'+clearPlans+'</div>' +
    '<p id="fileNotice" role="status"></p><input type="file" id="strategyFileInput" accept=".json,application/json" multiple hidden>';
  $('.workspace-nav').before(bar);
  const shortcuts = document.createElement('div'); shortcuts.className = 'file-actions recipe-file-actions';
  shortcuts.innerHTML = downloads+'<button class="btn" data-file-action="library">Chiến thuật đã tải lên</button>'+clearPlans;
  $('#recipeDetails')?.after(shortcuts);
  const dialog = document.createElement('dialog'); dialog.id = 'strategyFileDialog'; dialog.className = 'file-dialog';
  dialog.setAttribute('aria-labelledby', 'fileDialogTitle');
  dialog.innerHTML = '<header><h2 id="fileDialogTitle">Chiến thuật đã tải lên</h2><button class="btn" id="fileClose">Đóng</button></header>' +
    '<p>Tệp chỉ được giữ trong thẻ trình duyệt này cho đến khi bạn tải lại trang hoặc đóng thẻ. Có thể lưu tối đa 50 tệp, mỗi tệp không quá 1 MB. Tệp gốc vẫn nằm trên thiết bị của bạn.</p>' +
    '<div class="file-actions"><button class="btn" data-file-action="upload">Thêm tệp</button><button class="btn" id="fileClearAll">Xóa toàn bộ chiến thuật đã tải lên</button></div>' +
    '<section id="fileSelection" hidden><strong id="fileSelectedName"></strong><p id="fileSelectedDetails"></p>' +
    '<label>Nạp vào <select id="fileRobotTarget">'+robotOptions.map(r=>'<option value="'+r.color+'-'+r.index+'">'+r.label+'</option>').join('')+'</select></label><p id="fileTargetHint" class="fine"></p><p>Chỉ thay thế kế hoạch ba giai đoạn của robot này. Các robot khác và thiết lập thời gian trận đấu không thay đổi. Hãy tải kế hoạch hiện tại của robot xuống trước nếu muốn giữ lại.</p><button class="btn btn-primary" id="fileLoad">Nạp chiến thuật đã chọn</button></section>' +
    '<p id="fileMessage" role="status"></p><ul id="strategyFileList" class="strategy-file-list"></ul>';
  document.body.append(dialog);
  function say(text) { $('#fileNotice').textContent = text; $('#fileMessage').textContent = text; }
  function summary(snapshot) {
    const count = Object.values(snapshot.robot.zones).reduce((n, actions) => n + actions.length, 0);
    return (snapshot.alliance === 'red' ? 'Liên minh Đỏ' : 'Liên minh Xanh') + ' · Robot ' + (snapshot.robotIndex+1) + ' / ' + count + ' hành động / giai đoạn TỰ ĐỘNG và cả hai giai đoạn ĐIỀU KHIỂN';
  }

  function selectEntry(entry) {
    selected = entry;
    const target = destination(entry.name, entry.snapshot);
    $('#fileRobotTarget').value = target.alliance+'-'+target.robotIndex;
    $('#fileTargetHint').textContent = 'Gợi ý dựa trên '+(target.from === 'filename' ? 'tên tệp' : 'dữ liệu trong tệp')+': liên minh '+(target.alliance === 'red' ? 'ĐỎ' : 'XANH')+' · Robot '+(target.robotIndex+1)+'. Bạn có thể chọn robot khác.';
  }
  function render() {
    $('#fileLoad').disabled = reading || !selected;
    $('#fileClearAll').disabled = entries.length === 0 && !reading;
    $('#fileSelection').hidden = !selected;
    if (selected) { $('#fileSelectedName').textContent = selected.name; $('#fileSelectedDetails').textContent = summary(selected.snapshot); }
    document.querySelectorAll('.file-count').forEach(node => { node.textContent = '(' + entries.filter(e=>e.snapshot).length + ')'; });
    const list = $('#strategyFileList'); list.replaceChildren();
    entries.forEach(entry => {
      const li = document.createElement('li'), title = document.createElement('strong'), info = document.createElement('p'), controls = document.createElement('div');
      title.textContent = entry.name; info.textContent = entry.error || summary(entry.snapshot); controls.className = 'file-actions';
      if (entry.snapshot) {
        const choose = document.createElement('button'); choose.type = 'button'; choose.className = 'btn'; choose.textContent = selected === entry ? 'Đã chọn' : 'Chọn';
        choose.setAttribute('aria-pressed', String(selected === entry)); choose.setAttribute('aria-label', 'Chọn ' + entry.name);
        choose.onclick = () => { selectEntry(entry); render(); $('#fileLoad').focus(); };
        controls.append(choose);
      } else li.className = 'file-invalid';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn'; remove.textContent = 'Xóa';
      remove.setAttribute('aria-label', 'Xóa ' + entry.name + ' khỏi danh sách');
      remove.onclick = () => { entries.splice(entries.indexOf(entry), 1); if (selected === entry) selected = null; render(); $('#fileClose').focus(); };
      controls.append(remove); li.append(title, info, controls); list.append(li);
    });
    if (!entries.length) { const empty = document.createElement('li'); empty.textContent = 'Chưa có tệp nào. Nhấn Thêm tệp ở trên rồi chọn một hoặc nhiều tệp JSON.'; list.append(empty); }
  }
  function open() { render(); if (!dialog.open) dialog.showModal(); }
  const downloadDialog = document.createElement('dialog');
  downloadDialog.id = 'strategyDownloadDialog'; downloadDialog.className = 'file-dialog';
  downloadDialog.setAttribute('aria-labelledby', 'downloadTitle');
  downloadDialog.innerHTML = '<header><h2 id="downloadTitle">Tải kế hoạch robot</h2><button class="btn" id="downloadClose">Đóng</button></header><p id="downloadSummary"></p><label class="download-prefix">Tiền tố tên tệp (không bắt buộc)<input id="downloadPrefix" type="text" maxlength="60" placeholder="Ví dụ: Chung kết khu vực" autocomplete="off"></label><p class="fine">Tên này được thêm vào đầu mỗi tệp đã chọn. Để trống nếu chỉ muốn dùng tên robot.</p><div class="file-actions"><button class="btn" id="downloadAll">Chọn tất cả robot có kế hoạch</button><button class="btn" id="downloadNone">Bỏ chọn tất cả</button></div><div id="downloadChoices" class="download-choices"></div><p>Mỗi robot được tải xuống thành một tệp JSON riêng. Nếu trình duyệt hỏi, hãy cho phép tải nhiều tệp để nhận tất cả kế hoạch đã chọn.</p><button class="btn btn-primary" id="downloadSelected">Tải mục đã chọn</button>';
  document.body.append(downloadDialog);
  function updateDownloadCount() {
    downloadDialog.querySelectorAll('#downloadChoices input').forEach(input => {
      input.nextElementSibling.textContent = filename(input.dataset.color, Number(input.dataset.robot), $('#downloadPrefix').value) + ' / ' + input.dataset.description;
    });
    const count = downloadDialog.querySelectorAll('input:checked').length;
    $('#downloadSelected').disabled = count === 0;
    $('#downloadSelected').textContent = 'Tải mục đã chọn (' + count + ' tệp JSON)';
  }
  function chooseDownloads() {
    const list = $('#downloadChoices'); list.replaceChildren(); let loaded = 0;
    robotOptions.forEach(r => {
      const plan = root.BBUI._plans[r.color].robots[r.index];
      const count = Object.values(plan.zones).reduce((n, actions) => n + actions.length, 0);
      const label = document.createElement('label'), input = document.createElement('input'), copy = document.createElement('span');
      input.dataset.description = count ? count + ' hành động' : 'Chưa có kế hoạch';
      input.type = 'checkbox'; input.dataset.color = r.color; input.dataset.robot = r.index; input.checked = count > 0; input.disabled = count === 0;
      if (count) loaded++;
      copy.textContent = filename(r.color,r.index) + ' / ' + (count ? count + ' hành động' : 'Chưa có kế hoạch');
      label.append(input,copy);list.append(label);input.onchange = updateDownloadCount;
    });
    $('#downloadSummary').textContent = loaded ? loaded + ' robot có kế hoạch. Tải cả ' + loaded + ' tệp riêng hoặc bỏ chọn robot để chỉ tải một số kế hoạch.' : 'Chưa có kế hoạch robot. Hãy tạo công thức hoặc tải kế hoạch mẫu trước.';
    $('#downloadAll').disabled = loaded === 0; $('#downloadNone').disabled = loaded === 0;
    updateDownloadCount(); if (!downloadDialog.open) downloadDialog.showModal();
  }
  $('#downloadPrefix').oninput = updateDownloadCount;
  $('#downloadClose').onclick = () => downloadDialog.close();
  $('#downloadAll').onclick = () => { downloadDialog.querySelectorAll('#downloadChoices input:not(:disabled)').forEach(input => { input.checked = true; }); updateDownloadCount(); };
  $('#downloadNone').onclick = () => { downloadDialog.querySelectorAll('#downloadChoices input').forEach(input => { input.checked = false; }); updateDownloadCount(); };
  $('#downloadSelected').onclick = () => {
    try {
      // Validate all selected snapshots before starting any downloads.
      const files = Array.from(downloadDialog.querySelectorAll('input:checked')).map(input => {
        const color = input.dataset.color, index = Number(input.dataset.robot);
        return {text:encode(root.BBUI.exportRobotStrategy(color,index)),name:filename(color,index,$('#downloadPrefix').value)};
      });
      for (const file of files) {
        const url = URL.createObjectURL(new Blob([file.text], {type:'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      downloadDialog.close(); say('Đã bắt đầu tải ' + files.length + ' tệp JSON riêng: ' + files.map(file=>file.name).join(', ') + '. Kiểm tra mục tải xuống của trình duyệt; cho phép tải nhiều tệp nếu được hỏi.');
    } catch (error) { $('#downloadSummary').textContent = error.message; }
  };
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-file-action]')?.dataset.fileAction;
    if (action === 'download') chooseDownloads();
    if (action === 'library') open();
    if (action === 'clear-plans') {
      const message = root.BBUI.clearRecipes('all') ? 'Đã xóa kế hoạch của cả bốn robot. Các tệp đã tải lên vẫn được giữ. Thêm khối hoặc nạp chiến thuật để tạo kế hoạch mới.' : $('#status').textContent;
      say(message);
      $('#recipeFeedback').textContent = message;
    }
    if (action === 'upload') { if (reading) say('Vui lòng chờ đọc xong các tệp đã chọn.'); else $('#strategyFileInput').click(); }
  });
  $('#strategyFileInput').addEventListener('change', async event => {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (!files.length || reading) return;
    reading = true;
    const generation = ++uploadGeneration;
    open(); say('Đang đọc tệp trên thiết bị...');
    let loaded = 0, replaced = 0, failed = 0, skipped = 0, firstUploadedName = null;
    try {
      for (const file of files) {
        if (generation !== uploadGeneration) return;
        const existing = entries.findIndex(entry => entry.name.toLowerCase() === file.name.toLowerCase());
        if (existing < 0 && entries.length >= MAX_FILES) { skipped++; continue; }
        try {
          if (file.size > MAX_BYTES) throw new Error('Tệp vượt quá giới hạn 1 MB.');
          const snapshot = decode(await file.text());
          if (generation !== uploadGeneration) return;
          const entry = {name:file.name, snapshot};
          if (existing >= 0) {
            if (selected === entries[existing]) selected = null;
            entries[existing] = entry; replaced++;
          } else { entries.push(entry); loaded++; }
          if (firstUploadedName === null) firstUploadedName = entry.name.toLowerCase();
        } catch (error) {
          if (generation !== uploadGeneration) return;
          if (existing >= 0 && entries[existing].snapshot) {
            entries[existing].error = 'Không chấp nhận tệp thay thế: ' + error.message + ' Chiến thuật hợp lệ trước đó vẫn được giữ.';
          } else if (existing >= 0) entries[existing] = {name:file.name,error:error.message};
          else entries.push({name:file.name, error:error.message});
          failed++;
        }
      }
      if (firstUploadedName !== null) selectEntry(entries.find(entry => entry.name.toLowerCase() === firstUploadedName));
      render(); say('Đã thêm ' + loaded + ' tệp; thay thế ' + replaced + ' tệp' + (failed ? '; ' + failed + ' tệp không hợp lệ (xem chi tiết bên dưới)' : '') + (skipped ? '; bỏ qua ' + skipped + ' tệp vì danh sách đã đầy' : '') + '. Tệp trùng tên sẽ thay thế mục hiện có.' + (firstUploadedName !== null ? ' Tệp hợp lệ đầu tiên trong lượt tải này đã được chọn; nhấn Nạp chiến thuật đã chọn để áp dụng.' : ' Không có tệp hợp lệ mới nào được chọn.'));
    } finally { reading = false; render(); }
  });
  $('#fileClearAll').onclick = () => {
    uploadGeneration++; entries.length = 0; selected = null; render();
    say('Đã xóa danh sách chiến thuật đã tải lên. Kế hoạch robot hiện tại và các tệp trên thiết bị không thay đổi.');
  };
  $('#fileLoad').onclick = () => {
    if (!selected) return;
    try {
      const [color, index] = $('#fileRobotTarget').value.split('-');
      root.BBUI.importRobotStrategy(selected.snapshot, color, Number(index), {keepView:true});
      say('Đã nạp ' + selected.name + ' cho liên minh ' + (color === 'red' ? 'ĐỎ' : 'XANH') + ' · Robot ' + (Number(index)+1) + '. Kế hoạch của robot khác và thiết lập thời gian không thay đổi. Chọn tệp khác để nạp hoặc nhấn Đóng để xem lại công thức.');
      loadedWhileOpen = true;
    } catch (error) { say(error.message); }
  };
  // Keep loading and navigation separate: only the explicit Close button leaves this window.
  dialog.addEventListener('cancel', event => event.preventDefault());
  $('#fileClose').onclick = () => {
    dialog.close();
    if (loadedWhileOpen) { loadedWhileOpen = false; root.BBEase.screen('edit', true); }
  };
  render();
})(typeof window === 'undefined' ? globalThis : window);
