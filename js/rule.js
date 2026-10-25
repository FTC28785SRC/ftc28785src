/* =====================================================================
   BIOBUZZ Alliance Match Planner — rules.js
   ---------------------------------------------------------------------
   Every constant in this file is traceable to one of two places:

   [MANUAL]  FIRST Tech Challenge 2026-2027 Competition Manual, BIOBUZZ
             presented by RTX, Version 1 (published 2026-09-12),
             Section 10 "Game Details", Table 10-2 and Table 10-3.
   [VIDEO]   The two official FIRST Tech Challenge reveal videos,
             "BIOBUZZ presented by RTX Game Animation" and
             "BIOBUZZ presented by RTX Field Walkthrough".
   [ESTIMATE] A planning approximation built by this tool, clearly
             labelled as such wherever it reaches the screen.

   Nothing here is invented. If a number is not in one of the two
   official sources it is either absent from this tool or marked
   [ESTIMATE] on the page itself.

   This is an unofficial, fan-made tool. Not affiliated with, endorsed
   by, or reviewed by FIRST.
   ===================================================================== */
(function (root) {
  'use strict';

  /* ---------- Table 10-2 : match point values [MANUAL] ---------- */
  var POINTS = {
    LEAVE: 3,             // AUTO only — no TELEOP equivalent in Table 10-2
    PARK_AUTO: 5,         // robot at least partially in the LOADING ZONE
    PARK_TELEOP: 5,       // separate achievement, evaluated at match end
    HIVE_TIP_AUTO: 20,
    HIVE_TIP_TELEOP: 20,
    CELL_REMAINING: 2,    // per element left in an upward CELL at match end
    FLOWER_BOTTOM_BONUS: 5,
    FLOWER_OWNED_ELEMENT: 2,
    GARDEN_ELEMENT: 1
  };

  /* ---------- Table 10-2 / 10-3 : Ranking Points [MANUAL] --------
     "All Other Events" tier. Regional / Championship thresholds are
     listed as TBA in the source, so they are deliberately absent. */
  var RP = {
    WIN: 3,
    TIE: 1,
    SWARM: { rp: 1, threshold: 16, label: 'SWARM' },          // alliance-wide LEAVE + PARK points
    POLLINATOR_1: { rp: 1, threshold: 4, label: 'POLLINATOR 1' }, // alliance-wide TIPS
    POLLINATOR_2: { rp: 1, threshold: 7, label: 'POLLINATOR 2' }  // alliance-wide TIPS
  };

  /* ---------- Fouls [MANUAL] ---------- */
  var FOULS = { MINOR: 5, MAJOR: 20 }; // points credited to the OPPONENT

  /* ---------- Match structure [MANUAL] ---------- */
  var MATCH = {
    autoSeconds: 30,
    transitionSeconds: 8,
    teleopSeconds: 120,
    flowerLegalLastSeconds: 60   // G410
  };

  /* ---------- HIVE tipping model [ESTIMATE] ---------------------
     The manual states the exact tipping point depends on physical
     placement and landing, and gives no formula. The reveal video
     gives three illustrative examples:
        ~8 POLLEN               -> a TIP
         5 NECTAR               -> a TIP
         3 POLLEN + 3 NECTAR    -> a TIP
     Weights of 5 (POLLEN) and 8 (NECTAR) against a threshold of 40
     reproduce 8x5=40 and 5x8=40 exactly. The mixed example lands at
     3x5 + 3x8 = 39, i.e. one unit short — close to, but not identical
     to, the video's third example. That gap is stated on the page
     rather than papered over.                                      */
  var HIVE = {
    threshold: 40,
    units: { pollen: 5, nectar: 8 },
    estimate: true,
    note: 'Ngưỡng làm HIVE nghiêng là ước tính dựa trên các ví dụ trong video giới thiệu chính thức. Sổ tay cho biết vị trí thực tế ảnh hưởng đến kết quả, vì vậy hãy xem đây là ước lượng để lập kế hoạch, không phải công thức chính thức.',
    mixedExampleNote: 'Ví dụ kết hợp trong video (3 POLLEN + 3 NECTAR) đạt 39/40 đơn vị trong mô hình này, thiếu 1 đơn vị để làm tổ nghiêng. Mô hình khớp chính xác hai ví dụ dùng một loại bóng; trường hợp kết hợp chỉ là ước tính.'
  };

  /* ---------- Field / resource setup [VIDEO + MANUAL] ------------
     Where the 40 POLLEN and 16 NECTAR sit at match start. These DO
     drive the held-inventory model below. */
  var SETUP = {
    fieldFeet: 12,
    pollenTotal: 40,
    pollenPerFlower: 4,
    pollenPerGarden: 4,
    pollenPreloadedPerRobot: 4,
    robotsOnField: 4,
    nectarTotal: 16,
    nectarInUpCellPerAlliance: 3,
    nectarReservePerAlliance: 5,
    pollenDiameterInches: 2.8,   // approximate, per the reveal video
    nectarDiameterInches: 3.6,   // approximate, per the reveal video
    flowers: 4,
    hives: 2,
    gardens: 2
  };

  /* ---------- What a robot is holding [MANUAL + one stated choice] ----
     40 POLLEN break down as 4 pre-loaded on each of the 4 ROBOTS (16),
     4 in each of the 4 FLOWERS (16) and 4 in each GARDEN (8). So at the
     first instant of AUTO a robot is holding POLLEN and nothing else:
     POLLEN is the only element it can legally launch. */
  var INVENTORY = {
    pollenPreloadedPerRobot: 4,    // [MANUAL] "ROBOTS must start the MATCH contacting 4 pre-loaded POLLEN"
    nectarPreloadedPerRobot: 0,    // [MANUAL] no NECTAR starts on a ROBOT
    holdCap: 4, // G407
    note: 'G407 giới hạn mỗi robot kiểm soát tối đa bốn bóng ghi điểm.',
    groundPollenNote: 'Các bóng trên sàn có số lượng hữu hạn; hệ thống theo dõi từng bóng, vị trí và trạng thái có thể thu thập.'

  };

  /* ---------- How NECTAR reaches a ROBOT [MANUAL + one estimate] ------
     16 NECTAR, 8 per alliance: 3 already inside your upward CELL at
     match start (part of the HIVE's starting fill, not robot cargo) and
     5 held off-field by your HUMAN PLAYER. The reserve is released
     progressively:
        - exactly ONE per HIVE TIP by your alliance, and
        - ALL remaining at the 60-seconds-remaining mark.
     No TIP can happen before something has been launched, so at the
     first instant of AUTO the number of NECTAR a robot can obtain is
     ZERO. That is the constraint this planner now models.               */
  var NECTAR_FLOW = {
    releasedPerTip: 1,                   // [MANUAL]
    releaseAllAtSecondsRemaining: 60,    // [MANUAL]
    reservePerAlliance: 5,               // [MANUAL] same value as SETUP.nectarReservePerAlliance
    /* [ESTIMATE] A TIP dumps the upward CELL onto the floor, so NECTAR
       that a robot LAUNCHED into that CELL is loose again and can be
       collected. This planner returns it to the collectable pool. */
    spillIsCollectable: true,
     /* The 3 NECTAR staged in your upward CELL are released onto the FIELD
       when that CELL tips. They remain excluded from the estimated fill
       meter, but become collectable after the physical tip. */
    stagedCellNectarSpillsOnFirstTip: true,
    estimate: true,
    note: 'Sổ tay quy định phát 1 NECTAR sau mỗi lần TỔ NGHIÊNG và phát toàn bộ số còn lại khi trận còn 60 giây. Việc NECTAR được bắn vào Ô trở thành bóng có thể nhặt trên sàn sau khi Ô nghiêng là cách diễn giải của công cụ về quy tắc "Ô đổ bóng ra sân", không phải trích dẫn nguyên văn. 3 NECTAR đặt sẵn trong Ô hướng lên cũng có thể nhặt sau lần nghiêng đó.'
  };

  /* ---------- Rule codes that actually exist [MANUAL] ------------
     No other rule code may appear anywhere in this tool. */
  var RULES = {
    G410: {
      code: 'G410',
      short: 'Không được đưa NECTAR vào FLOWER trước khi trận đấu còn 60 giây.',
      penalty: 'LỖI NẶNG cho mỗi NECTAR'
    },
    G417: {
      code: 'G417',
      short: 'Robot không được can thiệp vào kết cấu HIVE; chỉ bắn vào Ô hướng lên mới được làm tổ nghiêng.',
      penalty: null
    },
    G418: {
      code: 'G418',
      short: 'Robot không được can thiệp vào FLOWER; chỉ được đưa POLLEN/NECTAR vào từ phía trên và chỉ được lấy POLLEN ra từ phía dưới. Không được lấy NECTAR ra sau khi đã đặt vào.',
      penalty: null
    }
  };

  /* ---------- Zones of the planner ---------- */
  var ZONES = [
    {
      key: 'auto',
      name: 'TỰ ĐỘNG',
      clock: '0:00 – 0:30',
      phase: 'auto',
      blurb: '30 giây: lặp chu kỳ thu thập và bắn hợp lệ, sau đó đỗ trước khi hết TỰ ĐỘNG.'
    },
    {
      key: 'teleopEarly',
      name: 'ĐIỀU KHIỂN · 60 giây đầu',
      clock: 'ĐIỀU KHIỂN còn 2:00 – 1:00',
      phase: 'teleop',
      blurb: 'Chuỗi ĐIỀU KHIỂN chạy liên tục. Hành động có thể vượt qua mốc một phút; chỉ đưa NECTAR vào hoa khi còn 60 giây (G410).'
    },
    {
      key: 'teleopLate',
      name: 'ĐIỀU KHIỂN · 60 giây cuối',
      clock: 'ĐIỀU KHIỂN còn 1:00 – 0:00',
      phase: 'teleop',
      blurb: 'Trận đấu không dừng ở mốc này. Các hành động bắt đầu sau chuỗi trước đó khi còn 60 giây; lúc này có thể đưa NECTAR vào hoa (G410).'
    }
  ];
  var ZONE_KEYS = ZONES.map(function (z) { return z.key; });

  /* ---------- Action palette ---------- */
  /* group:    which palette section the card lives in
     zones:    where the action may be placed at all
     lateOnly: placing it outside teleopLate is flagged, not silently scored
     once:     'auto' | 'teleop' — at most one per robot per phase group
     element:  'pollen' | 'nectar' | null — what the card is about
     collects: set on a COLLECT card; the element it ADDS to the robot.
               A card with `element` set and no `collects` CONSUMES one of
               that element from the robot when it runs.                   */
  var ACTIONS = {
    defendShooter: {
      id:'defendShooter',label:'Cản cú bắn của đối thủ rồi rút lui',tag:'PHÒNG THỦ',icon:'i-robot',element:null,
      group:'teleop',zones:['teleopEarly','teleopLate'],
      value:'Đẩy nhẹ có kiểm soát sau lượt bắn vào tổ; gồm di chuyển, rút lui và nhường đường',
      help:'Chỉ thử sau khi hoàn tất lượt bắn vào tổ của mình, trong lúc đối thủ đang bắn. Ước tính đẩy lệch khoảng 1,5 inch trong 0,5 giây, sau đó rút lui và tránh đường 3,1 giây. Robot đang bắn sẽ đổi vị trí và ngắm lại. Đây là ước tính lập kế hoạch, không đảm bảo trọng tài sẽ cho phép.'
    },
    defendLane: {
      id:'defendLane',label:'Chặn lối di chuyển rồi rời đi',tag:'PHÒNG THỦ',icon:'i-park',element:null,
      group:'teleop',zones:['teleopEarly','teleopLate'],
      value:'Chặn thấp 1 giây / vừa 1,5 giây / cao 2 giây, cộng thời gian di chuyển, rút lui và nhường đường 3,1 giây · không ghi điểm trực tiếp',
      help:'Chặn lối không tiếp xúc trong ĐIỀU KHIỂN. Đối thủ chỉ phải nhường nếu đường đi của họ gặp lối đang bị chiếm. Không cản trở trong TỰ ĐỘNG, húc, ghim robot, chạm tổ/hoa hoặc chặn khu nạp. Robot tự lùi ra hơn 24 inch rồi tránh đường trong 3,1 giây.'
    },
    leave: {
      id: 'leave', label: 'Rời tường', tag: 'RỜI TƯỜNG', icon: 'i-leave', element: null,
      group: 'auto', zones: ['auto'], once: 'auto',
      value: '3 điểm (chỉ trong TỰ ĐỘNG)',
      help: 'Robot rời khỏi tường biên. Bảng 10-2: 3 điểm, chỉ tính trong TỰ ĐỘNG.'
    },
    parkAuto: {
      id: 'parkAuto', label: 'Đỗ trong KHU NẠP', tag: 'ĐỖ', icon: 'i-park', element: null,
      group: 'auto', zones: ['auto'], once: 'auto',
      value: '5 điểm',
      help: 'Robot nằm một phần trong KHU NẠP khi kết thúc TỰ ĐỘNG. Bảng 10-2: 5 điểm.'
    },
    collectPollenGround: {
      id: 'collectPollenGround', label: 'Thu thập POLLEN trên sàn', tag: 'THU THẬP',
      icon: 'i-collect-pollen', element: 'pollen', collects: 'pollen',
      group: 'both', zones: ZONE_KEYS,
      value: 'robot giữ thêm 1 POLLEN · 0 điểm',
      help: 'Di chuyển đến POLLEN rời trên sàn hoặc POLLEN trong vườn. Bóng có giới hạn và sẽ bị lấy khỏi vị trí đó sau khi hút; bóng bị đổ phải rơi xuống và ổn định trước.'
    },
    collectPollenFlower: {
      needsFlower: true, id: 'collectPollenFlower', label: 'Lấy POLLEN ở đáy FLOWER', tag: 'THU THẬP',
      icon: 'i-collect-flower', element: 'pollen', collects: 'pollen',
      group: 'both', zones: ZONE_KEYS,
      value: 'robot giữ thêm 1 POLLEN · 0 điểm',
      help: 'Lấy POLLEN từ ĐÁY FLOWER. G418 cho phép lấy POLLEN ở đáy FLOWER và không giới hạn thời gian: quy tắc 60 giây cuối (G410) áp dụng cho việc đưa NECTAR VÀO FLOWER, khác với việc lấy POLLEN RA. Mỗi FLOWER có sẵn 4 POLLEN khi trận bắt đầu.'
    },
    collectNectar: {
      id: 'collectNectar', label: 'Thu thập NECTAR', tag: 'THU THẬP',
      icon: 'i-collect-nectar', element: 'nectar', collects: 'nectar',
      group: 'both', zones: ZONE_KEYS,
      value: 'robot giữ thêm 1 NECTAR · cần có bóng được phát ra',
      help: 'Lấy NECTAR từ NGƯỜI CHƠI của đội bạn hoặc trên sàn nơi một lần NGHIÊNG TỔ làm rơi bóng. 5 NECTAR dự trữ của liên minh được phát ra mỗi lần TỔ NGHIÊNG một quả, phần còn lại được phát khi trận còn 60 giây. Vì vậy, đầu TỰ ĐỘNG chưa có NECTAR để thu thập. Bạn vẫn có thể thêm hành động; kế hoạch sẽ gắn cảnh báo và giải thích lý do.'
    },
    hivePollen: {
      id: 'hivePollen', label: 'Bắn POLLEN vào HIVE', tag: 'TỔ', icon: 'i-pollen', element: 'pollen',
      group: 'both', zones: ZONE_KEYS,
      value: '+5 đơn vị lấp đầy [ước tính] · dùng 1 POLLEN robot đang giữ',
      help: 'BẮN vào Ô hướng lên là cách hợp lệ duy nhất để làm TỔ NGHIÊNG (G417). Robot dùng đi một POLLEN.'
    },
    hiveNectar: {
      id: 'hiveNectar', label: 'Bắn NECTAR vào HIVE', tag: 'TỔ', icon: 'i-nectar', element: 'nectar',
      group: 'both', zones: ZONE_KEYS,
      value: '+8 đơn vị lấp đầy [ước tính] · dùng 1 NECTAR robot đang giữ',
      help: 'NECTAR nặng hơn nên làm TỔ NGHIÊNG nhanh hơn. Chỉ được BẮN (G417). Robot dùng đi một NECTAR, vì vậy cần thu thập NECTAR trước; chưa có quả nào được phát ra cho đến khi TỔ NGHIÊNG.'
    },
    flowerPollen: {
      id: 'flowerPollen', label: 'Ghi điểm POLLEN trong FLOWER', tag: 'HOA', icon: 'i-pollen', element: 'pollen',
      group: 'both', zones: ZONE_KEYS, needsFlower: true,
      value: '2 điểm mỗi quả, chỉ khi liên minh sở hữu FLOWER · dùng 1 POLLEN robot đang giữ',
      help: 'Chỉ ghi 2 điểm nếu liên minh của bạn sở hữu FLOWER khi trận kết thúc. Robot dùng đi một POLLEN.'
    },
    flowerNectar: {
      id: 'flowerNectar', label: 'Ghi điểm NECTAR trong FLOWER', tag: 'HOA', icon: 'i-nectar', element: 'nectar',
      group: 'teleop', zones: ['teleopEarly', 'teleopLate'], lateOnly: true, needsFlower: true,
      value: '2 điểm và giành quyền sở hữu; quả đầu tiên thêm 5 điểm thưởng đáy · dùng 1 NECTAR robot đang giữ',
      lateOnly: true,
      help: 'NECTAR có màu liên minh bạn nằm trên cùng sẽ xác định quyền sở hữu FLOWER. Đưa NECTAR vào hoa trước 60 giây cuối sẽ bị LỖI NẶNG cho mỗi quả (G410). Robot dùng đi một NECTAR.'
    },
    gardenPollen: {
      id: 'gardenPollen', label: 'Ghi điểm POLLEN trong VƯỜN', tag: 'VƯỜN', icon: 'i-pollen', element: 'pollen',
      group: 'both', zones: ZONE_KEYS,
      value: '1 điểm mỗi quả · dùng 1 POLLEN robot đang giữ',
      help: 'Mỗi liên minh có VƯỜN riêng và không bị giới hạn theo giai đoạn. Robot dùng đi một POLLEN.'
    },
    gardenNectar: {
      id: 'gardenNectar', label: 'Ghi điểm NECTAR trong VƯỜN', tag: 'VƯỜN', icon: 'i-nectar', element: 'nectar',
      group: 'both', zones: ZONE_KEYS,
      value: '1 điểm mỗi quả · dùng 1 NECTAR robot đang giữ',
      help: 'Mỗi liên minh có VƯỜN riêng và không bị giới hạn theo giai đoạn. Robot dùng đi một NECTAR.'
    },
    parkTeleop: {
      id: 'parkTeleop', label: 'Đỗ trong KHU NẠP', tag: 'ĐỖ', icon: 'i-park', element: null,
      group: 'teleop', zones: ['teleopEarly', 'teleopLate'], once: 'teleop',
      value: '5 điểm',
      help: 'Được tính khi trận kết thúc. Bảng 10-2 xem ĐỖ trong TỰ ĐỘNG và ĐIỀU KHIỂN là hai thành tích riêng, nên robot có thể đạt cả hai trong một trận.'
    }
  };

  var PALETTE = {
    auto: ['leave', 'collectPollenGround', 'collectPollenFlower', 'collectNectar',
           'hivePollen', 'hiveNectar', 'flowerPollen', 'gardenPollen', 'gardenNectar', 'parkAuto'],
    teleop: ['defendShooter', 'defendLane', 'collectPollenGround', 'collectPollenFlower', 'collectNectar',
             'hivePollen', 'hiveNectar', 'flowerPollen', 'flowerNectar',
             'gardenPollen', 'gardenNectar', 'parkTeleop']
  };

  /* ---------- Sources [verbatim, do not alter] ---------- */
  var SOURCES = {
    manual: 'FIRST Tech Challenge 2026-2027 Competition Manual, BIOBUZZ presented by RTX, ' +
            'Version 1 (published 2026-09-12) — Section 10, Game Details, Table 10-2 and Table 10-3.',
    videos: [
      { title: 'BIOBUZZ presented by RTX Game Animation', url: 'https://youtu.be/sUH3z5a5S9I' },
      { title: 'BIOBUZZ presented by RTX Field Walkthrough', url: 'https://youtu.be/47X9sYnPijw' }
    ],
    resources: { title: 'official game resources', url: 'https://ftc-resources.firstinspires.org/ftc/game' },
    disclaimer: 'Đây là công cụ lập kế hoạch do cộng đồng tạo ra, không phải công cụ chính thức và không liên kết, được FIRST chứng thực hay FIRST đánh giá. Điểm số được chép từ Sổ tay thi đấu công khai; hãy đối chiếu với sổ tay chính thức trước khi sử dụng thông tin quan trọng.'
    };

  root.BBRules = {
    POINTS: POINTS, RP: RP, FOULS: FOULS, MATCH: MATCH, HIVE: HIVE,
    SETUP: SETUP, INVENTORY: INVENTORY, NECTAR_FLOW: NECTAR_FLOW,
    RULES: RULES, ZONES: ZONES, ZONE_KEYS: ZONE_KEYS,
    ACTIONS: ACTIONS, PALETTE: PALETTE, SOURCES: SOURCES
  };
})(typeof window !== 'undefined' ? window : globalThis);
