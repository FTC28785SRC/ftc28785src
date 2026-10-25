/* Java example programs and code templates. */
(function () {
'use strict';
const BBZ = window.BBZ = window.BBZ || {};

/* Safe element builder: text always goes in as text nodes, never as HTML. */
function h(tag, attrs) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') e[k] = !!v;
      else e.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (let i = 2; i < arguments.length; i++) {
    const c = arguments[i];
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) c.forEach((x) => { if (x !== null && x !== undefined && x !== false) e.append(x.nodeType ? x : document.createTextNode(String(x))); });
    else e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}
BBZ.h = h;

const BTN = [['a', 'A'], ['b', 'B'], ['x', 'X'], ['y', 'Y'], ['left_bumper', 'nút vai trái'], ['right_bumper', 'nút vai phải'],
  ['left_trigger', 'cò trái'], ['right_trigger', 'cò phải'], ['dpad_up', 'D-pad lên'], ['dpad_down', 'D-pad xuống'],
  ['dpad_left', 'D-pad trái'], ['dpad_right', 'D-pad phải']];
const COND = [['btn', 'nút tay cầm được nhấn:'], ['time', 'bộ đếm thời gian lớn hơn (giây)'], ['dist', 'khoảng cách nhỏ hơn (inch)'], ['lift', 'chiều cao nâng lớn hơn (inch)']];
const VAL = [['timer', 'thời gian (giây)'], ['heading', 'hướng (độ)'], ['distance', 'khoảng cách (inch)'], ['lift', 'chiều cao nâng (inch)'], ['none', 'không có giá trị khác']];
const CATS = [{ id: 'control', label: 'Điều khiển' }, { id: 'drive', label: 'Di chuyển' }, { id: 'mech', label: 'Cơ cấu' }, { id: 'output', label: 'Telemetry' }];

const N = (f, d, min, max, step) => ({ f, t: 'num', d, min, max, step });
const S = (f, opts) => ({ f, t: 'sel', opts, d: opts[0][0] });
const D = (f, kind) => ({ f, t: 'dev', kind });
const SPEC = {
  forever: { cat: 'control', title: 'lặp khi đang chạy', parts: ['lặp khi OpMode đang chạy'], body: true },
  repeat: { cat: 'control', title: 'lặp N lần', parts: ['lặp', N('n', 3, 1, 500, 1), 'lần'], body: true },
  if: { cat: 'control', title: 'nếu / nếu không', parts: ['nếu', { f: 'c', t: 'cond' }], body: true, els: true },
  wait_until: { cat: 'control', title: 'chờ đến khi', parts: ['chờ đến khi', { f: 'c', t: 'cond' }] },
  wait: { cat: 'control', title: 'chờ số giây', parts: ['chờ', N('s', 1, 0, 60, 0.1), 'giây'] },
  drive_pad: { cat: 'drive', title: 'điều khiển bằng tay cầm', parts: ['điều khiển bằng cần analog ở tốc độ', N('p', 1, 0.1, 1, 0.05)] },
  drive_set: { cat: 'drive', title: 'đặt công suất di chuyển', parts: ['di chuyển: tiến', N('f', 0.5, -1, 1, 0.05), 'trượt ngang', N('s', 0, -1, 1, 0.05), 'xoay', N('t', 0, -1, 1, 0.05)] },
  drive_stop: { cat: 'drive', title: 'dừng di chuyển', parts: ['dừng di chuyển'] },
  drive_in: { cat: 'drive', title: 'chạy theo inch', parts: ['chạy thẳng', N('d', 24, -144, 144, 0.5), 'inch với công suất', N('p', 0.6, 0.1, 1, 0.05)] },
  strafe_in: { cat: 'drive', title: 'trượt ngang theo inch', parts: ['trượt sang phải', N('d', 12, -144, 144, 0.5), 'inch với công suất', N('p', 0.6, 0.1, 1, 0.05)], mecanum: true },
  turn: { cat: 'drive', title: 'xoay theo độ', parts: ['xoay', S('dir', [['left', 'trái'], ['right', 'phải']]), N('a', 90, 1, 180, 1), 'độ với công suất', N('p', 0.5, 0.1, 1, 0.05)] },
  intake: { cat: 'mech', title: 'cơ cấu hút', parts: ['cơ cấu hút', S('m', [['in', 'hút vào'], ['out', 'đẩy ra'], ['off', 'tắt']])], tool: 'intake' },
  launcher: { cat: 'mech', title: 'bánh đà phóng', parts: ['công suất bánh đà', N('p', 0.75, 0, 1, 0.01)], tool: 'launcher' },
  launch_one: { cat: 'mech', title: 'phóng một vật phẩm', parts: ['phóng một vật phẩm'], tool: 'launcher' },
  lift_to: { cat: 'mech', title: 'di chuyển bộ nâng', parts: ['nâng đến', N('h', 22, 0, 26, 0.5), 'inch', S('w', [['wait', 'và chờ'], ['go', 'không chờ']])], tool: 'lift' },
  drop_one: { cat: 'mech', title: 'thả một vật phẩm', parts: ['mở cổng để thả một vật phẩm'], tool: 'lift' },
  motor: { cat: 'mech', title: 'đặt công suất động cơ', parts: ['đặt công suất động cơ', D('r', 'motor'), N('p', 0.5, -1, 1, 0.05)] },
  servo: { cat: 'mech', title: 'đặt vị trí servo', parts: ['đặt servo', D('r', 'servo'), 'ở vị trí', N('p', 1, 0, 1, 0.05)] },
  show: { cat: 'output', title: 'hiển thị trên telemetry', parts: ['hiển thị', { f: 't', t: 'text', d: 'Thời gian' }, 'và', { f: 'v', t: 'val' }] }
};
const MAX_BLOCKS = 300, MAX_DEPTH = 6;

let uid = 1;
const newId = () => 'b' + (uid++) + Math.floor(Math.random() * 1e6).toString(36);
const isOpt = (opts, v) => opts.some((o) => o[0] === v);
const fixNum = (v, p) => { v = typeof v === 'number' && isFinite(v) ? v : p.d; return Math.min(p.max, Math.max(p.min, v)); };
function fixCond(c) {
  c = c && typeof c === 'object' ? c : {};
  return { kind: isOpt(COND, c.kind) ? c.kind : 'btn', btn: isOpt(BTN, c.btn) ? c.btn : 'a', n: typeof c.n === 'number' && isFinite(c.n) ? Math.min(999, Math.max(0, c.n)) : 5, not: c.not === true };
}
function firstDev(cfg, kind) { const d = BBZ.deviceList(cfg).find((x) => x.kind === kind); return d ? d.role : ''; }

function makeBlock(type, cfg, f) {
  const sp = SPEC[type], b = { id: newId(), type, f: {}, body: [], els: [] };
  sp.parts.forEach((p) => {
    if (typeof p === 'string') return;
    if (p.t === 'num') b.f[p.f] = p.d;
    else if (p.t === 'sel') b.f[p.f] = p.d;
    else if (p.t === 'dev') b.f[p.f] = cfg ? firstDev(cfg, p.kind) : '';
    else if (p.t === 'text') b.f[p.f] = p.d;
    else if (p.t === 'cond') b.f[p.f] = fixCond(null);
    else if (p.t === 'val') b.f[p.f] = 'timer';
  });
  if (f) Object.keys(f).forEach((k) => { b.f[k] = f[k]; });
  return b;
}

/* Rebuilds a block list from untrusted data (saved storage), keeping only known shapes. */
function sanitize(list, depth, counter) {
  depth = depth || 0; counter = counter || { n: 0 };
  if (!Array.isArray(list) || depth > MAX_DEPTH) return [];
  const out = [];
  list.forEach((raw) => {
    if (!raw || typeof raw !== 'object' || !Object.prototype.hasOwnProperty.call(SPEC, raw.type) || counter.n >= MAX_BLOCKS) return;
    counter.n++;
    const sp = SPEC[raw.type], src = raw.f && typeof raw.f === 'object' ? raw.f : {}, b = { id: newId(), type: raw.type, f: {}, body: [], els: [] };
    sp.parts.forEach((p) => {
      if (typeof p === 'string') return;
      const v = src[p.f];
      if (p.t === 'num') b.f[p.f] = fixNum(v, p);
      else if (p.t === 'sel') b.f[p.f] = isOpt(p.opts, v) ? v : p.d;
      else if (p.t === 'dev') b.f[p.f] = (typeof v === 'string' && Object.prototype.hasOwnProperty.call(BBZ.ROLES, v) && BBZ.ROLES[v].kind === p.kind) ? v : '';
      else if (p.t === 'text') b.f[p.f] = typeof v === 'string' ? v.slice(0, 30) : p.d;
      else if (p.t === 'cond') b.f[p.f] = fixCond(v);
      else if (p.t === 'val') b.f[p.f] = isOpt(VAL, v) ? v : 'timer';
    });
    if (sp.body) b.body = sanitize(raw.body, depth + 1, counter);
    if (sp.els) b.els = sanitize(raw.els, depth + 1, counter);
    out.push(b);
  });
  return out;
}
function countBlocks(list) { let n = 0; list.forEach((b) => { n += 1 + countBlocks(b.body) + countBlocks(b.els); }); return n; }

/* ---------- Java generation ---------- */
const str = (s) => '"' + String(s).replace(/[\u0000-\u001f]/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const num = (v) => String(+(+v).toFixed(3));
function className(name) {
  const parts = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  let s = parts.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  if (!/^[A-Za-z]/.test(s)) s = 'My' + s;
  return s.slice(0, 40) || 'MyOpMode';
}

function helperLines(name, cfg) {
  const n = cfg.names, four = BBZ.holo(cfg), T = cfg.tools;
  const dm = BBZ.driveRoles(cfg).map((r) => n[r]);
  const each = (fn) => dm.map(fn);
  switch (name) {
    case 'setDrive':
      if (four) return [
        '// Mixes forward, strafe (right is +) and turn (right is +) into the four wheel powers.',
        'void setDrive(double forward, double strafe, double turn) {',
        '    ' + n.fl + '.setPower(forward + strafe + turn);',
        '    ' + n.fr + '.setPower(forward - strafe - turn);',
        '    ' + n.bl + '.setPower(forward - strafe + turn);',
        '    ' + n.br + '.setPower(forward + strafe - turn);',
        '}'];
      return [
        '// Mixes forward and turn (right is +) into the left and right wheel powers.',
        '// A tank drive cannot slide sideways, so strafe is ignored.',
        'void setDrive(double forward, double strafe, double turn) {',
        '    ' + n.left + '.setPower(forward + turn);',
        '    ' + n.right + '.setPower(forward - turn);',
        '}'];
    case 'moveTicks': {
      const params = four ? ['tFL', 'tFR', 'tBL', 'tBR'] : ['tLeft', 'tRight'];
      return [].concat(
        ['// Runs every drive motor to its own encoder target, then stops.',
          'void moveTicks(' + params.map((p) => 'int ' + p).join(', ') + ', double power) {'],
        each((m) => '    ' + m + '.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);'),
        dm.map((m, i) => '    ' + m + '.setTargetPosition(' + params[i] + ');'),
        each((m) => '    ' + m + '.setMode(DcMotor.RunMode.RUN_TO_POSITION);'),
        each((m) => '    ' + m + '.setPower(power);'),
        ['    while (opModeIsActive() && (' + dm.map((m) => m + '.isBusy()').join(' || ') + ')) {', '        idle();', '    }',
          '    sleep(250);       // let the motors settle exactly on their targets before letting go'],
        each((m) => '    ' + m + '.setPower(0);'),
        each((m) => '    ' + m + '.setMode(DcMotor.RunMode.RUN_USING_ENCODER);'),
        ['}']);
    }
    case 'driveInches': return [
      '// Drives straight using the wheel encoders. Negative inches goes backward.',
      'void driveInches(double inches, double power) {',
      '    int count = (int) Math.round(inches * TICKS_PER_INCH);',
      '    moveTicks(' + (four ? 'count, count, count, count' : 'count, count') + ', power);',
      '}'];
    case 'strafeInches': return [
      '// Slides sideways to the right (negative = left). Wheels slip a little when strafing,',
      '// so the robot travels a bit less than asked. Tune the number on your real robot.',
      'void strafeInches(double inches, double power) {',
      '    int count = (int) Math.round(inches * TICKS_PER_INCH);',
      '    moveTicks(count, -count, -count, count, power);',
      '}'];
    case 'turnLeft':
      if (T.imu) return [
        '// Turns on the spot using the IMU. Positive degrees turns left, negative turns right.',
        '// For a half turn, call it twice with 90.',
        'void turnLeft(double degrees, double power) {',
        '    ' + n.imu + '.resetYaw();',
        '    ElapsedTime onTarget = new ElapsedTime();',
        '    // Keep correcting until the robot has stayed within 1 degree for a quarter of a second.',
        '    while (opModeIsActive() && onTarget.seconds() < 0.25) {',
        '        double error = degrees - ' + n.imu + '.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES);',
        '        if (Math.abs(error) > 1.0) {',
        '            onTarget.reset();',
        '        }',
        '        // The further off it is, the harder it turns, so it slows down as it arrives.',
        '        setDrive(0, 0, -Range.clip(error * 0.02, -power, power));',
        '    }',
        '    setDrive(0, 0, 0);',
        '}'];
      return [
        '// Turns on the spot by counting encoder ticks (add an IMU for more accurate turns).',
        'void turnLeft(double degrees, double power) {',
        '    int count = (int) Math.round(degrees * TICKS_PER_DEGREE);',
        '    moveTicks(' + (four ? '-count, count, -count, count' : '-count, count') + ', power);',
        '}'];
    case 'launchOne':
      if (T.launcher && cfg.kit.launcher === 'catapult') return [
        '// Lets the catapult arm go, then pulls it back down ready for the next piece.',
        'void launchOne() {',
        '    ' + n.catapult + '.setPosition(1.0);',
        '    sleep(300);',
        '    ' + n.catapult + '.setPosition(0.0);',
        '    sleep(700);',
        '}'];
      return [
        '// Pushes one piece into the spinning launcher wheel, then pulls the feeder back.',
        'void launchOne() {',
        '    ' + n.feeder + '.setPosition(1.0);',
        '    sleep(300);',
        '    ' + n.feeder + '.setPosition(0.0);',
        '    sleep(700);       // let the wheel get back up to speed',
        '}'];
    case 'dropOne': return [
      '// Opens the gate long enough for one piece to fall out, then closes it.',
      'void dropOne() {',
      '    ' + n.gate + '.setPosition(1.0);',
      '    sleep(350);',
      '    ' + n.gate + '.setPosition(0.0);',
      '    sleep(300);',
      '}'];
    case 'liftTo': return [
      '// Sends the lift to a height in inches. It can wait there or return right away.',
      'void liftTo(double inches, boolean waitUntilThere) {',
      '    ' + n.lift + '.setTargetPosition((int) Math.round(inches * LIFT_TICKS_PER_INCH));',
      '    ' + n.lift + '.setMode(DcMotor.RunMode.RUN_TO_POSITION);',
      '    ' + n.lift + '.setPower(1.0);',
      '    while (waitUntilThere && opModeIsActive() && ' + n.lift + '.isBusy()) {',
      '        idle();',
      '    }',
      '}'];
    case 'findTag': return [
      '// Looks through everything the webcam can see for one tag ID. Gives back null if it is not in view.',
      'AprilTagDetection findTag(int id) {',
      '    for (AprilTagDetection detection : aprilTag.getDetections()) {',
      '        if (detection.id == id) {',
      '            return detection;',
      '        }',
      '    }',
      '    return null;',
      '}'];
  }
  return [];
}

const TYPE_OF = { motor: 'DcMotor', servo: 'Servo', imu: 'IMU', distance: 'DistanceSensor' };
/* Builds a full OpMode class around `body`. */
function scaffold(o) {
  const cfg = o.cfg, n = cfg.names, all = BBZ.deviceList(cfg);
  const use = new Set(o.use || []), consts = new Set(o.consts || []);
  if (use.has('driveInches') || use.has('strafeInches')) { use.add('moveTicks'); consts.add('TPI'); }
  if (use.has('turnLeft')) { if (cfg.tools.imu) use.add('setDrive'); else { use.add('moveTicks'); consts.add('TPD'); } }
  if (use.has('liftTo')) consts.add('LIFT');
  const helpers = [];
  ['setDrive', 'moveTicks', 'driveInches', 'strafeInches', 'turnLeft', 'launchOne', 'dropOne', 'liftTo', 'findTag'].forEach((hn) => {
    if (use.has(hn)) helpers.push(helperLines(hn, cfg));
  });
  const text = o.body.concat(o.extra || [], o.constLines || [], [].concat.apply([], helpers)).join('\n');
  const mentions = (word) => new RegExp('(^|[^A-Za-z0-9_])' + word + '([^A-Za-z0-9_]|$)').test(text);
  const drive = new Set(BBZ.driveRoles(cfg));
  const devs = all.filter((d) => d.kind !== 'camera' && (drive.has(d.role) || mentions(d.name)));
  const has = (kind) => devs.some((d) => d.kind === kind);
  const vision = mentions('aprilTag'), timer = mentions('runtime'), cam = all.find((d) => d.kind === 'camera');
  const L = [];
  (o.intro || []).forEach((s) => L.push('// ' + s));
  L.push('package org.firstinspires.ftc.teamcode;', '');
  L.push('import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;');
  L.push('import com.qualcomm.robotcore.eventloop.opmode.' + (o.mode === 'auto' ? 'Autonomous' : 'TeleOp') + ';');
  L.push('import com.qualcomm.robotcore.hardware.DcMotor;');
  if (has('servo')) L.push('import com.qualcomm.robotcore.hardware.Servo;');
  if (has('imu')) L.push('import com.qualcomm.robotcore.hardware.IMU;', 'import com.qualcomm.hardware.rev.RevHubOrientationOnRobot;', 'import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;');
  if (has('distance')) L.push('import com.qualcomm.robotcore.hardware.DistanceSensor;', 'import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;');
  if (vision) L.push('import org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName;', 'import org.firstinspires.ftc.vision.VisionPortal;',
    'import org.firstinspires.ftc.vision.apriltag.AprilTagDetection;', 'import org.firstinspires.ftc.vision.apriltag.AprilTagProcessor;');
  if (timer || mentions('ElapsedTime')) L.push('import com.qualcomm.robotcore.util.ElapsedTime;');
  if (mentions('Range')) L.push('import com.qualcomm.robotcore.util.Range;');
  L.push('', (o.mode === 'auto' ? '@Autonomous' : '@TeleOp') + '(name = ' + str(o.title) + (o.group ? ', group = ' + str(o.group === 'Examples' ? 'Ví dụ' : o.group) : '') + ')');
  L.push('public class ' + o.cls + ' extends LinearOpMode {');
  if (consts.has('TPI')) L.push('    static final double TICKS_PER_INCH = ' + BBZ.ticksPerInch(cfg).toFixed(2) + ';      // wheel encoder ticks for one inch');
  if (consts.has('TPD')) L.push('    static final double TICKS_PER_DEGREE = ' + (BBZ.ticksPerInch(cfg) * BBZ.turnK(cfg) * Math.PI / 180).toFixed(3) + ';   // wheel ticks to turn one degree');
  if (consts.has('LIFT')) L.push('    static final double LIFT_TICKS_PER_INCH = ' + BBZ.liftTicksPerInch(cfg).toFixed(2) + ';');
  (o.constLines || []).forEach((s) => L.push('    ' + s));
  if (consts.size || (o.constLines || []).length) L.push('');
  devs.forEach((d) => L.push('    private ' + TYPE_OF[d.kind] + ' ' + d.name + ';'));
  if (vision) L.push('    private AprilTagProcessor aprilTag;', '    private VisionPortal visionPortal;');
  if (timer) L.push('    private ElapsedTime runtime = new ElapsedTime();');
  L.push('', '    @Override', '    public void runOpMode() {');
  const B = (s) => L.push(s === '' ? '' : '        ' + s);
  devs.forEach((d) => B(d.name + ' = hardwareMap.get(' + TYPE_OF[d.kind] + '.class, ' + str(d.name) + ');'));
  if (cfg.realistic) {
    B('');
    B('// The left motors are mounted the other way round, so they are reversed.');
    (BBZ.holo(cfg) ? [n.fl, n.bl] : [n.left]).forEach((m) => B(m + '.setDirection(DcMotor.Direction.REVERSE);'));
  }
  const lift = devs.find((d) => d.role === 'lift');
  if (lift) { B(lift.name + '.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);'); B(lift.name + '.setMode(DcMotor.RunMode.RUN_USING_ENCODER);'); }
  if (has('imu')) {
    B(n.imu + '.initialize(new IMU.Parameters(new RevHubOrientationOnRobot(');
    B('        RevHubOrientationOnRobot.LogoFacingDirection.UP,');
    B('        RevHubOrientationOnRobot.UsbFacingDirection.FORWARD)));');
    B(n.imu + '.resetYaw();');
  }
  devs.filter((d) => d.kind === 'servo').forEach((d) => B(d.name + '.setPosition(0.0);'));
  if (vision) {
    B('');
    B('// The AprilTag processor finds tags in the picture; the VisionPortal connects it to the webcam.');
    B('aprilTag = AprilTagProcessor.easyCreateWithDefaults();');
    B('visionPortal = VisionPortal.easyCreateWithDefaults(hardwareMap.get(WebcamName.class, ' + str(cam ? cam.name : n.camera) + '), aprilTag);');
  }
  B('');
  B('telemetry.addData("Status", "Initialized");');
  B('telemetry.update();');
  B('// Wait for the game to start (driver presses START)');
  B('waitForStart();');
  if (timer) B('runtime.reset();');
  B('');
  o.body.forEach(B);
  L.push('    }');
  helpers.forEach((lines) => { L.push(''); lines.forEach((s) => L.push('    ' + s)); });
  if (o.extra && o.extra.length) { L.push(''); o.extra.forEach((s) => L.push(s === '' ? '' : '    ' + s)); }
  L.push('}', '');
  return L.join('\n');
}

function generate(prog, cfg) {
  const n = cfg.names, T = cfg.tools;
  const ctx = { use: new Set(), consts: new Set(), errs: [], loop: 0, depth: 0, pending: false };
  const fail = (m) => { ctx.errs.push(m); };
  const needTool = (tool, what) => { if (!T[tool]) { fail(what + ' needs the ' + BBZ.TOOLS[tool].label + '. Add it in Build Bot, or remove that block.'); return false; } return true; };
  const devName = (role, kind, what) => {
    const d = BBZ.deviceList(cfg).find((x) => x.role === role && x.kind === kind);
    if (!d) { fail('The block "' + what + '" has no ' + kind + ' picked (or your bot no longer has it). Choose one from its list.'); return 'missing'; }
    return d.name;
  };
  const cond = (c) => {
    let s;
    if (c.kind === 'btn') s = (c.btn === 'left_trigger' || c.btn === 'right_trigger') ? 'gamepad1.' + c.btn + ' > 0.5' : 'gamepad1.' + c.btn;
    else if (c.kind === 'time') s = 'runtime.seconds() > ' + num(c.n);
    else if (c.kind === 'dist') { needTool('distance', 'The condition "distance is less than"'); s = n.distance + '.getDistance(DistanceUnit.INCH) < ' + num(c.n); }
    else { needTool('lift', 'The condition "lift is above"'); ctx.consts.add('LIFT'); s = n.lift + '.getCurrentPosition() > ' + num(c.n) + ' * LIFT_TICKS_PER_INCH'; }
    return c.not ? '!(' + s + ')' : s;
  };
  const val = (v) => {
    if (v === 'timer') return 'runtime.seconds()';
    if (v === 'heading') { needTool('imu', 'Showing the heading'); return n.imu + '.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES)'; }
    if (v === 'distance') { needTool('distance', 'Showing the distance'); return n.distance + '.getDistance(DistanceUnit.INCH)'; }
    if (v === 'lift') { needTool('lift', 'Showing the lift height'); ctx.consts.add('LIFT'); return n.lift + '.getCurrentPosition() / LIFT_TICKS_PER_INCH'; }
    return null;
  };
  function list(blocks, ind) {
    const out = [], pad = '    '.repeat(ind), P = (s) => out.push(pad + s);
    blocks.forEach((b) => {
      const sp = SPEC[b.type], f = b.f;
      if (sp.tool && !needTool(sp.tool, 'The block "' + sp.title + '"')) return;
      if (sp.mecanum && !BBZ.holo(cfg)) { fail('The block "' + sp.title + '" only works with a mecanum drivetrain. A tank drive cannot slide sideways.'); return; }
      const loopBody = (open) => {
        P(open); ctx.depth++;
        list(b.body, ind + 1).forEach((s) => out.push(s));
        ctx.depth--;
        if (ctx.depth === 0 && ctx.pending) { out.push(pad + '    telemetry.update();'); ctx.pending = false; }
        P('}');
      };
      switch (b.type) {
        case 'forever': loopBody('while (opModeIsActive()) {'); break;
        case 'repeat': { const v = 'i' + (++ctx.loop); loopBody('for (int ' + v + ' = 0; ' + v + ' < ' + Math.round(f.n) + ' && opModeIsActive(); ' + v + '++) {'); break; }
        case 'if':
          P('if (' + cond(f.c) + ') {');
          list(b.body, ind + 1).forEach((s) => out.push(s));
          if (b.els.length) { P('} else {'); list(b.els, ind + 1).forEach((s) => out.push(s)); }
          P('}');
          break;
        case 'wait_until': P('while (opModeIsActive() && !(' + cond(f.c) + ')) {'); P('    idle();'); P('}'); break;
        case 'wait': P('sleep(' + Math.round(f.s * 1000) + ');'); break;
        case 'drive_pad': ctx.use.add('setDrive'); P('setDrive(-gamepad1.left_stick_y * ' + num(f.p) + ', gamepad1.left_stick_x * ' + num(f.p) + ', gamepad1.right_stick_x * ' + num(f.p) + ');'); break;
        case 'drive_set': ctx.use.add('setDrive'); P('setDrive(' + num(f.f) + ', ' + num(f.s) + ', ' + num(f.t) + ');'); break;
        case 'drive_stop': ctx.use.add('setDrive'); P('setDrive(0, 0, 0);'); break;
        case 'drive_in': ctx.use.add('driveInches'); P('driveInches(' + num(f.d) + ', ' + num(f.p) + ');'); break;
        case 'strafe_in': ctx.use.add('strafeInches'); P('strafeInches(' + num(f.d) + ', ' + num(f.p) + ');'); break;
        case 'turn': ctx.use.add('turnLeft'); P('turnLeft(' + num(f.dir === 'left' ? f.a : -f.a) + ', ' + num(f.p) + ');'); break;
        case 'intake': P(n.intake + '.setPower(' + (f.m === 'in' ? '1.0' : f.m === 'out' ? '-1.0' : '0') + ');'); break;
        case 'launcher': P(n.launcher + '.setPower(' + num(f.p) + ');'); break;
        case 'launch_one': ctx.use.add('launchOne'); P('launchOne();'); break;
        case 'lift_to': ctx.use.add('liftTo'); P('liftTo(' + num(f.h) + ', ' + (f.w === 'wait' ? 'true' : 'false') + ');'); break;
        case 'drop_one': ctx.use.add('dropOne'); P('dropOne();'); break;
        case 'motor': P(devName(f.r, 'motor', sp.title) + '.setPower(' + num(f.p) + ');'); break;
        case 'servo': P(devName(f.r, 'servo', sp.title) + '.setPosition(' + num(f.p) + ');'); break;
        case 'show': {
          const v = val(f.v);
          P(v === null ? 'telemetry.addLine(' + str(f.t) + ');' : 'telemetry.addData(' + str(f.t) + ', "%.1f", ' + v + ');');
          if (ctx.depth === 0) P('telemetry.update();'); else ctx.pending = true;
          break;
        }
      }
    });
    return out;
  }
  const body = list(prog.blocks, 0);
  if (!prog.blocks.length) body.push('// Add blocks to tell the robot what to do.');
  if (ctx.errs.length) throw new Error(ctx.errs[0]);
  return scaffold({
    cfg, mode: prog.mode, title: prog.name, group: prog.group, cls: className(prog.name), body, use: ctx.use, consts: ctx.consts,
    intro: ['Made from your blocks. The package, import and @ lines are what a real robot needs;', 'the simulator skips them.']
  });
}

/* ---------- editor ---------- */
let cursor = null;                         // { list, idx } where the next block lands
let openCat = 'drive';                     // toolbox category whose blocks are showing
let snapId = null;                         // id of the block that just connected, so it can play its snap
let swallow = false;                       // true for a moment after a drag so the mouse-up is not treated as a click
const fx = (name) => { try { if (BBZ.Sound) BBZ.Sound.play(name); } catch (e) { /* sound is optional */ } };
/* How many levels of nested lists a block carries inside it (0 for a plain block). */
function innerDepth(b) {
  if (!SPEC[b.type].body) return 0;
  let d = 0;
  b.body.concat(b.els).forEach((k) => { d = Math.max(d, innerDepth(k)); });
  return d + 1;
}
function listReachable(root, target) {
  if (root === target) return true;
  return root.some((b) => listReachable(b.body, target) || listReachable(b.els, target));
}
function clone(b) { return { id: newId(), type: b.type, f: JSON.parse(JSON.stringify(b.f)), body: b.body.map(clone), els: b.els.map(clone) }; }

/* Draws the palette and workspace into `root`. */
function render(root, prog, cfg, api) {
  root.textContent = '';
  if (!cursor || !listReachable(prog.blocks, cursor.list)) cursor = { list: prog.blocks, idx: prog.blocks.length };
  cursor.idx = Math.min(cursor.idx, cursor.list.length);
  const redraw = () => { render(root, prog, cfg, api); api.changed(); };
  const depthOf = (target, list, d) => {
    if (list === target) return d;
    for (let i = 0; i < list.length; i++) {
      const a = depthOf(target, list[i].body, d + 1); if (a >= 0) return a;
      const e = depthOf(target, list[i].els, d + 1); if (e >= 0) return e;
    }
    return -1;
  };
  const add = (type) => {
    if (countBlocks(prog.blocks) >= MAX_BLOCKS) { api.notify('That is the most blocks one program can hold (' + MAX_BLOCKS + ').'); return; }
    if (SPEC[type].body && depthOf(cursor.list, prog.blocks, 0) >= MAX_DEPTH - 1) { api.notify('Blocks cannot be nested any deeper than this.'); return; }
    const made = makeBlock(type, cfg);
    cursor.list.splice(cursor.idx, 0, made);
    cursor.idx++;
    snapId = made.id;
    redraw();
  };

  /* ----- drag and drop: pick a block up from the flyout or the workspace and drop it on a gap ----- */
  const slotInfo = new WeakMap();           // gap element -> { list, idx }
  function dropBlock(src, info) {
    const list = info.list;
    let idx = info.idx, made;
    const depth = depthOf(list, prog.blocks, 0);
    if (src.block) {
      const from = src.list.indexOf(src.block);
      if (from < 0) return;
      if (list === src.list && (idx === from || idx === from + 1)) { snapId = src.block.id; redraw(); return; }
      const inner = innerDepth(src.block);
      if (inner > 0 && depth + inner > MAX_DEPTH - 1) { api.notify('Blocks cannot be nested any deeper than this.'); return; }
      src.list.splice(from, 1);
      if (list === src.list && idx > from) idx--;
      made = src.block;
    } else {
      if (countBlocks(prog.blocks) >= MAX_BLOCKS) { api.notify('That is the most blocks one program can hold (' + MAX_BLOCKS + ').'); return; }
      if (SPEC[src.type].body && depth >= MAX_DEPTH - 1) { api.notify('Blocks cannot be nested any deeper than this.'); return; }
      made = makeBlock(src.type, cfg);
    }
    list.splice(idx, 0, made);
    cursor = { list, idx: idx + 1 };
    snapId = made.id;
    redraw();
  }
  function beginDrag(e, src, label, cat, srcEl) {
    if (e.button !== undefined && e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY, pid = e.pointerId;
    let ghost = null, target = null, active = false;
    /* a block cannot be dropped inside itself */
    const allowed = (info) => !src.block || !(listReachable(src.block.body, info.list) || listReachable(src.block.els, info.list));
    const pick = (x, y) => {
      let best = null, bd = 1e9;
      root.querySelectorAll('.slot').forEach((s) => {
        const info = slotInfo.get(s);
        if (!info || !allowed(info)) return;
        const r = s.getBoundingClientRect();
        if (!r.width) return;
        const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
        const d = Math.abs(y - (r.top + r.height / 2)) + dx * 0.5;
        if (d < bd) { bd = d; best = s; }
      });
      return bd < 70 ? best : null;
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
      if (ghost) ghost.remove();
      if (target) target.classList.remove('is-target');
      if (srcEl) srcEl.classList.remove('is-lifted');
      root.classList.remove('is-dragging');
    };
    function move(ev) {
      if (ev.pointerId !== pid) return;
      if (!active) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        active = true;
        ghost = h('div', { class: 'drag-ghost cat-' + cat }, label);
        document.body.append(ghost);
        root.classList.add('is-dragging');
        if (srcEl) srcEl.classList.add('is-lifted');
        fx('lift');
      }
      if (ev.cancelable) ev.preventDefault();
      ghost.style.transform = 'translate(' + (ev.clientX + 10) + 'px,' + (ev.clientY + 8) + 'px)';
      const wsEl = root.querySelector('.ws');
      if (wsEl) {
        const wr = wsEl.getBoundingClientRect();
        if (ev.clientY < wr.top + 28) wsEl.scrollTop -= 14; else if (ev.clientY > wr.bottom - 28) wsEl.scrollTop += 14;
      }
      const t = pick(ev.clientX, ev.clientY);
      if (t !== target) { if (target) target.classList.remove('is-target'); target = t; if (target) target.classList.add('is-target'); }
    }
    function end(ev) {
      if (ev.pointerId !== pid) return;
      const info = active && target && ev.type === 'pointerup' ? slotInfo.get(target) : null;
      const was = active;
      cleanup();
      if (!was) return;
      swallow = true; setTimeout(() => { swallow = false; }, 60);
      if (info) dropBlock(src, info);
    }
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /* toolbox: a column of categories; the open one shows its blocks in a flyout beside it */
  const pal = h('div', { class: 'toolbox', role: 'group', 'aria-label': 'Block categories' });
  CATS.forEach((cat) => {
    const on = openCat === cat.id;
    pal.append(h('button', { type: 'button', class: 'tb-cat cat-' + cat.id + (on ? ' is-on' : ''), 'aria-pressed': String(on),
      onclick: () => { openCat = on ? '' : cat.id; render(root, prog, cfg, api); } }, h('i', { class: 'tb-dot' }), cat.label));
  });
  const fly = h('div', { class: 'flyout cat-' + (openCat || 'none'), hidden: !openCat });
  if (openCat) {
    Object.keys(SPEC).forEach((t) => {
      if (SPEC[t].cat !== openCat) return;
      const sp = SPEC[t], off = (sp.tool && !cfg.tools[sp.tool]) || (sp.mecanum && !BBZ.holo(cfg));
      fly.append(h('button', { type: 'button', class: 'pal-btn cat-' + openCat + (off ? ' is-off' : ''), title: off ? 'Your bot does not have the part this block needs' : 'Click to add, or drag into your program',
        onclick: () => add(t), onpointerdown: (e) => beginDrag(e, { type: t }, sp.title, openCat, null) }, sp.title));
    });
  }

  function fieldEl(b, p) {
    const f = b.f;
    if (p.t === 'num') {
      return h('input', { type: 'number', class: 'f-num', value: f[p.f], min: p.min, max: p.max, step: p.step, 'aria-label': 'number',
        onchange: (e) => { const v = parseFloat(e.target.value); f[p.f] = fixNum(isNaN(v) ? p.d : v, p); e.target.value = f[p.f]; api.changed(); } });
    }
    if (p.t === 'sel' || p.t === 'val') {
      const opts = p.t === 'val' ? VAL : p.opts;
      const s = h('select', { class: 'f-sel', 'aria-label': 'choice', onchange: (e) => { f[p.f] = e.target.value; api.changed(); } }, opts.map((o) => h('option', { value: o[0] }, o[1])));
      s.value = f[p.f]; return s;
    }
    if (p.t === 'dev') {
      const devs = BBZ.deviceList(cfg).filter((d) => d.kind === p.kind);
      const s = h('select', { class: 'f-sel', 'aria-label': p.kind, onchange: (e) => { f[p.f] = e.target.value; api.changed(); } },
        h('option', { value: '' }, 'choose…'), devs.map((d) => h('option', { value: d.role }, d.name)));
      s.value = devs.some((d) => d.role === f[p.f]) ? f[p.f] : ''; return s;
    }
    if (p.t === 'text') {
      return h('input', { type: 'text', class: 'f-text', value: f[p.f], maxlength: 30, 'aria-label': 'caption', oninput: (e) => { f[p.f] = e.target.value.slice(0, 30); api.changed(); } });
    }
    /* condition */
    const c = f[p.f], wrap = h('span', { class: 'f-cond' });
    const notSel = h('button', { type: 'button', class: 'f-not', 'aria-pressed': String(c.not), title: 'Flip this condition (not)', onclick: () => { c.not = !c.not; notSel.setAttribute('aria-pressed', String(c.not)); api.changed(); } }, 'not');
    const kind = h('select', { class: 'f-sel', 'aria-label': 'condition', onchange: (e) => { c.kind = e.target.value; redraw(); } }, COND.map((o) => h('option', { value: o[0] }, o[1])));
    kind.value = c.kind;
    wrap.append(notSel, kind);
    if (c.kind === 'btn') {
      const bs = h('select', { class: 'f-sel', 'aria-label': 'button', onchange: (e) => { c.btn = e.target.value; api.changed(); } }, BTN.map((o) => h('option', { value: o[0] }, o[1])));
      bs.value = c.btn; wrap.append(bs);
    } else {
      wrap.append(h('input', { type: 'number', class: 'f-num', value: c.n, min: 0, max: 999, step: 0.5, 'aria-label': 'number',
        onchange: (e) => { const v = parseFloat(e.target.value); c.n = isNaN(v) ? 0 : Math.min(999, Math.max(0, v)); e.target.value = c.n; api.changed(); } }));
    }
    return wrap;
  }

  function slot(list, idx) {
    const on = cursor.list === list && cursor.idx === idx;
    const gap = h('button', { type: 'button', class: 'slot' + (on ? ' is-on' : ''), 'aria-label': 'Put the next block here', onclick: () => { cursor = { list, idx }; render(root, prog, cfg, api); } },
      on ? 'next block goes here' : '');
    slotInfo.set(gap, { list, idx });
    return gap;
  }
  function listEl(list) {
    const box = h('div', { class: 'blk-list' });
    list.forEach((b, i) => { box.append(slot(list, i), blockEl(b, list, i)); });
    box.append(slot(list, list.length));
    return box;
  }
  function blockEl(b, list, i) {
    const sp = SPEC[b.type];
    const row = h('div', { class: 'blk-row' }, h('span', { class: 'blk-grip', title: 'Drag to move this block', 'aria-hidden': 'true' }, '⠿'));
    sp.parts.forEach((p) => row.append(typeof p === 'string' ? h('span', { class: 'blk-word', text: p }) : fieldEl(b, p)));
    const tools = h('span', { class: 'blk-tools' },
      h('button', { type: 'button', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { list.splice(i, 1); list.splice(i - 1, 0, b); cursor = null; redraw(); } }, '↑'),
      h('button', { type: 'button', title: 'Move down', 'aria-label': 'Move down', disabled: i === list.length - 1, onclick: () => { list.splice(i, 1); list.splice(i + 1, 0, b); cursor = null; redraw(); } }, '↓'),
      h('button', { type: 'button', title: 'Copy', 'aria-label': 'Copy block', onclick: () => { if (countBlocks(prog.blocks) + countBlocks([b]) > MAX_BLOCKS) { api.notify('Not enough room to copy that many blocks.'); return; } list.splice(i + 1, 0, clone(b)); redraw(); } }, '⧉'),
      h('button', { type: 'button', title: 'Delete', 'aria-label': 'Delete block', class: 'del', onclick: () => { list.splice(i, 1); cursor = null; redraw(); } }, '✕'));
    row.append(tools);
    const el = h('div', { class: 'blk cat-' + sp.cat, 'data-id': b.id }, row);
    row.addEventListener('pointerdown', (e) => {
      if (e.target.closest('input, select, button')) return;                  // typing and the arrow buttons still work
      if (e.pointerType === 'touch' && !e.target.closest('.blk-grip')) return; // on touch, drag by the grip so the page can still scroll
      e.preventDefault();
      beginDrag(e, { block: b, list }, sp.title, sp.cat, el);
    });
    if (sp.body) el.append(h('div', { class: 'blk-body' }, listEl(b.body)));
    if (sp.els) el.append(h('div', { class: 'blk-else', text: 'else' }), h('div', { class: 'blk-body' }, listEl(b.els)));
    return el;
  }

  const ws = h('div', { class: 'ws' }, h('div', { class: 'ws-hat', text: 'when START is pressed' }), listEl(prog.blocks));
  root.append(h('div', { class: 'bk' }, pal, fly, ws));
  if (!root.bbzDragWired) {                  /* once per workspace: ignore the click that ends a drag */
    root.bbzDragWired = true;
    root.addEventListener('click', (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  if (snapId) {                              /* the block that just connected pops into place with a click */
    const done = root.querySelector('[data-id="' + snapId + '"]');
    snapId = null;
    if (done) {
      done.classList.add('snap');
      try { done.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
      fx('snap');
    }
  }
}

/* ---------- example programs ---------- */
/* How long to hold a power to cover a distance or an angle. */
const timing = (function () {
  const TAU = 0.1, BRAKE = 0.06;
  const solve = (amount, rate, chained) => {
    if (chained) return amount / rate;
    const travelled = (t) => { const k = 1 - Math.exp(-t / TAU); return rate * (t - TAU * k) + rate * k * BRAKE; };
    let lo = 0, hi = 30;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (travelled(mid) < amount) lo = mid; else hi = mid; }
    return hi;
  };
  const ms = (s) => Math.max(20, Math.round(s * 100) * 10);
  return {
    drive: (cfg, inches, p, chained) => ms(solve(Math.abs(inches), BBZ.topSpeed(cfg) * p, chained)),
    strafe: (cfg, inches, p, chained) => ms(solve(Math.abs(inches), BBZ.topSpeed(cfg) * p * BBZ.DRIVES[cfg.drive].ks / BBZ.DRIVES[cfg.drive].kf, chained)),
    turn: (cfg, deg, p, chained) => ms(solve(Math.abs(deg) * Math.PI / 180, BBZ.topSpeed(cfg) * p / BBZ.turnK(cfg), chained))
  };
})();

/* Facts about the current bot that every example needs: which mechanisms it has and the numbers that fit it. */
function botFacts(cfg) {
  const n = cfg.names, T = cfg.tools, kit = cfg.kit, hl = cfg.length / 2;
  const shooter = T.launcher ? kit.launcher : null, face = cfg.layout.launcher.face;
  const reach = shooter ? BBZ.shooterReach(cfg) : 0;
  const wheels = shooter === 'dual' ? [n.launcher, n.launcher2] : shooter === 'flywheel' ? [n.launcher] : [];
  /* Every autonomous starts by driving to the line in front of its HIVE. */
  const startY = cfg.start === 'hive' ? hl + 0.05 : 36;
  /* A catapult cannot change its range, so the robot itself moves until the CELL is exactly one throw away. */
  let shift = 0;
  if (shooter === 'catapult') {
    shift = Math.round((Math.max(62.6 - BBZ.CATAPULT_RANGE - reach, hl + 0.05) - startY) * 2) / 2;
    if (Math.abs(shift) < 1.5) shift = 0;
  }
  const shootY = startY + shift, hiveShot = 62.6 - shootY - reach;
  const half = (v) => Math.round(v * 2) / 2;
  /* The list of moves for "tip the HIVE, then park". */
  const route = (slides) => {
    const s = [], toHive = half(59.5 - hl - 0.05);
    if (cfg.start === 'garden') s.push(['D', toHive], ['T', 90]);
    else if (cfg.start === 'zone') {
      /* a FLOWER stands on the wall here, so the route leaves the wall first */
      if (slides) s.push(['D', 9], ['S', -48], ['D', toHive - 9], ['T', 90]);
      else s.push(['D', 9], ['T', -90], ['D', 48], ['T', 90], ['D', toHive - 9], ['T', 90]);
    }
    let y = startY;
    if (shooter) { if (shift) { s.push(['D', shift]); y = shootY; } s.push(['SHOOT']); }
    const last = half(13.5 - hl);                                  /* stops about 6 inches short of the wall, inside the LOADING ZONE */
    if (slides) s.push(['S', 40], ['D', half(108.5 - y)], ['S', last]);
    else {
      const pre = Math.max(0, Math.round(hl + 8 - y));           /* get clear of the wall before turning */
      if (pre) s.push(['D', pre]);
      s.push(['T', 90], ['D', 40], ['T', -90], ['D', half(108.5 - y - pre)], ['T', 90], ['D', last]);
    }
    return s;
  };
  return {
    n, T, kit, shooter, face, reach, hiveShot, wheels, route, start: cfg.start,
    four: BBZ.holo(cfg), claw: T.intake && kit.intake === 'claw', roller: T.intake && kit.intake !== 'claw',
    hivePower: +BBZ.shotPower(hiveShot).toFixed(2),
    hiveTag: cfg.alliance === 'red' ? 1 : 4,
    startName: BBZ.START_SPOTS[cfg.start].label,
    atHive: cfg.start === 'hive',
    spin: (p) => wheels.map((w) => w + '.setPower(' + p + ');')
  };
}
function need(cfg, tools, extra) {
  const miss = tools.filter((t) => !cfg.tools[t]).map((t) => BBZ.TOOLS[t].label);
  (extra || []).forEach((x) => { if (x) miss.push(x); });
  return miss.length ? 'Cần có ' + miss.join(' và ') : null;
}

function javaSample(mode, cfg) {
  const f = botFacts(cfg), n = f.n, T = f.T, body = [], use = [], constLines = [];
  if (mode === 'teleop') {
    use.push('setDrive');
    body.push('// Lặp đến hết trận đấu (người điều khiển nhấn STOP)', 'while (opModeIsActive()) {');
    body.push('    // Cần trái dùng để di chuyển' + (f.four ? ' và trượt ngang' : '') + ', cần phải dùng để xoay.');
    body.push('    // Đẩy cần lên sẽ tạo giá trị y ÂM nên cần đảo dấu.');
    body.push('    setDrive(-gamepad1.left_stick_y, gamepad1.left_stick_x, gamepad1.right_stick_x);', '');
    if (f.roller) body.push(
      '    // Cơ cấu hút: nút vai phải hút vật phẩm vào, nút vai trái đẩy vật phẩm ra.',
      '    if (gamepad1.right_bumper) {', '        ' + n.intake + '.setPower(1.0);',
      '    } else if (gamepad1.left_bumper) {', '        ' + n.intake + '.setPower(-1.0);',
      '    } else {', '        ' + n.intake + '.setPower(0);', '    }', '');
    if (f.claw) body.push(
      '    // Càng gắp: giữ nút vai phải để kẹp vật phẩm, thả nút để mở càng.',
      '    ' + n.claw + '.setPosition(gamepad1.right_bumper ? 1.0 : 0.0);', '');
    if (f.wheels.length) {
      constLines.push('static final double LAUNCH_POWER = 0.75;       // thử giá trị khác: bánh quay nhanh hơn thì bắn xa hơn');
      body.push('    // Bộ phóng: giữ cò phải để quay bánh đà, nhấn A để nạp một vật phẩm.');
      f.wheels.forEach((w) => body.push('    ' + w + '.setPower(gamepad1.right_trigger * LAUNCH_POWER);'));
      body.push('    ' + n.feeder + '.setPosition(gamepad1.a ? 1.0 : 0.0);', '');
    }
    if (f.shooter === 'catapult') body.push(
      '    // Máy bắn: nhấn A để bắn. Thả nút để tay đòn hạ xuống, sẵn sàng cho lần tiếp theo.',
      '    ' + n.catapult + '.setPosition(gamepad1.a ? 1.0 : 0.0);', '');
    if (T.lift) body.push(
      '    // Bộ nâng: dùng D-pad lên/xuống. Nhấn X để mở cổng thả vật phẩm.',
      '    if (gamepad1.dpad_up) {', '        ' + n.lift + '.setPower(0.9);',
      '    } else if (gamepad1.dpad_down) {', '        ' + n.lift + '.setPower(-0.9);',
      '    } else {', '        ' + n.lift + '.setPower(0);', '    }',
      '    ' + n.gate + '.setPosition(gamepad1.x ? 1.0 : 0.0);', '');
    if (T.imu) body.push('    telemetry.addData("Hướng", "%.1f độ", ' + n.imu + '.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES));');
    if (T.distance) body.push('    telemetry.addData("Khoảng cách", "%.1f inch", ' + n.distance + '.getDistance(DistanceUnit.INCH));');
    body.push('    telemetry.addData("Trạng thái", "Đang chạy");', '    telemetry.update();', '}');
    return scaffold({ cfg, mode, title: 'Điều khiển thủ công đầy đủ', cls: 'FullTeleOp', body, use, constLines,
      intro: ['Điều khiển thủ công đầy đủ: dùng tay cầm để lái và vận hành mọi cơ cấu trên robot.'] });
  }
  /* Quarter turns that point the shooter's side at the HIVE (dir 1) and back again (dir -1). */
  const aim = (dir) => (f.face === 2 ? [90, 90] : [f.face === 1 ? -90 : 90]).map((d) => 'turnLeft(' + d * dir + ', 0.4);');
  const steps = f.route(false), shootAt = steps.findIndex((s) => s[0] === 'SHOOT');
  const move = (s) => s[0] === 'D' ? 'driveInches(' + s[1] + ', ' + (Math.abs(s[1]) >= 30 ? '0.7' : '0.5') + ');' : 'turnLeft(' + s[1] + ', 0.5);';
  use.push('driveInches', 'turnLeft');
  let step = 1;
  if (shootAt > 0) {
    body.push('// ' + (step++) + '. Chạy đến vạch trước TỔ và hướng về phía đó.');
    steps.slice(0, shootAt).forEach((s) => body.push(move(s)));
    body.push('');
  }
  if (f.shooter) {
    use.push('launchOne');
    if (f.face) { body.push('// Bộ phóng hướng về phía ' + BBZ.FACE_NAME[f.face] + ', hãy xoay mặt đó về phía TỔ.'); aim(1).forEach((s) => body.push(s)); }
    if (f.shooter === 'catapult') body.push('// ' + (step++) + '. Máy bắn luôn phóng cùng một khoảng cách. Từ đây vật phẩm sẽ rơi vào Ô phía trên.');
    else {
      constLines.push('static final double LAUNCH_POWER = ' + f.hivePower.toFixed(2) + ';       // điều chỉnh theo khoảng cách từ đây đến TỔ');
      body.push('// ' + (step++) + '. Khởi động bộ phóng và bắn 3 POLLEN vào Ô phía trên.');
      f.spin('LAUNCH_POWER').forEach((s) => body.push(s));
      body.push('sleep(1500);');
    }
    body.push('//    Ô đó có sẵn 3 NECTAR, nên thêm 3 POLLEN sẽ làm nghiêng TỔ (20 điểm).',
      'for (int i = 0; i < 3 && opModeIsActive(); i++) {', '    launchOne();', '}');
    f.spin('0').forEach((s) => body.push(s));
    if (f.face) aim(-1).forEach((s) => body.push(s));
    body.push('');
  }
  body.push('// ' + step + '. RỜI TƯỜNG (3 điểm), sau đó chạy đến KHU NẠP và ĐỖ (5 điểm).');
  steps.slice(shootAt + 1).forEach((s) => body.push(move(s)));
  return scaffold({ cfg, mode, title: 'Nghiêng tổ và đỗ tự động', cls: 'TipAndParkAuto', body, use, constLines,
    intro: ['Chương trình tự động nghiêng tổ và đỗ. Được viết cho vị trí xuất phát "' + f.startName + '".'] });
}

BBZ.Blocks = { SPEC, render, generate, sanitize, makeBlock, countBlocks, className, resetCursor: () => { cursor = null; } };
/* The example library: every entry has a name, a one-line description and a maker for the current bot. */
function exampleList(cfg) {
  const f = botFacts(cfg), n = f.n;
  const J = (o) => () => scaffold(Object.assign({ cfg, intro: [o.title + ': ' + o.about] }, o));
  const dm = BBZ.driveRoles(cfg).map((r) => n[r]);
  const loop = (lines) => ['// run until the end of the match (driver presses STOP)', 'while (opModeIsActive()) {'].concat(lines.map((s) => s === '' ? '' : '    ' + s), ['}']);
  const mix = f.four
    ? [n.fl + '.setPower(y + x + turn);', n.fr + '.setPower(y - x - turn);', n.bl + '.setPower(y - x + turn);', n.br + '.setPower(y + x - turn);']
    : [n.left + '.setPower(y + turn);', n.right + '.setPower(y - turn);'];
  /* Some examples drive forward toward what a sensor sees, so they only make sense when it looks out of the front. */
  const frontOnly = (part, label) => (cfg.tools[part] && cfg.layout[part].face) ? label + ' hướng ra phía trước' : null;
  const tagRange = 34, camReach = cfg.tools.camera ? BBZ.partPos(cfg, 'camera').x : 0;
  const tagShot = tagRange + 10.1 + camReach - f.reach;                      // from the shooter to the middle of the CELL
  const cataRange = Math.round(BBZ.CATAPULT_RANGE - 10.1 - camReach + f.reach) - 4;      // a little close, so the wall behind is never in the way
  return [
    { id: 'java-drive', name: 'Điều khiển cơ bản', lang: 'java', mode: 'teleop', why: null,
      desc: 'Chương trình điều khiển thủ công đơn giản nhất: dùng cần analog để lái robot. Hãy bắt đầu từ đây.',
      make: J({ mode: 'teleop', title: 'Điều khiển cơ bản', cls: 'DriveOnlyTeleOp', about: 'dùng cần analog để lái robot.', body: loop([
        '// Đẩy cần lên sẽ tạo giá trị y ÂM nên cần đảo dấu.',
        'double y = -gamepad1.left_stick_y;'].concat(f.four ? ['double x = gamepad1.left_stick_x;'] : [], [
        'double turn = gamepad1.right_stick_x;', ''], mix, ['',
        'telemetry.addData("Status", "Running");',
        'telemetry.update();'])) }) },
    { id: 'java-full', name: 'Điều khiển đầy đủ', lang: 'java', mode: 'teleop', why: null,
      desc: 'Lái robot và vận hành mọi cơ cấu. Chương trình tự điều chỉnh theo các bộ phận bạn đã chọn trong mục Lắp robot.',
      make: () => javaSample('teleop', cfg) },
    { id: 'java-two', name: 'Điều khiển hai tay cầm', lang: 'java', mode: 'teleop', why: (f.T.intake || f.T.launcher || f.T.lift) ? null : 'Cần ít nhất một cơ cấu ghi điểm',
      desc: 'Dùng hai tay cầm: gamepad1 lái robot, gamepad2 điều khiển các cơ cấu. Nếu chỉ có một tay cầm, hãy chuyển tay cầm trên màn hình sang gamepad2.',
      make: () => javaSample('teleop', cfg).split('\n').map((line) => line.indexOf('setDrive(') >= 0 ? line : line.replace(/gamepad1\./g, 'gamepad2.')).join('\n')
        .replace('Điều khiển thủ công đầy đủ: dùng tay cầm để lái và vận hành mọi cơ cấu trên robot.', 'Điều khiển hai tay cầm: gamepad1 lái robot, gamepad2 vận hành mọi cơ cấu.')
        .replace('"Điều khiển thủ công đầy đủ"', '"Điều khiển hai tay cầm"').replace('class FullTeleOp', 'class TwoDriverTeleOp')
        .replace('// Cần trái dùng để di chuyển', '// Người lái (gamepad1): dùng cần trái để di chuyển') },
    { id: 'java-slow', name: 'Điều khiển tốc độ chậm', lang: 'java', mode: 'teleop', why: null,
      desc: 'Giữ cò trái để chạy ở một phần ba tốc độ, giúp căn chỉnh chính xác.',
      make: J({ mode: 'teleop', title: 'Điều khiển tốc độ chậm', cls: 'SlowModeTeleOp', about: 'giữ cò trái để lái chậm và chính xác.', use: ['setDrive'], body: loop([
        '// Toán tử ? : chọn một trong hai giá trị: chạy chậm khi giữ cò, nếu không thì chạy hết tốc độ.',
        'double speed = gamepad1.left_trigger > 0.5 ? 0.35 : 1.0;',
        'setDrive(-gamepad1.left_stick_y * speed, gamepad1.left_stick_x * speed, gamepad1.right_stick_x * speed);',
        'telemetry.addData("Speed", speed == 1.0 ? "FULL" : "SLOW");',
        'telemetry.update();']) }) },
    { id: 'java-field', name: 'Lái theo hướng sân', lang: 'java', mode: 'teleop', why: need(cfg, ['imu'], [f.four ? null : 'hệ truyền động có thể trượt ngang']),
      desc: 'Đẩy cần lên luôn khiến robot chạy ra xa bạn, bất kể robot đang quay hướng nào. Nhấn Y để đặt lại hướng.',
      make: J({ mode: 'teleop', title: 'Lái theo hướng sân', cls: 'FieldCentricTeleOp', about: 'hướng cần điều khiển bám theo sân, không theo hướng robot.', use: ['setDrive'], body: loop([
        'double stickForward = -gamepad1.left_stick_y;',
        'double stickRight = gamepad1.left_stick_x;',
        '// Robot đã xoay bao nhiêu độ kể từ khi bắt đầu?',
        'double heading = ' + n.imu + '.getRobotYawPitchRollAngles().getYaw(AngleUnit.RADIANS);',
        '',
        '// Xoay hướng cần theo góc đó để "lên" luôn chỉ cùng một hướng trên sân.',
        'double forward = stickForward * Math.cos(heading) - stickRight * Math.sin(heading);',
        'double strafe = stickRight * Math.cos(heading) + stickForward * Math.sin(heading);',
        'setDrive(forward, strafe, gamepad1.right_stick_x);',
        '',
        '// Nhấn Y để lấy hướng robot hiện tại làm hướng "tiến" mới.',
        'if (gamepad1.y) {',
        '    ' + n.imu + '.resetYaw();',
        '}',
        'telemetry.addData("Heading", "%.0f deg", Math.toDegrees(heading));',
        'telemetry.update();']) }) },
    { id: 'java-motortest', name: 'Kiểm tra động cơ', lang: 'java', mode: 'teleop', why: null,
      desc: 'Lần lượt quay mỗi động cơ truyền động trong một giây và hiển thị bộ mã hóa. Dùng để kiểm tra dây nối và tên thiết bị.',
      make: J({ mode: 'teleop', title: 'Kiểm tra động cơ', cls: 'MotorTest', about: 'lần lượt quay từng động cơ để kiểm tra dây nối và chiều quay.',
        body: dm.map((m) => 'testMotor(' + m + ', ' + str(m) + ');'),
        extra: [
          '// Chạy một động cơ theo chiều tiến trong một giây và hiển thị số đếm bộ mã hóa.',
          'void testMotor(DcMotor motor, String label) {',
          '    motor.setPower(0.5);',
          '    for (int i = 0; i < 20 && opModeIsActive(); i++) {',
          '        telemetry.addData("Testing", label);',
          '        telemetry.addData("Encoder", motor.getCurrentPosition());',
          '        telemetry.update();',
          '        sleep(50);',
          '    }',
          '    motor.setPower(0);',
          '    sleep(300);',
          '}'] }) },
    { id: 'java-tune', name: 'Căn chỉnh bộ phóng', lang: 'java', mode: 'teleop', why: f.wheels.length ? null : 'Cần có bộ phóng bánh đà',
      desc: 'D-pad lên/xuống điều chỉnh công suất bánh đà từng bước nhỏ, nhấn A để bắn. Dùng để tìm công suất phù hợp với từng khoảng cách.',
      make: J({ mode: 'teleop', title: 'Căn chỉnh bộ phóng', cls: 'ShooterTuningTeleOp', about: 'tìm công suất bộ phóng phù hợp với mục tiêu.', use: ['setDrive'], body: [
        'double power = 0.60;',
        'boolean wasUp = false;',
        'boolean wasDown = false;',
        ''].concat(loop([
        'setDrive(-gamepad1.left_stick_y, gamepad1.left_stick_x, gamepad1.right_stick_x);',
        '',
        '// Mỗi lần nhấn chỉ thay đổi công suất một lần, không lặp liên tục.',
        'if (gamepad1.dpad_up && !wasUp) {',
        '    power = Math.min(1.0, power + 0.05);',
        '}',
        'if (gamepad1.dpad_down && !wasDown) {',
        '    power = Math.max(0.0, power - 0.05);',
        '}',
        'wasUp = gamepad1.dpad_up;',
        'wasDown = gamepad1.dpad_down;',
        ''].concat(f.spin('power'), [
        n.feeder + '.setPosition(gamepad1.a ? 1.0 : 0.0);',
        'telemetry.addData("Launcher power", "%.2f", power);',
        'telemetry.update();']))) }) },
    { id: 'java-tags', name: 'Đọc AprilTag', lang: 'java', mode: 'teleop', why: need(cfg, ['camera']),
      desc: 'Lái robot và xem webcam báo mọi AprilTag nhìn thấy: mã ID, khoảng cách, góc phương vị và góc lệch.',
      make: J({ mode: 'teleop', title: 'Đọc AprilTag', cls: 'AprilTagReader', about: 'hiển thị mọi AprilTag webcam nhìn thấy.', use: ['setDrive'], body: loop([
        'setDrive(-gamepad1.left_stick_y, gamepad1.left_stick_x, gamepad1.right_stick_x);',
        '',
        'telemetry.addData("Tags in view", aprilTag.getDetections().size());',
        'for (AprilTagDetection detection : aprilTag.getDetections()) {',
        '    telemetry.addLine("Tag " + detection.id + ": " + detection.metadata.name);',
        '    telemetry.addData("  range", "%.1f in", detection.ftcPose.range);',
        '    telemetry.addData("  bearing", "%.1f deg", detection.ftcPose.bearing);',
        '    telemetry.addData("  yaw", "%.1f deg", detection.ftcPose.yaw);',
        '}',
        'telemetry.update();']) }) },
    { id: 'java-leave', name: 'Rời vạch tự động', lang: 'java', mode: 'auto', why: null,
      desc: 'Chương trình tự động hữu ích ngắn nhất: chạy khỏi tường để ghi 3 điểm RỜI VẠCH.',
      make: J({ mode: 'auto', title: 'Rời vạch tự động', cls: 'LeaveOnlyAuto', about: 'chạy khỏi tường để ghi điểm RỜI VẠCH.', use: ['setDrive'], body: [
        '// RỜI VẠCH được 3 điểm: robot chỉ cần không còn chạm vào tường.',
        'setDrive(0.4, 0, 0);',
        'sleep(600);',
        'setDrive(0, 0, 0);'] }) },
    { id: 'java-tip', name: 'Nghiêng tổ và đỗ tự động', lang: 'java', mode: 'auto', why: null,
      desc: (f.shooter ? 'Bắn 3 POLLEN để làm nghiêng TỔ, rời tường rồi đỗ.' : 'Rời tường và đỗ trong KHU NẠP.') + ' Dành cho vị trí xuất phát "' + f.startName + '".',
      make: () => javaSample('auto', cfg) },
    { id: 'java-square', name: 'Chạy theo hình vuông', lang: 'java', mode: 'auto', why: null,
      desc: 'Chạy thành hình vuông cạnh 20 inch rồi trở về vị trí đầu. Dùng để căn chỉnh quãng đường và góc xoay.',
      make: J({ mode: 'auto', title: 'Chạy theo hình vuông', cls: 'SquarePathAuto', about: 'chạy theo hình vuông để luyện căn chỉnh quãng đường và góc xoay.', use: ['driveInches', 'turnLeft'], body: [
        '// Bốn cạnh, bốn lần xoay trái. Nếu robot không về đúng chỗ cũ, hãy điều chỉnh các giá trị.',
        'for (int side = 0; side < 4 && opModeIsActive(); side++) {',
        '    driveInches(20, 0.6);',
        '    turnLeft(90, 0.5);',
        '}'] }) },
    { id: 'java-distance', name: 'Dừng theo khoảng cách', lang: 'java', mode: 'auto', why: need(cfg, ['distance'], [frontOnly('distance', 'cảm biến khoảng cách')]),
      desc: 'Chạy chậm về phía trước đến khi cảm biến khoảng cách báo dưới 12 inch thì dừng.',
      make: J({ mode: 'auto', title: 'Dừng theo khoảng cách', cls: 'DistanceStopAuto', about: 'dùng cảm biến khoảng cách để dừng trước vật cản.', use: ['setDrive'], body: [
        '// Chạy chậm đến khi có vật cách dưới 12 inch thì dừng.',
        'setDrive(0.4, 0, 0);',
        'while (opModeIsActive() && ' + n.distance + '.getDistance(DistanceUnit.INCH) > 12) {',
        '    telemetry.addData("Distance", "%.1f in", ' + n.distance + '.getDistance(DistanceUnit.INCH));',
        '    telemetry.update();',
        '}',
        'setDrive(0, 0, 0);'] }) },
    { id: 'java-lift', name: 'Nâng và thả', lang: 'java', mode: 'auto', why: need(cfg, ['lift']),
      desc: 'Dùng RUN_TO_POSITION để nâng lên độ cao FLOWER, thả một vật phẩm rồi hạ xuống.',
      make: J({ mode: 'auto', title: 'Nâng và thả', cls: 'LiftAndDropAuto', about: 'nâng đến đúng độ cao, thả vật phẩm rồi hạ xuống.', use: ['liftTo', 'dropOne'], body: [
        '// Đỉnh FLOWER cao 21,5 inch, vì vậy nâng 22 inch sẽ vượt qua.',
        'liftTo(22, true);',
        'dropOne();',
        'liftTo(0, true);'] }) },
    { id: 'java-tagaim', name: 'Căn hướng bằng AprilTag', lang: 'java', mode: 'auto', why: need(cfg, ['camera'], [frontOnly('camera', 'webcam'), f.atHive ? null : 'vị trí xuất phát hướng về TỔ']),
      desc: 'Dùng webcam để xoay cho đến khi AprilTag của TỔ ở ngay phía trước, sau đó ' + (f.shooter && !f.face ? 'chạy đến khoảng cách bắn rồi khai hỏa.' : 'chạy đến khoảng cách đã định.'),
      make: J({ mode: 'auto', title: 'Căn hướng bằng AprilTag', cls: 'AprilTagAimAuto', about: 'dùng webcam để căn thẳng robot theo AprilTag.', use: ['setDrive', 'findTag'].concat(f.shooter ? ['launchOne'] : []),
        constLines: ['static final int HIVE_TAG = ' + f.hiveTag + ';            // the tag on your side of your HIVE',
          'static final double TARGET_RANGE = ' + (f.shooter === 'catapult' ? cataRange : tagRange) + ';     // how many inches from the tag to stop'],
        body: [
          '// Keep correcting until the tag is straight ahead and at the right distance (or 10 seconds pass).',
          'while (opModeIsActive() && runtime.seconds() < 10) {',
          '    AprilTagDetection tag = findTag(HIVE_TAG);',
          '    if (tag == null) {',
          '        setDrive(0, 0, 0.25);          // not in view: turn slowly to look for it',
          '    } else if (Math.abs(tag.ftcPose.bearing) < 1.5 && Math.abs(tag.ftcPose.range - TARGET_RANGE) < 1.0) {',
          '        break;                         // lined up',
          '    } else {',
          '        // bearing is + when the tag is to the left, and a left turn is a negative turn value.',
          '        double turn = Range.clip(-tag.ftcPose.bearing * 0.03, -0.3, 0.3);',
          '        double forward = Range.clip((tag.ftcPose.range - TARGET_RANGE) * 0.05, -0.4, 0.4);',
          '        setDrive(forward, 0, turn);',
          '        telemetry.addData("Range", "%.1f in", tag.ftcPose.range);',
          '        telemetry.addData("Bearing", "%.1f deg", tag.ftcPose.bearing);',
          '        telemetry.update();',
          '    }',
          '}',
          'setDrive(0, 0, 0);'].concat(f.shooter && !f.face ? [''].concat(
            f.shooter === 'catapult' ? [] : ['// Spin up, then shoot 3 POLLEN.'].concat(f.spin(BBZ.shotPower(tagShot).toFixed(2)), ['sleep(1500);']),
            ['for (int i = 0; i < 3 && opModeIsActive(); i++) {', '    launchOne();', '}'], f.spin('0')) : []) }) }
  ];
}

BBZ.Samples = { java: javaSample, list: exampleList, facts: botFacts, timing, need };
})();
