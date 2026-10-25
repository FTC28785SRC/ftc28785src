/* Phone-only presentation. Uses existing controls and restores their exact
 * positions when returning to desktop; never changes plans or simulation. */
(function(){
  'use strict';
  var media=matchMedia('(max-width: 700px)'),undo=[],created=[],observer=null,active=false;
  var $=s=>document.querySelector(s);
  function move(node,parent,before){
    if(!node)return;
    var marker=document.createComment('mobile position');node.before(marker);
    undo.push(function(){marker.replaceWith(node);});
    parent.insertBefore(node,before||null);
  }
  function fold(label,parent,before){
    var d=document.createElement('details');d.className='mobile-fold';
    var s=document.createElement('summary');s.textContent=label;d.appendChild(s);
    parent.insertBefore(d,before||null);created.push(d);return d;
  }
  function view(){
    var current=$('.workspace-nav [aria-pressed="true"]');
    document.body.dataset.mobileView=current?current.dataset.screen:'watch';
  }
  function enter(){
    if(active)return;active=true;
    var setup=fold('Match settings', $('.match-setup'),null);setup.id='mobileSettings';
    move($('.topbar-controls'),setup);move($('#modeNote'),setup);
    function label(){setup.querySelector('summary').textContent='Match settings · '+$('#playingAlliance').value.toUpperCase();}
    label();
    var update=function(){label();};document.addEventListener('change',update);undo.push(()=>document.removeEventListener('change',update));
    var board=$('.board-wrap');
    move($('.match-card'),$('#watchPanel'),board);
    var extras=fold('Field key, defense and assumptions',board,null);
    ['.field-key','.hive-readouts','.field-hint','.defense-explainer','.estimate-callout','#phaseTrack'].forEach(s=>move($(s),extras));
    var plans=fold('See the robot plans', $('.watch-summary'),null);move($('.plan-preview'),plans);
    var editor=$('#editPanel'),intro=fold('How to build a strategy',editor.querySelector('.builder-head'),editor.querySelector('.builder-head p'));
    Array.from(editor.querySelectorAll('.builder-head > p')).forEach(p=>move(p,intro));
    move($('.timing-settings'),editor,null);
    var palette=$('.palette'),add=fold('＋ Add a step',palette.parentNode,palette);add.id='mobileAddStep';move(palette,add);
    var hint=document.createElement('div');hint.className='mobile-field-tools';
    hint.innerHTML='<button type="button" class="btn" id="mobileFieldSize" aria-pressed="false">Enlarge field</button><span>Enlarge, then swipe to inspect robots.</span>';
    $('.board').before(hint);created.push(hint);
    $('#mobileFieldSize').onclick=function(){
      var large=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',String(large));this.textContent=large?'Fit whole field':'Enlarge field';$('.board').classList.toggle('mobile-enlarged',large);
      if(large)$('.board').scrollLeft=($('.board').scrollWidth-$('.board').clientWidth)/2;
    };
    function click(e){
      if(e.target.closest('.pal-card')){add.open=false;requestAnimationFrame(()=>$('#lanes').scrollIntoView({block:'start'}));}
      if(e.target.closest('.preview-edit'))add.open=false;
    }
    document.addEventListener('click',click);undo.push(()=>document.removeEventListener('click',click));
    observer=new MutationObserver(function(){
      view();
    });observer.observe($('.workspace-nav'),{subtree:true,attributes:true,attributeFilter:['aria-pressed']});view();
  }
  function leave(){
    if(!active)return;active=false;if(observer)observer.disconnect();
    undo.reverse().forEach(f=>f());undo=[];created.forEach(n=>n.remove());created=[];
    $('.board').classList.remove('mobile-enlarged');$('.board').scrollLeft=0;delete document.body.dataset.mobileView;
  }
  function sync(){if(media.matches)enter();else leave();}
  media.addEventListener('change',sync);sync();
})();
