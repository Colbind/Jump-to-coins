// Игра: движение по линиям, уровни и админ-панель.
// Добавлены функции отнять монеты (себе и другим) и крестик закрытия панели.

// Элементы DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const timerEl = document.getElementById('timer');
const coinsEl = document.getElementById('coins');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayRestart = document.getElementById('overlayRestart');

const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

const playerNameInput = document.getElementById('playerName');
const setNameBtn = document.getElementById('setNameBtn');
const playerNameDisplay = document.getElementById('playerNameDisplay');

const levelSelect = document.getElementById('levelSelect');

const adminPassInput = document.getElementById('adminPass');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminPanelBtnWrap = document.getElementById('adminPanelBtnWrap');
const openAdminPanelBtn = document.getElementById('openAdminPanel');

const adminPanel = document.getElementById('adminPanel');
const adminClose = document.getElementById('adminClose');
const adminCloseX = document.getElementById('adminCloseX');

const adminGiveSelf = document.getElementById('adminGiveSelf');
const adminSelfAmount = document.getElementById('adminSelfAmount');
const adminDeductSelf = document.getElementById('adminDeductSelf');
const adminSelfDeduct = document.getElementById('adminSelfDeduct');

const adminBanBtn = document.getElementById('adminBanBtn');
const adminBanName = document.getElementById('adminBanName');

const adminGiveBtn = document.getElementById('adminGiveBtn');
const adminGiveName = document.getElementById('adminGiveName');
const adminGiveAmount = document.getElementById('adminGiveAmount');

const adminDeductBtn = document.getElementById('adminDeductBtn');
const adminDeductName = document.getElementById('adminDeductName');
const adminDeductAmount = document.getElementById('adminDeductAmount');

const statusBox = document.getElementById('statusBox');
const bannedListEl = document.getElementById('bannedList');

// Игра — уровни
const LEVELS = [
  { id: 'easy',   name: 'Легкий',   cols: 8,  rows: 6,  time: 60, coins: 6 },
  { id: 'normal', name: 'Нормальный', cols: 12, rows: 8,  time: 60, coins: 8 },
  { id: 'hard',   name: 'Сложный',  cols: 16, rows: 10, time: 45, coins: 12 },
  { id: 'tiny',   name: 'Мини',     cols: 6,  rows: 4,  time: 45, coins: 4 },
];

let gridCols = 12;
let gridRows = 8;
let TIME_SECONDS = 60;
let COIN_COUNT = 8;

const PADDING = 40;
const MOVE_SPEED = 6;

let cellW, cellH;
let intersections = [];
let coins = new Set();

let playerIndex = 0;
let playerPos = {x:0,y:0};
let targetIndex = null;

let timer = TIME_SECONDS;
let coinsCollected = 0;
let gameRunning = false;
let tickInterval = null;
let animFrame = null;

// Профили игроков
const STORAGE_KEY = 'simple_grid_game_players_v1';
let players = {}; // {name: {coins: number, banned: bool}}
let currentPlayer = 'Гость';
let isAdmin = false;

function loadPlayers(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    players = raw ? JSON.parse(raw) : {};
  }catch(e){
    players = {};
  }
}

function savePlayers(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
}

function ensurePlayer(name){
  if(!players[name]) players[name] = { coins: 0, banned: false };
  savePlayers();
}

function updateBannedList(){
  bannedListEl.innerHTML = '';
  const banned = Object.keys(players).filter(n => players[n].banned);
  if(banned.length === 0){
    const li = document.createElement('li'); li.textContent = 'нет';
    bannedListEl.appendChild(li);
    return;
  }
  for(const n of banned){
    const li = document.createElement('li'); li.textContent = n + (players[n].coins ? ` (${players[n].coins}◐)` : '');
    bannedListEl.appendChild(li);
  }
}

// Смена уровня
function populateLevels(){
  levelSelect.innerHTML = '';
  for(const lv of LEVELS){
    const opt = document.createElement('option');
    opt.value = lv.id;
    opt.textContent = lv.name;
    levelSelect.appendChild(opt);
  }
  levelSelect.value = LEVELS[1].id; // normal по умолчанию
}
function applyLevelById(id){
  const lv = LEVELS.find(l => l.id === id) || LEVELS[0];
  gridCols = lv.cols;
  gridRows = lv.rows;
  TIME_SECONDS = lv.time;
  COIN_COUNT = lv.coins;
  resetGame(); // пересоздать сетку
  setStatus(`Выбран уровень: ${lv.name}`);
}

// Сетка и рендер
function initGrid(){
  intersections = [];
  const w = canvas.width - PADDING*2;
  const h = canvas.height - PADDING*2;
  cellW = w / (gridCols-1);
  cellH = h / (gridRows-1);
  for(let r=0;r<gridRows;r++){
    for(let c=0;c<gridCols;c++){
      intersections.push({ x: PADDING + c*cellW, y: PADDING + r*cellH, c, r });
    }
  }
}

function idxFromCR(c,r){ return r*gridCols + c; }

function spawnCoins(){
  coins.clear();
  while(coins.size < COIN_COUNT){
    const i = Math.floor(Math.random()*intersections.length);
    if(i === playerIndex) continue;
    coins.add(i);
  }
}

// Сброс и старт
function resetGame(){
  stopLoop();
  clearInterval(tickInterval);
  tickInterval = null;
  gameRunning = false;

  initGrid();
  playerIndex = idxFromCR(Math.floor(gridCols/2), Math.floor(gridRows/2));
  playerPos.x = intersections[playerIndex].x;
  playerPos.y = intersections[playerIndex].y;
  targetIndex = null;

  timer = TIME_SECONDS;
  coinsCollected = 0;
  spawnCoins();
  updateHUD();
  draw();
  updateBannedList();
}

function startGame(){
  if(gameRunning) return;
  if(players[currentPlayer] && players[currentPlayer].banned){
    showOverlay('Вы забанены и не можете играть', 'Доступ запрещён');
    setStatus('Игрок забанен');
  return;
}
gameRunning = true;
timer = TIME_SECONDS;
coinsCollected = 0;
spawnCoins();
updateHUD();
tickInterval = setInterval(()=> {
  timer--;
  updateHUD();
  if(timer <= 0){
    endGame();
  }
}, 1000);
loop();
setStatus('Игра запущена');
}

function endGame(){
  gameRunning = false;
  clearInterval(tickInterval);
  tickInterval = null;
  showOverlay(`Монет собрано в раунде: ${coinsCollected}`, 'Игра окончена');
  setStatus('Игра завершена');
}

function showOverlay(text, title){
  overlayTitle.textContent = title || 'Игра окончена';
  overlayText.textContent = text || '';
  overlay.classList.remove('hidden');
}

function hideOverlay(){
  overlay.classList.add('hidden');
}

function updateHUD(){
  timerEl.textContent = timer;
  const total = (players[currentPlayer] && players[currentPlayer].coins) ? players[currentPlayer].coins : 0;
  coinsEl.textContent = total;
  playerNameDisplay.textContent = currentPlayer;
}

// Рисование
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#052a2a';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // линии
  ctx.strokeStyle = '#2ea3a3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for(let r=0;r<gridRows;r++){
    const y = PADDING + r*cellH;
    ctx.moveTo(PADDING, y);
    ctx.lineTo(canvas.width - PADDING, y);
  }
  for(let c=0;c<gridCols;c++){
    const x = PADDING + c*cellW;
    ctx.moveTo(x, PADDING);
    ctx.lineTo(x, canvas.height - PADDING);
  }
  ctx.stroke();

  // перекрёстки
  for(let i=0;i<intersections.length;i++){
    const p = intersections[i];
    ctx.fillStyle = '#0f1724';
    ctx.strokeStyle = '#1cc5c5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }

  // монеты
  for(const i of coins){
    const p = intersections[i];
    drawCoin(p.x, p.y);
  }

  // игрок
  drawPlayer(playerPos.x, playerPos.y);
}

function drawCoin(x,y){
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = '#ffd166';
  ctx.shadowColor = 'rgba(255,209,102,0.6)';
  ctx.shadowBlur = 8;
  ctx.arc(x, y, 10, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff2b8';
  ctx.beginPath();
  ctx.ellipse(x-3, y-4, 3,2,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(x,y){
  ctx.beginPath();
  ctx.fillStyle = '#84ccff';
  ctx.shadowColor = 'rgba(132,204,255,0.8)';
  ctx.shadowBlur = 12;
  ctx.arc(x, y, 12, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#cbeeff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Движение и взаимодействие
function neighbors(index){
  const {c,r} = intersections[index];
  const list = [];
  if(r>0) list.push(idxFromCR(c, r-1));
  if(r<gridRows-1) list.push(idxFromCR(c, r+1));
  if(c>0) list.push(idxFromCR(c-1, r));
  if(c<gridCols-1) list.push(idxFromCR(c+1, r));
  return list;
}

function tryMove(direction){
  if(!gameRunning) return;
  if(targetIndex !== null) return;
  const {c,r} = intersections[playerIndex];
  let nc=c, nr=r;
  if(direction === 'up') nr = r-1;
  if(direction === 'down') nr = r+1;
  if(direction === 'left') nc = c-1;
  if(direction === 'right') nc = c+1;
  if(nc < 0 || nr < 0 || nc >= gridCols || nr >= gridRows) return;
  const ni = idxFromCR(nc, nr);
  targetIndex = ni;
}

function animatePlayer(){
  if(targetIndex === null) return;
  const target = intersections[targetIndex];
  const dx = target.x - playerPos.x;
  const dy = target.y - playerPos.y;
  const dist = Math.hypot(dx,dy);
  if(dist < MOVE_SPEED){
    playerPos.x = target.x;
    playerPos.y = target.y;
    playerIndex = targetIndex;
    targetIndex = null;
    checkCoinPickup();
    return;
  }
  playerPos.x += (dx / dist) * MOVE_SPEED;
  playerPos.y += (dy / dist) * MOVE_SPEED;
}

function checkCoinPickup(){
  if(coins.has(playerIndex)){
    coins.delete(playerIndex);
    coinsCollected++;
    // сохранить в профиле игрока
    ensurePlayer(currentPlayer);
    players[currentPlayer].coins = (players[currentPlayer].coins || 0) + 1;
    savePlayers();
    updateHUD();
  }
}

function loop(){
  animFrame = requestAnimationFrame(() => {
    animatePlayer();
    draw();
    if(gameRunning) loop();
  });
}

function stopLoop(){
  if(animFrame) cancelAnimationFrame(animFrame);
  animFrame = null;
}

// UI и события
upBtn.addEventListener('click', ()=> tryMove('up'));
downBtn.addEventListener('click', ()=> tryMove('down'));
leftBtn.addEventListener('click', ()=> tryMove('left'));
rightBtn.addEventListener('click', ()=> tryMove('right'));

startBtn.addEventListener('click', ()=> {
  hideOverlay();
  startGame();
});
restartBtn.addEventListener('click', ()=> {
  hideOverlay();
  resetGame();
});

overlayRestart.addEventListener('click', ()=>{
  hideOverlay();
  resetGame();
  startGame();
});

window.addEventListener('keydown', (e) => {
  if(!gameRunning) return;
  if(e.key === 'ArrowUp') tryMove('up');
  if(e.key === 'ArrowDown') tryMove('down');
  if(e.key === 'ArrowLeft') tryMove('left');
  if(e.key === 'ArrowRight') tryMove('right');
});

// Имя игрока
setNameBtn.addEventListener('click', ()=>{
  const name = (playerNameInput.value || '').trim();
  if(!name) {
    setStatus('Введите корректное имя');
    return;
  }
  currentPlayer = name;
  ensurePlayer(currentPlayer);
  updateHUD();
  updateBannedList();
  setStatus(`Имя установлено: ${currentPlayer}`);
});

// Уровень
levelSelect.addEventListener('change', (e) => {
  applyLevelById(e.target.value);
});

// Админ вход/выход
adminLoginBtn.addEventListener('click', ()=>{
  const pass = adminPassInput.value || '';
  if(pass === '2017'){
    isAdmin = true;
    adminPanelBtnWrap.classList.remove('hidden');
    adminLoginBtn.classList.add('hidden');
    adminLogoutBtn.classList.remove('hidden');
    setStatus('Вход администратора успешен');
  } else {
    setStatus('Неправильный пароль');
  }
});
admin
