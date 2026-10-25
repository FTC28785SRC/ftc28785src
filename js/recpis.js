/* Recipe blocks expand to ordinary actions; the existing simulator remains authoritative. */
(function(root) {
    'use strict';
    var $ = s => document.querySelector(s)
      , R = root.BBRules
      , serial = 0
      , drag = null;
    var library = [{
        id: 'opening',
        name: 'Opening volley',
        quantity: 4,
        note: 'Leave the wall and shoot your four preloaded pollen.',
        steps: ['leave', 'hivePollen']
    }, {
        id: 'ground',
        name: 'Ground-to-hive cycle',
        note: 'Collect available floor pollen, travel to the hive, then shoot.',
        steps: ['collectPollenGround', 'hivePollen']
    }, {
        id: 'spill',
        name: 'Recycle hive spills',
        note: 'Collect settled pollen from a tipped hive and shoot it back. Needs available spills.',
        steps: ['collectPollenGround', 'hivePollen'],
        source: 'spill'
    }, {
        id: 'flowerHive',
        name: 'Flower-to-hive cycle',
        note: 'Take accessible pollen from the chosen flower bottom, then shoot into the hive.',
        steps: ['collectPollenFlower', 'hivePollen']
    }, {
        id: 'nectarHive',
        name: 'Nectar-to-hive cycle',
        note: 'Collect released nectar of your alliance and shoot. Needs available nectar.',
        steps: ['collectNectar', 'hiveNectar']
    }, {
        id: 'claim',
        name: 'Claim a flower',
        note: 'Collect one available alliance nectar and place it in the chosen flower. Last minute only.',
        steps: ['collectNectar', 'flowerNectar'],
        quantity: 1
    }, {
        id: 'fill',
        name: 'Fill a flower with pollen',
        note: 'Collect floor pollen and fill the chosen flower. Scoring depends on ownership.',
        steps: ['collectPollenGround', 'flowerPollen']
    }, {
        id: 'disrupt',
        name: 'Score, disrupt, retreat',
        note: 'Collect pollen, shoot, then attempt a brief push while an opponent shoots. TELEOP only; the attempt may be skipped.',
        steps: ['collectPollenGround', 'hivePollen', 'defendShooter']
    }, {
        id: 'autoPark',
        name: 'Finish AUTO parked',
        note: 'Put this after your AUTO cycles. Travel time still counts.',
        steps: ['parkAuto']
    }, {
        id: 'park',
        name: 'Finish the match parked',
        note: 'Put this at the end of the last driver minute.',
        steps: ['parkTeleop'],
        last: true
    }];
    library.forEach(b => {
        b.category = ['opening', 'autoPark', 'park'].includes(b.id) ? 'Opening & finish' : ['claim', 'fill'].includes(b.id) ? 'Flower control' : b.id === 'disrupt' ? 'Defense' : 'Hive cycles';
    }
    );
    library.push({
        id: 'heldPollen',
        category: 'Opening & finish',
        name: 'Shoot held pollen',
        note: 'Shoot pollen already carried. No collection; useful after a partial cycle.',
        steps: ['hivePollen']
    }, {
        id: 'spillNectar',
        category: 'Recovery & supply',
        name: 'Recover spilled nectar',
        note: 'Collect your alliance nectar from settled hive spills and shoot it back.',
        steps: ['collectNectar', 'hiveNectar'],
        source: 'spill'
    }, {
        id: 'loadingHive',
        category: 'Recovery & supply',
        name: 'Loading-zone nectar cycle',
        note: 'Collect released nectar from the loading zone and shoot at the hive.',
        steps: ['collectNectar', 'hiveNectar'],
        source: 'loading'
    }, {
        id: 'spillFlower',
        category: 'Recovery & supply',
        name: 'Send spilled pollen to a flower',
        note: 'Recover settled hive pollen and place it in your selected flower.',
        steps: ['collectPollenGround', 'flowerPollen'],
        source: 'spill'
    }, {
        id: 'spillClaim',
        category: 'Recovery & supply',
        name: 'Claim with recovered nectar',
        note: 'Use one settled alliance nectar from a hive spill to claim the chosen flower. Last minute only.',
        steps: ['collectNectar', 'flowerNectar'],
        source: 'spill',
        quantity: 1
    }, {
        id: 'claimFill',
        category: 'Flower control',
        name: 'Claim, then fill',
        note: 'Place one alliance nectar, then collect floor pollen and fill that flower. Last minute only; ownership may change later.',
        steps: [{
            type: 'collectNectar',
            quantity: 1
        }, {
            type: 'flowerNectar',
            quantity: 1
        }, 'collectPollenGround', 'flowerPollen']
    }, {
        id: 'fillClaim',
        category: 'Flower control',
        name: 'Fill, then secure ownership',
        note: 'Place floor pollen first, then put one alliance nectar on top. Last minute only.',
        steps: ['collectPollenGround', 'flowerPollen', {
            type: 'collectNectar',
            quantity: 1
        }, {
            type: 'flowerNectar',
            quantity: 1
        }]
    }, {
        id: 'twoClaims',
        category: 'Flower control',
        name: 'Claim two neighboring flowers',
        note: 'Collect and place one nectar in the chosen flower, then repeat at the next numbered flower. Last minute only.',
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
        category: 'Flower control',
        name: 'Transfer flower pollen',
        note: 'Take accessible pollen from the selected flower bottom and fill the next numbered flower. Check ownership before using it.',
        steps: ['collectPollenFlower', {
            type: 'flowerPollen',
            nextFlower: true
        }]
    }, {
        id: 'alternating',
        category: 'Mixed scoring',
        name: 'Alternate pollen and nectar hive cycles',
        note: 'Run a floor-pollen cycle, then a released-nectar cycle. Resource availability still limits both.',
        steps: ['collectPollenGround', 'hivePollen', 'collectNectar', 'hiveNectar']
    }, {
        id: 'hiveFlower',
        category: 'Mixed scoring',
        name: 'Hive first, then flower',
        note: 'Shoot a floor-pollen batch at the hive, then collect another batch for the selected flower.',
        steps: ['collectPollenGround', 'hivePollen', 'collectPollenGround', 'flowerPollen']
    }, {
        id: 'flowerHiveClaim',
        category: 'Mixed scoring',
        name: 'Empty flower, score hive, claim flower',
        note: 'Shoot accessible flower pollen into the hive, then place one released nectar in that flower. Last minute only.',
        steps: ['collectPollenFlower', 'hivePollen', {
            type: 'collectNectar',
            quantity: 1
        }, {
            type: 'flowerNectar',
            quantity: 1
        }]
    }, {
        id: 'lightBlock',
        category: 'Defense',
        name: 'Score, briefly block a route',
        note: 'Complete a pollen hive cycle, hold a transit spot for about one second, then retreat. TELEOP only.',
        steps: ['collectPollenGround', 'hivePollen', {
            type: 'defendLane',
            defenseLevel: 'low',
            lane: 0
        }]
    }, {
        id: 'strongBlock',
        category: 'Defense',
        name: 'Score, contest a route',
        note: 'Complete a pollen hive cycle, hold a transit spot for at most two seconds, then retreat. TELEOP only.',
        steps: ['collectPollenGround', 'hivePollen', {
            type: 'defendLane',
            defenseLevel: 'high',
            lane: 2
        }]
    }, {
        id: 'disruptRecover',
        category: 'Defense',
        name: 'Disrupt, then resume scoring',
        note: 'Shoot a collected pollen batch, attempt a brief shooting disruption, retreat, then run another pollen cycle. TELEOP only.',
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
            throw Error('Unknown block');
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
    host.innerHTML = '<h2 id="recipeTitle">Build a strategy recipe</h2><p>Choose the alliance, robot and phase above. Add complete blocks below, arrange their order, then test the match. Each robot has its own recipe.</p><div class="recipe-options"><label>Block family <select id="recipeCategory"><option value="all">All block types</option>' + ['Opening & finish', 'Hive cycles', 'Recovery & supply', 'Flower control', 'Mixed scoring', 'Defense'].map(c => '<option>' + c + '</option>').join('') + ' </select></label><label>Cycles to add <select id="recipeRepeat">' + [1, 2, 3, 4, 5, 6].map(n => '<option>' + n + '</option>').join('') + '</select></label><label>Balls per cycle <select id="recipeQuantity">' + [4, 3, 2, 1].map(n => '<option>' + n + '</option>').join('') + '</select></label><label>Flower target <select id="recipeFlower">' + [1, 2, 3, 4].map(n => '<option value="' + n + '">Flower ' + n + '</option>').join('') + '</select></label></div><p class="fine">Travel is included automatically. Blocks request up to the selected ball count; resources and the four-ball capacity still apply. Claim a flower uses one nectar. Opening and parking blocks are added once.</p><div class="recipe-workspace"><section class="recipe-shelf" aria-labelledby="recipeShelfTitle"><h3 id="recipeShelfTitle">Reusable blocks</h3><p id="recipeCatalogHint" class="fine"></p><div class="recipe-library" id="recipeLibrary" tabindex="0" aria-label="Reusable block library"></div></section><section class="recipe-canvas" aria-labelledby="recipeContext"><h3 id="recipeContext"></h3><div class="recipe-tools"><button type="button" class="btn" id="recipeClearRobot">Clear robot recipe</button></div><p class="fine">Clear robot recipe removes this robot&#39;s AUTO and both TELEOP phases. Uploaded files stay available.</p><p>Drag a block here to append it, or drop it on a recipe block to insert before it. Use Move up and Move down on a phone or keyboard.</p><ol id="recipeList" class="recipe-list"></ol><p id="recipeFeedback" role="status"></p><button class="btn btn-primary" id="recipeTest">Test full match</button> <button class="btn" id="recipeDetails" aria-expanded="false">Show individual actions</button></section></div>';
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
        commit(next, 'Added ' + count + ' ' + b.name + ' block' + (count === 1 ? '' : 's') + '. Review warnings before trusting the score.');
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
        commit(list.flatMap(g => g.actions), 'Recipe updated. All four robot plans are re-simulated.');
    }
    function render() {
        $('#recipeFeedback').textContent = '';
        var zone = $('#paletteSegment').value
          , gs = groups(actions());
        $('#recipeContext').textContent = root.BBUI._plan.alliance.toUpperCase() + ' robot ' + (Number($('#paletteRobot').value) + 1) + ' / ' + $('#paletteSegment').selectedOptions[0].text + ' / ' + gs.length + ' blocks';
        var choices = library.filter(b => available(b, zone) && ($('#recipeCategory').value === 'all' || b.category === $('#recipeCategory').value));
        $('#recipeCatalogHint').textContent = choices.length + ' blocks available for this phase and family. Scroll the library for more choices; click a block to add it.';
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
            info.textContent = g.actions.map(a => R.ACTIONS[a.type].label + (a.quantity ? ' (up to ' + a.quantity + ')' : '') + (a.flower ? ' / flower ' + a.flower : '') + (a.source === 'spill' ? ' / hive spills' : a.source === 'loading' ? ' / loading zone' : '') + (a.defenseLevel ? ' / ' + a.defenseLevel + ' defense' : '')).join(' \u2192 ');
            li.append(info);
            var flags = root.BBUI.recipeFlags || {}
              , issues = g.actions.filter(a => flags[a.uid] && (flags[a.uid].blocked || flags[a.uid].illegal || flags[a.uid].overrun || flags[a.uid].ignored));
            if (issues.length) {
                var warning = document.createElement('p');
                warning.className = 'recipe-warning';
                warning.textContent = issues.length + ' flagged action(s): ' + Array.from(new Set(issues.map(a => flags[a.uid].message || 'Check timing, inventory or rules in individual actions.'))).join(' ');
                li.append(warning);
            }
            var timing = document.createElement('p');
            timing.textContent = 'Simulated block time: ' + g.actions.reduce( (sum, a) => sum + (flags[a.uid]?.duration || 0), 0).toFixed(1) + ' s (including modeled travel and waits).';
            li.append(timing);
            var tools = document.createElement('div');
            tools.className = 'recipe-tools';
            [['up', 'Move up'], ['down', 'Move down'], ['copy', 'Repeat block'], ['delete', 'Remove']].forEach( ([act,label]) => {
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
            empty.textContent = 'Your recipe starts here. Click or drag a block above.';
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
            $('#recipeFeedback').textContent = scope === 'all' ? 'All four robot plans cleared. Add a block to start rebuilding.' : "This robot's full recipe is cleared. Add a block to start rebuilding.";
        } else
            $('#recipeFeedback').textContent = $('#status').textContent;
    }
    $('#recipeClearRobot').onclick = () => clear('robot');
    $('#recipeDetails').onclick = function() {
        detailed.hidden = !detailed.hidden;
        this.setAttribute('aria-expanded', String(!detailed.hidden));
        this.textContent = detailed.hidden ? 'Show individual actions' : 'Hide individual actions';
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
