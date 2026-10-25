/* Blocks editor and Blocks examples. */
(function () {
'use strict';
const BBZ = window.BBZ, h = BBZ.h, legacy = BBZ.Blocks, B = window.Blockly;
const ok = !!(B && B.inject && B.serialization && B.Generator);
let cfg = BBZ.defaultRobot();                 // the bot whose device names fill the dropdowns
const fx = (name) => { try { if (BBZ.Sound) BBZ.Sound.play(name); } catch (e) { /* sound is optional */ } };
const names = (kind) => BBZ.deviceList(cfg).filter((d) => d.kind === kind).map((d) => d.name);
const SET = 147, GET = 151, FN = 289, NOTE = 200;

const PAD_NUM = { LeftStickX: 'left_stick_x', LeftStickY: 'left_stick_y', RightStickX: 'right_stick_x', RightStickY: 'right_stick_y', LeftTrigger: 'left_trigger', RightTrigger: 'right_trigger' };
const PAD_BOOL = { A: 'a', B: 'b', X: 'x', Y: 'y', DpadUp: 'dpad_up', DpadDown: 'dpad_down', DpadLeft: 'dpad_left', DpadRight: 'dpad_right', LeftBumper: 'left_bumper', RightBumper: 'right_bumper', Start: 'start', Back: 'back' };
const FIELD_LABELS = {
  Power: 'Công suất',
  TargetPosition: 'Vị trí mục tiêu',
  Velocity: 'Vận tốc',
  CurrentPosition: 'Vị trí hiện tại',
  LeftStickX: 'Cần trái X',
  LeftStickY: 'Cần trái Y',
  RightStickX: 'Cần phải X',
  RightStickY: 'Cần phải Y',
  LeftTrigger: 'Cò trái',
  RightTrigger: 'Cò phải',
  DpadUp: 'Nút hướng lên',
  DpadDown: 'Nút hướng xuống',
  DpadLeft: 'Nút hướng trái',
  DpadRight: 'Nút hướng phải',
  LeftBumper: 'Nút vai trái',
  RightBumper: 'Nút vai phải',
  Start: 'Bắt đầu',
  Back: 'Quay lại',
  Range: 'Khoảng cách',
  Bearing: 'Góc phương vị',
  Yaw: 'Góc quay',
  REVERSE: 'ĐẢO CHIỀU',
  FORWARD: 'TIẾN',
  BRAKE: 'PHANH',
  FLOAT: 'THẢ TRÔI',
  RUN_USING_ENCODER: 'CHẠY DÙNG ENCODER',
  RUN_WITHOUT_ENCODER: 'CHẠY KHÔNG DÙNG ENCODER',
  RUN_TO_POSITION: 'CHẠY ĐẾN VỊ TRÍ',
  STOP_AND_RESET_ENCODER: 'DỪNG VÀ ĐẶT LẠI ENCODER'
};
const pairs = (list) => list.map((x) => [x, x]);
const fieldPairs = (list) => list.map((x) => [FIELD_LABELS[x] || x, x]);

/* ---------- block shapes ---------- */
function defineBlocks() {
  const dd = (list) => new B.FieldDropdown(fieldPairs(list));
  const dev = (kind, i) => {
    const field = new B.FieldDropdown(() => { const n = names(kind); return n.length ? pairs(n) : [['(robot chưa có thiết bị này)', '']]; });
    const n = names(kind);
    if (i && n[i]) field.setValue(n[i]);
    return field;
  };
  const stmt = (b) => { b.setPreviousStatement(true); b.setNextStatement(true); };
  const def = (type, init) => { B.Blocks[type] = { init }; };

  def('ftc_runOpMode', function () {
    this.appendDummyInput().appendField('khi chạy').appendField('runOpMode');
    this.appendStatementInput('DO');
    this.setColour(290); this.setDeletable(false);
    this.setTooltip('Các khối bên trong sẽ chạy khi chọn OpMode này tại Trạm điều khiển.');
  });
  def('ftc_comment', function () {
    this.appendDummyInput().appendField(new B.FieldTextInput('Đặt các khối khởi tạo ở đây.'), 'TEXT');
    stmt(this); this.setColour(NOTE); this.setTooltip('Ghi chú dành cho người đọc; robot sẽ bỏ qua.');
  });
  def('linearOpMode_waitForStart', function () {
    this.appendDummyInput().appendField('gọi').appendField('waitForStart');
    stmt(this); this.setColour(FN); this.setTooltip('Chờ cho đến khi nhấn START.');
  });
  def('linearOpMode_opModeIsActive', function () {
    this.appendDummyInput().appendField('gọi').appendField('opModeIsActive');
    this.setOutput(true, 'Boolean'); this.setColour(FN); this.setTooltip('Trả về đúng khi OpMode vẫn đang chạy.');
  });
  def('linearOpMode_sleep', function () {
    this.appendValueInput('MS').setCheck('Number').appendField('gọi').appendField('sleep').appendField('mili giây');
    stmt(this); this.setColour(FN); this.setTooltip('Tạm dừng chương trình. 1000 mili giây bằng một giây.');
  });
  def('linearOpMode_getRuntime', function () {
    this.appendDummyInput().appendField('gọi').appendField('getRuntime');
    this.setOutput(true, 'Number'); this.setColour(FN); this.setTooltip('Số giây kể từ khi OpMode bắt đầu.');
  });

  def('dcMotor_setProperty_Number', function () {
    this.appendValueInput('VALUE').setCheck('Number').appendField('đặt').appendField(dev('motor'), 'DEVICE').appendField('.')
      .appendField(dd(['Power', 'TargetPosition', 'Velocity']), 'PROP').appendField('thành');
    stmt(this); this.setColour(SET); this.setTooltip('Power nằm trong khoảng từ -1 (đảo chiều tối đa) đến 1 (tiến tối đa).');
  });
  const multi = (type, count) => def(type, function () {
    this.appendDummyInput().appendField('đặt').appendField(dd(['Power', 'TargetPosition', 'Velocity']), 'PROP');
    for (let i = 1; i <= count; i++) this.appendValueInput('VALUE' + i).setCheck('Number').setAlign(B.inputs ? B.inputs.Align.RIGHT : 1).appendField(dev('motor', i - 1), 'DEVICE' + i).appendField('thành');
    this.setInputsInline(false); stmt(this); this.setColour(SET);
    this.setTooltip('Đặt giá trị cho ' + count + ' động cơ cùng lúc. Dùng số âm để quay động cơ theo chiều ngược lại.');
  });
  multi('dcMotor_setDualProperty', 2);
  multi('dcMotor_setQuadProperty', 4);
  const enumPair = (prop, values, check, tip) => {
    def('dcMotor_setProperty_' + prop, function () {
      this.appendValueInput('VALUE').setCheck(check).appendField('đặt').appendField(dev('motor'), 'DEVICE').appendField('.').appendField(prop === 'RunMode' ? 'Chế độ' : prop).appendField('thành');
      stmt(this); this.setColour(SET); this.setTooltip(tip);
    });
    def('dcMotor_enum_' + prop, function () {
      this.appendDummyInput().appendField(prop).appendField('.').appendField(dd(values), 'VALUE');
      this.setOutput(true, check); this.setColour(GET);
    });
  };
  enumPair('Direction', ['REVERSE', 'FORWARD'], 'DcMotor.Direction', 'REVERSE làm động cơ quay ngược chiều khi nhận công suất dương.');
  enumPair('RunMode', ['RUN_USING_ENCODER', 'RUN_WITHOUT_ENCODER', 'RUN_TO_POSITION', 'STOP_AND_RESET_ENCODER'], 'DcMotor.RunMode', 'Chọn cách động cơ sử dụng bộ mã hóa encoder.');
  enumPair('ZeroPowerBehavior', ['BRAKE', 'FLOAT'], 'DcMotor.ZeroPowerBehavior', 'Hành vi của động cơ khi công suất bằng 0: hãm đứng yên hoặc thả trôi.');
  def('dcMotor_getProperty_Number', function () {
    this.appendDummyInput().appendField(dev('motor'), 'DEVICE').appendField('.').appendField(dd(['CurrentPosition', 'Power', 'TargetPosition', 'Velocity']), 'PROP');
    this.setOutput(true, 'Number'); this.setColour(GET); this.setTooltip('CurrentPosition là số đếm encoder theo đơn vị tick.');
  });
  def('dcMotor_isBusy', function () {
    this.appendDummyInput().appendField('gọi').appendField(dev('motor'), 'DEVICE').appendField('.').appendField('isBusy');
    this.setOutput(true, 'Boolean'); this.setColour(FN); this.setTooltip('Trả về đúng khi động cơ vẫn đang chạy chế độ RUN_TO_POSITION.');
  });
  def('servo_setProperty_Number', function () {
    this.appendValueInput('VALUE').setCheck('Number').appendField('đặt').appendField(dev('servo'), 'DEVICE').appendField('.').appendField('Vị trí').appendField('thành');
    stmt(this); this.setColour(SET); this.setTooltip('Vị trí servo nằm trong khoảng từ 0 đến 1.');
  });
  def('servo_getProperty_Number', function () {
    this.appendDummyInput().appendField(dev('servo'), 'DEVICE').appendField('.').appendField('Vị trí');
    this.setOutput(true, 'Number'); this.setColour(GET);
  });
  def('gamepad_getProperty_Number', function () {
    this.appendDummyInput().appendField(dd(['gamepad1', 'gamepad2']), 'GAMEPAD').appendField('.').appendField(dd(Object.keys(PAD_NUM)), 'PROP');
    this.setOutput(true, 'Number'); this.setColour(GET); this.setTooltip('Cần điều khiển trả về giá trị từ -1 đến 1. Đẩy cần về trước sẽ cho giá trị Y ÂM.');
  });
  def('gamepad_getProperty_Boolean', function () {
    this.appendDummyInput().appendField(dd(['gamepad1', 'gamepad2']), 'GAMEPAD').appendField('.').appendField(dd(Object.keys(PAD_BOOL)), 'PROP');
    this.setOutput(true, 'Boolean'); this.setColour(GET); this.setTooltip('Trả về đúng khi nút đang được nhấn giữ.');
  });
  def('imu_getYaw', function () {
    this.appendDummyInput().appendField(dev('imu'), 'DEVICE').appendField('.').appendField('Góc quay').appendField('(độ)');
    this.setOutput(true, 'Number'); this.setColour(GET); this.setTooltip('Góc robot đã quay. Quay sang trái làm giá trị tăng.');
  });
  def('imu_resetYaw', function () {
    this.appendDummyInput().appendField('gọi').appendField(dev('imu'), 'DEVICE').appendField('.').appendField('resetYaw');
    stmt(this); this.setColour(FN); this.setTooltip('Đặt hướng robot hiện tại làm góc 0 độ.');
  });
  def('distanceSensor_getDistance', function () {
    this.appendDummyInput().appendField('gọi').appendField(dev('distance'), 'DEVICE').appendField('.').appendField('getDistance').appendField(dd(['INCH', 'CM']), 'UNIT');
    this.setOutput(true, 'Number'); this.setColour(FN);
  });
  /* AprilTag blocks. */
  def('aprilTag_isVisible', function () {
    this.appendValueInput('ID').setCheck('Number').appendField('gọi').appendField('AprilTag').appendField('.').appendField('isTagVisible').appendField('mã');
    this.setOutput(true, 'Boolean'); this.setColour(FN); this.setTooltip('Trả về đúng khi webcam nhìn thấy AprilTag có mã này.');
  });
  def('aprilTag_getProperty', function () {
    this.appendValueInput('ID').setCheck('Number').appendField('AprilTag').appendField('mã');
    this.appendDummyInput().appendField('.').appendField(dd(['Range', 'Bearing', 'Yaw', 'X', 'Y']), 'PROP');
    this.setInputsInline(true); this.setOutput(true, 'Number'); this.setColour(GET);
    this.setTooltip('Range là khoảng cách đến tag theo inch. Bearing là góc robot cần quay để hướng về tag (trái là số dương). Trả về 0 khi không thấy tag.');
  });
  def('aprilTag_count', function () {
    this.appendDummyInput().appendField('gọi').appendField('AprilTag').appendField('.').appendField('detectionCount');
    this.setOutput(true, 'Number'); this.setColour(FN); this.setTooltip('Số AprilTag webcam đang nhìn thấy.');
  });
  def('aprilTag_nearestId', function () {
    this.appendDummyInput().appendField('AprilTag').appendField('.').appendField('nearestTagId');
    this.setOutput(true, 'Number'); this.setColour(GET); this.setTooltip('Mã của AprilTag gần nhất trong tầm nhìn, hoặc -1 nếu không thấy tag nào.');
  });
  const addData = (type, label, check) => def(type, function () {
    this.appendDummyInput().appendField('gọi').appendField('Telemetry').appendField('.').appendField('addData');
    this.appendValueInput('KEY').setCheck('String').setAlign(B.inputs ? B.inputs.Align.RIGHT : 1).appendField('khóa');
    this.appendValueInput('VALUE').setCheck(check).setAlign(B.inputs ? B.inputs.Align.RIGHT : 1).appendField(label);
    this.setInputsInline(false); stmt(this); this.setColour(FN); this.setTooltip('Thêm một dòng vào màn hình Trạm điều khiển. Dòng sẽ xuất hiện sau khi gọi Telemetry.update.');
  });
  addData('telemetry_addNumericData', 'number', 'Number');
  addData('telemetry_addTextData', 'text', 'String');
  def('telemetry_update', function () {
    this.appendDummyInput().appendField('gọi').appendField('Telemetry').appendField('.').appendField('update');
    stmt(this); this.setColour(FN); this.setTooltip('Gửi các dòng telemetry đang chờ đến màn hình Trạm điều khiển.');
  });
}

/* ---------- toolbox, laid out like the FTC Blocks palette ---------- */
function toolbox() {
  const n = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const t = (v) => ({ shadow: { type: 'text', fields: { TEXT: v } } });
  const b = (type, inputs, fields) => { const o = { kind: 'block', type }; if (inputs) o.inputs = inputs; if (fields) o.fields = fields; return o; };
  const cat = (name, colour, contents) => ({ kind: 'category', name, colour: String(colour), contents });
  return { kind: 'categoryToolbox', contents: [
    cat('OpMode tuyến tính', FN, [b('ftc_comment'), b('linearOpMode_waitForStart'), b('linearOpMode_opModeIsActive'), b('linearOpMode_sleep', { MS: n(1000) }), b('linearOpMode_getRuntime')]),
    cat('Tay cầm', GET, [b('gamepad_getProperty_Number'), b('gamepad_getProperty_Boolean')]),
    cat('Bộ chấp hành', SET, [
      cat('Động cơ DcMotor', SET, [
        b('dcMotor_setProperty_Number', { VALUE: n(0) }),
        b('dcMotor_setDualProperty', { VALUE1: n(0), VALUE2: n(0) }),
        b('dcMotor_setQuadProperty', { VALUE1: n(0), VALUE2: n(0), VALUE3: n(0), VALUE4: n(0) }),
        b('dcMotor_setProperty_Direction', { VALUE: { shadow: { type: 'dcMotor_enum_Direction' } } }),
        b('dcMotor_setProperty_RunMode', { VALUE: { shadow: { type: 'dcMotor_enum_RunMode' } } }),
        b('dcMotor_setProperty_ZeroPowerBehavior', { VALUE: { shadow: { type: 'dcMotor_enum_ZeroPowerBehavior' } } }),
        b('dcMotor_getProperty_Number'), b('dcMotor_isBusy'),
        b('dcMotor_enum_Direction'), b('dcMotor_enum_RunMode'), b('dcMotor_enum_ZeroPowerBehavior')]),
      cat('Servo', SET, [b('servo_setProperty_Number', { VALUE: n(0) }), b('servo_getProperty_Number')])]),
    cat('Cảm biến', GET, [b('imu_getYaw'), b('imu_resetYaw'), b('distanceSensor_getDistance')]),
    cat('Thị giác máy tính', FN, [
      cat('AprilTag', FN, [b('aprilTag_isVisible', { ID: n(1) }), b('aprilTag_getProperty', { ID: n(1) }), b('aprilTag_count'), b('aprilTag_nearestId')])]),
    cat('Tiện ích', FN, [
      cat('Telemetry', FN, [b('telemetry_addNumericData', { KEY: t('khóa'), VALUE: n(123) }), b('telemetry_addTextData', { KEY: t('khóa'), VALUE: t('văn bản') }), b('telemetry_update')])]),
    { kind: 'sep' },
    cat('Điều kiện logic', 210, [b('controls_if'), b('controls_if', null, null), b('logic_compare'), b('logic_operation'), b('logic_negate'), b('logic_boolean')]),
    cat('Vòng lặp', 120, [b('controls_whileUntil'), b('controls_repeat_ext', { TIMES: n(10) }), b('controls_flow_statements')]),
    cat('Toán học', 230, [b('math_number', null, { NUM: 0 }), b('math_arithmetic', { A: n(1), B: n(1) }), b('math_single', { NUM: n(9) }), b('math_constrain', { VALUE: n(50), LOW: n(-1), HIGH: n(1) }), b('math_modulo', { DIVIDEND: n(64), DIVISOR: n(10) }), b('math_round', { NUM: n(3.1) })]),
    cat('Văn bản', 160, [b('text')]),
    { kind: 'category', name: 'Biến', colour: '330', custom: 'VARIABLE' }
  ] };
}

/* ---------- building block programs in code (blank program and examples) ---------- */
function builder() {
  const vars = [];
  const V = (name) => { if (vars.indexOf(name) < 0) vars.push(name); return { id: 'var_' + name }; };
  const blk = (type, fields, inputs) => {
    const o = { type };
    if (fields) o.fields = fields;
    if (inputs) { o.inputs = {}; Object.keys(inputs).forEach((k) => { if (inputs[k]) o.inputs[k] = { block: inputs[k] }; }); }
    return o;
  };
  const chain = (list) => { const a = list.filter(Boolean); for (let i = 0; i < a.length - 1; i++) a[i].next = { block: a[i + 1] }; return a[0] || null; };
  const num = (v) => blk('math_number', { NUM: v });
  const txt = (v) => blk('text', { TEXT: v });
  const note = (v) => blk('ftc_comment', { TEXT: v });
  const op = (o, a, b) => blk('math_arithmetic', { OP: o }, { A: a, B: b });
  const cmp = (o, a, b) => blk('logic_compare', { OP: o }, { A: a, B: b });
  const and = (a, b) => blk('logic_operation', { OP: 'AND' }, { A: a, B: b });
  const neg = (a) => blk('math_single', { OP: 'NEG' }, { NUM: a });
  const get = (name) => blk('variables_get', { VAR: V(name) });
  const set = (name, v) => blk('variables_set', { VAR: V(name) }, { VALUE: v });
  const active = () => blk('linearOpMode_opModeIsActive');
  const who = { pad: 'gamepad1' };                 /* which gamepad the next gamepad blocks read */
  const padN = (p) => blk('gamepad_getProperty_Number', { GAMEPAD: who.pad, PROP: p });
  const padB = (p) => blk('gamepad_getProperty_Boolean', { GAMEPAD: who.pad, PROP: p });
  const power = (m, v) => blk('dcMotor_setProperty_Number', { DEVICE: m, PROP: 'Power' }, { VALUE: v });
  const powers = (ms, vs) => {
    const f = { PROP: 'Power' }, inp = {};
    ms.forEach((m, i) => { f['DEVICE' + (i + 1)] = m; inp['VALUE' + (i + 1)] = vs[i]; });
    return blk(ms.length === 4 ? 'dcMotor_setQuadProperty' : 'dcMotor_setDualProperty', f, inp);
  };
  const servo = (s, v) => blk('servo_setProperty_Number', { DEVICE: s }, { VALUE: v });
  const reverse = (m) => blk('dcMotor_setProperty_Direction', { DEVICE: m }, { VALUE: blk('dcMotor_enum_Direction', { VALUE: 'REVERSE' }) });
  const pos = (m) => blk('dcMotor_getProperty_Number', { DEVICE: m, PROP: 'CurrentPosition' });
  const sleep = (ms) => blk('linearOpMode_sleep', null, { MS: num(ms) });
  const loopWhile = (cond, body) => blk('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: cond, DO: chain(body) });
  const repeat = (times, body) => blk('controls_repeat_ext', null, { TIMES: num(times), DO: chain(body) });
  /* arms: [[condition, [blocks...]], ...]; other: blocks for the final else (or null) */
  const iff = (arms, other) => {
    const o = { type: 'controls_if', inputs: {} };
    if (arms.length > 1 || other) o.extraState = { elseIfCount: arms.length - 1, hasElse: !!other };
    if (o.extraState && !o.extraState.elseIfCount) delete o.extraState.elseIfCount;
    arms.forEach((a, i) => { o.inputs['IF' + i] = { block: a[0] }; const d = chain(a[1]); if (d) o.inputs['DO' + i] = { block: d }; });
    if (other) { const e = chain(other); if (e) o.inputs.ELSE = { block: e }; }
    return o;
  };
  const numData = (key, v) => blk('telemetry_addNumericData', null, { KEY: txt(key), VALUE: v });
  const update = () => blk('telemetry_update');
  const program = (body) => ({
    blocks: { languageVersion: 0, blocks: [{ type: 'ftc_runOpMode', x: 20, y: 20, inputs: { DO: { block: chain(body) } } }] },
    variables: vars.map((name) => ({ name, id: 'var_' + name }))
  });
  return { who, blk, chain, num, txt, note, op, cmp, and, neg, get, set, active, padN, padB, power, powers, servo, reverse, pos, sleep, loopWhile, repeat, iff, numData, update, program };
}
/* The starting point for a new op mode: the same skeleton FTC Blocks gives you. */
function blank() {
  const b = builder();
  return b.program([
    b.note('Đặt các khối khởi tạo ở đây.'),
    b.blk('linearOpMode_waitForStart'),
    b.iff([[b.active(), [
      b.note('Đặt các khối cần chạy ở đây.'),
      b.loopWhile(b.active(), [b.note('Đặt các khối lặp ở đây.'), b.update()])
    ]]])
  ]);
}

/* ---------- Java generator ---------- */
const O = { ATOMIC: 0, UNARY: 2, MULT: 3, ADD: 4, REL: 6, EQ: 7, AND: 11, OR: 12, NONE: 99 };
let G = null, gen = null;                     // gen holds per-run state (errors, loop counter, variable names)
function defineGenerator() {
  G = new B.Generator('Java');
  G.INDENT = '    ';
  G.scrub_ = function (block, code, thisOnly) {
    const next = block.nextConnection && block.nextConnection.targetBlock();
    return code + (next && !thisOnly ? this.blockToCode(next) : '');
  };
  const F = G.forBlock;
  const str = (s) => '"' + String(s).replace(/[\u0000-\u001f]/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  const numLit = (v) => { const x = Number(v); if (!isFinite(x)) return '0.0'; return Number.isInteger(x) ? x + '.0' : String(x); };
  const val = (b, name, order, dflt) => G.valueToCode(b, name, order) || dflt;
  const device = (b, field, kind) => {
    const v = b.getFieldValue(field);
    if (!v) { gen.errs.push('Khối này cần thiết bị loại ' + kind + ' nhưng robot chưa có. Hãy thêm thiết bị trong mục Lắp robot hoặc xóa khối này.'); return 'missing'; }
    return v;
  };
  const setNumber = (m, prop, v) => prop === 'Power' ? m + '.setPower(' + v + ');\n'
    : prop === 'Velocity' ? m + '.setVelocity(' + v + ');\n' : m + '.setTargetPosition((int) (' + v + '));\n';

  F.ftc_comment = (b) => '// ' + String(b.getFieldValue('TEXT')).replace(/[\r\n]/g, ' ') + '\n';
  F.linearOpMode_waitForStart = () => 'waitForStart();\n';
  F.linearOpMode_opModeIsActive = () => ['opModeIsActive()', O.ATOMIC];
  F.linearOpMode_sleep = (b) => 'sleep((long) (' + val(b, 'MS', O.NONE, '0.0') + '));\n';
  F.linearOpMode_getRuntime = () => ['getRuntime()', O.ATOMIC];
  F.dcMotor_setProperty_Number = (b) => setNumber(device(b, 'DEVICE', 'motor'), b.getFieldValue('PROP'), val(b, 'VALUE', O.NONE, '0.0'));
  const multi = (count) => (b) => {
    let code = '';
    for (let i = 1; i <= count; i++) code += setNumber(device(b, 'DEVICE' + i, 'motor'), b.getFieldValue('PROP'), val(b, 'VALUE' + i, O.NONE, '0.0'));
    return code;
  };
  F.dcMotor_setDualProperty = multi(2);
  F.dcMotor_setQuadProperty = multi(4);
  F.dcMotor_setProperty_Direction = (b) => device(b, 'DEVICE', 'motor') + '.setDirection(' + val(b, 'VALUE', O.NONE, 'DcMotor.Direction.FORWARD') + ');\n';
  F.dcMotor_enum_Direction = (b) => ['DcMotor.Direction.' + b.getFieldValue('VALUE'), O.ATOMIC];
  F.dcMotor_setProperty_RunMode = (b) => device(b, 'DEVICE', 'motor') + '.setMode(' + val(b, 'VALUE', O.NONE, 'DcMotor.RunMode.RUN_USING_ENCODER') + ');\n';
  F.dcMotor_enum_RunMode = (b) => ['DcMotor.RunMode.' + b.getFieldValue('VALUE'), O.ATOMIC];
  F.dcMotor_setProperty_ZeroPowerBehavior = (b) => device(b, 'DEVICE', 'motor') + '.setZeroPowerBehavior(' + val(b, 'VALUE', O.NONE, 'DcMotor.ZeroPowerBehavior.BRAKE') + ');\n';
  F.dcMotor_enum_ZeroPowerBehavior = (b) => ['DcMotor.ZeroPowerBehavior.' + b.getFieldValue('VALUE'), O.ATOMIC];
  F.dcMotor_getProperty_Number = (b) => {
    const m = device(b, 'DEVICE', 'motor'), p = b.getFieldValue('PROP');
    if (p === 'Power') return [m + '.getPower()', O.ATOMIC];
    if (p === 'Velocity') return [m + '.getVelocity()', O.ATOMIC];
    return ['(double) ' + m + (p === 'TargetPosition' ? '.getTargetPosition()' : '.getCurrentPosition()'), O.UNARY];
  };
  F.dcMotor_isBusy = (b) => [device(b, 'DEVICE', 'motor') + '.isBusy()', O.ATOMIC];
  F.servo_setProperty_Number = (b) => device(b, 'DEVICE', 'servo') + '.setPosition(' + val(b, 'VALUE', O.NONE, '0.0') + ');\n';
  F.servo_getProperty_Number = (b) => [device(b, 'DEVICE', 'servo') + '.getPosition()', O.ATOMIC];
  F.gamepad_getProperty_Number = (b) => [b.getFieldValue('GAMEPAD') + '.' + (PAD_NUM[b.getFieldValue('PROP')] || 'left_stick_x'), O.ATOMIC];
  F.gamepad_getProperty_Boolean = (b) => [b.getFieldValue('GAMEPAD') + '.' + (PAD_BOOL[b.getFieldValue('PROP')] || 'a'), O.ATOMIC];
  F.imu_getYaw = (b) => [device(b, 'DEVICE', 'IMU') + '.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES)', O.ATOMIC];
  F.imu_resetYaw = (b) => device(b, 'DEVICE', 'IMU') + '.resetYaw();\n';
  F.distanceSensor_getDistance = (b) => [device(b, 'DEVICE', 'distance sensor') + '.getDistance(DistanceUnit.' + (b.getFieldValue('UNIT') === 'CM' ? 'CM' : 'INCH') + ')', O.ATOMIC];
  const tagId = (b) => '(int) (' + val(b, 'ID', O.NONE, '1.0') + ')';
  const camera = () => { if (!names('camera').length) gen.errs.push('Khối AprilTag cần webcam. Hãy bật "Webcam (AprilTags)" trong mục Lắp robot hoặc xóa khối đó.'); };
  F.aprilTag_isVisible = (b) => { camera(); gen.vis.add('findTag'); return ['findTag(' + tagId(b) + ') != null', O.EQ]; };
  F.aprilTag_getProperty = (b) => {
    const p = b.getFieldValue('PROP');
    camera(); gen.vis.add('findTag'); gen.vis.add(p);
    return ['tag' + p + '(' + tagId(b) + ')', O.ATOMIC];
  };
  F.aprilTag_count = () => { camera(); gen.vis.add('any'); return ['(double) aprilTag.getDetections().size()', O.UNARY]; };
  F.aprilTag_nearestId = () => { camera(); gen.vis.add('nearest'); return ['(double) nearestTagId()', O.UNARY]; };
  F.telemetry_addNumericData = (b) => 'telemetry.addData(' + val(b, 'KEY', O.NONE, '"key"') + ', ' + val(b, 'VALUE', O.NONE, '0.0') + ');\n';
  F.telemetry_addTextData = (b) => 'telemetry.addData(' + val(b, 'KEY', O.NONE, '"key"') + ', ' + val(b, 'VALUE', O.NONE, '""') + ');\n';
  F.telemetry_update = () => 'telemetry.update();\n';

  F.controls_if = (b) => {
    let code = '', i = 0;
    while (b.getInput('IF' + i)) {
      code += (i ? ' else ' : '') + 'if (' + val(b, 'IF' + i, O.NONE, 'false') + ') {\n' + G.statementToCode(b, 'DO' + i) + '}';
      i++;
    }
    if (b.getInput('ELSE')) code += ' else {\n' + G.statementToCode(b, 'ELSE') + '}';
    return code + '\n';
  };
  F.controls_whileUntil = (b) => {
    let c = val(b, 'BOOL', O.NONE, 'false');
    if (b.getFieldValue('MODE') === 'UNTIL') c = '!(' + c + ')';
    return 'while (' + c + ') {\n' + G.statementToCode(b, 'DO') + '}\n';
  };
  F.controls_repeat_ext = (b) => {
    const v = 'count' + (++gen.loop);
    return 'for (int ' + v + ' = 0; ' + v + ' < (int) (' + val(b, 'TIMES', O.NONE, '0.0') + '); ' + v + '++) {\n' + G.statementToCode(b, 'DO') + '}\n';
  };
  F.controls_flow_statements = (b) => (b.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n');
  F.logic_compare = (b) => {
    const ops = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }, o = b.getFieldValue('OP');
    const order = (o === 'EQ' || o === 'NEQ') ? O.EQ : O.REL;
    return [val(b, 'A', order, '0.0') + ' ' + ops[o] + ' ' + val(b, 'B', order, '0.0'), order];
  };
  F.logic_operation = (b) => {
    const isAnd = b.getFieldValue('OP') === 'AND', order = isAnd ? O.AND : O.OR;
    return [val(b, 'A', order, 'false') + (isAnd ? ' && ' : ' || ') + val(b, 'B', order, 'false'), order];
  };
  F.logic_negate = (b) => ['!' + val(b, 'BOOL', O.UNARY, 'true'), O.UNARY];
  F.logic_boolean = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC];
  F.math_number = (b) => { const s = numLit(b.getFieldValue('NUM')); return [s, s[0] === '-' ? O.UNARY : O.ATOMIC]; };
  F.math_arithmetic = (b) => {
    const o = b.getFieldValue('OP');
    if (o === 'POWER') return ['Math.pow(' + val(b, 'A', O.NONE, '0.0') + ', ' + val(b, 'B', O.NONE, '0.0') + ')', O.ATOMIC];
    const sym = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' }[o], order = (o === 'ADD' || o === 'MINUS') ? O.ADD : O.MULT;
    return [val(b, 'A', order, '0.0') + ' ' + sym + ' ' + val(b, 'B', order, '0.0'), order];
  };
  F.math_single = (b) => {
    const o = b.getFieldValue('OP');
    if (o === 'NEG') return ['-' + val(b, 'NUM', O.UNARY, '0.0'), O.UNARY];
    const a = val(b, 'NUM', O.NONE, '0.0');
    const fn = { ROOT: 'Math.sqrt(', ABS: 'Math.abs(', LN: 'Math.log(', EXP: 'Math.exp(', LOG10: 'Math.log(', POW10: 'Math.pow(10.0, ' }[o] || 'Math.abs(';
    return [fn + a + ')' + (o === 'LOG10' ? ' / Math.log(10.0)' : ''), o === 'LOG10' ? O.MULT : O.ATOMIC];
  };
  F.math_constrain = (b) => ['Math.min(Math.max(' + val(b, 'VALUE', O.NONE, '0.0') + ', ' + val(b, 'LOW', O.NONE, '0.0') + '), ' + val(b, 'HIGH', O.NONE, '0.0') + ')', O.ATOMIC];
  F.math_modulo = (b) => [val(b, 'DIVIDEND', O.MULT, '0.0') + ' % ' + val(b, 'DIVISOR', O.MULT, '1.0'), O.MULT];
  F.math_round = (b) => {
    const fn = { ROUND: 'Math.round', ROUNDUP: 'Math.ceil', ROUNDDOWN: 'Math.floor' }[b.getFieldValue('OP')] || 'Math.round';
    return ['(double) ' + fn + '(' + val(b, 'NUM', O.NONE, '0.0') + ')', O.UNARY];
  };
  F.text = (b) => [str(b.getFieldValue('TEXT')), O.ATOMIC];
  F.variables_get = (b) => [gen.varName(b.getFieldValue('VAR')), O.ATOMIC];
  F.variables_set = (b) => gen.varName(b.getFieldValue('VAR')) + ' = ' + val(b, 'VALUE', O.NONE, gen.varType(b.getFieldValue('VAR')) === 'boolean' ? 'false' : gen.varType(b.getFieldValue('VAR')) === 'String' ? '""' : '0.0') + ';\n';
  F.math_change = (b) => gen.varName(b.getFieldValue('VAR')) + ' += ' + val(b, 'DELTA', O.NONE, '0.0') + ';\n';
  F.ftc_runOpMode = () => '';
}

const validState = (s) => !!(s && typeof s === 'object' && !Array.isArray(s) && s.blocks && Array.isArray(s.blocks.blocks));

function generate(prog, c) {
  if (!ok) throw new Error('Không tải được trình chỉnh sửa Blocks nên không thể chạy các khối này. Hãy tải lại trang rồi thử lại.');
  cfg = c;
  const ws = new B.Workspace();
  try {
    B.serialization.workspaces.load(validState(prog.blocks) ? prog.blocks : blank(), ws);
    const root = ws.getTopBlocks(true).find((b) => b.type === 'ftc_runOpMode');
    if (!root) throw new Error('Chương trình không có khối "khi chạy runOpMode" nên không có gì để chạy.');
    /* variables: each one gets a Java name and a type */
    const devNames = new Set(BBZ.deviceList(c).map((d) => d.name)), used = new Set(), info = new Map();
    ws.getVariableMap().getAllVariables().forEach((v) => {
      let nm = String(v.name).replace(/[^A-Za-z0-9_]/g, '_');
      if (!BBZ.validName(nm) || devNames.has(nm)) nm = 'var_' + nm.slice(0, 18);
      let k = 2; const base = nm;
      while (used.has(nm)) nm = base + (k++);
      used.add(nm);
      info.set(v.getId(), { name: nm, type: null });
    });
    ws.getAllBlocks(false).forEach((b) => {
      if (b.type !== 'variables_set') return;
      const it = info.get(b.getFieldValue('VAR')), t = b.getInputTargetBlock('VALUE');
      if (!it) return;
      const check = t && t.outputConnection ? t.outputConnection.getCheck() : null;
      const type = check && check.indexOf('Boolean') >= 0 ? 'boolean' : check && check.indexOf('String') >= 0 ? 'String' : 'double';
      it.type = it.type && it.type !== type ? 'double' : type;
    });
    gen = { errs: [], loop: 0, vis: new Set(),
      varName: (id) => (info.get(id) || { name: 'unknown' }).name,
      varType: (id) => (info.get(id) || {}).type || 'double' };
    const body = G.statementToCode(root, 'DO');
    if (gen.errs.length) throw new Error(gen.errs[0]);

    /* Like the Java that FTC Blocks exports, only the devices the blocks really use are declared. */
    const mentions = (word) => new RegExp('(^|[^A-Za-z0-9_])' + word + '([^A-Za-z0-9_]|$)').test(body);
    const all = BBZ.deviceList(c), devs = all.filter((d) => d.kind !== 'camera' && mentions(d.name)), has = (kind) => devs.some((d) => d.kind === kind);
    const vision = gen.vis.size > 0, cam = all.find((d) => d.kind === 'camera');
    const typeOf = (d) => d.kind === 'motor' ? 'DcMotor' : d.kind === 'servo' ? 'Servo' : d.kind === 'imu' ? 'IMU' : 'DistanceSensor';
    const L = ['package org.firstinspires.ftc.teamcode;', '',
      'import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;',
      'import com.qualcomm.robotcore.eventloop.opmode.' + (prog.mode === 'auto' ? 'Autonomous' : 'TeleOp') + ';'];
    if (has('motor')) L.push('import com.qualcomm.robotcore.hardware.DcMotor;');
    if (has('servo')) L.push('import com.qualcomm.robotcore.hardware.Servo;');
    if (has('imu')) L.push('import com.qualcomm.robotcore.hardware.IMU;', 'import com.qualcomm.hardware.rev.RevHubOrientationOnRobot;', 'import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;');
    if (has('distance')) L.push('import com.qualcomm.robotcore.hardware.DistanceSensor;', 'import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;');
    if (vision) L.push('import org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName;', 'import org.firstinspires.ftc.vision.VisionPortal;',
      'import org.firstinspires.ftc.vision.apriltag.AprilTagDetection;', 'import org.firstinspires.ftc.vision.apriltag.AprilTagProcessor;');
    const q = (s) => '"' + String(s).replace(/[\u0000-\u001f]/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    L.push('', (prog.mode === 'auto' ? '@Autonomous' : '@TeleOp') + '(name = ' + q(prog.name) + (prog.group ? ', group = ' + q(prog.group === 'Examples' ? 'Ví dụ' : prog.group) : '') + ')');
    L.push('public class ' + legacy.className(prog.name) + ' extends LinearOpMode {', '');
    devs.forEach((d) => L.push('    private ' + typeOf(d) + ' ' + d.name + ';'));
    if (vision) L.push('    private AprilTagProcessor aprilTag;', '    private VisionPortal visionPortal;');
    info.forEach((it) => L.push('    ' + (it.type || 'double') + ' ' + it.name + ';'));
    L.push('', '    /**', '     * Hàm này chạy khi chọn OpMode từ Trạm điều khiển.', '     */', '    @Override', '    public void runOpMode() {');
    devs.forEach((d) => L.push('        ' + d.name + ' = hardwareMap.get(' + typeOf(d) + '.class, ' + q(d.name) + ');'));
    if (has('imu')) {
      const imu = devs.find((d) => d.kind === 'imu').name;
      L.push('        ' + imu + '.initialize(new IMU.Parameters(new RevHubOrientationOnRobot(',
        '                RevHubOrientationOnRobot.LogoFacingDirection.UP,', '                RevHubOrientationOnRobot.UsbFacingDirection.FORWARD)));');
    }
    if (vision) L.push('        aprilTag = AprilTagProcessor.easyCreateWithDefaults();',
      '        visionPortal = VisionPortal.easyCreateWithDefaults(hardwareMap.get(WebcamName.class, ' + q(cam ? cam.name : c.names.camera) + '), aprilTag);');
    L.push('');
    body.split('\n').forEach((line) => { if (line.length) L.push('    ' + line); });
    L.push('    }');
    const M = (lines) => { L.push(''); lines.forEach((s) => L.push('    ' + s)); };
    if (gen.vis.has('findTag')) M(['/**', ' * Tìm AprilTag theo mã. Trả về null nếu webcam không nhìn thấy tag đó.', ' */',
      'private AprilTagDetection findTag(int id) {', '    for (AprilTagDetection detection : aprilTag.getDetections()) {', '        if (detection.id == id) {', '            return detection;', '        }', '    }', '    return null;', '}']);
    ['Range', 'Bearing', 'Yaw', 'X', 'Y'].forEach((p) => {
      if (gen.vis.has(p)) M(['private double tag' + p + '(int id) {', '    AprilTagDetection detection = findTag(id);', '    if (detection == null) {', '        return 0.0;', '    }',
        '    return detection.ftcPose.' + p.toLowerCase() + ';', '}']);
    });
    if (gen.vis.has('nearest')) M(['private int nearestTagId() {', '    int nearest = -1;', '    double best = 9999.0;', '    for (AprilTagDetection detection : aprilTag.getDetections()) {',
      '        if (detection.ftcPose.range < best) {', '            best = detection.ftcPose.range;', '            nearest = detection.id;', '        }', '    }', '    return nearest;', '}']);
    L.push('}', '');
    return L.join('\n');
  } finally { ws.dispose(); gen = null; }
}

/* Cleans saved Blocks data by loading it and saving it back out. */
function sanitize(s) {
  if (!validState(s)) return blank();
  let copy;
  try { const json = JSON.stringify(s); if (json.length > 250000) return blank(); copy = JSON.parse(json); } catch (e) { return blank(); }
  if (!ok) return copy;
  const ws = new B.Workspace();
  try {
    B.serialization.workspaces.load(copy, ws);
    if (ws.getAllBlocks(false).length > 800 || !ws.getTopBlocks(false).some((b) => b.type === 'ftc_runOpMode')) return blank();
    return B.serialization.workspaces.save(ws);
  } catch (e) { return blank(); } finally { ws.dispose(); }
}

/* ---------- the editor ---------- */
let ws = null, holder = null, cur = null, quietUntil = 0, darkTheme = null;
const isDark = () => { try { return getComputedStyle(document.documentElement).colorScheme.indexOf('dark') >= 0; } catch (e) { return false; } };
function theme() {
  if (!darkTheme) darkTheme = B.Theme.defineTheme('simDark', { name: 'simDark', base: B.Themes.Classic, componentStyles: {
    workspaceBackgroundColour: '#1c2017', toolboxBackgroundColour: '#10130c', toolboxForegroundColour: '#eceee4',
    flyoutBackgroundColour: '#262b1f', flyoutForegroundColour: '#cfd3c6', flyoutOpacity: 1,
    scrollbarColour: '#7d8672', scrollbarOpacity: 0.5, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.3 } });
  return isDark() ? darkTheme : B.Themes.Classic;
}
function onChange(e) {
  if (!cur || !ws || e.isUiEvent) return;
  if (e.type === B.Events.BLOCK_MOVE && Date.now() > quietUntil) {
    if (e.newParentId && e.newParentId !== e.oldParentId) fx('snap');
  }
  try { cur.prog.blocks = B.serialization.workspaces.save(ws); } catch (x) { return; }
  cur.api.changed();
}
function render(root, prog, c, api) {
  cfg = c;
  if (!ok) { root.textContent = 'Không tải được trình chỉnh sửa Blocks. Hãy tải lại trang; nếu vẫn lỗi, trình duyệt có thể đang chặn các tệp Blockly.'; return; }
  cur = { prog, api };
  if (!ws || !holder || holder.parentNode !== root) {
    root.textContent = '';
    holder = h('div', { class: 'bly' });
    root.append(holder);
    ws = B.inject(holder, { toolbox: toolbox(), media: 'js/vendor/blockly/media/', sounds: false, trashcan: true, renderer: 'geras', theme: theme(),
      zoom: { controls: true, wheel: false, startScale: 0.85, maxScale: 1.6, minScale: 0.4, scaleSpeed: 1.15 },
      move: { scrollbars: true, drag: true, wheel: true } });
    ws.addChangeListener(onChange);
    if (window.ResizeObserver) new ResizeObserver(() => { if (ws) B.svgResize(ws); }).observe(holder);
    const retheme = () => { if (ws) ws.setTheme(theme()); };
    try { new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-look', 'class'] }); } catch (e) { /* ignore */ }
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme); } catch (e) { /* ignore */ }
  }
  quietUntil = Date.now() + 600;
  B.Events.disable();
  try {
    ws.clear();
    try { B.serialization.workspaces.load(validState(prog.blocks) ? prog.blocks : blank(), ws); }
    catch (e) { ws.clear(); prog.blocks = blank(); B.serialization.workspaces.load(prog.blocks, ws); api.notify('Không mở được chương trình Blocks này nên đã tạo lại chương trình trống.'); }
  } finally { B.Events.enable(); }
  ws.clearUndo();
  B.svgResize(ws);
  ws.scroll(10, 10);
}

/* ---------- Blocks examples ---------- */
/* Short Blocks examples built from timed moves. */
function examples(c) {
  const S = BBZ.Samples, f = S.facts(c), n = f.n, T = f.T, four = f.four, time = S.timing;
  const drive = BBZ.driveRoles(c).map((r) => n[r]);
  const leftSide = four ? [n.fl, n.bl] : [n.left];

  /* shared pieces */
  const init = (b) => c.realistic ? leftSide.map((m) => b.reverse(m)) : [b.note('Đặt các khối khởi tạo ở đây.')];
  const set = (b, vals) => b.powers(drive, vals.map((v) => b.num(v)));
  const fwd = (b, p) => set(b, drive.map(() => p));
  const spin = (b, p) => set(b, four ? [-p, p, -p, p] : [-p, p]);                 // + turns left
  const slide = (b, p) => set(b, [-p, p, p, -p]);                                  // + slides left
  const teleop = (b, loop) => b.program(init(b).concat([
    b.blk('linearOpMode_waitForStart'),
    b.iff([[b.active(), [b.loopWhile(b.active(), loop.concat([b.update()]))]]])
  ]));
  const auto = (b, steps) => b.program(init(b).concat([b.blk('linearOpMode_waitForStart'), b.iff([[b.active(), steps]])]));
  /* One piece through the shooter, whichever kind the bot has. */
  const fire = (b) => f.shooter === 'catapult'
    ? [b.servo(n.catapult, b.num(1)), b.sleep(300), b.servo(n.catapult, b.num(0)), b.sleep(700)]
    : [b.servo(n.feeder, b.num(1)), b.sleep(300), b.servo(n.feeder, b.num(0)), b.sleep(700)];
  const wheels = (b, p) => f.wheels.length === 2 ? [b.powers(f.wheels, [b.num(p), b.num(p)])] : f.wheels.map((w) => b.power(w, b.num(p)));
  const stickMix = (b) => {
    const y = () => b.get('y'), x = () => b.get('x'), t = () => b.get('turn');
    const pre = [b.set('y', b.neg(b.padN('LeftStickY')))].concat(four ? [b.set('x', b.padN('LeftStickX'))] : [], [b.set('turn', b.padN('RightStickX'))]);
    return pre.concat([b.powers(drive, four
      ? [b.op('ADD', b.op('ADD', y(), x()), t()), b.op('MINUS', b.op('MINUS', y(), x()), t()), b.op('ADD', b.op('MINUS', y(), x()), t()), b.op('MINUS', b.op('ADD', y(), x()), t())]
      : [b.op('ADD', y(), t()), b.op('MINUS', y(), t())])]);
  };
  const tagVal = (b, id, prop) => b.blk('aprilTag_getProperty', { PROP: prop }, { ID: b.num(id) });

  const list = [];
  list.push({ id: 'blocks-drive', name: 'Blocks: Điều khiển cơ bản', lang: 'blocks', mode: 'teleop', why: null,
    desc: 'Chương trình đầu tiên: cần trái điều khiển robot' + (four ? ' và trượt ngang' : '') + ', cần phải dùng để xoay.',
    make: () => { const b = builder(); return teleop(b, stickMix(b)); } });
  /* The whole TeleOp. */
  const fullBlocks = (second) => {
      const b = builder(), loop = stickMix(b);
      if (second) b.who.pad = 'gamepad2';
      if (f.roller) loop.push(b.iff([[b.padB('RightBumper'), [b.power(n.intake, b.num(1))]], [b.padB('LeftBumper'), [b.power(n.intake, b.num(-1))]]], [b.power(n.intake, b.num(0))]));
      if (f.claw) loop.push(b.iff([[b.padB('RightBumper'), [b.servo(n.claw, b.num(1))]]], [b.servo(n.claw, b.num(0))]));
      if (f.wheels.length) {
        const trig = () => b.op('MULTIPLY', b.padN('RightTrigger'), b.num(0.75));
        loop.push(f.wheels.length === 2 ? b.powers(f.wheels, [trig(), trig()]) : b.power(f.wheels[0], trig()));
        loop.push(b.iff([[b.padB('A'), [b.servo(n.feeder, b.num(1))]]], [b.servo(n.feeder, b.num(0))]));
      }
      if (f.shooter === 'catapult') loop.push(b.iff([[b.padB('A'), [b.servo(n.catapult, b.num(1))]]], [b.servo(n.catapult, b.num(0))]));
      if (T.lift) {
        loop.push(b.iff([[b.padB('DpadUp'), [b.power(n.lift, b.num(0.9))]], [b.padB('DpadDown'), [b.power(n.lift, b.num(-0.9))]]], [b.power(n.lift, b.num(0))]));
        loop.push(b.iff([[b.padB('X'), [b.servo(n.gate, b.num(1))]]], [b.servo(n.gate, b.num(0))]));
      }
      return teleop(b, loop);
  };
  list.push({ id: 'blocks-full', name: 'Blocks: TeleOp đầy đủ', lang: 'blocks', mode: 'teleop', why: null,
    desc: 'Điều khiển robot và mọi cơ cấu trên robot bằng các khối nếu / nếu không cho từng nút.',
    make: () => fullBlocks(false) });
  list.push({ id: 'blocks-two', name: 'Blocks: TeleOp hai tay cầm', lang: 'blocks', mode: 'teleop', why: (T.intake || T.launcher || T.lift) ? null : 'Cần ít nhất một cơ cấu ghi điểm',
    desc: 'Dùng hai tay cầm: gamepad1 điều khiển robot, gamepad2 điều khiển cơ cấu. Không có tay cầm thứ hai? Chuyển tay cầm trên màn hình sang gamepad2.',
    make: () => fullBlocks(true) });
  list.push({ id: 'blocks-leave', name: 'Blocks: Rời vạch trong Tự động', lang: 'blocks', mode: 'auto', why: null,
    desc: 'Ba khối: chạy thẳng, chờ rồi dừng. Như vậy là đủ để ghi 3 điểm LEAVE.',
    make: () => { const b = builder(); return auto(b, [fwd(b, 0.4), b.sleep(600), fwd(b, 0)]); } });
  /* Turns a list of moves into timed blocks: set the powers, wait, stop, pause. */
  const timed = (b, s) => {
    const p = s[0] === 'T' ? 0.4 : (Math.abs(s[1]) >= 30 ? 0.9 : 0.5), dir = s[1] < 0 ? -1 : 1;
    if (s[0] === 'D') return [fwd(b, dir * p), b.sleep(time.drive(c, s[1], p)), fwd(b, 0), b.sleep(150)];
    if (s[0] === 'S') return [slide(b, dir * p), b.sleep(time.strafe(c, s[1], p)), fwd(b, 0), b.sleep(150)];
    return [spin(b, dir * p), b.sleep(time.turn(c, s[1], p)), fwd(b, 0), b.sleep(150)];
  };
  list.push({ id: 'blocks-tip', name: 'Blocks: Nghiêng tổ và đậu trong Tự động', lang: 'blocks', mode: 'auto', why: f.face ? 'Cần hướng bộ phóng ra phía trước robot' : null,
    desc: (f.shooter ? 'Bắn 3 POLLEN để làm nghiêng HIVE, sau đó ' : 'Rời tường rồi ') + 'chạy đến LOADING ZONE và đậu theo thời gian. Dành cho vị trí xuất phát "' + f.startName + '".',
    make: () => {
      const b = builder(), steps = [];
      f.route(four).forEach((s) => {
        if (s[0] !== 'SHOOT') { timed(b, s).forEach((x) => steps.push(x)); return; }
        if (f.wheels.length) { wheels(b, f.hivePower).forEach((x) => steps.push(x)); steps.push(b.sleep(1500)); }
        steps.push(b.repeat(3, fire(b)));
        if (f.wheels.length) wheels(b, 0).forEach((x) => steps.push(x));
      });
      return auto(b, steps);
    } });
  list.push({ id: 'blocks-square', name: 'Blocks: Chạy theo hình vuông', lang: 'blocks', mode: 'auto', why: null,
    desc: 'Lặp lại chuỗi "chạy 20 inch, xoay trái 90 độ" bốn lần theo thời gian. Thay đổi thời gian chờ để xem hình vuông thay đổi.',
    make: () => {
      const b = builder();
      return auto(b, [b.repeat(4, [fwd(b, 0.5), b.sleep(time.drive(c, 20, 0.5)), fwd(b, 0), b.sleep(250), spin(b, 0.3), b.sleep(time.turn(c, 90, 0.3)), fwd(b, 0), b.sleep(250)])]);
    } });
  list.push({ id: 'blocks-distance', name: 'Blocks: Dừng theo cảm biến khoảng cách', lang: 'blocks', mode: 'auto', why: S.need(c, ['distance'], [T.distance && c.layout.distance.face ? 'hướng cảm biến khoảng cách ra phía trước' : null]),
    desc: 'Chạy thẳng khi cảm biến khoảng cách đọc lớn hơn 12 inch, sau đó dừng lại.',
    make: () => {
      const b = builder();
      const dist = () => b.blk('distanceSensor_getDistance', { DEVICE: n.distance, UNIT: 'INCH' });
      return auto(b, [fwd(b, 0.35), b.loopWhile(b.and(b.active(), b.cmp('GT', dist(), b.num(12))), [b.numData('Distance', dist()), b.update()]), fwd(b, 0)]);
    } });
  list.push({ id: 'blocks-tags', name: 'Blocks: Đọc AprilTag', lang: 'blocks', mode: 'teleop', why: S.need(c, ['camera']),
    desc: 'Điều khiển robot trong khi telemetry hiển thị AprilTag gần nhất, khoảng cách và góc của tag.',
    make: () => {
      const b = builder(), near = () => b.blk('aprilTag_nearestId');
      const prop = (p) => b.blk('aprilTag_getProperty', { PROP: p }, { ID: near() });
      return teleop(b, stickMix(b).concat([b.numData('Nearest tag', near()), b.numData('Range', prop('Range')), b.numData('Bearing', prop('Bearing'))]));
    } });
  list.push({ id: 'blocks-tagstop', name: 'Blocks: Dừng theo AprilTag', lang: 'blocks', mode: 'auto', why: S.need(c, ['camera'], [T.camera && c.layout.camera.face ? 'hướng webcam ra phía trước' : null, f.atHive ? null : 'vị trí xuất phát hướng về HIVE của bạn']),
    desc: 'Chạy về phía HIVE và dừng khi AprilTag cách 30 inch. Bắt đầu ở vị trí hướng về HIVE.',
    make: () => {
      const b = builder(), id = f.hiveTag;
      const far = b.blk('logic_operation', { OP: 'OR' }, { A: b.blk('logic_negate', null, { BOOL: b.blk('aprilTag_isVisible', null, { ID: b.num(id) }) }), B: b.cmp('GT', tagVal(b, id, 'Range'), b.num(30)) });
      return auto(b, [fwd(b, 0.3), b.loopWhile(b.and(b.active(), far), [b.numData('Range', tagVal(b, id, 'Range')), b.update()]), fwd(b, 0)]);
    } });
  return list;
}

if (ok) { defineBlocks(); defineGenerator(); }
const javaList = BBZ.Samples.list;
BBZ.Samples.list = (c) => { cfg = c; return javaList(c).filter((e) => e.lang === 'java').concat(examples(c)); };
BBZ.Blocks = { render, generate, sanitize, blank, theme, useRobot(c) { cfg = c; }, className: legacy.className, resetCursor() {},
  legacyJava: legacy.generate, legacySanitize: legacy.sanitize, ready: ok };
})();
