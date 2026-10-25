/* Concurrent, completion-time simulation with finite, identifiable elements.
 * Four robot queues share the floor/flowers. All durations are editable estimates. */
(function(root) {
    'use strict';
    var W = root.BBWorld
      , R = root.BBRules
      , P = R.POINTS;
    function clone(v) {
        return JSON.parse(JSON.stringify(v));
    }
    function opposite(c) {
        return c === 'red' ? 'blue' : 'red';
    }
    function simulate(plans, options, recordSnapshots) {
        var settings = Object.assign({}, W.defaults, options || {});
        Object.keys(W.defaults).forEach(function(k) {
            if (!Number.isFinite(+settings[k]) || +settings[k] <= 0)
                settings[k] = W.defaults[k];
            else
                settings[k] = +settings[k];
        });
        settings.capacity = Math.max(1, Math.min(4, Math.floor(settings.capacity)));
        // G407
        var time = 0
          , serial = 0
          , events = []
          , balls = []
          , flowers = []
          , hives = {}
          , robots = {}
          , reserves = {}
          , flags = {
            red: {},
            blue: {}
        }
          , fouls = {
            red: 0,
            blue: 0
        }
          , released = {
            red: 0,
            blue: 0
        }
          , hiveReady = {
            red: 0,
            blue: 0
        };
        var activeDefense = []
          , defenseLog = [];
        function enabled(c, i) {
            return !settings.activeRobots || settings.activeRobots.includes(c + '-' + i);
        }
        var usage = {
            red: [{}, {}],
            blue: [{}, {}]
        }
          , hiveBusy = {
            red: false,
            blue: false
        };
        function token(element, color) {
            return {
                id: 'ball-' + (++serial),
                element: element,
                alliance: color || null
            };
        }
        ['red', 'blue'].forEach(function(c) {
            hives[c] = {
                fill: 0,
                tips: 0,
                autoTips: 0,
                teleopTips: 0,
                items: Array.from({
                    length: 3
                }, () => token('nectar', c))
            };
            reserves[c] = Array.from({
                length: 5
            }, () => token('nectar', c));
            robots[c] = [0, 1].map(function(i) {
                return {
                    position: W.geometry[c].homes[i].slice(),
                    items: Array.from({
                        length: 4
                    }, () => token('pollen')),
                    leave: false,
                    parkAuto: false,
                    motion: null
                };
            });
            robots[c].forEach(function(r, i) {
                r.active = enabled(c, i);
                if (!r.active) {
                    r.items.forEach( (b, j) => balls.push(Object.assign(b, {
                        position: [r.position[0], r.position[1] + j * 15, 12],
                        availableAt: 0,
                        source: 'practice'
                    })));
                    r.items = [];
                }
            });
            var g = W.geometry[c].garden;
            for (var i = 0; i < 4; i++)
                balls.push(Object.assign(token('pollen'), {
                    position: [g[0] + 20 + i * 35, g[1] + 13, 12],
                    availableAt: 0,
                    source: 'garden'
                }));
        });
        for (var f = 0; f < 4; f++)
            flowers.push({
                stack: Array.from({
                    length: 4
                }, () => token('pollen'))
            });
        function flowerState(f) {
            var nectar = f.stack.filter(b => b.element === 'nectar');
            return {
                stack: f.stack.map(b => Object.assign({}, b)),
                pollen: f.stack.filter(b => b.element === 'pollen').length,
                nectar: nectar.length,
                owner: nectar.length ? nectar[nectar.length - 1].alliance : null,
                bottom: nectar.length ? nectar[0].alliance : null
            };
        }
        function inZone(p, z) {
            return p[0] >= z[0] - 32 && p[0] <= z[0] + z[2] + 32 && p[1] >= z[1] - 32 && p[1] <= z[1] + z[3] + 32;
        }
        function gardenCount(c) {
            var z = W.geometry[c].garden;
            return balls.filter(b => time >= b.availableAt && b.position[0] >= z[0] - 12 && b.position[0] <= z[0] + z[2] + 12 && b.position[1] >= z[1] - 12 && b.position[1] <= z[1] + z[3] + 12).length;
        }
        function capture() {
            var fs = flowers.map(flowerState)
              , s = {
                time: time,
                settings: settings,
                defense: clone(activeDefense),
                flowers: fs,
                fouls: Object.assign({}, fouls),
                balls: balls.map(b => Object.assign({}, b))
            };
            ['red', 'blue'].forEach(function(c) {
                var h = hives[c]
                  , rs = robots[c].map(function(r) {
                    var pos = W.robotPosition(r, time);
                    return {
                        active: r.active,
                        position: pos,
                        motion: r.motion ? clone(r.motion) : null,
                        leave: r.leave,
                        parkAuto: r.parkAuto,
                        parkTeleop: r.active && time >= 38 && inZone(pos, W.geometry[c].load),
                        heldPollen: r.items.filter(b => b.element === 'pollen').length,
                        heldNectar: r.items.filter(b => b.element === 'nectar').length,
                        items: r.items.map(b => Object.assign({}, b))
                    };
                });
                var own = fs.map(f => Object.assign({}, f, {
                    owned: f.owner === c,
                    bottomBonus: f.bottom === c
                }));
                var auto = h.autoTips * P.HIVE_TIP_AUTO + rs.filter(r => r.leave).length * P.LEAVE + rs.filter(r => r.parkAuto).length * P.PARK_AUTO;
                var tele = h.teleopTips * P.HIVE_TIP_TELEOP + h.items.length * P.CELL_REMAINING + gardenCount(c) * P.GARDEN_ELEMENT + rs.filter(r => r.parkTeleop).length * P.PARK_TELEOP;
                own.forEach(f => {
                    tele += (f.owned ? (f.pollen + f.nectar) * P.FLOWER_OWNED_ELEMENT : 0) + (f.bottomBonus ? P.FLOWER_BOTTOM_BONUS : 0);
                }
                );
                s[c] = {
                    lastTipTime: h.lastTipTime == null ? null : h.lastTipTime,
                    cellItems: h.items.map(b => Object.assign({}, b)),
                    reserveItems: reserves[c].map(b => Object.assign({}, b)),
                    fill: h.fill,
                    cellCount: h.items.length,
                    cellNectar: h.items.filter(b => b.element === 'nectar').length,
                    cellUp: h.tips % 2,
                    tips: h.tips,
                    autoTips: h.autoTips,
                    teleopTips: h.teleopTips,
                    garden: gardenCount(c),
                    robots: rs,
                    flowers: own,
                    nectarReleased: released[c],
                    nectarReserve: reserves[c].length,
                    nectarInPlay: 8 - reserves[c].length,
                    nectarLoose: balls.filter(b => b.element === 'nectar' && b.alliance === c && b.availableAt <= time).length,
                    liveAuto: auto,
                    liveTeleop: tele,
                    matchTotal: auto + tele + fouls[opposite(c)],
                    foulCredit: fouls[opposite(c)]
                };
            });
            return s;
        }
        var initial = capture();
        function log(e) {
            e.step = events.length;
            e.time = time;
            if (recordSnapshots !== false)
                e.matchSnapshot = capture();
            events.push(e);
        }
        function release(c) {
            var b = reserves[c].shift();
            if (b) {
                var p = W.geometry[c].parks[0];
                balls.push(Object.assign(b, {
                    position: [p[0] + (c === 'red' ? 32 : -32), p[1], 12],
                    availableAt: time,
                    source: 'loading'
                }));
                released[c]++;
            }
        }
        function approachFlower(index) {
            var p = W.geometry.flowers[index].slice();
            p[0] += (600 - p[0]) * .09;
            p[1] += (600 - p[1]) * .09;
            p[2] = 0;
            return p;
        }
        function floorDestination(b) {
            var p = b.position.slice();
            p[0] = Math.max(70, Math.min(1130, p[0]));
            p[1] = Math.max(70, Math.min(1130, p[1]));
            p[2] = 0;
            return p;
        }
        function buildJob(actor, a, zone, end) {
            var c = actor.color
              , r = robots[c][actor.index]
              , def = R.ACTIONS[a.type]
              , qty = Math.max(1, Math.min(4, Math.floor(a.quantity || 1)))
              , source = null
              , reason = ''
              , dest = r.position.slice();
            var isCollect = !!def.collects
              , isHive = a.type.indexOf('hive') === 0
              , isFlower = a.type.indexOf('flower') === 0;
            if (a.type === 'defendLane' && zone === 'auto')
                reason = 'Defense is TELEOP only; avoid AUTO interference (G402).';
            if (isCollect && r.items.length + qty > settings.capacity)
                reason = 'Capacity ' + settings.capacity + ' reached (G407: at most four). Score held elements before collecting.';
            if (isCollect && !reason) {
                if (a.type === 'collectPollenFlower') {
                    var fi = (a.flower || 1) - 1
                      , first = flowers[fi].stack[0];
                    if (!first || first.element !== 'pollen')
                        reason = 'FLOWER ' + (fi + 1) + ' has no accessible bottom POLLEN (G418). NECTAR cannot be retrieved.';
                    else if (first.reserved)
                        reason = 'That flower bottom is already being collected by another robot.';
                    else {
                        source = first;
                        dest = approachFlower(fi);
                    }
                } else {
                    var candidates = balls.filter(function(b) {
                        return (zone !== 'auto' || (c === 'red' ? b.position[0] < 568 : b.position[0] > 632)) && b.element === def.collects && !b.reserved && (b.element !== 'nectar' || b.alliance === c) && (a.source !== 'spill' || b.source === 'spill') && (a.source !== 'loading' || b.source === 'loading') && !W.insideFrame(floorDestination(b));
                    });
                    var ranked = candidates.map(function(b) {
                        var route = W.route(r.position, floorDestination(b));
                        return {
                            ball: b,
                            route: route,
                            cost: route ? route.inches / settings.referenceDistanceInches * settings.collectionTravelSeconds + Math.max(0, b.availableAt - time) : Infinity
                        };
                    }).sort( (a, b) => a.cost - b.cost);
                    if (!ranked.length || !Number.isFinite(ranked[0].cost))
                        reason = 'No reachable ' + def.collects.toUpperCase() + ' at this source. Retrieve flower POLLEN or wait for a hive spill/release.';
                    else {
                        source = ranked[0].ball;
                        dest = floorDestination(source);
                    }
                }
            }
            if (!isCollect && def.element && r.items.filter(b => b.element === def.element).length < qty)
                reason = 'Robot holds fewer than ' + qty + ' ' + def.element.toUpperCase() + '. Collect them first.';
            if (isHive)
                dest = [W.geometry[c].hive[0] + (actor.index === 0 ? -52 : 52), hives[c].tips % 2 ? 850 : 350, 0];
            if (isFlower)
                dest = approachFlower((a.flower || 1) - 1);
            if (a.type.indexOf('garden') === 0) {
                var g = W.geometry[c].garden;
                dest = [g[0] + g[2] / 2, c === 'red' ? 1100 : 100, 0];
            }
            if (a.type === 'defendLane')
                dest = W.defenseSpots[Math.max(0, Math.min(3, Math.floor(a.lane || 0)))].slice();
            if (a.type === 'leave')
                dest = [r.position[0] + (c === 'red' ? 100 : -100), r.position[1], 0];
            if (a.type.indexOf('park') === 0)
                dest = W.geometry[c].parks[actor.index].slice();
            if (zone === 'auto' && (c === 'red' ? dest[0] > 568 : dest[0] < 632))
                reason = 'AUTO plan stays on its own side to avoid opponent interference (G402).';
            if (reason)
                dest = r.position.slice();
            var route = W.route(r.position, dest);
            if (zone === 'auto' && route && route.points.some(p => c === 'red' ? p[0] > 568 : p[0] < 632)) {
                reason = 'AUTO route crosses the opponent side (G402).';
                dest = r.position.slice();
                route = W.route(r.position, dest);
            }
            if (!route) {
                reason = 'No route around the hive frame to this location.';
                route = W.route(r.position, r.position);
            }
            var travel = route.inches / settings.referenceDistanceInches * (isCollect ? settings.collectionTravelSeconds : settings.returnTravelSeconds)
              , arrival = time + travel;
            var wait = reason ? 0 : Math.max(0, (source ? (source.availableAt || 0) : 0) - arrival, isHive ? hiveReady[c] - arrival : 0);
            var service = isCollect ? (a._pickupSeconds || settings.collectSeconds) : isHive ? (a._shotSeconds || settings.volleySeconds) : isFlower ? settings.flowerSeconds * qty : a.type.indexOf('garden') === 0 ? .5 * qty : .25;
            var retreat = null
              , retreatTravel = 0;
            if (a.type === 'defendLane' && !reason) {
                retreat = [dest[0], dest[1] < 600 ? 160 : 1040, 0];
                retreatTravel = W.route(dest, retreat).inches / settings.referenceDistanceInches * settings.returnTravelSeconds;
                service = ({
                    low: 1,
                    medium: 1.5,
                    high: 2
                }[a.defenseLevel] || 2) + retreatTravel + 3.1;
            }
            var finish = arrival + wait + service;
            var flag = flags[c][a.uid] || (flags[c][a.uid] = {});
            flag.travelSeconds = (flag.travelSeconds || 0) + travel;
            flag.serviceSeconds = (flag.serviceSeconds || 0) + service;
            flag.waitSeconds = (flag.waitSeconds || 0) + wait;
            flag.duration = (flag.duration || 0) + travel + wait + service;
            flag.start = flag.start == null ? time : flag.start;
            flag.finish = finish;
            if (retreat) {
                flag.travelSeconds += retreatTravel;
                flag.serviceSeconds -= retreatTravel;
            }
            if (finish > end + .00001) {
                flag.blocked = true;
                flag.overrun = true;
                flag.message = 'Needs ' + (finish - time).toFixed(1) + ' s; only ' + Math.max(0, end - time).toFixed(1) + ' s remain in this phase. Not executed.';
                return null;
            }
            if (reason) {
                flag.blocked = true;
                flag.message = reason;
            }
            if (source && !reason)
                source.reserved = c + '-' + actor.index;

            r.motion = {
                path: route.points,
                start: time,
                arrival: arrival,
                serviceStart: arrival + wait,
                finish: finish,
                action: a.type,
                quantity: qty,
                element: def.element,
                sourcePoint: source ? (source.position || W.geometry.flowers[(a.flower || 1) - 1]) : null,
                flower: a.flower
            };
            if (isHive && !reason) {
                r.motion.action = 'approachHive';
                r.motion.serviceStart = arrival;
                r.motion.finish = arrival;
                finish = arrival;
                wait = 0;
                flag.waitSeconds -= Math.max(0, hiveReady[c] - arrival);
                flag.duration = flag.travelSeconds + flag.serviceSeconds + flag.waitSeconds;
            }
            if (a.type === 'defendLane' && !reason) {
                r.motion.action = 'defenseApproach';
                r.motion.finish = arrival;
                r.motion.serviceStart = arrival;
                finish = arrival;
            }
            return {
                holdSeconds: ({
                    low: 1,
                    medium: 1.5,
                    high: 2
                }[a.defenseLevel] || 2),
                retreat: retreat,
                retreatTravel: retreatTravel,
                actor: actor,
                a: a,
                qty: qty,
                source: source,
                reason: reason,
                dest: dest,
                route: route,
                travel: travel + retreatTravel,
                wait: wait,
                service: service - retreatTravel,
                start: time,
                arrival: arrival,
                finish: finish,
                zone: zone,
                end: end,
                stage: isHive && !reason ? 'approach' : a.type === 'defendLane' && !reason ? 'defenseApproach' : null
            };
        }
        // All robots may approach concurrently. Reserve only actual shooting time,
        // rechecking the raised side after travel or a wait instead of locking a
        // teammate at its previous collection point for an entire trip.
        function arriveHive(job) {
            var c = job.actor.color
              , r = robots[c][job.actor.index]
              , flag = flags[c][job.a.uid];
            r.position = job.dest.slice();
            var dest = [W.geometry[c].hive[0] + (job.actor.index === 0 ? -52 : 52), hives[c].tips % 2 ? 850 : 350, 0];
            var path = W.route(r.position, dest)
              , travel = path.inches / settings.referenceDistanceInches * settings.returnTravelSeconds;
            var wait = Math.max(0, hiveReady[c] - time, (hiveBusy[c] || 0) - time);
            if (travel > .00001) {
                job.route.points = job.route.points.concat(path.points.slice(1));
                job.travel += travel;
                job.dest = dest;
                job.arrival = time + travel;
                job.finish = job.arrival;
                flag.travelSeconds += travel;
                r.motion = {
                    path: path.points,
                    start: time,
                    arrival: job.arrival,
                    serviceStart: job.arrival,
                    finish: job.arrival,
                    action: 'approachHive'
                };
            } else if (wait > .00001) {
                job.wait += wait;
                job.finish = time + wait;
                flag.waitSeconds += wait;
                r.motion = {
                    path: [dest, dest],
                    start: time,
                    arrival: time,
                    serviceStart: job.finish,
                    finish: job.finish,
                    action: 'waitHive'
                };
            } else {
                job.stage = 'shoot';
                job.finish = time + job.service;
                hiveBusy[c] = job.finish;
                r.motion = {
                    path: [dest, dest],
                    start: time,
                    arrival: time,
                    serviceStart: time,
                    finish: job.finish,
                    action: job.a.type,
                    quantity: job.qty,
                    element: R.ACTIONS[job.a.type].element
                };
            }
            flag.duration = flag.travelSeconds + flag.waitSeconds + flag.serviceSeconds;
            flag.finish = job.finish + (job.stage === 'shoot' ? 0 : job.service);
            if (flag.finish > job.end + .00001) {
                flag.blocked = true;
                flag.overrun = true;
                flag.message = 'Travel or hive wait leaves too little time to finish this shot.';
                if (job.stage === 'shoot')
                    hiveBusy[c] = false;
                job.reason = flag.message;
                job.stage = null;
                job.finish = time;
                r.motion = null;
                return false;
            }
            return true;
        }
        function complete(job) {
            var actor = job.actor
              , c = actor.color
              , ri = actor.index
              , r = robots[c][ri]
              , a = job.a
              , def = R.ACTIONS[a.type]
              , flag = flags[c][a.uid]
              , h = hives[c];
            r.position = job.dest.slice();
            r.motion = null;
            if (job.zone === 'auto' && r.position[0] > 70.01 && r.position[0] < 1129.99)
                r.leave = true;
            var fx = {
                kind: 'move',
                from: ri,
                element: def.element,
                quantity: job.qty,
                route: job.route.points,
                travelSeconds: job.travel,
                waitSeconds: job.wait,
                serviceSeconds: job.service,
                source: a.source || a.type,
                flower: a.flower
            };
            if (job.reason) {
                fx.kind = 'blocked';
                if (job.source)
                    delete job.source.reserved;
            } else if (a.type === 'defendShooter') {
                flag.finish = time;
                flag.duration = time - job.start;
                flag.travelSeconds = job.travel + (job.contacted ? job.release - job.arrival - .5 : 0);
                flag.serviceSeconds = job.contacted ? 3.6 : 0;
                flag.waitSeconds = job.wait;
                fx.kind = 'defense';
                fx.holdSeconds = job.contacted ? .5 : 0;
                fx.clearSeconds = job.contacted ? 3.1 : 0;
                fx.displacementInches = job.contacted ? 12 / W.scale : 0;
                flag.defense = true;
            } else if (a.type === 'defendLane') {
                fx.kind = 'defense';
                fx.lane = a.lane || 0;
                fx.holdSeconds = job.defenseSkipped ? 0 : job.holdSeconds;
                fx.retreat = job.retreat;
                fx.clearSeconds = 3.1;
                flag.defense = true;
            } else if (def.collects) {
                if (a.type === 'collectPollenFlower')
                    flowers[(a.flower || 1) - 1].stack.shift();
                else
                    balls.splice(balls.indexOf(job.source), 1);
                delete job.source.reserved;
                r.items.push({
                    id: job.source.id,
                    element: job.source.element,
                    alliance: job.source.alliance
                });
                flag.collected = def.collects;
                fx.kind = 'collect';
                fx.ballId = job.source.id;
                fx.collectionPoint = job.source.position || W.geometry.flowers[(a.flower || 1) - 1];
            } else if (def.element) {
                var consumed = [];
                for (var n = 0; n < job.qty; n++) {
                    var at = r.items.findIndex(b => b.element === def.element);
                    consumed.push(r.items.splice(at, 1)[0]);
                }
                if (a.type.indexOf('hive') === 0) {
                    fx.kind = 'hive';
                    fx.cellBefore = h.tips % 2;
                    fx.target = W.receivingPoint(c, h.tips % 2);
                    hiveBusy[c] = false;
                    consumed.forEach(function(b) {
                        h.items.push(b);
                        h.fill += R.HIVE.units[b.element];
                        if (h.fill >= R.HIVE.threshold) {
                            var previous = h.tips % 2
                              , spill = h.items.slice();
                            h.tips++;
                            h.lastTipTime = time;
                            if (job.zone === 'auto')
                                h.autoTips++;
                            else
                                h.teleopTips++;
                            spill.forEach(function(item, i) {
                                balls.push(W.spill(item, c, previous, time + settings.tiltSeconds, i, settings.settleSeconds));
                            });
                            fx.tipped = true;
                            fx.spilledIds = spill.map(b => b.id);
                            flag.tipped = true;
                            flag.spilledNectar = spill.filter(b => b.element === 'nectar').length;
                            h.items = [];
                            h.fill = 0;
                            hiveReady[c] = time + settings.tiltSeconds;
                            release(c);
                        }
                    });
                } else if (a.type.indexOf('flower') === 0) {
                    fx.kind = 'flower';
                    var f = flowers[(a.flower || 1) - 1]
                      , before = flowerState(f);
                    f.stack.push.apply(f.stack, consumed);
                    if (def.element === 'nectar') {
                        flag.bottomBonus = !before.bottom;
                        flag.claimedOwnership = before.owner !== c;
                        if (time < 98) {
                            fouls[c] += R.FOULS.MAJOR * job.qty;
                            flag.illegal = true;
                            flag.rule = 'G410';
                            flag.message = 'Early NECTAR scores but credits ' + R.FOULS.MAJOR * job.qty + ' foul points to the opponent.';
                            fx.kind = 'illegal';
                        }
                    }
                } else if (a.type.indexOf('garden') === 0) {
                    fx.kind = 'garden';
                    var garden = W.geometry[c].garden;
                    consumed.forEach(function(b, i) {
                        balls.push(Object.assign(b, {
                            position: [garden[0] + 30 + i * 25, garden[1] + 13, 12],
                            availableAt: time,
                            source: 'garden'
                        }));
                    });
                }
            } else
                fx.kind = a.type === 'leave' ? 'leave' : 'park';
            if (a.type.indexOf('hive') === 0)
                hiveBusy[c] = false;
            if (!job.reason)
                r.lastCompleted = a.type;
            return {
                kind: 'action',
                uid: a.uid,
                type: a.type,
                robot: ri,
                alliance: c,
                zone: job.zone,
                phase: job.zone === 'auto' ? 'auto' : 'teleop',
                start: job.start,
                arrival: job.arrival,
                duration: job.finish - job.start,
                fx: fx
            };
        }
        function runPhase(zone, start, end) {
            time = start;
            var actors = [];
            function applyDefense(actor) {
                scheduleTraffic(actor);
            }
            function contactJob(actor, a) {
                var r = robots[actor.color][actor.index]
                  , target = actors.find(other => other.color !== actor.color && other.job && other.job.stage === 'shoot');
                var j = {
                    actor: actor,
                    a: a,
                    qty: 0,
                    zone: a._zone,
                    end: end,
                    start: time,
                    arrival: time,
                    finish: time,
                    travel: 0,
                    wait: 0,
                    service: 0,
                    dest: r.position.slice(),
                    route: {
                        points: [r.position.slice(), r.position.slice()]
                    }
                };
                var f = flags[actor.color][a.uid] = {
                    start: time,
                    finish: time,
                    duration: 0,
                    travelSeconds: 0,
                    serviceSeconds: 0,
                    waitSeconds: 0
                };
                function skip(message) {
                    j.reason = message;
                    f.ignored = message;
                    return j;
                }
                if (zone === 'auto' || r.lastCompleted !== 'hivePollen' && r.lastCompleted !== 'hiveNectar')
                    return skip('Requires a completed own hive volley immediately before this TELEOP attempt.');
                r.lastCompleted = 'defendShooter';
                if (!target)
                    return skip('No opponent is currently shooting; continue scoring.');
                var tr = robots[target.color][target.index]
                  , p = W.robotPosition(tr, time)
                  , sign = actor.color === 'red' ? -1 : 1;
                var dest = [p[0] + sign * 68, p[1], 0]
                  , others = actors.filter(o => o !== actor).map(o => robots[o.color][o.index]);
                var remaining = 0;
                for (var q = target.next; q < target.list.length && target.list[q].uid === target.job.a.uid; q++)
                    remaining += target.list[q]._shotSeconds;
                var reserve = root.BBTraffic.reserve(r, dest, others, time, settings.returnTravelSeconds / settings.referenceDistanceInches, 0, end, false);
                if (!reserve || reserve.motion.arrival >= target.job.finish + remaining)
                    return skip('Cannot reach the shooter before its current shot completes.');
                j.target = target;
                j.sign = sign;
                j.dest = dest;
                j.route = reserve.route;
                j.travel = reserve.travel;
                j.wait = reserve.wait;
                j.arrival = reserve.motion.arrival;
                j.finish = j.arrival;
                j.stage = 'contactApproach';
                r.motion = Object.assign({}, reserve.motion, {
                    action: 'contactApproach'
                });
                return j;
            }
            function advanceContact(actor) {
                var j = actor.job
                  , r = robots[actor.color][actor.index]
                  , f = flags[actor.color][j.a.uid];
                r.position = j.dest.slice();
                if (j.stage === 'contactApproach') {
                    var target = j.target
                      , tr = robots[target.color][target.index]
                      , tj = target.job
                      , p = W.robotPosition(tr, time);
                    if (!tj || tj.stage !== 'shoot' || tj.finish <= time || Math.abs(p[0] - r.position[0]) > 68.01 || Math.abs(p[1] - r.position[1]) > .01) {
                        j.reason = 'Opponent finished shooting; attempt skipped.';
                        f.ignored = j.reason;
                        j.stage = null;
                        return false;
                    }
                    var pushed = [p[0] - j.sign * 12, p[1], 0]
                      , endPos = [pushed[0] + j.sign * 64, pushed[1], 0]
                      , retreat = [endPos[0], p[1] < 600 ? 70 : 1130, 0];
                    var path = W.route(endPos, retreat)
                      , duration = path ? path.inches / settings.referenceDistanceInches * settings.returnTravelSeconds : Infinity;
                    var release = time + .5 + duration
                      , recover = release + .8 + W.distance(pushed, p) / W.scale / settings.referenceDistanceInches * settings.returnTravelSeconds;
                    var dm = {
                        position: r.position,
                        motion: {
                            path: [r.position, endPos],
                            start: time,
                            arrival: time + .5,
                            finish: time + .5
                        }
                    };
                    var tm = {
                        position: p,
                        motion: {
                            path: [p, pushed],
                            start: time,
                            arrival: time + .5,
                            finish: recover
                        }
                    };
                    var retreatBody = {
                        position: endPos,
                        motion: {
                            path: path ? path.points : [endPos],
                            start: time + .5,
                            arrival: release,
                            finish: release + 3.1
                        }
                    };
                    var others = actors.filter(o => o !== actor && o !== target).map(o => robots[o.color][o.index]);
                    var safe = path && recover + tj.service <= end && release + 3.1 <= end && [pushed, endPos, retreat].every(v => v[0] >= 68 && v[0] <= 1132 && v[1] >= 68 && v[1] <= 1132 && !W.insideFrame(v)) && !root.BBTraffic.conflict(dm, tm, time, time + .5, 64) && !root.BBTraffic.conflict(retreatBody, tm, time + .5, release, 64) && others.every(o => !root.BBTraffic.conflict(dm, o, time, time + .5) && !root.BBTraffic.conflict(tm, o, time, recover) && !root.BBTraffic.conflict(retreatBody, o, time + .5, release + 3.1));
                    if (!safe) {
                        j.reason = 'No clear push and retreat corridor; contact skipped.';
                        f.ignored = j.reason;
                        j.stage = null;
                        return false;
                    }
                    j.contacted = true;
                    j.stage = 'contactPush';
                    j.finish = time + .5;
                    j.dest = endPos;
                    j.retreat = retreat;
                    j.retreatPath = path;
                    j.release = release;
                    r.motion = Object.assign({}, dm.motion, {
                        action: 'contactPush'
                    });
                    tj.dest = pushed;
                    tj.stage = 'contactRecover';
                    tj.finish = recover;
                    tj.wait += recover - time;
                    flags[target.color][tj.a.uid].waitSeconds += recover - time;
                    tr.motion = Object.assign({}, tm.motion, {
                        action: 'displacedAim',
                        serviceStart: recover
                    });
                    hiveBusy[target.color] = recover;
                    defenseLog.push({
                        defender: actor.color,
                        uid: j.a.uid,
                        target: target.color,
                        robot: target.index,
                        start: time,
                        delay: recover - time,
                        contact: true,
                        displacementInches: 12 / W.scale
                    });
                } else if (j.stage === 'contactPush') {
                    j.dest = j.retreat;
                    j.stage = 'contactRetreat';
                    j.finish = j.release;
                    r.motion = {
                        path: j.retreatPath.points,
                        start: time,
                        arrival: j.finish,
                        serviceStart: j.finish,
                        finish: j.finish,
                        action: 'defenseRetreat'
                    };
                } else if (j.stage === 'contactRetreat') {
                    j.stage = 'contactClear';
                    j.finish = time + 3.1;
                    r.motion = {
                        path: [j.dest, j.dest],
                        start: time,
                        arrival: time,
                        finish: j.finish,
                        serviceStart: time,
                        action: 'defenseClear'
                    };
                } else
                    return false;
                f.finish = j.finish;
                f.duration = j.finish - j.start;
                log({
                    kind: 'motion',
                    phase: 'teleop',
                    label: j.stage === 'contactPush' ? 'Controlled push / shooter must re-aim' : 'Contact defense / retreat and reset',
                    alliance: actor.color,
                    robot: actor.index
                });
                return true;
            }
            function scheduleTraffic(actor) {
                var job = actor.job
                  , r = robots[actor.color][actor.index]
                  , m = r.motion;
                if (!job || job.a.type === 'defendShooter' || job.reason || !m || m.arrival <= time + .00001 || m.trafficReserved)
                    return;
                var others = [];
                ['red', 'blue'].forEach(c => robots[c].forEach( (other, i) => {
                    if (other.active && (c !== actor.color || i !== actor.index))
                        others.push(other);
                }
                ));
                var from = W.robotPosition(r, time)
                  , oldTravel = m.arrival - time
                  , service = Math.max(0, m.finish - m.arrival);
                var rate = (R.ACTIONS[job.a.type].collects ? settings.collectionTravelSeconds : settings.returnTravelSeconds) / settings.referenceDistanceInches;
                var canOffset = !!R.ACTIONS[job.a.type].collects || job.a.type.indexOf('flower') === 0;
                var tail = job.stage === 'defenseApproach' ? job.holdSeconds + job.retreatTravel + 3.1 : job.stage === 'defenseRetreat' ? 3.1 : job.stage === 'approach' ? job.service : 0;
                var reservation = root.BBTraffic.reserve({
                    position: from
                }, job.dest, others, time, rate, service + tail, job.end, canOffset);
                if (reservation && job.zone === 'auto' && reservation.route.points.some(p => actor.color === 'red' ? p[0] > 568 : p[0] < 632))
                    reservation = null;
                var flag = flags[actor.color][job.a.uid];
                if (!reservation) {
                    flag.blocked = true;
                    flag.trafficBlocked = true;
                    flag.message = 'No collision-free approach fits now. Robot stays clear; action is not executed.';
                    job.reason = flag.message;
                    job.stage = null;
                    job.dest = from;
                    job.finish = time;
                    r.position = from;
                    r.motion = null;
                    return;
                }
                var delta = reservation.motion.arrival - m.arrival
                  , travelDelta = reservation.travel - oldTravel;
                var settleWait = job.source ? Math.max(0, (job.source.availableAt || 0) - (m.serviceStart + delta)) : 0;
                job.dest = reservation.dest;
                job.arrival += delta;
                job.finish += delta;
                job.travel += travelDelta;
                job.wait += reservation.wait;
                flag.travelSeconds += travelDelta;
                flag.waitSeconds += reservation.wait;
                flag.duration += delta;
                flag.finish += delta;
                job.finish += settleWait;
                job.wait += settleWait;
                flag.waitSeconds += settleWait;
                flag.duration += settleWait;
                flag.finish += settleWait;
                flag.trafficSeconds = (flag.trafficSeconds || 0) + Math.max(0, delta);
                r.position = from;
                r.motion = Object.assign({}, m, reservation.motion, {
                    serviceStart: m.serviceStart + delta + settleWait,
                    finish: m.finish + delta + settleWait,
                    trafficReserved: true
                });
                job.route.points = reservation.route.points;
                activeDefense.filter(d => d.color !== actor.color && d.until > time).forEach(d => {
                    if (delta > 0 && W.encounter(m.path, d.position, 90) != null) {
                        flag.defenseDelaySeconds = (flag.defenseDelaySeconds || 0) + delta;
                        flags[d.color][d.uid].delayCausedSeconds = (flags[d.color][d.uid].delayCausedSeconds || 0) + delta;
                        defenseLog.push({
                            defender: d.color,
                            uid: d.uid,
                            target: actor.color,
                            robot: actor.index,
                            start: time,
                            delay: delta,
                            lane: d.lane
                        });
                    }
                }
                );
            }
            function advanceDefense(actor) {
                var job = actor.job
                  , r = robots[actor.color][actor.index]
                  , a = job.a;
                r.position = job.dest.slice();
                if (job.stage === 'defenseApproach') {
                    // Never move into / trap an already present opponent. An occupied
                    // station is an unsuccessful attempt, still costing the defender time.
                    job.defenseSkipped = robots[opposite(actor.color)].some(other => other.active && W.distance(W.robotPosition(other, time), job.dest) < 110);
                    if (!job.defenseSkipped)
                        activeDefense.push({
                            uid: a.uid,
                            color: actor.color,
                            lane: a.lane || 0,
                            position: job.dest.slice(),
                            until: time + job.holdSeconds
                        });
                    job.stage = 'defenseHold';
                    job.finish = time + job.holdSeconds;
                    r.motion = {
                        path: [job.dest, job.dest],
                        start: time,
                        arrival: time,
                        serviceStart: time,
                        finish: job.finish,
                        action: job.defenseSkipped ? 'defenseClear' : 'defenseHold'
                    };
                    actors.forEach(applyDefense);
                } else if (job.stage === 'defenseHold') {
                    activeDefense = activeDefense.filter(d => d.uid !== a.uid);
                    var path = W.route(job.dest, job.retreat);
                    job.route.points = job.route.points.concat(path.points.slice(1));
                    job.dest = job.retreat.slice();
                    job.stage = 'defenseRetreat';
                    job.finish = time + job.retreatTravel;
                    r.motion = {
                        path: path.points,
                        start: time,
                        arrival: job.finish,
                        serviceStart: job.finish,
                        finish: job.finish,
                        action: 'defenseRetreat'
                    };
                } else if (job.stage === 'defenseRetreat') {
                    job.stage = 'defenseClear';
                    job.finish = time + 3.1;
                    r.motion = {
                        path: [job.dest, job.dest],
                        start: time,
                        arrival: time,
                        serviceStart: time,
                        finish: job.finish,
                        action: 'defenseClear'
                    };
                } else
                    return false;
                scheduleTraffic(actor);
                log({
                    kind: 'motion',
                    phase: 'teleop',
                    label: 'Lane defense · ' + ({
                        defenseHold: job.defenseSkipped ? 'position occupied — yielding' : 'holding lane',
                        defenseRetreat: 'retreating',
                        defenseClear: 'waiting clear'
                    }[job.stage]),
                    alliance: actor.color,
                    robot: actor.index
                });
                return true;
            }
            ['red', 'blue'].forEach(function(c) {
                robots[c].forEach(function(r, i) {
                    var list = [];
                    if (!r.active)
                        return;
                    (zone === 'auto' ? ['auto'] : ['teleopEarly', 'teleopLate']).forEach(function(lane) {
                        (plans[c].robots[i].zones[lane] || []).forEach(function(original) {
                            var a = Object.assign({}, original, {
                                _zone: lane,
                                _notBefore: lane === 'teleopLate' ? 98 : start
                            });
                            var count = Math.max(1, Math.min(4, a.quantity || 1));
                            if (R.ACTIONS[a.type].collects || a.type.indexOf('hive') === 0) {
                                for (var k = 0; k < count; k++)
                                    list.push(Object.assign({}, a, {
                                        quantity: 1,
                                        _shotSeconds: settings.volleySeconds / count,
                                        _pickupSeconds: settings.collectSeconds / count
                                    }));
                            } else
                                list.push(a);
                        });
                    });
                    actors.push({
                        color: c,
                        index: i,
                        list: list,
                        next: 0,
                        job: null
                    });
                });
            });
            function dispatch(actor) {
                if (actor.job || actor.next >= actor.list.length)
                    return;
                if (actor.list[actor.next]._notBefore > time)
                    return;

                var a = actor.list[actor.next++]
                  , job = a.type === 'defendShooter' ? contactJob(actor, a) : buildJob(actor, a, a._zone, end);
                if (job) {
                    actor.job = job;
                    if (a.type !== 'defendShooter')
                        applyDefense(actor);
                    return;
                }
                log({
                    kind: 'action',
                    uid: a.uid,
                    type: a.type,
                    robot: actor.index,
                    alliance: actor.color,
                    zone: a._zone,
                    phase: zone === 'auto' ? 'auto' : 'teleop',
                    duration: 0,
                    fx: {
                        kind: 'blocked',
                        from: actor.index,
                        reason: 'time'
                    }
                });
                while (actor.next < actor.list.length) {
                    var later = actor.list[actor.next++];
                    flags[actor.color][later.uid] = Object.assign(flags[actor.color][later.uid] || {}, {
                        blocked: true,
                        overrun: true,
                        message: 'Not executed: an earlier action exceeded this phase’s time budget.'
                    });
                }
            }
            actors.forEach(dispatch);
            if (zone === 'auto')
                initial = capture();
            else if (recordSnapshots !== false && events.length && events[events.length - 1].time === start)
                events[events.length - 1].matchSnapshot = capture();
            var releasedAtMinute = zone === 'auto';
            while (actors.some(a => a.job) || !releasedAtMinute) {
                var next = actors.filter(a => a.job).sort( (a, b) => a.job.finish - b.job.finish || (a.job.stage === 'shoot' ? -1 : 0) - (b.job.stage === 'shoot' ? -1 : 0))[0];
                if (!releasedAtMinute && (!next || next.job.finish >= 98)) {
                    time = 98;
                    releasedAtMinute = true;
                    ['red', 'blue'].forEach(c => {
                        while (reserves[c].length)
                            release(c);
                    }
                    );
                    actors.forEach(dispatch);
                    log({
                        kind: 'boundary',
                        phase: 'teleop',
                        label: '60 seconds remain · FLOWER nectar unlocked · play continues'
                    });
                    continue;
                }
                if (!next)
                    break;
                time = next.job.finish;
                if (next.job.stage === 'contactRecover') {
                    next.job.stage = 'approach';
                    robots[next.color][next.index].position = next.job.dest.slice();
                    hiveBusy[next.color] = false;
                } else if (next.job.stage && next.job.stage.indexOf('contact') === 0 && advanceContact(next))
                    continue;
                if (next.job.stage && next.job.stage.indexOf('defense') === 0 && advanceDefense(next))
                    continue;
                if (next.job.stage === 'approach' && arriveHive(next.job)) {
                    applyDefense(next);
                    log({
                        kind: 'motion',
                        phase: zone === 'auto' ? 'auto' : 'teleop',
                        label: 'Hive approach / wait',
                        alliance: next.color,
                        robot: next.index
                    });
                    continue;
                }
                var e = complete(next.job);
                next.job = null;
                actors.forEach(dispatch);
                log(e);
            }
            time = end;
            ['red', 'blue'].forEach(function(c) {
                robots[c].forEach(function(r) {
                    r.motion = null;
                    if (zone === 'auto')
                        r.parkAuto = r.active && inZone(r.position, W.geometry[c].load);
                });
            });
            ['red', 'blue'].forEach(function(c) {
                usage[c].forEach(function(u, i) {
                    var own = events.filter(e => e.alliance === c && e.robot === i && e.start != null && e.fx.kind !== 'blocked');
                    function busy(lo, hi) {
                        return own.reduce( (n, e) => n + Math.max(0, Math.min(hi, e.time) - Math.max(lo, e.start)), 0);
                    }
                    if (zone === 'auto')
                        u.auto = busy(0, 30);
                    else {
                        u.teleopEarly = busy(38, 98);
                        u.teleopLate = busy(98, 158);
                        u.teleop = u.teleopEarly + u.teleopLate;
                    }
                });
            });
        }
        runPhase('auto', 0, 30);
        log({
            kind: 'boundary',
            phase: 'auto',
            label: 'AUTO complete · 8-second transition'
        });
        time = 38;
        log({
            kind: 'boundary',
            phase: 'teleop',
            label: 'TELEOP begins'
        });
        runPhase('teleop', 38, 158);
        time = Math.max(158, ...balls.map(b => b.availableAt));
        log({
            kind: 'boundary',
            phase: 'final',
            label: 'Match complete · elements settled'
        });
        var final = capture()
          , results = {};
        ['red', 'blue'].forEach(function(c) {
            var s = final[c]
              , empty = {
                robots: [{
                    zones: {}
                }, {
                    zones: {}
                }]
            }
              , result = root.BBScoring.simulate(empty)
              , counts = result.counts;
            counts.leave = s.robots.filter(r => r.leave).length;
            counts.parkAuto = s.robots.filter(r => r.parkAuto).length;
            counts.parkTeleop = s.robots.filter(r => r.parkTeleop).length;
            counts.illegalFlowerNectar = fouls[c] / R.FOULS.MAJOR;
            counts.unavailableNectar = 0;
            counts.unstockedNectar = 0;
            counts.unstockedPollen = 0;
            var values = {
                leave: counts.leave,
                parkAuto: counts.parkAuto,
                autoTip: s.autoTips,
                parkTeleop: counts.parkTeleop,
                teleopTip: s.teleopTips,
                cell: s.cellCount,
                bottom: s.flowers.filter(f => f.bottomBonus).length,
                owned: s.flowers.reduce( (n, f) => n + (f.owned ? f.pollen + f.nectar : 0), 0),
                garden: s.garden
            };
            result.breakdown.auto.concat(result.breakdown.teleop).forEach(row => {
                row.n = values[row.key];
                row.pts = row.n * row.each;
            }
            );
            var swarm = counts.leave * P.LEAVE + counts.parkAuto * P.PARK_AUTO + counts.parkTeleop * P.PARK_TELEOP;
            result.rp.swarm.value = swarm;
            result.rp.swarm.earned = swarm >= R.RP.SWARM.threshold;
            ['pollinator1', 'pollinator2'].forEach(k => {
                result.rp[k].value = s.tips;
                result.rp[k].earned = s.tips >= result.rp[k].threshold;
            }
            );
            result.rp.outcome = s.matchTotal > final[opposite(c)].matchTotal ? 3 : s.matchTotal === final[opposite(c)].matchTotal ? 1 : 0;
            result.rp.total = result.rp.outcome + ['swarm', 'pollinator1', 'pollinator2'].filter(k => result.rp[k].earned).length;
            Object.assign(result, {
                initial: initial[c],
                final: s,
                flags: flags[c],
                autoPoints: s.liveAuto,
                teleopPoints: s.liveTeleop,
                totalPoints: s.liveAuto + s.liveTeleop,
                matchTotal: s.matchTotal,
                foulCredit: s.foulCredit,
                opponentFoulPoints: fouls[c],
                tips: s.tips,
                autoTips: s.autoTips,
                teleopTips: s.teleopTips,
                swarmPoints: swarm,
                unownedFlowerElements: s.flowers.reduce( (n, f) => n + (f.owned ? 0 : f.pollen + f.nectar), 0),
                ownedFlowers: s.flowers.filter(f => f.owned).length
            });
            results[c] = result;
        });
        return {
            initial: initial,
            final: final,
            events: events,
            results: results,
            settings: settings,
            usage: usage,
            defenseLog: defenseLog,
            duration: time
        };
    }
    root.BBMatch = {
        simulate: simulate
    };
}
)(typeof window !== 'undefined' ? window : globalThis);
