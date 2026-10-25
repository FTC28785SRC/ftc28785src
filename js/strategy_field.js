/* =====================================================================
   BIOBUZZ Alliance Match Planner — scoring.js
   ---------------------------------------------------------------------
   Pure simulation. No DOM, no globals beyond the export. Given a plan it
   returns the score, the ranking-point progress, the end-of-match field
   state, and a step-by-step timeline with a snapshot after every action
   so the field board can replay the plan.

   Resolution order (stated on the page as an explicit assumption):
       AUTO        : Robot 1's sequence, then Robot 2's
       TELEOP <60s : Robot 1's sequence, then Robot 2's
       -- 60-second mark: all reserved NECTAR released --
       TELEOP last : Robot 1's sequence, then Robot 2's

   Real matches interleave the two robots. Phase attribution of a TIP is
   unaffected by interleaving (every AUTO action precedes every TELEOP
   action either way); the exact element that trips a TIP can differ.

   RESOURCES. A robot cannot launch what it is not holding, so this runs
   a small inventory model alongside the score:

     * Each robot starts holding 4 POLLEN and 0 NECTAR — the manual's
       pre-load. POLLEN is therefore the only thing launchable at the
       first instant of AUTO.
     * A COLLECT action adds one element to that robot. A launch or
       score action consumes one. Running a launch with nothing held is
       flagged and not scored, exactly the way a G410 FLOWER violation
       is flagged and not scored — placeable, visible, explained.
     * POLLEN collection is always available (40 are in play).
     * NECTAR is alliance-wide and genuinely scarce: 5 sit off-field
       with your HUMAN PLAYER, one released per HIVE TIP and all
       remaining at the 60-second mark. NECTAR spilled out of a tipped
       CELL joins the collectable pool. Collecting with nothing released
       and nothing spilled is flagged, not scored, and explained.

   Neither the inventory flag nor the NECTAR-availability flag is a
   foul. Only G410 concedes points to the opponent.
   ===================================================================== */
(function (root) {
  'use strict';

  var R = root.BBRules;

  function emptyFlower() {
    return { pollen: 0, nectar: 0, owned: false, bottomBonus: false };
  }

  function snapshotOf(s) {
    return {
      fill: s.fill,
      cellCount: s.cellCount,
      cellNectar: s.cellNectar,
      cellUp: s.tips % 2,
      tips: s.tips,
      autoTips: s.autoTips,
      teleopTips: s.teleopTips,
      garden: s.garden,
      nectarReleased: s.nectarReleased,
      nectarInPlay: R.SETUP.nectarInUpCellPerAlliance + s.nectarReleased,
      nectarReserve: R.SETUP.nectarReservePerAlliance - s.nectarReleased,
      nectarLoose: s.nectarLoose,        // released or spilled, nobody holding it
      nectarCollected: s.nectarCollected,
      flowers: s.flowers.map(function (f) {
        return { pollen: f.pollen, nectar: f.nectar, owned: f.owned, bottomBonus: f.bottomBonus };
      }),
      robots: s.robots.map(function (r) {
        return { leave: r.leave, parkAuto: r.parkAuto, parkTeleop: r.parkTeleop,
                 heldPollen: r.heldPollen, heldNectar: r.heldNectar };
      }),
      liveAuto: s.autoPts + R.POINTS.HIVE_TIP_AUTO * s.autoTips,
      liveTeleop: s.teleopPts + R.POINTS.HIVE_TIP_TELEOP * s.teleopTips
    };
  }

  /**
   * @param {{robots: Array<{zones: Object<string, Array>}>}} plan
   * @returns {Object} full evaluation
   */
  function simulate(plan) {
    var s = {
      fill: 0, cellCount: 0, tips: 0, autoTips: 0, teleopTips: 0,
      garden: 0,
      nectarReleased: 0,       // cumulative, out of the 5-NECTAR reserve
      nectarLoose: 0,          // released or spilled and not yet picked up
      nectarCollected: 0,      // cumulative pick-ups by either robot
      cellNectar: 0,           // NECTAR launched into the CELL that is currently up
      stagedSpilled: false,    // have the 3 staged CELL NECTAR spilled yet?
      flowers: [emptyFlower(), emptyFlower(), emptyFlower(), emptyFlower()],
      robots: plan.robots.map(function () {
        return {
          leave: false, parkAuto: false, parkTeleop: false,
          heldPollen: R.INVENTORY.pollenPreloadedPerRobot,   // 4 pre-loaded POLLEN
          heldNectar: R.INVENTORY.nectarPreloadedPerRobot    // 0 — no NECTAR starts on a robot
        };
      }),
      autoPts: 0, teleopPts: 0
    };

    var events = [];
    var flags = {};                 // action uid -> per-card badges
    var counts = {
      leave: 0, parkAuto: 0, parkTeleop: 0,
      hivePollen: 0, hiveNectar: 0,
      gardenElements: 0,
      flowerBottomBonus: 0,
      illegalFlowerNectar: 0, illegalFlowerPollen: 0,
      collectedPollen: 0, collectedNectar: 0,
      unstockedPollen: 0, unstockedNectar: 0,   // launched/scored with an empty robot
      unavailableNectar: 0,                     // collected with nothing released or spilled
      ignored: 0
    };

    function push(ev) {
      ev.step = events.length;
      ev.snapshot = snapshotOf(s);
      events.push(ev);
    }

    /* A TIP dumps the upward CELL onto the floor and releases one reserve
       NECTAR to the HUMAN PLAYER. Both of those put NECTAR back within a
       robot's reach — the second half of the resource loop. */
    function doTip(phase) {
      s.tips += 1;
      if (phase === 'auto') { s.autoTips += 1; } else { s.teleopTips += 1; }

      // [MANUAL] one reserve NECTAR released per TIP, up to the 5 you have
      if (s.nectarReleased < R.NECTAR_FLOW.reservePerAlliance) {
        s.nectarReleased += 1;
        s.nectarLoose += R.NECTAR_FLOW.releasedPerTip;
      }

      // [ESTIMATE] the CELL empties onto the field, so its NECTAR is collectable again
      var spill = s.cellNectar;
      if (!s.stagedSpilled && R.NECTAR_FLOW.stagedCellNectarSpillsOnFirstTip) {
        spill += R.SETUP.nectarInUpCellPerAlliance;      // the 3 staged in your upward CELL
        s.stagedSpilled = true;
      }
      if (R.NECTAR_FLOW.spillIsCollectable) { s.nectarLoose += spill; }

      s.fill = 0;
      s.cellCount = 0;
      s.cellNectar = 0;
      return spill;
    }

    function launch(a, zoneKey, phase, robotIdx) {
      var el = R.ACTIONS[a.type].element;               // 'pollen' | 'nectar'
      var units = R.HIVE.units[el];
      s.fill += units;
      s.cellCount += 1;
      if (el === 'nectar') { s.cellNectar += 1; }
      var tipped = false, overflow = 0, spilled = 0;
      if (s.fill >= R.HIVE.threshold) {
        tipped = true;
        overflow = s.fill - R.HIVE.threshold;
        spilled = doTip(phase);
        flags[a.uid] = flags[a.uid] || {};
        flags[a.uid].tipped = true;
        if (spilled > 0) { flags[a.uid].spilledNectar = spilled; }
      }
      counts[a.type] += 1;
      push({
        kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
        fx: { kind: 'hive', element: el, from: robotIdx, tipped: tipped, overflow: overflow, units: units }
      });
    }

    function runZone(zoneKey, robotIdx, phase) {
      var list = plan.robots[robotIdx].zones[zoneKey] || [];
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        var robot = s.robots[robotIdx];
        var def = R.ACTIONS[a.type] || {};
        flags[a.uid] = flags[a.uid] || {};

        /* ---------- COLLECT: puts one element INTO the robot ----------
           Scores nothing. POLLEN is always collectable; NECTAR only once
           your alliance has some released or spilled and unclaimed.     */
        if (def.collects) {
          if (def.collects === 'nectar' && s.nectarLoose <= 0) {
            flags[a.uid].blocked = true;
            flags[a.uid].rule = null;                       // NOT a foul — just not possible
            flags[a.uid].message = s.tips === 0
              ? 'Nothing to collect yet. No HIVE TIP has happened at this point in the plan, so none of ' +
                'your alliance’s ' + R.NECTAR_FLOW.reservePerAlliance + ' reserve NECTAR has been ' +
                'released and nothing has spilled out of a CELL. Reserve NECTAR is released one per ' +
                'HIVE TIP, and all of it at the 60-second mark. Not scored.'
              : 'Nothing left to collect here. Your alliance has released ' + s.nectarReleased + ' of ' +
                R.NECTAR_FLOW.reservePerAlliance + ' reserve NECTAR, and every released or spilled ' +
                'NECTAR is already held by a robot or already scored. Not scored.';
            counts.unavailableNectar++;
            push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                   fx: { kind: 'blocked', element: 'nectar', from: robotIdx, reason: 'nectar' } });
            continue;
          }
          if (def.collects === 'nectar') {
            s.nectarLoose -= 1;
            s.nectarCollected += 1;
            robot.heldNectar += 1;
            counts.collectedNectar++;
          } else {
            robot.heldPollen += 1;
            counts.collectedPollen++;
          }
          flags[a.uid].collected = def.collects;
          flags[a.uid].heldPollen = robot.heldPollen;
          flags[a.uid].heldNectar = robot.heldNectar;
          push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                 fx: { kind: 'collect', element: def.collects, from: robotIdx, source: a.type } });
          continue;
        }

        /* ---------- CONSUME: everything that launches or scores --------
           A robot cannot put out what it is not holding. Flagged and not
           scored — the same "flag it, don't block it" treatment G410
           violations get, because seeing the gap is the point.
           An element thrown in breach of G410 is still consumed: it left
           the robot, it just did not score.                             */
        if (def.element) {
          var held = def.element === 'pollen' ? robot.heldPollen : robot.heldNectar;
          if (held <= 0) {
            flags[a.uid].blocked = true;
            flags[a.uid].rule = null;                       // NOT a foul
            flags[a.uid].message = def.element === 'pollen'
              ? 'Robot ' + (robotIdx + 1) + ' is holding no POLLEN at this point in the plan. It starts ' +
                'the match with ' + R.INVENTORY.pollenPreloadedPerRobot + ' pre-loaded POLLEN and needs ' +
                'a Collect POLLEN action before it can launch or score another. Not scored.'
              : 'Robot ' + (robotIdx + 1) + ' is holding no NECTAR at this point in the plan. No NECTAR ' +
                'starts on a robot, so this needs a Collect NECTAR first — and none of your alliance’s ' +
                'reserve is released until your first HIVE TIP. Not scored.';
            if (def.element === 'pollen') { counts.unstockedPollen++; } else { counts.unstockedNectar++; }
            push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                   fx: { kind: 'blocked', element: def.element, from: robotIdx, reason: 'stock' } });
            continue;
          }
          if (def.element === 'pollen') { robot.heldPollen -= 1; } else { robot.heldNectar -= 1; }
        }

        switch (a.type) {

          case 'leave':
            if (robot.leave) { flags[a.uid].ignored = 'LEAVE already earned by this robot.'; counts.ignored++; break; }
            robot.leave = true;
            s.autoPts += R.POINTS.LEAVE;
            counts.leave++;
            push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                   fx: { kind: 'leave', from: robotIdx } });
            break;

          case 'parkAuto':
            if (robot.parkAuto) { flags[a.uid].ignored = 'AUTO PARK already earned by this robot.'; counts.ignored++; break; }
            robot.parkAuto = true;
            s.autoPts += R.POINTS.PARK_AUTO;
            counts.parkAuto++;
            push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                   fx: { kind: 'park', from: robotIdx } });
            break;

          case 'parkTeleop':
            if (robot.parkTeleop) { flags[a.uid].ignored = 'TELEOP PARK already earned by this robot.'; counts.ignored++; break; }
            robot.parkTeleop = true;
            s.teleopPts += R.POINTS.PARK_TELEOP;
            counts.parkTeleop++;
            push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                   fx: { kind: 'park', from: robotIdx } });
            break;

          case 'hivePollen':
          case 'hiveNectar':
            launch(a, zoneKey, phase, robotIdx);
            break;

          case 'flowerPollen':
          case 'flowerNectar': {
            var isNectar = a.type === 'flowerNectar';
            if (zoneKey !== 'teleopLate' && isNectar) {
              // G410 gate. Only NECTAR is prohibited before the final 60 seconds.
              flags[a.uid].illegal = true;
              flags[a.uid].rule = 'G410';
              flags[a.uid].message = 'MAJOR FOUL per NECTAR — NECTAR may not be entered into a FLOWER ' +
                                     'before 60 seconds remain (G410). Not scored.';
              counts.illegalFlowerNectar++;
              push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                     fx: { kind: 'illegal', element: isNectar ? 'nectar' : 'pollen', from: robotIdx,
                           flower: a.flower } });
              break;
            }
            var f = s.flowers[a.flower - 1];
            if (isNectar) {
              if (!f.bottomBonus) {
                f.bottomBonus = true;
                s.teleopPts += R.POINTS.FLOWER_BOTTOM_BONUS;
                counts.flowerBottomBonus++;
                flags[a.uid].bottomBonus = true;
              }
              if (!f.owned) { flags[a.uid].claimedOwnership = true; }
              f.owned = true;
              f.nectar += 1;
            } else {
              f.pollen += 1;
            }
            push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                   fx: { kind: 'flower', element: isNectar ? 'nectar' : 'pollen', from: robotIdx,
                         flower: a.flower, bonus: !!flags[a.uid].bottomBonus } });
            break;
          }

          case 'gardenPollen':
          case 'gardenNectar':
            s.garden += 1;
            s.teleopPts += R.POINTS.GARDEN_ELEMENT;
            counts.gardenElements++;
            push({ kind: 'action', uid: a.uid, type: a.type, robot: robotIdx, zone: zoneKey, phase: phase,
                   fx: { kind: 'garden', element: a.type === 'gardenNectar' ? 'nectar' : 'pollen', from: robotIdx } });
            break;

          default:
            break;
        }
      }
    }

    /* ---- resolution order ---- */
    var initial = snapshotOf(s);          // taken before anything runs, so it cannot drift

    runZone('auto', 0, 'auto');
    runZone('auto', 1, 'auto');
    runZone('teleopEarly', 0, 'teleop');
    runZone('teleopEarly', 1, 'teleop');

    // The 60-second mark happens whether or not anything is planned around it.
    // Every reserve NECTAR not already released by a TIP is released now.
    var releasedAtMark = R.NECTAR_FLOW.reservePerAlliance - s.nectarReleased;
    s.nectarReleased = R.NECTAR_FLOW.reservePerAlliance;
    s.nectarLoose += releasedAtMark;
    push({ kind: 'boundary', releasedAtMark: releasedAtMark,
           label: '60 seconds remain — FLOWER scoring legal (G410), all reserved NECTAR released' });

    runZone('teleopLate', 0, 'teleop');
    runZone('teleopLate', 1, 'teleop');

    /* ---- end-of-match evaluation ---- */
    var cellRemainingPts = R.POINTS.CELL_REMAINING * s.cellCount;
    s.teleopPts += cellRemainingPts;

    var ownedElements = 0, unownedElements = 0, ownedFlowers = 0;
    s.flowers.forEach(function (f) {
      var n = f.pollen + f.nectar;
      if (f.owned) { ownedFlowers++; ownedElements += n; } else { unownedElements += n; }
    });
    var flowerOwnedPts = R.POINTS.FLOWER_OWNED_ELEMENT * ownedElements;
    s.teleopPts += flowerOwnedPts;

    var autoTipPts = R.POINTS.HIVE_TIP_AUTO * s.autoTips;
    var teleopTipPts = R.POINTS.HIVE_TIP_TELEOP * s.teleopTips;
    var autoTotal = s.autoPts + autoTipPts;
    var teleopTotal = s.teleopPts + teleopTipPts;

    /* ---- ranking points ---- */
    var swarmPts = 0;
    s.robots.forEach(function (r) {
      if (r.leave) { swarmPts += R.POINTS.LEAVE; }
      if (r.parkAuto) { swarmPts += R.POINTS.PARK_AUTO; }
      if (r.parkTeleop) { swarmPts += R.POINTS.PARK_TELEOP; }
    });

    var rp = {
      swarm: { value: swarmPts, threshold: R.RP.SWARM.threshold, earned: swarmPts >= R.RP.SWARM.threshold, rp: R.RP.SWARM.rp },
      pollinator1: { value: s.tips, threshold: R.RP.POLLINATOR_1.threshold, earned: s.tips >= R.RP.POLLINATOR_1.threshold, rp: R.RP.POLLINATOR_1.rp },
      pollinator2: { value: s.tips, threshold: R.RP.POLLINATOR_2.threshold, earned: s.tips >= R.RP.POLLINATOR_2.threshold, rp: R.RP.POLLINATOR_2.rp }
    };
    rp.total = (rp.swarm.earned ? rp.swarm.rp : 0) +
               (rp.pollinator1.earned ? rp.pollinator1.rp : 0) +
               (rp.pollinator2.earned ? rp.pollinator2.rp : 0);

    /* ---- penalties this plan hands to the opponent ---- */
    var opponentFoulPoints = counts.illegalFlowerNectar * R.FOULS.MAJOR;

    var breakdown = {
      auto: [
        { key: 'leave', label: 'LEAVE', n: counts.leave, each: R.POINTS.LEAVE, pts: counts.leave * R.POINTS.LEAVE },
        { key: 'parkAuto', label: 'PARK (AUTO)', n: counts.parkAuto, each: R.POINTS.PARK_AUTO, pts: counts.parkAuto * R.POINTS.PARK_AUTO },
        { key: 'autoTip', label: 'HIVE TIP (AUTO)', n: s.autoTips, each: R.POINTS.HIVE_TIP_AUTO, pts: autoTipPts }
      ],
      teleop: [
        { key: 'parkTeleop', label: 'PARK (TELEOP)', n: counts.parkTeleop, each: R.POINTS.PARK_TELEOP, pts: counts.parkTeleop * R.POINTS.PARK_TELEOP },
        { key: 'teleopTip', label: 'HIVE TIP (TELEOP)', n: s.teleopTips, each: R.POINTS.HIVE_TIP_TELEOP, pts: teleopTipPts },
        { key: 'cell', label: 'Elements left in upward CELL', n: s.cellCount, each: R.POINTS.CELL_REMAINING, pts: cellRemainingPts },
        { key: 'bottom', label: 'FLOWER bottom NECTAR bonus', n: counts.flowerBottomBonus, each: R.POINTS.FLOWER_BOTTOM_BONUS, pts: counts.flowerBottomBonus * R.POINTS.FLOWER_BOTTOM_BONUS },
        { key: 'owned', label: 'Elements in FLOWERS you own', n: ownedElements, each: R.POINTS.FLOWER_OWNED_ELEMENT, pts: flowerOwnedPts },
        { key: 'garden', label: 'Elements in your GARDEN', n: counts.gardenElements, each: R.POINTS.GARDEN_ELEMENT, pts: counts.gardenElements * R.POINTS.GARDEN_ELEMENT }
      ]
    };

    return {
      autoPoints: autoTotal,
      teleopPoints: teleopTotal,
      totalPoints: autoTotal + teleopTotal,
      breakdown: breakdown,
      counts: counts,
      rp: rp,
      swarmPoints: swarmPts,
      tips: s.tips,
      autoTips: s.autoTips,
      teleopTips: s.teleopTips,
      opponentFoulPoints: opponentFoulPoints,
      unownedFlowerElements: unownedElements,
      ownedFlowers: ownedFlowers,
      events: events,
      flags: flags,
      initial: initial,
      final: snapshotOf(s)
    };
  }

  root.BBScoring = { simulate: simulate };
})(typeof window !== 'undefined' ? window : globalThis);
