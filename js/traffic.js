/* Solid 64x64 robot bodies, with 4 world units of planning clearance.
 * Reservations use continuous relative motion, not frame-by-frame sampling. */
(function(root){
  'use strict';
  var W=root.BBWorld,GAP=68;
  function breaks(r,start,end){
    var m=r.motion,result=[start,end];if(!m)return result;
    result.push(m.start,m.arrival);
    var path=m.path,total=path.slice(1).reduce((n,p,i)=>n+W.distance(path[i],p),0),walked=0;
    var waits=m.waits||[],duration=m.arrival-m.start-waits.reduce((n,w)=>n+w.duration,0);
    for(var i=1;i<path.length;i++){walked+=W.distance(path[i-1],path[i]);var t=m.start+duration*walked/Math.max(.001,total);waits.forEach(w=>{if(w.start<=t)t+=w.duration;});result.push(t);}
    waits.forEach(w=>result.push(w.start,w.start+w.duration));
    return result.filter(t=>t>=start&&t<=end);
  }
  function conflict(a,b,start,end,gap){
    var GAP=gap||68;
    var times=Array.from(new Set(breaks(a,start,end).concat(breaks(b,start,end)))).sort((a,b)=>a-b);
    for(var i=1;i<times.length;i++){
      var t=times[i-1],u=times[i],ap=W.robotPosition(a,t),bp=W.robotPosition(b,t),aq=W.robotPosition(a,u),bq=W.robotPosition(b,u),lo=0,hi=1;
      for(var axis=0;axis<2;axis++){
        var d=ap[axis]-bp[axis],v=aq[axis]-bq[axis]-d;
        if(Math.abs(v)<1e-9){if(Math.abs(d)>=GAP-.01){hi=-1;break;}}
        else{var x=(-GAP+.01-d)/v,y=(GAP-.01-d)/v;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}
      }
      if(lo<hi)return true;
    }return false;
  }
  function reserve(robot,dest,others,time,rate,service,end,canOffset){
    var current=W.robotPosition(robot,time),targets=[dest],offsets=[[-72,0],[72,0],[0,-72],[0,72],[-72,-72],[72,72],[-72,72],[72,-72]];
    if(canOffset)offsets.forEach(o=>targets.push([Math.max(70,Math.min(1130,dest[0]+o[0])),Math.max(70,Math.min(1130,dest[1]+o[1])),0]));
    var blocks=others.map(r=>{var p=W.robotPosition(r,time);return [p[0]-GAP,p[1]-GAP,p[0]+GAP,p[1]+GAP];});
    var stops=others.map(r=>{var p=r.motion?r.motion.path[r.motion.path.length-1]:r.position;return [p[0]-GAP,p[1]-GAP,p[0]+GAP,p[1]+GAP];});
    var options=[];
    targets.forEach(target=>{
      var routes=[W.route(current,target,blocks.concat(stops)),W.route(current,target,stops),W.route(current,target,blocks),W.route(current,target)];
      routes.filter(Boolean).forEach(route=>{
        var travel=route.inches*rate;
        for(var delay=0;time+delay+travel+service<=end+.00001;delay+=.5){
          var motion={path:route.points,start:time+delay,arrival:time+delay+travel,serviceStart:time+delay+travel,finish:time+delay+travel+service},candidate={position:current,motion:motion};
          // Check the whole remaining reservation, including both robots at rest.
          var horizon=Math.max(motion.finish,...others.map(r=>r.motion?r.motion.finish:time));
          if(others.every(r=>!conflict(candidate,r,time,horizon))){options.push({motion:motion,dest:target,travel:travel,wait:delay,route:route});break;}
          if(delay>=8)break; // A long obstruction is flagged, never driven through.
        }
      });
    });
    return options.sort((a,b)=>a.motion.finish-b.motion.finish)[0]||null;
  }
  root.BBTraffic={reserve:reserve,conflict:conflict,gap:GAP};
})(typeof window!=='undefined'?window:globalThis);
