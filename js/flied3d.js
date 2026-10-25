/* Parallel 3D projection into SVG. World positions and elevations share one
 * camera. Resting poses and the tipping motion are illustrative, not CAD. */
(function(root) {
    'use strict';
    var showSpots = false;
    var svg, state, phase = 'final', view = 'angled', raf = 0, epoch = 0, angles = {}, particle;
    var C = {
        red: '#ff5775',
        blue: '#5ba4ff',
        pollen: '#ffda58'
    };
    var G = root.BBWorld.geometry;
    function el(tag, a, parent) {
        var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.keys(a || {}).forEach(function(k) {
            n.setAttribute(k, a[k]);
        });
        (parent || svg).appendChild(n);
        return n;
    }
    function project(p) {
        var x = p[0] - 600
          , y = p[1] - 600
          , z = p[2] || 0;
        return view === 'top' ? [600 + x * .86, 440 + y * .63] : [600 + x * .88 + y * .12, 490 + y * .46 - z * .88];
    }
    function points(ps) {
        return ps.map(function(p) {
            return project(p).join(',');
        }).join(' ');
    }
    function poly(ps, fill, stroke, parent, width) {
        return el('polygon', {
            points: points(ps),
            fill: fill,
            stroke: stroke || 'none',
            'stroke-width': width || 1.5,
            'stroke-linejoin': 'round'
        }, parent);
    }
    function line(ps, color, width, parent, dash) {
        return el('polyline', {
            points: points(ps),
            fill: 'none',
            stroke: color,
            'stroke-width': width || 2,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-dasharray': dash || ''
        }, parent);
    }
    function label(p, text, cls, parent, dy) {
        var q = project(p)
          , n = el('text', {
            x: q[0],
            y: q[1] + (dy || 0),
            class: 'f3-label ' + (cls || ''),
            'text-anchor': 'middle'
        }, parent);
        n.textContent = text;
        return n;
    }
    function dot(p, r, color, parent) {
        var q = project(p);
        return el('circle', {
            cx: q[0],
            cy: q[1],
            r: r,
            fill: color,
            stroke: '#101828',
            'stroke-width': 1.5
        }, parent);
    }
    function rect(x, y, w, h, z) {
        return [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]];
    }
    function box(x, y, w, h, z, height, color, parent) {
        var a = rect(x, y, w, h, z)
          , b = rect(x, y, w, h, z + height);
        poly([a[1], a[2], b[2], b[1]], '#1b304b', color, parent);
        poly([a[2], a[3], b[3], b[2]], '#20364e', color, parent);
        poly(b, color, '#c1d2ed', parent);
    }
    function floor() {
        poly([[36, 1164, -20], [1164, 1164, -20], [1164, 1164, 0], [36, 1164, 0]], '#101827', '#405372');
        poly(rect(36, 36, 1128, 1128, 0), '#18243a', '#667b9c');
        for (var i = 0; i <= 6; i++) {
            line([[36 + i * 188, 36, 1], [36 + i * 188, 1164, 1]], '#2d405b', 1);
            line([[36, 36 + i * 188, 1], [1164, 36 + i * 188, 1]], '#2d405b', 1);
            if (i < 6) {
                label([130 + i * 188, 0, 0], 'ABCDEF'[i], 'f3-axis');
            }
        }
        line([[600, 36, 2], [600, 1164, 2]], '#71839f', 2, null, '8 9');
        label([600, 1240, 0], 'AUDIENCE', 'f3-audience');
        ['red', 'blue'].forEach(function(c) {
            var l = G[c].load
              , a = G[c].garden;
            poly(rect(l[0], l[1], l[2], l[3], 2), c === 'red' ? '#55263b' : '#203f65', C[c]);
            poly(rect(a[0], a[1], a[2], a[3], 2), C[c], C[c]);
            label([l[0] + l[2] / 2, l[1] + l[3] / 2, 6], c.toUpperCase() + ' LOAD', 'f3-zone');
            label([a[0] + a[2] / 2, a[1] + (c === 'red' ? -25 : 75), 0], c.toUpperCase() + ' GARDEN · ' + state[c].garden, 'f3-zone');
        });
        line([[36, 36, 35], [1164, 36, 35], [1164, 1164, 35]], '#7188a8', 3);
    }
    function robotPosition(c, i) {
        var r = state[c].robots[i];
        return root.BBWorld.robotPosition(r, state.time || 0);
    }
    function robot(c, i) {
        if (state[c].robots[i].active === false)
            return;
        var p = robotPosition(c, i)
          , r = state[c].robots[i]
          , g = el('g', {
            'data-robot': c + '-' + (i + 1)
        });
        poly(rect(p[0] - 32, p[1] - 32, 64, 64, 1), '#0b1324', 'none', g);
        box(p[0] - 32, p[1] - 32, 64, 64, 3, 35, C[c], g);
        label([p[0], p[1], 42], (c === 'red' ? 'R' : 'B') + (i + 1), 'f3-robot-label', g, 6);
        label([p[0], p[1] + 60, 5], r.heldPollen + 'P · ' + r.heldNectar + 'N', 'f3-small', g, 9);
        var m = r.motion, t = state.time || 0, status;
        if (t >= 30 && t < 38)
            status = 'AUTO → TELEOP';
        else if (!m)
            status = r.parkAuto && t < 30 || r.parkTeleop && t >= 38 ? 'PARKED' : 'QUEUE COMPLETE';
        else if ((m.waits || []).some(w => t >= w.start && t < w.start + w.duration))
            status = 'YIELDING TO DEFENSE';
        else if (m.action === 'contactPush')
            status = 'BRIEF PUSH';
        else if (m.action === 'displacedAim')
            status = 'DISPLACED / RE-AIMING';
        else if (m.action === 'contactApproach')
            status = 'APPROACHING SHOOTER';
        else if (m.action === 'defenseHold')
            status = 'BLOCKING ROUTE';
        else if (m.action === 'defenseClear')
            status = 'CLEARANCE WAIT';
        else if (m.action === 'defenseRetreat')
            status = 'RETREATING';
        else if (t < m.start)
            status = 'WAITING FOR TRAFFIC';
        else if (t < m.arrival)
            status = 'DRIVING';
        else if (m.action === 'waitHive')
            status = 'HIVE WAIT';
        else if (t < m.serviceStart)
            status = 'SETTLING WAIT';
        else if (m.action.indexOf('collect') === 0)
            status = 'COLLECTING';
        else if (m.action.indexOf('flower') === 0)
            status = 'FILLING FLOWER';
        else if (m.action.indexOf('hive') === 0)
            status = 'SHOOTING';
        else
            status = 'POSITIONING';
        g.setAttribute('data-status', status);
        el('title', {}, g).textContent = status;
        label([p[0], p[1] + 88, 5], status, 'f3-small', g, 11);
    }
    function flower(i) {
        var p = G.flowers[i]
          , f = state.flowers[i]
          , col = f.owner ? C[f.owner] : '#92a1b8'
          , g = el('g', {
            'data-flower': i + 1
        })
          , z = view === 'top' ? 0 : 100;
        [-19, 19].forEach(function(dx) {
            line([[p[0] + dx, p[1], 0], [p[0] + dx, p[1], z]], col, 3, g);
        });
        var q = project([p[0], p[1], z]);
        el('ellipse', {
            cx: q[0],
            cy: q[1],
            rx: 25,
            ry: 12,
            fill: '#0d192a',
            stroke: col,
            'stroke-width': 4
        }, g);
        for (var k = 0; k < Math.min(4, f.stack.length); k++) {
            var e = f.stack[k];
            dot([p[0], p[1], 18 + k * 19], 6, e.element === 'pollen' ? C.pollen : C[e.alliance], g);
        }
        label([p[0], p[1], z + 30], 'F' + (i + 1) + ' · ' + (f.pollen + f.nectar), 'f3-flower-label', g);
    }
    // One transform defines both the visible basket and the launch destination.
    // A stays on the far half; B stays on the audience half. The rocker changes
    // between -30 and +30 degrees instead of swapping cells through a half-turn.
    function restAngle(snapshot) {
        return snapshot.cellUp ? 30 : -30;
    }
    function rotateX(p, degrees) {
        var r = degrees * Math.PI / 180;
        return [p[0], p[1] * Math.cos(r) - p[2] * Math.sin(r), p[1] * Math.sin(r) + p[2] * Math.cos(r)];
    }
    function cellPoint(color, index, local, angle) {
        var sign = index === 0 ? -1 : 1;
        var cup = rotateX(local, -sign * 60);
        cup[1] += sign * 110;
        var world = rotateX(cup, angle)
          , pivot = G[color].hive;
        return world.map(function(v, i) {
            return v + pivot[i];
        });
    }
    function receivingPoint(color, snapshot) {
        return cellPoint(color, snapshot.cellUp, [0, 0, 35], restAngle(snapshot));
    }
    function hiveStand() {
        // One frame supports both independent pivots (manual section 9.6.1).
        var red = G.red.hive
          , blue = G.blue.hive
          , stand = G.hiveStand
          , left = stand.supports[0]
          , right = stand.supports[1];
        var y = stand.y
          , z = stand.height
          , depth = stand.halfDepth;
        var group = el('g', {
            'data-hive-stand': 'shared',
            'aria-label': 'One shared frame supporting the red and blue hives'
        });
        el('title', {}, group).textContent = 'Shared hive stand: two triangular supports joined by one crossbar';
        [left, right].forEach(function(x) {
            line([[x, y - depth, 4], [x, y + depth, 4]], '#647897', 7, group);
            line([[x, y - depth, 4], [x, y, z], [x, y + depth, 4]], '#a4b5ca', 5, group);
        });
        line([[left, y, z], [right, y, z]], '#d1dceb', 7, group);
        [red, blue].forEach(function(h) {
            dot(h, 6, '#d1dceb', group);
        });
    }
    function hive(c) {
        var h = G[c].hive
          , s = state[c]
          , col = C[c]
          , group = el('g', {
            'data-hive': c,
            class: 'f3-hive',
            'aria-label': c + ' hive, cell ' + (s.cellUp ? 'B' : 'A') + ' up, ' + s.tips + ' tips'
        });
        var tiltSeconds = state.settings ? state.settings.tiltSeconds : 4;
        var tipping = s.lastTipTime != null && state.time < s.lastTipTime + tiltSeconds;
        var progress = tipping ? Math.max(0, (state.time - s.lastTipTime) / tiltSeconds) : 1;
        var angle = tipping ? -restAngle(s) + 2 * restAngle(s) * progress : restAngle(s)
          , rad = angle * Math.PI / 180;
        if (tipping)
            group.setAttribute('aria-label', c + ' hive tipping; wait for the other cell');
        function rot(p) {
            return [h[0] + p[0], h[1] + p[1] * Math.cos(rad) - p[2] * Math.sin(rad), h[2] + p[1] * Math.sin(rad) + p[2] * Math.cos(rad)];
        }
        if (view === 'top') {
            [0, 1].forEach(function(index) {
                var active = index === s.cellUp && !tipping;
                var center = cellPoint(c, index, [0, 0, 35], restAngle(s));
                var shape = poly(rect(center[0] - 65, center[1] - 50, 130, 100, 0), active ? '#364553' : '#17263a', active ? C.pollen : col, group, 3);
                shape.setAttribute('data-cell', index ? 'B' : 'A');
                shape.setAttribute('data-active', active);
                label(center, (index ? 'B' : 'A') + (active ? ' ↑ ' + s.cellCount : ''), 'f3-cell-text', group, 7);
            });
        } else {
            line([rot([0, -110, 0]), rot([0, 110, 0])], col, 10, group);
            [0, 1].forEach(function(index) {
                var active = index === s.cellUp && !tipping;
                var cell = el('g', {
                    'data-cell': index ? 'B' : 'A',
                    'data-active': active
                }, group);
                function cp(p) {
                    return cellPoint(c, index, p, angle);
                }
                var rim = [[-72, -50, 35], [72, -50, 35], [72, 50, 35], [-72, 50, 35]];
                var bottom = [[-58, -36, -40], [58, -36, -40], [58, 36, -40], [-58, 36, -40]];
                poly(bottom.map(cp), '#162941', col, cell);
                for (var j = 0; j < 4; j++) {
                    var next = (j + 1) % 4;
                    poly([bottom[j], bottom[next], rim[next], rim[j]].map(cp), j % 2 ? '#20384fb8' : '#132b45cc', col, cell);
                    for (var mesh = 1; mesh < 4; mesh++) {
                        var t = mesh / 4;
                        line([bottom[j].map(function(v, k) {
                            return v + (bottom[next][k] - v) * t;
                        }), rim[j].map(function(v, k) {
                            return v + (rim[next][k] - v) * t;
                        })].map(cp), col, .8, cell);
                    }
                }
                if (active) {
                    for (var n = 0; n < Math.min(s.cellCount, 6); n++) {
                        dot(cp([-36 + (n % 3) * 32, -16 + Math.floor(n / 3) * 27, 24]), 7, n < (s.cellNectar || 0) ? col : C.pollen, cell);
                    }
                }
                line(rim.concat([rim[0]]).map(cp), active ? C.pollen : col, active ? 4 : 2, cell);
                label(cp([0, 0, 40]), (index ? 'B' : 'A') + (active ? ' · ' + s.cellCount : ''), 'f3-cell-text', cell, 4);
            });
            dot(h, 6, '#edf3ff', group);
        }
        label([h[0], h[1] + 210, 0], c.toUpperCase() + ' HIVE', 'f3-hive-title', group);
        label([h[0], h[1] + 252, 0], s.tips + ' TIPS · ' + s.fill + '/40', 'f3-small', group);
    }
    function draw() {
        if (!svg || !state) {
            return;
        }
        svg.replaceChildren();
        el('title', {}).textContent = 'BIOBUZZ match · ' + (view === 'top' ? 'overhead' : 'angled 3D schematic');
        floor();
        if (showSpots)
            root.BBWorld.defenseSpots.forEach(function(p, i) {
                poly(rect(p[0] - 40, p[1] - 40, 80, 80, 2), '#ffda5830', '#ffda58');
                label([p[0], p[1] - 50, 4], 'BLOCK SPOT ' + (i + 1), 'f3-small');
            });
        var explanation = document.getElementById('fieldExplanation')
          , holding = (state.defense || []).filter(d => d.until > state.time);
        var pushing = ['red', 'blue'].flatMap(c => state[c].robots.map( (r, i) => ({
            c: c,
            r: r,
            i: i
        }))).find(o => o.r.motion && o.r.motion.action === 'contactPush');
        if (explanation)
            explanation.textContent = pushing ? pushing.c.toUpperCase() + ' ' + (pushing.i + 1) + ' is making a brief push. The opponent must reposition and aim again; the defender will retreat.' : holding.length ? holding.map(d => d.color.toUpperCase() + ' is blocking an open driving route for ' + Math.max(0, d.until - state.time).toFixed(1) + ' more seconds. Opponents may detour or wait.').join(' ') : 'No route is being blocked right now. A gold circle appears only during an active block; driving there and retreating are separate steps.';
        holding.forEach(function(d) {
            var c = d.color === 'red' ? 'blue' : 'red';
            state[c].robots.forEach(function(r, i) {
                if (r.motion && r.motion.arrival > state.time) {
                    line(r.motion.path, C[c], 3, null, '8 6');
                    label(r.motion.path[0], c.toUpperCase() + ' ' + (i + 1) + ' ROUTE', 'f3-small');
                }
            });
        });
        (state.defense || []).filter(d => d.until > state.time).forEach(function(d) {
            var p = d.position;
            var ring = poly(Array.from({
                length: 24
            }, (_, i) => [p[0] + 90 * Math.cos(i * Math.PI / 12), p[1] + 90 * Math.sin(i * Math.PI / 12), 2]), '#ffcc3330', '#ffcc33', null, 2);
            ring.setAttribute('data-defense', d.color);
            label([p[0], p[1] - 105, 4], 'BLOCKING ROUTE', 'f3-small');
        });
        (state.balls || []).forEach(function(b) {
            if (b.releasedAt != null && state.time < b.releasedAt)
                return;
            var pos = root.BBWorld.ballPosition(b, state.time || 0);
            var mark = dot(pos, b.element === 'nectar' ? 8 : 6, b.element === 'nectar' ? C[b.alliance] : C.pollen);
            mark.setAttribute('data-ball', b.id);
            mark.setAttribute('data-source', b.source);
        });
        var objects = [];
        G.flowers.forEach(function(p, i) {
            objects.push({
                y: p[1],
                fn: function() {
                    flower(i);
                }
            });
        });
        ['red', 'blue'].forEach(function(c) {
            [0, 1].forEach(function(i) {
                objects.push({
                    y: robotPosition(c, i)[1],
                    fn: function() {
                        robot(c, i);
                    }
                });
            });
        });
        objects.sort(function(a, b) {
            return a.y - b.y;
        });
        objects.filter(function(o) {
            return o.y < 600;
        }).forEach(function(o) {
            o.fn();
        });
        hiveStand();
        hive('red');
        hive('blue');
        objects.filter(function(o) {
            return o.y >= 600;
        }).forEach(function(o) {
            o.fn();
        });
        if (particle) {
            dot(particle.p, 9, particle.color);
        }
    }
    function clearFx() {
        epoch++;
        cancelAnimationFrame(raf);
        raf = 0;
        angles = {};
        particle = null;
    }
    function renderMatch(s, p) {
        state = s;
        phase = p || 'final';
        draw();
    }
    function setView(v) {
        clearFx();
        view = v === 'top' ? 'top' : v === 'hives' ? 'hives' : 'angled';
        svg.setAttribute('viewBox', view === 'hives' ? '340 0 520 650' : '-50 0 1300 880');
        svg.style.aspectRatio = view === 'hives' ? '520 / 650' : '1300 / 880';
        document.getElementById('viewHives').setAttribute('aria-pressed', view === 'hives');
        document.getElementById('viewAngled').setAttribute('aria-pressed', view === 'angled');
        document.getElementById('viewTop').setAttribute('aria-pressed', view === 'top');
        draw();
    }
    function playEvent(ev, p, speed, onFrame, onComplete) {
        clearFx();
        if (!ev || !ev.matchSnapshot)
            return 0;
        var old = state
          , fromTime = old.time || 0
          , toTime = ev.time || 0;
        var duration = Math.max(0, toTime - fromTime) * 1000 / (speed || 1);
        var token = epoch
          , start = performance.now();
        if (root.matchMedia('(prefers-reduced-motion: reduce)').matches || duration < 1) {
            renderMatch(ev.matchSnapshot, p);
            if (onFrame)
                onFrame(toTime);
            if (onComplete)
                onComplete();
            return duration;
        }
        function frame(now) {
            if (token !== epoch)
                return;
            var f = Math.min(1, (now - start) / duration)
              , t = fromTime + (toTime - fromTime) * f;
            state = Object.assign({}, old, {
                time: t
            });
            phase = p;
            draw();
            // Show all four robots' actions at their own scheduled times.
            ['red', 'blue'].forEach(function(c) {
                old[c].robots.forEach(function(r, i) {
                    var m = r.motion;
                    if (!m || t < m.serviceStart || t > m.finish)
                        return;
                    var kind = m.action
                      , from = robotPosition(c, i).slice();
                    from[2] = 42;
                    var target = null
                      , flight = Math.min(.6, m.finish - m.serviceStart);
                    if (kind.indexOf('hive') === 0)
                        target = receivingPoint(c, old[c]);
                    else if (kind.indexOf('flower') === 0) {
                        target = G.flowers[(m.flower || 1) - 1].slice();
                        target[2] = 100;
                        flight = .3;
                    } else if (kind.indexOf('collect') === 0 && m.sourcePoint) {
                        target = from;
                        from = m.sourcePoint;
                        flight = Math.min(.35, m.finish - m.serviceStart);
                    }
                    if (!target)
                        return;
                    var qty = kind.indexOf('collect') === 0 ? 1 : m.quantity || 1;
                    for (var ball = 0; ball < qty; ball++) {
                        var launch = qty === 1 ? m.finish - flight : m.serviceStart + ball * (m.finish - m.serviceStart - flight) / (qty - 1);
                        var dt = t - launch;
                        if (dt < 0 || dt > flight)
                            continue;
                        var k = dt / flight
                          , point = from.map(function(v, axis) {
                            return v + (target[axis] - v) * k;
                        });
                        if (kind.indexOf('hive') === 0)
                            point[2] += .5 * 386.09 * root.BBWorld.scale * dt * (flight - dt);
                        var projectile = dot(point, m.element === 'nectar' ? 8 : 6, m.element === 'nectar' ? C[c] : C.pollen);
                        projectile.setAttribute('data-projectile', c);
                    }
                });
            });
            if (onFrame)
                onFrame(t);
            if (f < 1)
                raf = requestAnimationFrame(frame);
            else {
                renderMatch(ev.matchSnapshot, p);
                if (onComplete)
                    onComplete();
            }
        }
        raf = requestAnimationFrame(frame);
        return duration;
    }
    root.BBField = {
        showDefenseSpots: function(value) {
            showSpots = value;
            draw();
        },
        mount: function(n) {
            svg = n;
            svg.setAttribute('viewBox', '-50 0 1300 880');
            svg.setAttribute('role', 'img');
        },
        setAlliance: function() {
            clearFx();
            draw();
        },
        renderMatch: renderMatch,
        playEvent: playEvent,
        clearFx: clearFx,
        setView: setView,
        geometry: G,
        receivingPoint: receivingPoint
    };
}
)(typeof window !== 'undefined' ? window : globalThis);
