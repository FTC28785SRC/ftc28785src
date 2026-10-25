/* Precomputed, feasible high-activity demo at BBWorld.defaults.
 * Greedy search adds full cycles, then useful partial volleys / flower claims,
 * checking all four robots after each insertion. Not a global optimum proof. */
(function(root){
  'use strict';
  var blueprint={
  "red": [
    {
      "auto": [
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["parkAuto", 1, 1, 0, "high"]
      ],
      "teleopEarly": [
        ["defendLane", 1, 1, 2, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"]
      ],
      "teleopLate": [
        ["collectNectar", 1, 1, 0, "high"],
        ["flowerNectar", 1, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["flowerPollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["parkTeleop", 1, 1, 0, "high"]
      ]
    },
    {
      "auto": [
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenFlower", 4, 4, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenFlower", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["parkAuto", 1, 1, 0, "high"]
      ],
      "teleopEarly": [
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectNectar", 4, 1, 0, "high"],
        ["hiveNectar", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"]
      ],
      "teleopLate": [
        ["collectNectar", 1, 1, 0, "high"],
        ["flowerNectar", 1, 4, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["flowerPollen", 4, 4, 0, "high"],
        ["parkTeleop", 1, 1, 0, "high"]
      ]
    }
  ],
  "blue": [
    {
      "auto": [
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenFlower", 4, 3, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["parkAuto", 1, 1, 0, "high"]
      ],
      "teleopEarly": [
        ["defendLane", 1, 1, 1, "high"]
      ],
      "teleopLate": [
        ["collectNectar", 1, 1, 0, "high"],
        ["flowerNectar", 1, 2, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["flowerPollen", 4, 2, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectNectar", 4, 1, 0, "high"],
        ["hiveNectar", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["parkTeleop", 1, 1, 0, "high"]
      ]
    },
    {
      "auto": [
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenFlower", 4, 2, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["parkAuto", 1, 1, 0, "high"]
      ],
      "teleopEarly": [
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectNectar", 4, 1, 0, "high"],
        ["hiveNectar", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["collectNectar", 4, 1, 0, "high"],
        ["hiveNectar", 4, 1, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"]
      ],
      "teleopLate": [
        ["collectNectar", 1, 1, 0, "high"],
        ["flowerNectar", 1, 3, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["flowerPollen", 4, 3, 0, "high"],
        ["collectPollenGround", 4, 1, 0, "high"],
        ["hivePollen", 4, 1, 0, "high"],
        ["parkTeleop", 1, 1, 0, "high"]
      ]
    }
  ]
};
  function create(uid){
    var plans={};
    ['red','blue'].forEach(function(c){plans[c]={alliance:c,robots:blueprint[c].map(function(lanes){
      var zones={};Object.keys(lanes).forEach(function(z){zones[z]=lanes[z].map(function(a){return {uid:uid(),type:a[0],quantity:a[1],flower:a[2],lane:a[3],defenseLevel:a[4],source:'nearest'};});});
      return {zones:zones};
    })};});return plans;
  }
  function signature(plans){return JSON.stringify(['red','blue'].map(c=>plans[c].robots.map(r=>Object.keys(r.zones).map(z=>r.zones[z].map(a=>[a.type,a.quantity,a.flower,a.source,a.lane,a.defenseLevel])))));}
  function valid(match){return ['red','blue'].every(c=>Object.values(match.results[c].flags).every(f=>!f.blocked&&!f.illegal));}
  function scoreKey(match){return ['red','blue'].map(c=>match.results[c].matchTotal).join(':');}
  // One short pass: only completely empty phase queues, four trials each.
  // The full replay still protects inventory, traffic, timing and later plans.
  async function fillEmptyPhases(plans,settings,uid,random){
    var match=root.BBMatch.simulate(plans,settings,false),attempts=0,addedCycles=0;
    var active=settings.activeRobots||['red-0','red-1','blue-0','blue-1'];
    var jobs=active.flatMap(function(id){
      var parts=id.split('-'),c=parts[0],ri=+parts[1];
      return ['auto','teleopEarly','teleopLate']
        .filter(zone=>plans[c].robots[ri].zones[zone].length===0)
        .map(zone=>({c:c,ri:ri,zone:zone,end:zone==='auto'?30:zone==='teleopEarly'?98:158}));
    });
    for(var job of jobs){
      var c=job.c,lane=plans[c].robots[job.ri].zones[job.zone];
      var park=lane.findIndex(a=>a.type.startsWith('park')),at=park<0?lane.length:park;
      var flower=1+Math.floor(random()*4);
      var choices=[
        [null,'hivePollen',4],
        ['collectPollenGround','hivePollen',4],
        ['collectPollenGround','hivePollen',2],
        job.zone==='teleopLate'?['collectNectar','flowerNectar',1]:[null,'hivePollen',2]
      ];
      for(var choice of choices){
        // Yield between trials so the generating indicator stays responsive.
        await new Promise(resolve=>setTimeout(resolve,0));
        var batch=[];
        if(choice[0])batch.push({uid:uid(),type:choice[0],quantity:choice[2],flower:flower,source:'nearest'});
        batch.push({uid:uid(),type:choice[1],quantity:choice[2],flower:flower});
        lane.splice(at,0,...batch);attempts++;
        var trial=root.BBMatch.simulate(plans,settings,false),flag=trial.results[c].flags[batch[batch.length-1].uid];
        if(valid(trial)&&flag&&flag.finish<=job.end&&trial.results[c].matchTotal>=match.results[c].matchTotal){
          match=trial;addedCycles++;break;
        }
        lane.splice(at,batch.length);
      }
    }
    return {match:match,attempts:attempts,addedCycles:addedCycles};
  }
  function defenseLayout(plans,color){
    var entries=[];if(!plans)return entries;
    plans[color].robots.forEach((r,robot)=>Object.keys(r.zones).forEach(zone=>r.zones[zone].forEach((a,index)=>{if(a.type==='defendLane'||a.type==='defendShooter')entries.push({robot:robot,zone:zone,index:index,lane:a.lane,level:a.defenseLevel});})));
    return entries;
  }
  // Only change action choices. Never randomize physics, scores, clock or supply.
  async function generate(uid,settings,previous,seed){
    seed=seed==null?Math.floor(Math.random()*4294967296):seed>>>0;
    var state=seed;
    function random(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}
    function pick(items){return items[Math.floor(random()*items.length)];}
    function copy(v){return JSON.parse(JSON.stringify(v));}
    var serial=0,base=create(()=>String(++serial)),baseline=root.BBMatch.simulate(base,settings,false);
    // For slower custom timing, remove whole collection/scoring pairs, keeping
    // inventory dependencies intact. Every candidate still gets a full replay.
    for(var repair=0;!valid(baseline)&&repair<100;repair++){
      var candidates=[];
      ['red','blue'].forEach(c=>base[c].robots.forEach(r=>Object.keys(r.zones).forEach(z=>{
        var lane=r.zones[z];
        for(var i=0;i<lane.length-1;i++)if(root.BBRules.ACTIONS[lane[i].type].collects&&root.BBRules.ACTIONS[lane[i+1].type].element&&!root.BBRules.ACTIONS[lane[i+1].type].collects)candidates.push({lane:lane,index:i});
      })));
      if(candidates.length){var remove=pick(candidates);remove.lane.splice(remove.index,2);}
      else {
        var lanes=[];['red','blue'].forEach(c=>base[c].robots.forEach(r=>Object.values(r.zones).forEach(l=>{if(l.length)lanes.push(l);})));
        if(!lanes.length)break;pick(lanes).pop();
      }
      baseline=root.BBMatch.simulate(base,settings,false);
      if(repair%8===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    var oldSignature=previous?signature(previous):'',oldScores=previous?scoreKey(root.BBMatch.simulate(previous,settings,false)):'';
    var best=null,baseSignature=signature(base);
    var defenders={};['red','blue'].forEach(c=>{var old=defenseLayout(previous,c);defenders[c]=old.length?1-old[0].robot:Math.floor(random()*2);});
    for(var attempt=0;attempt<120;attempt++){
      var candidate=copy(base),edits=1+Math.floor(random()*4),strategies={};
      ['red','blue'].forEach(function(c){
        var profile=pick(['Hive cycling','Flower focus','Nectar cycling','Cycle + lane defense']);
        var level=pick(['low','medium','high']);strategies[c]=profile+' · '+level+' defense';
        // Remove inherited assignments entirely, then rebuild this match's roles.
        var inherited=defenseLayout(candidate,c),oldRobot=inherited.length?inherited[0].robot:0;
        if(oldRobot!==defenders[c])['teleopEarly','teleopLate'].forEach(z=>{
          var swap=candidate[c].robots[oldRobot].zones[z];candidate[c].robots[oldRobot].zones[z]=candidate[c].robots[defenders[c]].zones[z];candidate[c].robots[defenders[c]].zones[z]=swap;
        });
        candidate[c].robots.forEach(rb=>Object.keys(rb.zones).forEach(z=>{rb.zones[z]=rb.zones[z].filter(a=>a.type!=='defendLane');}));
        var defenseZone=pick(['teleopEarly','teleopLate']),defenseLane=candidate[c].robots[defenders[c]].zones[defenseZone];
        var slots=[0];for(var j=0;j<defenseLane.length;j++)if(defenseLane[j].type.indexOf('hive')===0||defenseLane[j].type.indexOf('flower')===0)slots.push(j+1);
        var insert=pick(slots);
        defenseLane.splice(insert,0,{uid:String(++serial),type:'defendLane',quantity:1,flower:1,lane:pick([0,1,2,3]),defenseLevel:level});
        strategies[c]+=' · Robot '+(defenders[c]+1)+' · '+(defenseZone==='teleopEarly'?'first minute':'last minute');
        var r=pick(candidate[c].robots),early=r.zones.teleopEarly,late=r.zones.teleopLate;
        if(profile==='Cycle + lane defense'){
          var secondZone=defenseZone==='teleopEarly'?'teleopLate':'teleopEarly',second=candidate[c].robots[defenders[c]].zones[secondZone],slots=[0];
          for(var j=0;j<second.length;j++)if(second[j].type.indexOf('hive')===0||second[j].type.indexOf('flower')===0)slots.push(j+1);
          second.splice(pick(slots),0,{defenseLevel:pick(['low','medium','high']),uid:String(++serial),type:'defendLane',lane:pick([0,1,2,3]),quantity:1,flower:1});
          strategies[c]+=' · two defensive trips';
        }else if(profile==='Flower focus'&&late.length>=7){
          var flower=late.find(a=>a.type==='flowerNectar');
          var at=late.findIndex((a,i)=>i>3&&a.type==='hivePollen');
          if(at>0){late[at].type='flowerPollen';late[at].flower=flower?flower.flower:1;late[at-1].type='collectPollenGround';
            if(late.length>at+3)late.splice(at+1,2);
          }
        }else if(profile==='Nectar cycling'){
          var at=early.findIndex(a=>a.type==='hivePollen');
          if(at>0){early[at-1].type='collectNectar';early[at].type='hiveNectar';early[at-1].quantity=early[at].quantity=pick([2,3,4]);}
        }
      });
      for(var edit=0;edit<edits;edit++){
        var c=pick(['red','blue']),robot=pick(candidate[c].robots),zone=pick(['teleopEarly','teleopLate']),lane=robot.zones[zone];
        var pairs=[];for(var i=0;i<lane.length-1;i++)if(root.BBRules.ACTIONS[lane[i].type].collects)pairs.push(i);
        if(!pairs.length)continue;
        var at=pick(pairs),collect=lane[at],score=lane[at+1],kind=Math.floor(random()*4);
        if(score.type.indexOf('flower')===0){score.flower=1+Math.floor(random()*4);}
        else if(kind===0){var nectar=random()<.4;collect.type=nectar?'collectNectar':'collectPollenGround';score.type=nectar?'hiveNectar':'hivePollen';}
        else if(kind===1){collect.quantity=score.quantity=1+Math.floor(random()*4);}
        else if(kind===2&&pairs.length>1){var other=pick(pairs);if(other!==at){var temp=lane.slice(at,at+2);lane.splice(at,2,...lane.slice(other,other+2));lane.splice(other,2,...temp);}}
        else if(collect.type==='collectPollenGround'){collect.source=pick(['nearest','spill']);}
      }
      var sig=signature(candidate);
      if(sig===oldSignature||sig===baseSignature)continue;
      // A short defensive engagement must be followed by useful scoring before
      // the same robot can defend again. Crossing the minute marker is not a break.
      if(settings.demoDefense&&settings.demoDefense!=='lane'){
        ['red','blue'].forEach(c=>candidate[c].robots.forEach(rb=>['teleopEarly','teleopLate'].forEach(z=>{
          var lane=rb.zones[z];
          lane.slice().filter(a=>a.type==='defendLane').forEach(a=>{
            if(settings.demoDefense==='contact'||random()<.5){
              var slots=lane.map((b,i)=>b.type.indexOf('hive')===0?i:-1).filter(i=>i>=0);
              if(slots.length){lane.splice(lane.indexOf(a),1);var slot=lane.map((b,i)=>b.type.indexOf('hive')===0?i:-1).filter(i=>i>=0);lane.splice(pick(slot)+1,0,Object.assign(a,{type:'defendShooter'}));}
            }
          });
        })));
      }
      function spacedDefense(plans){return ['red','blue'].every(c=>plans[c].robots.every(r=>{
        var defended=false,scored=true;
        return r.zones.teleopEarly.concat(r.zones.teleopLate).every(a=>{
          if(a.type==='defendLane'||a.type==='defendShooter'){if(defended&&!scored)return false;defended=true;scored=false;}
          else if(root.BBRules.ACTIONS[a.type].element&&!root.BBRules.ACTIONS[a.type].collects)scored=true;
          return true;
        });
      }));}
      if(!spacedDefense(candidate))continue;
      var match=root.BBMatch.simulate(candidate,settings,false);
      // Relocating a defensive trip changes travel and shared ball availability.
      // Repair by removing whole hive cycles, never a lone intake or shot, and
      // keep defense and the flower-scoring sequence visible in the result.
      for(var repair=0;!valid(match)&&repair<10;repair++){
        var removals=[];
        ['red','blue'].forEach(c=>candidate[c].robots.forEach(rb=>['teleopEarly','teleopLate'].forEach(z=>{
          var lane=rb.zones[z],bad=lane.some(a=>(match.results[c].flags[a.uid]||{}).blocked);
          for(var j=0;j<lane.length-1;j++)if(root.BBRules.ACTIONS[lane[j].type].collects&&lane[j+1].type.indexOf('hive')===0)removals.push({lane:lane,index:j,priority:bad?1:0});
        })));
        if(!removals.length)break;
        var priority=Math.max(...removals.map(r=>r.priority)),remove=pick(removals.filter(r=>r.priority===priority));remove.lane.splice(remove.index,2);
        match=root.BBMatch.simulate(candidate,settings,false);
      }
      if(valid(match)&&spacedDefense(candidate)&&scoreKey(match)!==oldScores){
        best={plans:candidate,seed:seed,scores:scoreKey(match),strategies:strategies};break;
      }
      if(attempt%8===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    // A repaired baseline may itself be a new feasible outcome.
    // Never silently fall back to the fixed B1-first-minute assignment.
    if(!best)throw new Error('No different feasible score was found with these timing settings. Your current plans are unchanged. Try faster timing estimates or load again.');
    var originalPlans=copy(best.plans),originalScores=best.scores;
    var filled=await fillEmptyPhases(best.plans,settings,()=>String(++serial),random);
    best.scores=scoreKey(filled.match);
    best.activity={attempts:filled.attempts,addedCycles:filled.addedCycles};
    // Preserve the promise that consecutive demo scores differ.
    if(best.scores===oldScores){best.plans=originalPlans;best.scores=originalScores;best.activity.addedCycles=0;}
    ['red','blue'].forEach(c=>best.plans[c].robots.forEach(r=>Object.values(r.zones).forEach(l=>l.forEach(a=>{a.uid=uid();}))));
    return best;
  }
  async function generatePractice(uid,settings){
    var plans={};['red','blue'].forEach(c=>plans[c]={alliance:c,robots:[0,1].map(()=>({zones:{auto:[],teleopEarly:[],teleopLate:[]}}))});
    var active=settings.activeRobots,match=root.BBMatch.simulate(plans,settings,false),seed=Date.now();
    for(var zone of ['auto','teleopEarly','teleopLate']){
      for(var cycle=0;cycle<(zone==='auto'?5:14);cycle++){
        var changed=false;
        for(var id of active){
          var c=id.split('-')[0],ri=+id.split('-')[1],lane=plans[c].robots[ri].zones[zone],choices=[];
          var held=match.final[c].robots[ri];
          // Validate whole candidate queues against the shared inventory and clock.
          var types=['hivePollen','hiveNectar'];
          if(zone==='teleopLate')types.push('flowerNectar');
          for(var type of types)for(var quantity of [4,2,1]){
            var nectar=type.includes('Nectar'),have=nectar?held.heldNectar:held.heldPollen;
            var sources=have>=quantity?[null]:nectar?['collectNectar']:['collectPollenGround','collectPollenFlower'];
            for(var collect of sources)for(var flower of collect==='collectPollenFlower'||type==='flowerNectar'?[1,2,3,4]:[1]){
              var batch=[];if(collect)batch.push({uid:uid(),type:collect,quantity:quantity,flower:flower});
              batch.push({uid:uid(),type:type,quantity:quantity,flower:flower});
              lane.push(...batch);var trial=root.BBMatch.simulate(plans,settings,false);lane.splice(lane.length-batch.length);
              if(valid(trial)&&(zone!=='teleopEarly'||trial.results[c].flags[batch[batch.length-1].uid].finish<=98)){var finish=trial.results[c].flags[batch[batch.length-1].uid].finish,score=trial.results[c].matchTotal-match.results[c].matchTotal;
                choices.push({batch:batch,match:trial,merit:score*2+quantity-finish*.04+Math.random()*3});}
            }
          }
          choices.sort((a,b)=>b.merit-a.merit);
          if(choices.length){lane.push(...choices[0].batch);match=choices[0].match;changed=true;}
        }
        if(!changed)break;
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(zone!=='teleopEarly')for(var id of active){
        var c=id.split('-')[0],ri=+id.split('-')[1],lane=plans[c].robots[ri].zones[zone];
        lane.push({uid:uid(),type:zone==='auto'?'parkAuto':'parkTeleop'});var trial=root.BBMatch.simulate(plans,settings,false);
        if(valid(trial))match=trial;else lane.pop();
      }
    }
    return {plans:plans,seed:seed,strategies:{red:'Practice cycles',blue:'Practice cycles'}};
  }
  root.BBDemo={fillEmptyPhases:fillEmptyPhases,generatePractice:generatePractice,create:create,generate:generate,signature:signature,defenseLayout:defenseLayout};
})(typeof window!=='undefined'?window:globalThis);
    