// main.js

// --------------- Configuration ---------------
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


/**
 * Fills a .subset-grid wrapper with rows for each subset.
 * @param {HTMLElement} wrapper   the empty .subset-grid element
 * @param {string}       inputCls  class name for number inputs
 * @param {string}       disableCls class name for disable checkboxes
 * @param {number|null}  playerIdx index if per-player, or null
 */
function generateSubsetGrid(wrapper, inputCls, disableCls, playerIdx = null) {
  wrapper.innerHTML = '';
  subsets.forEach(sub => {
    const row = document.createElement('div');
    row.className = 'subset-row';
    row.dataset.subset = sub;

    // Label
    const lbl = document.createElement('span');
    lbl.textContent = labels[sub] + ':';
    row.appendChild(lbl);

    // Number input
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min  = '0';
    inp.value = 0;
    inp.classList.add(inputCls);
    inp.dataset.subset = sub;
    if (playerIdx !== null) inp.dataset.idx = playerIdx;
    row.appendChild(inp);

// NEW: Disable‐toggle button
const disableBtn = document.createElement('button');
disableBtn.type = 'button';
disableBtn.classList.add('disable-btn');
disableBtn.dataset.subset = sub;
if (playerIdx !== null) disableBtn.dataset.idx = playerIdx;
disableBtn.textContent = '🚫';
disableBtn.title = 'Click to disable this subset';
disableBtn.addEventListener('click', () => {
  const willDisable = disableBtn.textContent === '🚫';
  disableBtn.textContent = willDisable ? '✔️' : '🚫';
  row.classList.toggle('disabled', willDisable);
  const numInput = row.querySelector('input[type="number"]');
  numInput.disabled = willDisable;
});

row.appendChild(disableBtn);


    wrapper.appendChild(row);
  });
}

// When a disable checkbox is toggled, grey out & disable its input
document.addEventListener('change', e => {
  // match either common/master or per-player disable checkboxes
  if (e.target.matches('.disable-checkbox, .pdisable-checkbox')) {
    const row = e.target.closest('.subset-row');
    const numInput = row.querySelector('input[type="number"]');
    const isDisabled = e.target.checked;

    // disable/enable the number input
    numInput.disabled = isDisabled;

    // toggle our CSS class
    row.classList.toggle('disabled', isDisabled);
  }
});


let players = [];
let commonLimits = {};
let isIndividual = false;
let individualMode = 'same';
let globalUsed = {};

// --------------- Utility Functions ---------------
const isHigh = d => d>=4 && d<=6;
const isLow  = d => d>=1 && d<=3;
const isMid  = d => d>=2 && d<=4;
const isOdd  = d => d%2===1;
const isEven = d => d%2===0;

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

/**
 * Returns an array of all ordered die‐roll pairs [1…6]×[1…6].
 */
function getAllRolls() {
  const rolls = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      rolls.push([a, b]);
    }
  }
  return rolls;
}

// ─── Face‐to‐cube‐rotation map ───
const faceTransforms = {
  1: 'rotateY(0deg) rotateX(0deg)',
  2: 'rotateY(-90deg) rotateX(0deg)',
  3: 'rotateY(180deg) rotateX(0deg)',
  4: 'rotateY(90deg) rotateX(0deg)',
  5: 'rotateX(-90deg) rotateY(0deg)',
  6: 'rotateX(90deg) rotateY(0deg)'
};


/**
 * Spins a .dice element a couple times then lands it on the face for `value`.
 * Returns a Promise that resolves once the CSS transition ends.
 */
function animateDice(value, diceEl) {
  // pick 2–5 full spins for flair
  const spins = Math.floor(Math.random() * 4) + 2;
  // apply a 1s ease‐out spin + final orientation
  diceEl.style.transition = 'transform 1s cubic-bezier(0.33,1,0.68,1)';
  diceEl.style.transform  = `rotateX(${360 * spins}deg) ${faceTransforms[value]}`;
  // resolve when the animation finishes
  return new Promise(resolve => {
    diceEl.addEventListener('transitionend', resolve, { once: true });
  });
}


// --------------- 1) Player Setup & Section Toggle ---------------
document.addEventListener('DOMContentLoaded', () => {

    //  ─── Populate the empty grids ───
  const commonGrid = document.querySelector('#common-config .subset-grid');
  generateSubsetGrid(commonGrid, 'limit-input',   'disable-checkbox');

  const masterGrid = document.querySelector('#master-config .subset-grid');
  generateSubsetGrid(masterGrid, 'limit-input',   'disable-checkbox');

  // ─── Seed “Default limit” into every input in a grid ───
document
  .getElementById('apply-common-default-limit')
  .addEventListener('click', () => {
    const def = parseInt(
      document.getElementById('common-default-limit-input').value,
      10
    ) || 0;
    document
      .querySelectorAll('#common-config .limit-input')
      .forEach(inp => { inp.value = def; });
  });

document
  .getElementById('apply-master-default-limit')
  .addEventListener('click', () => {
    const def = parseInt(
      document.getElementById('master-default-limit-input').value,
      10
    ) || 0;
    document
      .querySelectorAll('#master-config .limit-input')
      .forEach(inp => { inp.value = def; });
  });


  const numInput   = document.getElementById('num-players');
  const namesDiv   = document.getElementById('player-names');
  const setupBtn   = document.getElementById('setup-players-btn');
  const section1   = document.getElementById('player-setup');
  const section2   = document.getElementById('pool-setup');

  // Render initial single name field
  renderPlayerInputs();

  // If the number changes, re-render the inputs immediately
  numInput.addEventListener('change', renderPlayerInputs);

  // On click “Setup Players”: build players array, hide sect 1, show sect 2
  setupBtn.addEventListener('click', () => {
    // 1) Populate players[]
    players = [];
    const inputs = namesDiv.querySelectorAll('input');
    inputs.forEach((inp, i) => {
      const nm = inp.value.trim() || `Player ${i+1}`;
      players.push({ name: nm, limits: {}, used: {} });
    });

    // 2) Toggle visibility
    section1.classList.add('hidden');
    section2.classList.remove('hidden');
  });

  function renderPlayerInputs() {
    const count = parseInt(numInput.value, 10) || 0;
    namesDiv.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = `Player ${i + 1} Name`;
      input.dataset.idx = i;
      namesDiv.appendChild(input);
    }
  }
});

// --------------- 2) Toggle Pools ---------------
document.getElementById('individual-toggle').onchange = e => {
  isIndividual = e.target.checked;
  document.getElementById('common-config')
          .classList.toggle('hidden', isIndividual);
  document.getElementById('individual-config')
          .classList.toggle('hidden', !isIndividual);
};

// --------------- 3) Individual Mode Switch ---------------
document.querySelectorAll('input[name="ind-mode"]').forEach(radio=>{
  radio.onchange = e => {
    individualMode = e.target.value;
    document.getElementById('master-config')
            .classList.toggle('hidden', individualMode!=='same');
    document.getElementById('per-player-config')
            .classList.toggle('hidden', individualMode!=='custom');
    if(individualMode==='custom') renderPerPlayerConfigs();
  };
});

// --------------- 4) Render Custom-Per-Player Forms ---------------
function renderPerPlayerConfigs() {
  const container = document.getElementById('per-player-config');
  container.innerHTML = '';

  players.forEach((p, i) => {
    const card = document.createElement('div');
    card.classList.add('player-card');

    // Header
    const heading = document.createElement('h4');
    heading.textContent = p.name;
    card.appendChild(heading);

    // Empty grid → fill via helper
    const grid = document.createElement('div');
    grid.classList.add('subset-grid');
    generateSubsetGrid(grid, 'plimit-input', 'pdisable-checkbox', i);

    card.appendChild(grid);
    container.appendChild(card);
  });
}


// --------------- 5) Start Game and Capture Limits ---------------
document.getElementById('start-game').onclick = () => {
  // 1) Capture player names & init used counts
  document.querySelectorAll('#player-names input').forEach(inp => {
    const idx = +inp.dataset.idx;
    players[idx].name = inp.value.trim() || players[idx].name;
    subsets.forEach(sub => { players[idx].used[sub] = 0; });
  });

  // 2) Capture limits into commonLimits or players[].limits
  if (!isIndividual) {
    // Common‐pool case
    subsets.forEach(sub => {
      const disableBox = document.querySelector(
        `#common-config .disable-checkbox[data-subset="${sub}"]`
      );
      const disabled   = disableBox?.checked || false;
      const valInput   = document.querySelector(
        `#common-config .limit-input[data-subset="${sub}"]`
      );
      const cap        = disabled ? 0 : +(valInput?.value || 0);

      commonLimits[sub] = { cap, disabled };
      globalUsed[sub]   = 0;
    });

  } else if (individualMode === 'same') {
    // Same‐per-player case: master limits → every player
    const master = {};
    subsets.forEach(sub => {
      const disableBox = document.querySelector(
        `#master-config .disable-checkbox[data-subset="${sub}"]`
      );
      const disabled   = disableBox?.checked || false;
      const valInput   = document.querySelector(
        `#master-config .limit-input[data-subset="${sub}"]`
      );
      const cap        = disabled ? 0 : +(valInput?.value || 0);

      master[sub] = { cap, disabled };
    });
    players.forEach(p => { p.limits = JSON.parse(JSON.stringify(master)); });

  } else {
    // Custom‐per-player case
    players.forEach((p, i) => {
      p.limits = {};
      subsets.forEach(sub => {
        const disableBox = document.querySelector(
          `.pdisable-checkbox[data-subset="${sub}"][data-idx="${i}"]`
        );
        const disabled   = disableBox?.checked || false;
        const valInput   = document.querySelector(
          `.plimit-input[data-subset="${sub}"][data-idx="${i}"]`
        );
        const cap        = disabled ? 0 : +(valInput?.value || 0);

        p.limits[sub] = { cap, disabled };
        p.used[sub]   = 0;
      });
    });
  }

  // 3) Reveal Roll UI
  populatePlayerSelect();
  updateSubsetOptions();
  document.getElementById('player-setup').classList.add('hidden');
  document.getElementById('pool-setup').classList.add('hidden');
  document.getElementById('roll-section').classList.remove('hidden');
};


// --------------- Helpers for Roll UI ---------------
// (unchanged from your existing code)

function populatePlayerSelect() {
  const sel = document.getElementById('player-select');
  sel.innerHTML = '';
  players.forEach(p => sel.add(new Option(p.name, p.name)));
}

function updateSubsetOptions() {
  const sel = document.getElementById('subset-select'); sel.innerHTML = '';
  const current = players.find(p => p.name === document.getElementById('player-select').value);
  subsets.forEach(sub => {
    const used = isIndividual ? current.used[sub] : globalUsed[sub];
    const cfg = isIndividual ? current.limits[sub] : commonLimits[sub];
    const rem = cfg.infinite ? Infinity : (cfg.cap - used);
    if(rem > 0) sel.add(new Option(labels[sub], sub));
  });
  displayRemaining();
}

function displayRemaining() {
  const sub = document.getElementById('subset-select').value;
  const player = players.find(p => p.name === document.getElementById('player-select').value);
  const used = isIndividual ? player.used[sub] : globalUsed[sub];
  const cfg = isIndividual ? player.limits[sub] : commonLimits[sub];
  const rem = cfg.infinite ? '∞' : cfg.cap - used;
  document.getElementById('remaining-display').textContent = `Remaining: ${rem}`;
}

document.getElementById('player-select').onchange = updateSubsetOptions;
document.getElementById('subset-select').onchange = displayRemaining;

document.getElementById('roll-dice').onclick = async () => {
  const subset = document.getElementById('subset-select').value;
  const pool   = getAllRolls().filter(([a,b]) => filters[subset](a,b));
  const [d1,d2] = pool[Math.floor(Math.random()*pool.length)];
  await Promise.all([
    animateDice(d1, document.getElementById('dice1')),
    animateDice(d2, document.getElementById('dice2'))
  ]);
  const player = players.find(p => p.name === document.getElementById('player-select').value);
  if(isIndividual) player.used[subset]++; else globalUsed[subset]++;
  document.getElementById('subset-output').textContent = `Subset: ${labels[subset]}`;
  const li = document.createElement('li');
  li.textContent = `${player.name} rolled ${d1} & ${d2} (${labels[subset]})`;
  document.getElementById('history').prepend(li);
  updateSubsetOptions();
};
