const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const mapCanvas=document.querySelector('#map'),mctx=mapCanvas.getContext('2d');
ctx.imageSmoothingEnabled=false;mctx.imageSmoothingEnabled=false;
const W=960,H=600,T=40,COLS=60,ROWS=40;
const BALANCE={oilDrain:2.2,lightBase:60,lightScale:1.8,enemyContactDistance:28,enemyContactCooldown:1.15,dashSteps:5,dashStepDistance:16,dashHitRadius:30,dashRecharge:3,attackCooldown:.55,attackRangeBoost:20,spawnerHp:5};
const loadSprite=src=>{const image=new Image();image.src=src;return image};
const sprites={idle:loadSprite('assets/player-idle.png'),walk:loadSprite('assets/player-walk.png'),attack:loadSprite('assets/player-attack.png')};
const STAGES=[
  {name:'재의 굴',rooms:[{x:2,y:15,w:10,h:9},{x:15,y:13,w:9,h:7},{x:27,y:5,w:11,h:11},{x:27,y:23,w:11,h:11},{x:44,y:3,w:12,h:11},{x:44,y:21,w:12,h:12},{x:9,y:29,w:11,h:8}],links:[[0,1],[1,2],[1,3],[2,4],[3,5],[3,6]],rubyRooms:[1,2,4,5,6],chestRooms:[3,4],spawnerRooms:[2,3,4,6],exitRoom:5,baseEnemies:2,enemyHp:3,enemySpeed:74,enemyDamage:10,spawnInterval:50,spawnHp:4,spawnSpeed:90},
  {name:'갈라진 묘역',rooms:[{x:3,y:16,w:9,h:8},{x:16,y:6,w:10,h:8},{x:16,y:26,w:10,h:8},{x:31,y:14,w:10,h:10},{x:45,y:4,w:11,h:8},{x:45,y:16,w:11,h:8},{x:45,y:28,w:11,h:8},{x:30,y:29,w:9,h:7}],links:[[0,1],[0,2],[1,3],[2,3],[3,4],[3,5],[3,7],[7,6]],rubyRooms:[1,2,4,6,7],chestRooms:[3,5],spawnerRooms:[1,2,4,5,6],exitRoom:5,baseEnemies:3,enemyHp:5,enemySpeed:88,enemyDamage:12,spawnInterval:42,spawnHp:6,spawnSpeed:104},
  {name:'심연의 심장',rooms:[{x:2,y:16,w:8,h:8},{x:13,y:7,w:9,h:8},{x:13,y:26,w:9,h:8},{x:26,y:3,w:10,h:8},{x:26,y:15,w:10,h:10},{x:26,y:29,w:10,h:8},{x:41,y:5,w:8,h:8},{x:41,y:17,w:8,h:8},{x:41,y:29,w:8,h:8},{x:52,y:14,w:6,h:10}],links:[[0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[3,6],[4,7],[5,8],[6,9],[7,9],[8,9]],rubyRooms:[3,5,6,8,9],chestRooms:[4,7],spawnerRooms:[1,2,3,5,6,7,8],exitRoom:9,baseEnemies:4,enemyHp:7,enemySpeed:102,enemyDamage:14,spawnInterval:35,spawnHp:8,spawnSpeed:118}
];
const keys={};let rooms=[],links=[],stageIndex=0;
let tiles=[],player,enemies,spawners,drops,rubies,objects,exit,kills,gameState='title',last=performance.now(),toastTimer=0;
const ui={hp:$('#hp-fill'),hpText:$('#hp-text'),oil:$('#oil-fill'),oilText:$('#oil-text'),stage:$('#stage-text'),ruby:$('#ruby-text'),dash:$('#dash-text'),prompt:$('#prompt'),toast:$('#toast')};
function $(q){return document.querySelector(q)}
function carve(x,y,w,h){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(i>0&&j>0&&i<COLS-1&&j<ROWS-1)tiles[j][i]=0}
function corridor(a,b){let ax=(a.x+a.w/2)|0,ay=(a.y+a.h/2)|0,bx=(b.x+b.w/2)|0,by=(b.y+b.h/2)|0;carve(Math.min(ax,bx),ay-1,Math.abs(bx-ax)+1,3);carve(bx-1,Math.min(ay,by),3,Math.abs(by-ay)+1)}
function center(r){return{x:(r.x+r.w/2)*T,y:(r.y+r.h/2)*T}}
function inputVector(){return{x:(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),y:(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)}}
function makeEnemy(x,y,hp,speed){return{x,y,hp,speed,hit:0,attackCd:0,phase:Math.random()*6.2,exposed:false}}
function currentStage(){return STAGES[stageIndex]}
function reset(){stageIndex=0;kills=0;player=null;loadStage(false)}
function loadStage(carry){
  const stage=currentStage();rooms=stage.rooms;links=stage.links;tiles=Array.from({length:ROWS},()=>Array(COLS).fill(1));rooms.forEach(r=>carve(r.x,r.y,r.w,r.h));links.forEach(([a,b])=>corridor(rooms[a],rooms[b]));
  const start=center(rooms[0]);
  if(carry){Object.assign(player,{x:start.x,y:start.y,faceX:1,faceY:0,lookLeft:false,moving:false,attack:0,attackCd:0,dashCharges:player.dashMax,dashCd:0,dashInvuln:0,dashAnim:0,flash:0})}
  else player={x:start.x,y:start.y,hp:100,oil:100,attackDamage:1,attackRange:80,faceX:1,faceY:0,lookLeft:false,moving:false,attack:0,attackCd:0,dashCharges:1,dashMax:1,dashCd:0,dashInvuln:0,dashAnim:0,flash:0};
  enemies=[];drops=[];
  rooms.forEach((r,ri)=>{if(ri===0)return;const count=stage.baseEnemies+ri%2,c=center(r),ring=Math.min(r.w,r.h)*T*.22;for(let n=0;n<count;n++){const angle=n/count*Math.PI*2+ri*.73;enemies.push(makeEnemy(c.x+Math.cos(angle)*ring,c.y+Math.sin(angle)*ring,stage.enemyHp+(ri%3===0?1:0),stage.enemySpeed+(ri%4)*4))}});
  spawners=stage.spawnerRooms.map((ri,i)=>{const r=rooms[ri],maxHp=BALANCE.spawnerHp+stageIndex*2,ox=i%2===0?2:r.w-2,oy=i%3===0?2:r.h-2;return{x:(r.x+ox)*T,y:(r.y+oy)*T,hp:maxHp,maxHp,timer:stage.spawnInterval,spawnIndex:i*2,hit:0}});
  rubies=stage.rubyRooms.map((ri,i)=>({...center(rooms[ri]),taken:false,phase:i}));
  objects=[{...center(rooms[0]),type:'altar',used:false},...stage.chestRooms.map((ri,i)=>{const r=rooms[ri];return{x:(r.x+(i%2===0?2:r.w-2))*T,y:(r.y+(i%2===0?r.h-2:2))*T,type:'chest',used:false}})];
  const exitRoom=rooms[stage.exitRoom];exit={x:(exitRoom.x+exitRoom.w-2)*T,y:(exitRoom.y+exitRoom.h/2)*T,open:false};
  updateUI();updateMapStats();drawMap();
}
function advanceStage(){stageIndex++;loadStage(true);notify(`${stageIndex+1}단계 · ${currentStage().name}`)}
function solid(x,y){const tx=Math.floor(x/T),ty=Math.floor(y/T);return tx<0||ty<0||tx>=COLS||ty>=ROWS||tiles[ty][tx]===1}
function moveBody(body,dx,dy,r=12){if(!solid(body.x+dx+Math.sign(dx)*r,body.y)&&!solid(body.x+dx,body.y-r)&&!solid(body.x+dx,body.y+r))body.x+=dx;if(!solid(body.x,body.y+dy+Math.sign(dy)*r)&&!solid(body.x-r,body.y+dy)&&!solid(body.x+r,body.y+dy))body.y+=dy}
function notify(text){ui.toast.textContent=text;ui.toast.classList.add('show');toastTimer=2.2}
function update(dt){
  if(gameState!=='play')return;
  const stage=currentStage();
  let {x:mx,y:my}=inputVector(),len=Math.hypot(mx,my);
  player.moving=len>0;if(len){mx/=len;my/=len;player.faceX=mx;player.faceY=my;if(mx<-.15)player.lookLeft=true;else if(mx>.15)player.lookLeft=false}
  const speed=player.oil<50?176:160;moveBody(player,mx*speed*dt,my*speed*dt);
  player.oil=Math.max(1,player.oil-BALANCE.oilDrain*dt);if(player.oil<20)player.hp-=dt;
  player.attack=Math.max(0,player.attack-dt);player.attackCd=Math.max(0,player.attackCd-dt);if(player.dashCharges<player.dashMax){player.dashCd=Math.max(0,player.dashCd-dt);if(player.dashCd<=0){player.dashCharges++;player.dashCd=player.dashCharges<player.dashMax?BALANCE.dashRecharge:0}}else player.dashCd=0;player.dashInvuln=Math.max(0,player.dashInvuln-dt);player.dashAnim=Math.max(0,player.dashAnim-dt);player.flash=Math.max(0,player.flash-dt);
  const radius=BALANCE.lightBase+player.oil*BALANCE.lightScale;
  enemies.forEach(e=>{
    if(e.hp<=0)return;e.hit=Math.max(0,e.hit-dt);e.attackCd=Math.max(0,e.attackCd-dt);e.phase+=dt*3;
    const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;e.exposed=d<radius;
    if(d>BALANCE.enemyContactDistance)moveBody(e,dx/d*e.speed*dt,dy/d*e.speed*dt,11);
    const contactDistance=Math.hypot(player.x-e.x,player.y-e.y);
    if(e.exposed&&contactDistance<=BALANCE.enemyContactDistance&&e.attackCd<=0&&player.dashInvuln<=0){e.attackCd=BALANCE.enemyContactCooldown;player.hp-=stage.enemyDamage;player.flash=.16}
  });
  spawners.forEach(s=>{if(s.hp<=0)return;s.hit=Math.max(0,s.hit-dt);s.timer-=dt;if(s.timer<=0){if(trySpawnEnemy(s))s.timer=stage.spawnInterval;else s.timer=1}});
  for(const r of rubies)if(!r.taken&&Math.hypot(player.x-r.x,player.y-r.y)<29){r.taken=true;notify(`루비를 손에 넣었다 — ${rubyCount()} / ${rubies.length}`);if(rubyCount()===rubies.length){exit.open=true;notify('다섯 루비가 공명한다. 출구가 열렸다!')}drawMap()}
  for(const d of drops){if(d.taken)continue;const dx=player.x-d.x,dy=player.y-d.y,dist=Math.hypot(dx,dy)||1;if(dist<100){d.x+=dx/dist*260*dt;d.y+=dy/dist*260*dt}if(dist<18){d.taken=true;player.oil=Math.min(100,player.oil+15);notify('기름 +15')}}
  if(player.hp<=0)end(false);toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show');updatePrompt();updateUI();
}
function attack(){
  if(gameState!=='play'||player.attackCd>0)return;player.attackCd=BALANCE.attackCooldown;resolveAttack();
}
function resolveAttack(){
  player.attack=.16;
  enemies.forEach(e=>{if(e.hp<=0||!e.exposed)return;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy);const dot=(dx*player.faceX+dy*player.faceY)/(d||1);if(d<player.attackRange&&dot>.45)hitEnemy(e)});
  spawners.forEach(s=>{if(s.hp<=0)return;const dx=s.x-player.x,dy=s.y-player.y,d=Math.hypot(dx,dy);const dot=(dx*player.faceX+dy*player.faceY)/(d||1);if(d<player.attackRange&&dot>.45)hitSpawner(s)});
}
function hitEnemy(e){if(e.hp<=0)return false;e.hp-=player.attackDamage;e.hit=.12;if(e.hp<=0){kills++;drops.push({x:e.x,y:e.y,taken:false,phase:Math.random()*6.2});notify('그림자가 기름으로 흩어졌다');return true}return false}
function hitSpawner(s){if(s.hp<=0)return;s.hp-=player.attackDamage;s.hit=.12;if(s.hp<=0){notify('그림자 스폰기가 무너졌다');drawMap()}}
function pointSegmentDistance(px,py,ax,ay,bx,by){const vx=bx-ax,vy=by-ay,len2=vx*vx+vy*vy;if(!len2)return Math.hypot(px-ax,py-ay);const t=Math.max(0,Math.min(1,((px-ax)*vx+(py-ay)*vy)/len2));return Math.hypot(px-(ax+vx*t),py-(ay+vy*t))}
function trySpawnEnemy(s){const stage=currentStage(),offsets=[[1,0],[.7,.7],[0,1],[-.7,.7],[-1,0],[-.7,-.7],[0,-1],[.7,-.7]];for(let i=0;i<offsets.length;i++){const index=(s.spawnIndex+i)%offsets.length,[ox,oy]=offsets[index],x=s.x+ox*52,y=s.y+oy*52;if(spawnPositionClear(x,y)){enemies.push(makeEnemy(x,y,stage.spawnHp,stage.spawnSpeed));s.spawnIndex=(index+1)%offsets.length;return true}}return false}
function spawnPositionClear(x,y){if(solid(x,y)||solid(x-12,y)||solid(x+12,y)||solid(x,y-12)||solid(x,y+12)||Math.hypot(player.x-x,player.y-y)<70)return false;if(enemies.some(e=>e.hp>0&&Math.hypot(e.x-x,e.y-y)<44))return false;if(spawners.some(s=>s.hp>0&&Math.hypot(s.x-x,s.y-y)<38))return false;return true}
function dash(){
  if(gameState!=='play'||player.dashCharges<=0)return;player.dashCharges--;if(player.dashCharges<player.dashMax&&player.dashCd<=0)player.dashCd=BALANCE.dashRecharge;let {x:dx,y:dy}=inputVector(),d=Math.hypot(dx,dy),dashKill=false;if(!d){dx=player.faceX;dy=player.faceY;d=1}dx/=d;dy/=d;player.faceX=dx;player.faceY=dy;if(dx<-.15)player.lookLeft=true;else if(dx>.15)player.lookLeft=false;const path=[{x:player.x,y:player.y}];for(let i=0;i<BALANCE.dashSteps;i++){moveBody(player,dx*BALANCE.dashStepDistance,dy*BALANCE.dashStepDistance);path.push({x:player.x,y:player.y})}enemies.forEach(e=>{if(e.hp<=0)return;for(let i=1;i<path.length;i++){if(pointSegmentDistance(e.x,e.y,path[i-1].x,path[i-1].y,path[i].x,path[i].y)<=BALANCE.dashHitRadius){if(hitEnemy(e))dashKill=true;break}}});player.dashInvuln=.4;player.dashAnim=.18;if(dashKill){player.dashCharges=Math.min(player.dashMax,player.dashCharges+1);if(player.dashCharges===player.dashMax)player.dashCd=0}notify(dashKill?'대시 처치 — 충전 1회 회복':'그림자 대시');
}
function interact(){
  if(gameState!=='play')return;const near=nearestObject();if(near&&near.dist<62){const o=near.obj;if(o.type==='altar'){player.oil=100;notify('제단의 불꽃이 랜턴을 채웠다')}else if(o.type==='chest'&&!o.used)openChest(o)}else if(exit.open&&Math.hypot(player.x-exit.x,player.y-exit.y)<70){if(stageIndex<STAGES.length-1)advanceStage();else end(true)}
}
function openChest(chest){chest.used=true;const reward=Math.floor(Math.random()*3);if(reward===0){player.attackDamage++;notify(`상자의 축복 — 공격력 +1 (현재 ${player.attackDamage})`)}else if(reward===1){player.dashMax++;player.dashCharges++;notify(`상자의 축복 — 대시 충전 +1 (최대 ${player.dashMax}회)`)}else{player.attackRange+=BALANCE.attackRangeBoost;notify(`상자의 축복 — 공격 범위 +0.5타일`)}updateMapStats()}
function nearestObject(){let best=null;for(const o of objects){if(o.type==='chest'&&o.used)continue;const dist=Math.hypot(player.x-o.x,player.y-o.y);if(!best||dist<best.dist)best={obj:o,dist}}return best}
function updatePrompt(){let text='';const n=nearestObject();if(n&&n.dist<62)text=n.obj.type==='altar'?'[ E ] 제단에서 기름 충전':'[ E ] 상자 열기';if(exit.open&&Math.hypot(player.x-exit.x,player.y-exit.y)<70)text=stageIndex<STAGES.length-1?'[ E ] 다음 단계로':'[ E ] 던전 탈출';ui.prompt.textContent=text;ui.prompt.classList.toggle('show',!!text)}
function rubyCount(){return rubies.filter(r=>r.taken).length}
function updateUI(){ui.hp.style.width=`${Math.max(0,player.hp)}%`;ui.hpText.textContent=Math.ceil(Math.max(0,player.hp));ui.oil.style.width=`${player.oil}%`;ui.oilText.textContent=`${Math.ceil(player.oil)}%`;ui.stage.textContent=`${stageIndex+1} / ${STAGES.length}`;ui.ruby.textContent=`${rubyCount()} / ${rubies.length}`;ui.dash.textContent=`${player.dashCharges} / ${player.dashMax}${player.dashCharges<player.dashMax?` · ${player.dashCd.toFixed(1)}초`:''}`;ui.oil.style.background=player.oil<20?'#d62945':player.oil<50?'#e66d27':'#f0a42b'}
function updateMapStats(){$('#map-stage').textContent=`${stageIndex+1}단계 · ${currentStage().name}`;$('#map-attack').textContent=player.attackDamage;$('#map-dashes').textContent=`${player.dashMax}회`;$('#map-range').textContent=`${(player.attackRange/T).toFixed(1)} 타일`}
function end(win){gameState=win?'win':'dead';$('#end-sigil').textContent=win?'◆':'◇';$('#end-eyebrow').textContent=win?'THE FLAME ENDURES':'THE DARK CONSUMES';$('#end-title').textContent=win?'새벽을 찾았다':'불꽃이 꺼졌다';$('#end-copy').textContent=win?`세 단계에서 ${kills}개의 그림자를 베고 던전을 탈출했다.`:`${stageIndex+1}단계의 어둠 속에서 불씨가 꺼졌다.`;$('#end-screen').classList.remove('hidden')}
function draw(){
  const camX=Math.max(0,Math.min(COLS*T-W,player.x-W/2)),camY=Math.max(0,Math.min(ROWS*T-H,player.y-H/2));
  ctx.fillStyle='#050608';ctx.fillRect(0,0,W,H);const x0=Math.floor(camX/T),y0=Math.floor(camY/T),x1=Math.min(COLS,x0+Math.ceil(W/T)+1),y1=Math.min(ROWS,y0+Math.ceil(H/T)+1);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const sx=x*T-camX,sy=y*T-camY;if(tiles[y][x]){ctx.fillStyle=(x+y)%3?'#15181d':'#181b20';ctx.fillRect(sx,sy,T,T);ctx.fillStyle='#090b0e';ctx.fillRect(sx,sy+32,T,8);ctx.fillStyle='#262a30';ctx.fillRect(sx+3,sy+3,34,3)}else{ctx.fillStyle=(x*7+y*13)%5?'#242329':'#29272c';ctx.fillRect(sx,sy,T,T);ctx.strokeStyle='#17171b';ctx.strokeRect(sx+.5,sy+.5,T-1,T-1);if((x*11+y*17)%9===0){ctx.fillStyle='#353139';ctx.fillRect(sx+7,sy+12,4,3)}}}
  const px=player.x-camX,py=player.y-camY,radius=BALANCE.lightBase+player.oil*BALANCE.lightScale;
  drawRubies(camX,camY);objects.forEach(o=>drawObject(o,camX,camY));spawners.forEach(s=>drawSpawner(s,camX,camY));if(exit.open)drawExit(camX,camY);
  drops.forEach(d=>{if(d.taken)return;const x=d.x-camX,y=d.y-camY;d.phase+=.04;ctx.fillStyle='#ffbb32';ctx.fillRect(x-5,y-5+Math.sin(d.phase)*3,10,10);ctx.fillStyle='#fff0a8';ctx.fillRect(x-2,y-7+Math.sin(d.phase)*3,4,5)});
  enemies.forEach(e=>{if(e.hp<=0||!e.exposed)return;const x=e.x-camX,y=e.y-camY;ctx.fillStyle=e.hit?'#fff2dc':'#7e3140';ctx.fillRect(x-13,y-14,26,27);ctx.fillStyle='#24131a';ctx.fillRect(x-10,y-20,20,9);ctx.fillStyle='#f6c653';ctx.fillRect(x-7,y-7,4,3);ctx.fillRect(x+3,y-7,4,3);ctx.fillStyle='#421923';ctx.fillRect(x-17,y+8,7,10);ctx.fillRect(x+10,y+8,7,10)});
  if((player.attack>0||player.dashAnim>0)&&sprites.attack.complete&&sprites.attack.naturalWidth){const mirror=player.faceX<0,w=player.attackRange*1.0133,h=w*110/128;ctx.save();ctx.translate(px,py);ctx.rotate(mirror?Math.atan2(-player.faceY,-player.faceX):Math.atan2(player.faceY,player.faceX));if(mirror)ctx.scale(-1,1);ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(sprites.attack,0,-h/2,w,h);ctx.restore()}
  drawPlayer(px,py);
  ctx.save();const shadow=ctx.createRadialGradient(px,py,22,px,py,radius);shadow.addColorStop(0,'rgba(2,3,4,0)');shadow.addColorStop(.55,'rgba(2,3,4,.06)');shadow.addColorStop(.78,'rgba(2,3,4,.5)');shadow.addColorStop(1,'rgba(2,3,4,.96)');ctx.fillStyle=shadow;ctx.fillRect(0,0,W,H);ctx.restore();
  ctx.save();ctx.globalCompositeOperation='screen';const warm=ctx.createRadialGradient(px,py,5,px,py,radius);warm.addColorStop(0,'#ffd15a7a');warm.addColorStop(.28,'#c8782435');warm.addColorStop(1,'#00000000');ctx.fillStyle=warm;ctx.fillRect(px-radius,py-radius,radius*2,radius*2);ctx.restore();
  if(player.flash>0){ctx.fillStyle='#b51e3044';ctx.fillRect(0,0,W,H)}
}
function drawPlayer(x,y){const sprite=player.moving?sprites.walk:sprites.idle;if(!sprite.complete||!sprite.naturalWidth){ctx.fillStyle='#d8d0b2';ctx.fillRect(x-10,y-22,20,35);return}ctx.save();ctx.translate(x,y);if(player.lookLeft)ctx.scale(-1,1);if(player.dashInvuln>0&&Math.floor(player.dashInvuln*30)%2)ctx.globalAlpha=.42;ctx.drawImage(sprite,-21,-44,42,57);ctx.restore()}
function drawRubies(cx,cy){rubies.forEach(r=>{if(r.taken)return;const x=r.x-cx,y=r.y-cy,b=Math.sin(performance.now()/250+r.phase)*4;ctx.fillStyle='#5d1021';ctx.fillRect(x-10,y-5+b,20,14);ctx.fillStyle='#e32e4e';ctx.fillRect(x-6,y-12+b,12,20);ctx.fillStyle='#ff8ca0';ctx.fillRect(x-2,y-9+b,4,7)})}
function drawObject(o,cx,cy){const x=o.x-cx,y=o.y-cy;if(o.type==='altar'){ctx.fillStyle='#3d3834';ctx.fillRect(x-20,y-12,40,28);ctx.fillStyle='#74634b';ctx.fillRect(x-14,y-18,28,8);ctx.fillStyle='#f0a42b';ctx.fillRect(x-5,y-29,10,13);ctx.fillStyle='#ffe499';ctx.fillRect(x-2,y-34,4,10)}else{ctx.fillStyle=o.used?'#282527':'#6e4829';ctx.fillRect(x-18,y-12,36,25);ctx.fillStyle='#b17a37';ctx.fillRect(x-18,y-4,36,5);ctx.fillRect(x-3,y-12,6,25)}}
function drawSpawner(s,cx,cy){if(s.hp<=0)return;const x=s.x-cx,y=s.y-cy,p=performance.now()/260;ctx.fillStyle=s.hit?'#fff0df':'#541929';ctx.fillRect(x-18,y-14,36,28);ctx.fillStyle='#271018';ctx.fillRect(x-12,y-22,24,8);ctx.fillRect(x-23,y-7,7,18);ctx.fillRect(x+16,y-7,7,18);ctx.fillStyle='#e03858';ctx.fillRect(x-7,y-9,14,18);ctx.fillStyle=`rgba(255,91,117,${.55+Math.sin(p)*.2})`;ctx.fillRect(x-3,y-6,6,12);for(let i=0;i<s.maxHp;i++){ctx.fillStyle=i<s.hp?'#ef405b':'#32141b';ctx.fillRect(x-17+i*7,y-29,5,3)}}
function drawExit(cx,cy){const x=exit.x-cx,y=exit.y-cy,p=performance.now()/300;ctx.fillStyle='#32121b';ctx.fillRect(x-22,y-38,44,76);ctx.strokeStyle='#ef405b';ctx.lineWidth=4;ctx.strokeRect(x-20,y-36,40,72);ctx.fillStyle=`rgba(255,48,80,${.25+Math.sin(p)*.1})`;ctx.fillRect(x-15,y-31,30,62);ctx.fillStyle='#ffd0d7';ctx.fillRect(x-2,y-20,4,40)}
function drawMap(){mctx.fillStyle='#050608';mctx.fillRect(0,0,mapCanvas.width,mapCanvas.height);const sx=5.6,sy=5.2;links.forEach(([a,b])=>{const A=center(rooms[a]),B=center(rooms[b]);mctx.strokeStyle='#32363a';mctx.lineWidth=8;mctx.beginPath();mctx.moveTo(A.x/T*sx,A.y/T*sy);mctx.lineTo(B.x/T*sx,A.y/T*sy);mctx.lineTo(B.x/T*sx,B.y/T*sy);mctx.stroke()});rooms.forEach(r=>{mctx.fillStyle=['#25282d','#25262d','#29232c'][stageIndex];mctx.fillRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy);mctx.strokeStyle=['#4c4d4d','#565064','#6b4658'][stageIndex];mctx.strokeRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy)});spawners.forEach(s=>{if(s.hp<=0)return;mctx.fillStyle='#d02c4b';mctx.fillRect(s.x/T*sx-3,s.y/T*sy-3,6,6)});rubies.forEach(r=>{if(!r.taken)return;mctx.fillStyle='#d62945';mctx.fillRect(r.x/T*sx-3,r.y/T*sy-3,6,6)});if(exit.open){mctx.strokeStyle='#ef405b';mctx.strokeRect(exit.x/T*sx-5,exit.y/T*sy-5,10,10)}}
function frame(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(frame)}
document.addEventListener('keydown',e=>{keys[e.code]=true;if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='Tab'&&!e.repeat&&gameState!=='title'&&!['win','dead'].includes(gameState)){if(gameState==='map'){gameState='play';$('#map-screen').classList.add('hidden')}else{gameState='map';drawMap();updateMapStats();$('#map-rubies').textContent=`${rubyCount()} / ${rubies.length}`;$('#map-kills').textContent=kills;$('#map-screen').classList.remove('hidden')}}});
document.addEventListener('keyup',e=>keys[e.code]=false);canvas.addEventListener('mousedown',e=>{if(e.button===0)attack();else if(e.button===2){e.preventDefault();dash()}});canvas.addEventListener('contextmenu',e=>e.preventDefault());
$('#start-btn').addEventListener('click',()=>{gameState='play';$('#start-screen').classList.add('hidden');canvas.focus();notify(`1단계 · ${currentStage().name}`)});
$('#restart-btn').addEventListener('click',()=>{reset();gameState='play';$('#end-screen').classList.add('hidden');notify(`1단계 · ${currentStage().name}`)});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
reset();requestAnimationFrame(frame);
