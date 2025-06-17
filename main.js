// main.js
const subsets = [
  'double','highLow','high','low','mid',
  'opposite','odds','evens','sequential','gap'
];
const labels = {
  double:   "Double",
  highLow:  "High/Low",
  high:     "High",
  low:      "Low",
  mid:      "Mid",
  opposite: "Opposite",
  odds:     "Odds",
  evens:    "Evens",
  sequential:"Sequential",
  gap:      "Gap"
};

let players = [];            // [{ name, limits:{subset:{cap,infinite}}, used:{subset:count} }]
let commonLimits = {};       // { subset:{cap,infinite}, … }
let isIndividual = false;
let individualMode = 'same'; // 'same' or 'custom'
let globalUsed = {};         // { subset: count }

// Utility preds
const isHigh = d => d>=4&&d<=6;
const isLow  = d => d>=1&&d<=3;
const isMid  = d => d>=2&&d<=4;
const isOdd  = d => d%2===1;
const isEven = d => d%2===0;

// Filters
const filters = {
  double:     (a,b) => a===b,
  highLow:    (a,b) => (isHigh(a)&&isLow(b))||(isLow(a)&&isHigh(b)),
  high:       (a,b) => isHigh(a)&&isHigh(b)&&a!==b,
  low:        (a,b) => isLow(a)&&isLow(b)&&a!==b,
  mid:        (a,b) => isMid(a)&&isMid(b)&&a!==b,
  opposite:   (a,b) => a+b===7,
  odds:       (a,b) => isOdd(a)&&isOdd(b)&&a!==b,
  evens:      (a,b) => isEven(a)&&isEven(b)&&a!==b,
  sequential: (a,b) => Math.abs(a-b)===1,
  gap:        (a,b) => Math.abs(a-b)>=2
};


// map a face value to the final orientation
const faceTransforms = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(90deg) rotateY(0deg)',
  4: 'rotateX(-90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(0deg) rotateY(180deg)'
};

// animate one dice element to a target face
function animateDice(value, diceEl) {
  return new Promise(resolve => {
    // 2 full spins + random extra
    const fullSpins = 2;
    const extraX = Math.floor(Math.random() * 4) * 360;
    const extraY = Math.floor(Math.random() * 4) * 360;

    // 1) spin wildly
    diceEl.style.transform =
      `rotateX(${360 * fullSpins + extraX}deg) ` +
      `rotateY(${360 * fullSpins + extraY}deg)`;

    // 2) after spin ends, snap to the exact face
    const onEnd = () => {
      diceEl.removeEventListener('transitionend', onEnd);
      // temporarily remove transition so we can snap
      diceEl.style.transition = 'none';
      diceEl.style.transform = faceTransforms[value];
      // force repaint then restore transition
      requestAnimationFrame(() => {
        diceEl.style.transition = 'transform 1s ease-in-out';
        resolve();
      });
    };
    diceEl.addEventListener('transitionend', onEnd);
  });
}



function getAllRolls(){
  const all=[];
  for(let d1=1;d1<=6;d1++){
    for(let d2=1;d2<=6;d2++){
      all.push([d1,d2]);
    }
  }
  return all;
}

// 1) Player Setup
document.getElementById('setup-players').onclick = () => {
  const count = +document.getElementById('player-count').value;
  const div = document.getElementById('players');
  div.innerHTML = '';
  players = [];

  for(let i=0;i<count;i++){
    const inp = document.createElement('input');
    inp.placeholder = `Player ${i+1}`;
    inp.dataset.idx = i;
    div.appendChild(inp);

    players.push({ name:`Player ${i+1}`, limits:{}, used:{} });
  }

  document.getElementById('config-section').classList.remove('hidden');
};

// 2) Toggle Pools
document.getElementById('individual-toggle').onchange = e => {
  isIndividual = e.target.checked;
  document.getElementById('common-config').classList.toggle('hidden', isIndividual);
  document.getElementById('individual-config').classList.toggle('hidden', !isIndividual);
};

// 3) Individual Mode switch
document.querySelectorAll('input[name="ind-mode"]').forEach(radio=>{
  radio.onchange = e => {
    individualMode = e.target.value;
    document.getElementById('master-config').classList.toggle('hidden', individualMode!=='same');
    document.getElementById('per-player-config').classList.toggle('hidden', individualMode!=='custom');
    if(individualMode==='custom') renderPerPlayerConfigs();
  };
});

// 4) Render Custom-Per-Player Forms
function renderPerPlayerConfigs(){
  const ctr = document.getElementById('per-player-config');
  ctr.innerHTML = '';
  players.forEach((p,i)=>{
    const card = document.createElement('div');
    card.className = 'player-card config-form';
    // grab whatever was typed into the Player X input
    const liveInput = document.querySelector(`#players input[data-idx="${i}"]`);
    const displayName = liveInput && liveInput.value.trim()
                      ? liveInput.value.trim()
                      : p.name;
    card.innerHTML = `<h4>${displayName}</h4>`;
    subsets.forEach(sub=>{
      const row = document.createElement('div');
      row.className = 'subset-row';
      row.innerHTML = `
        <span>${labels[sub]}:</span>
        <input type="number" min="0" class="plimit-input" data-subset="${sub}" data-idx="${i}" placeholder="0"/>
        <label><input type="checkbox" class="pinfinite-checkbox" data-subset="${sub}" data-idx="${i}"/> ∞</label>
      `;
      card.appendChild(row);
    });
    ctr.appendChild(card);
  });
}

// 5) Start Game: Capture Names & Limits
document.getElementById('start-game').onclick = () => {
  // Names
  document.querySelectorAll('#players input').forEach(inp=>{
    const idx = +inp.dataset.idx;
    players[idx].name = inp.value.trim()||players[idx].name;
  });

  // Limits
  if(!isIndividual){
    // Common
    subsets.forEach(sub=>{
      const inf = document.querySelector(`.infinite-checkbox[data-subset="${sub}"]`).checked;
      const val = document.querySelector(`.limit-input[data-subset="${sub}"]`).value;
      const cap = inf ? Infinity : +(val||0);
      commonLimits[sub] = { cap, infinite: inf };
      globalUsed[sub] = 0;
    });

  } else if(individualMode==='same'){
    // Master→all players
    const master = {};
    subsets.forEach(sub=>{
      const inf = document.querySelector(`#master-config .infinite-checkbox[data-subset="${sub}"]`).checked;
      const val = document.querySelector(`#master-config .limit-input[data-subset="${sub}"]`).value;
      master[sub] = { cap: inf?Infinity: +(val||0), infinite: inf };
    });
    players.forEach(p=>{
      p.limits = JSON.parse(JSON.stringify(master));
      subsets.forEach(s=>p.used[s]=0);
    });

  } else {
    // Custom per-player
    players.forEach((p,i)=>{
      subsets.forEach(sub=>{
        const checkbox = document.querySelector(`.pinfinite-checkbox[data-subset="${sub}"][data-idx="${i}"]`);
        const inf = checkbox.checked;
        const valInput = document.querySelector(`.plimit-input[data-subset="${sub}"][data-idx="${i}"]`);
        const cap = inf ? Infinity : +(valInput.value||0);
        p.limits[sub] = { cap, infinite: inf };
        p.used[sub] = 0;
      });
    });
  }

  // Show Roll UI
  populatePlayerSelect();
  updateSubsetOptions();
  document.getElementById('player-setup').classList.add('hidden');
  document.getElementById('config-section').classList.add('hidden');
  document.getElementById('roll-section').classList.remove('hidden');
};

// Populate player dropdown
function populatePlayerSelect(){
  const sel = document.getElementById('player-select');
  sel.innerHTML = '';
  players.forEach(p=> sel.add(new Option(p.name, p.name)));
}

// Update subset options based on remaining
function updateSubsetOptions(){
  const sel = document.getElementById('subset-select');
  sel.innerHTML = '';
  const current = players.find(p=>p.name===document.getElementById('player-select').value);

  subsets.forEach(sub=>{
    const used = isIndividual ? current.used[sub] : globalUsed[sub];
    const cfg = isIndividual ? current.limits[sub] : commonLimits[sub];
    const rem = cfg.infinite ? Infinity : (cfg.cap - used);
    if(rem>0) sel.add(new Option(labels[sub], sub));
  });

  displayRemaining();
}

// Display remaining count
function displayRemaining(){
  const sub = document.getElementById('subset-select').value;
  const player = players.find(p=>p.name===document.getElementById('player-select').value);
  const used = isIndividual ? player.used[sub] : globalUsed[sub];
  const cfg = isIndividual ? player.limits[sub] : commonLimits[sub];
  const remText = cfg.infinite ? '∞' : (cfg.cap - used);
  document.getElementById('remaining-display').textContent = `Remaining: ${remText}`;
}

document.getElementById('player-select').onchange = updateSubsetOptions;
document.getElementById('subset-select').onchange = displayRemaining;

// Roll handler
// document.getElementById('roll-dice').onclick = () => {
//   const subset = document.getElementById('subset-select').value;
//   const pool = getAllRolls().filter(([a,b])=>filters[subset](a,b));
//   const [d1,d2] = pool[Math.floor(Math.random()*pool.length)];

//   // Decrement
//   const player = players.find(p=>p.name===document.getElementById('player-select').value);
//   if(isIndividual) player.used[subset]++; else globalUsed[subset]++;

//   // Show results
//   document.getElementById('dice-output').textContent = `${d1} + ${d2}`;
//   document.getElementById('subset-output').textContent = `Subset: ${labels[subset]}`;
//   const li = document.createElement('li');
//   li.textContent = `${player.name} rolled ${d1} & ${d2} (${labels[subset]})`;
//   document.getElementById('history').prepend(li);

//   // Refresh
//   updateSubsetOptions();
// };
 document.getElementById('roll-dice').onclick = async () => {
   const subset = document.getElementById('subset-select').value;
   const pool   = getAllRolls().filter(([a,b])=>filters[subset](a,b));
   const [d1,d2]= pool[Math.floor(Math.random()*pool.length)];

   // 1) play animations on both dice in parallel
   await Promise.all([
     animateDice(d1, document.getElementById('dice1')),
     animateDice(d2, document.getElementById('dice2'))
   ]);

   // 2) now decrement counts and log history
   const player = players.find(p=>p.name===document.getElementById('player-select').value);
   if(isIndividual) player.used[subset]++; else globalUsed[subset]++;

   document.getElementById('subset-output').textContent = `Subset: ${labels[subset]}`;
   const li = document.createElement('li');
   li.textContent = `${player.name} rolled ${d1} & ${d2} (${labels[subset]})`;
   document.getElementById('history').prepend(li);

   // 3) refresh dropdown & remaining
   updateSubsetOptions();
 };