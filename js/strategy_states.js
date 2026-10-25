/* Versioned, allowlisted save format. No session, email, password or DOM state. */
(function (root) {
  'use strict';
  const zones = ['auto', 'teleopEarly', 'teleopLate'];
  const limits = {
    collectSeconds:[0.1,30], volleySeconds:[0.6,30], flowerSeconds:[0.3,30],
    collectionTravelSeconds:[0.1,30], returnTravelSeconds:[0.1,30],
    referenceDistanceInches:[6,144], tiltSeconds:[0.1,4], settleSeconds:[0.1,10], capacity:[4,4]
  };
  function check(condition, message) {
    if (!condition) throw new Error('Cannot load strategy: ' + message);
  }
  function choice(value, values, label) {
    check(values.includes(value), 'invalid ' + label + '.');
    return value;
  }
  function normalize(input) {
    check(input && input.schemaVersion === 1, 'unsupported save format.');
    check(JSON.stringify(input).length <= 500000, 'save is too large.');
    const data = {schemaVersion:1, plans:{}, settings:{}, setup:{}, editor:{}};
    let count = 0;
    for (const color of ['red','blue']) {
      const robots = input.plans?.[color]?.robots;
      check(Array.isArray(robots) && robots.length === 2, 'each alliance needs two robot plans.');
      data.plans[color] = {alliance:color, robots:robots.map(robot => {
        const result = {zones:{}};
        for (const zone of zones) {
          const actions = robot?.zones?.[zone];
          check(Array.isArray(actions), 'missing phase.');
          count += actions.length;
          check(count <= 2000, 'maximum 2,000 actions per match.');
          result.zones[zone] = actions.map(action => {
            const def = action && Object.hasOwn(root.BBRules.ACTIONS, action.type) && root.BBRules.ACTIONS[action.type];
            check(def && def.zones.includes(zone), 'unknown action or invalid phase.');
            const clean = {type:action.type};
            if (action.quantity !== undefined) {
              check(Number.isInteger(action.quantity) && action.quantity >= 1 && action.quantity <= 4, 'invalid ball count.');
              clean.quantity = action.quantity;
            }
            if (def.needsFlower) {
              check(Number.isInteger(action.flower) && action.flower >= 1 && action.flower <= 4, 'invalid flower.');
              clean.flower = action.flower;
            }
            if (action.source !== undefined) clean.source = choice(action.source, ['nearest','spill','loading'], 'collection source');
            if (action.lane !== undefined) {
              check(Number.isInteger(action.lane) && action.lane >= 0 && action.lane <= 3, 'invalid defense position.');
              clean.lane = action.lane;
            }
            if (action.defenseLevel !== undefined) clean.defenseLevel = choice(action.defenseLevel, ['low','medium','high'], 'defense level');
            if (action.recipeId !== undefined) {
              check(typeof action.recipeId === 'string' && action.recipeId.length <= 100 &&
                typeof action.recipeName === 'string' && action.recipeName.length <= 120, 'invalid recipe block.');
              clean.recipeId = action.recipeId;
              clean.recipeName = action.recipeName;
            }
            return clean;
          });
        }
        return result;
      })};
    }
    for (const [key, [min,max]] of Object.entries(limits)) {
      const value = input.settings?.[key];
      check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, 'invalid timing setting.');
      data.settings[key] = value;
    }
    data.setup.matchMode = choice(input.setup?.matchMode, ['single','alliance','competitive','opponent'], 'match mode');
    data.setup.playingAlliance = choice(input.setup?.playingAlliance, ['red','blue'], 'alliance');
    data.setup.singleRobot = choice(input.setup?.singleRobot, ['0','1'], 'practice robot');
    data.setup.defenseTactic = choice(input.setup?.defenseTactic, ['mixed','contact','lane'], 'defense style');
    data.editor.alliance = choice(input.editor?.alliance, ['red','blue'], 'editor alliance');
    data.editor.robot = choice(input.editor?.robot, ['0','1'], 'editor robot');
    data.editor.phase = choice(input.editor?.phase, zones, 'editor phase');
    if (['single','alliance'].includes(data.setup.matchMode)) data.editor.alliance = data.setup.playingAlliance;
    if (data.setup.matchMode === 'single') data.editor.robot = data.setup.singleRobot;
    return data;
  }
  function normalizeRobot(input) {
    check(input?.schemaVersion === 2 && input.kind === 'dragonflow-robot-strategy', 'choose a Dragonflow robot strategy file.');
    const alliance = choice(input.alliance, ['red','blue'], 'source alliance');
    const robotIndex = choice(input.robotIndex, [0,1], 'source robot');
    const plans = Object.fromEntries(['red','blue'].map(color => [color,{robots:[0,1].map(() => ({zones:{auto:[],teleopEarly:[],teleopLate:[]}}))}]));
    plans[alliance].robots[robotIndex] = input.robot;
    const clean = normalize({schemaVersion:1,plans,settings:root.BBWorld.defaults,
      setup:{matchMode:'competitive',playingAlliance:alliance,singleRobot:'0',defenseTactic:'mixed'},
      editor:{alliance,robot:String(robotIndex),phase:'auto'}});
    return {schemaVersion:2,kind:'dragonflow-robot-strategy',alliance,robotIndex,robot:clean.plans[alliance].robots[robotIndex]};
  }
  root.BBStrategyState = {normalize, normalizeRobot};
})(typeof window === 'undefined' ? globalThis : window);
