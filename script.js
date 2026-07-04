const holes = [...document.querySelectorAll(".hole")];
const scoreEl = document.querySelector("#score");
const timeEl = document.querySelector("#time");
const comboEl = document.querySelector("#combo");
const bestScoreEl = document.querySelector("#bestScore");
const startBtn = document.querySelector("#startBtn");
const difficultyEl = document.querySelector("#difficulty");
const messageEl = document.querySelector("#message");
const rankForm = document.querySelector("#rankForm");
const nicknameEl = document.querySelector("#nickname");
const saveRankBtn = document.querySelector("#saveRankBtn");
const clearRankBtn = document.querySelector("#clearRankBtn");
const rankListEl = document.querySelector("#rankList");
const rankStatusEl = document.querySelector("#rankStatus");

const settings = {
  easy: { showFor: 760, delay: 360, duration: 30, label: "쉬움" },
  normal: { showFor: 560, delay: 260, duration: 30, label: "보통" },
  hard: { showFor: 390, delay: 180, duration: 30, label: "어려움" },
};

let score = 0;
let combo = 0;
let bestScore = Number(localStorage.getItem("moleBestScore") || 0);
let timeLeft = 30;
let activeHole = null;
let gameTimer = null;
let moleTimer = null;
let running = false;
let pendingScore = 0;
let supabaseClient = null;
let rankings = [];

bestScoreEl.textContent = bestScore;
setupRankingStore();

function randomHole() {
  const available = holes.filter((hole) => hole !== activeHole);
  return available[Math.floor(Math.random() * available.length)];
}

function setMessage(text) {
  messageEl.textContent = text;
}

function clearActiveHole() {
  holes.forEach((hole) => {
    hole.classList.remove("up", "hit");
    hole.dataset.active = "false";
  });
  activeHole = null;
}

function popMole() {
  if (!running) return;
  clearActiveHole();

  const config = settings[difficultyEl.value];
  activeHole = randomHole();
  activeHole.classList.add("up");
  activeHole.dataset.active = "true";

  moleTimer = window.setTimeout(() => {
    if (activeHole?.dataset.active === "true") {
      combo = 0;
      comboEl.textContent = combo;
      clearActiveHole();
      moleTimer = window.setTimeout(popMole, config.delay);
    }
  }, config.showFor);
}

function updateBestScore() {
  if (score <= bestScore) return;
  bestScore = score;
  localStorage.setItem("moleBestScore", String(bestScore));
  bestScoreEl.textContent = bestScore;
}

function setupRankingStore() {
  const config = window.MOLE_RANKING_CONFIG || {};
  const hasConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const hasSdk = Boolean(window.supabase?.createClient);

  if (hasConfig && hasSdk) {
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    rankStatusEl.textContent = "공용 랭킹";
    clearRankBtn.hidden = true;
    loadRankings();
    return;
  }

  rankStatusEl.textContent = "로컬 랭킹";
  clearRankBtn.hidden = false;
  rankings = getLocalRankings();
  renderRankings();
}

function getLocalRankings() {
  try {
    return JSON.parse(localStorage.getItem("moleRankings") || "[]");
  } catch {
    return [];
  }
}

function saveLocalRankings(nextRankings) {
  localStorage.setItem("moleRankings", JSON.stringify(nextRankings.slice(0, 10)));
}

function renderRankings() {
  rankListEl.innerHTML = "";

  if (rankings.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "아직 등록된 기록이 없습니다.";
    rankListEl.append(empty);
    return;
  }

  rankings.forEach((rank, index) => {
    const item = document.createElement("li");
    const position = document.createElement("span");
    const name = document.createElement("span");
    const rankScore = document.createElement("strong");

    position.className = "rank-position";
    name.className = "rank-name";
    rankScore.className = "rank-score";
    position.textContent = index + 1;
    name.textContent = rank.name;
    rankScore.textContent = `${rank.score}점`;

    item.append(position, name, rankScore);
    rankListEl.append(item);
  });
}

async function loadRankings() {
  if (!supabaseClient) {
    rankings = getLocalRankings();
    renderRankings();
    return;
  }

  rankStatusEl.textContent = "공용 랭킹 불러오는 중";
  const { data, error } = await supabaseClient
    .from("mole_rankings")
    .select("name, score, difficulty, created_at")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    rankStatusEl.textContent = "공용 랭킹 연결 실패";
    rankings = [];
    renderRankings();
    return;
  }

  rankings = data.map((rank) => ({
    name: rank.name,
    score: rank.score,
    difficulty: rank.difficulty,
    createdAt: rank.created_at,
  }));
  rankStatusEl.textContent = "공용 랭킹";
  renderRankings();
}

function setRankFormEnabled(enabled) {
  nicknameEl.disabled = !enabled;
  saveRankBtn.disabled = !enabled;
  if (enabled) nicknameEl.focus();
}

async function registerRanking(name) {
  const trimmedName = name.trim().slice(0, 12);
  if (!trimmedName || pendingScore <= 0) return;

  const nextRank = {
    name: trimmedName,
    score: pendingScore,
    difficulty: settings[difficultyEl.value].label,
    createdAt: new Date().toISOString(),
  };

  saveRankBtn.disabled = true;
  if (supabaseClient) {
    const { error } = await supabaseClient.from("mole_rankings").insert({
      name: nextRank.name,
      score: nextRank.score,
      difficulty: nextRank.difficulty,
    });

    if (error) {
      setMessage("공용 랭킹 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      saveRankBtn.disabled = false;
      return;
    }

    await loadRankings();
  } else {
    rankings.push(nextRank);
    rankings.sort((a, b) => b.score - a.score || new Date(a.createdAt) - new Date(b.createdAt));
    rankings = rankings.slice(0, 10);
    saveLocalRankings(rankings);
    renderRankings();
  }

  setMessage(`${trimmedName} 님의 ${pendingScore}점 기록을 등록했습니다.`);
  pendingScore = 0;
  nicknameEl.value = "";
  setRankFormEnabled(false);
}

function endGame() {
  running = false;
  window.clearInterval(gameTimer);
  window.clearTimeout(moleTimer);
  clearActiveHole();
  startBtn.textContent = "다시 시작";
  difficultyEl.disabled = false;
  updateBestScore();
  pendingScore = score;
  setRankFormEnabled(score > 0);
  setMessage(score > 0 ? `게임 끝! 닉네임을 입력해 ${score}점을 등록하세요.` : "게임 끝! 최종 점수는 0점입니다.");
}

function startGame() {
  const config = settings[difficultyEl.value];
  score = 0;
  combo = 0;
  timeLeft = config.duration;
  running = true;
  pendingScore = 0;

  scoreEl.textContent = score;
  comboEl.textContent = combo;
  timeEl.textContent = timeLeft;
  startBtn.textContent = "진행 중";
  difficultyEl.disabled = true;
  setRankFormEnabled(false);
  setMessage(`${config.label} 모드 시작! 숫자키 1-9로도 잡을 수 있어요.`);
  clearActiveHole();
  window.clearInterval(gameTimer);
  window.clearTimeout(moleTimer);

  popMole();
  gameTimer = window.setInterval(() => {
    timeLeft -= 1;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function hitHole(hole) {
  if (!running || hole.dataset.active !== "true") {
    if (running) {
      combo = 0;
      comboEl.textContent = combo;
      document.body.classList.add("flash");
      window.setTimeout(() => document.body.classList.remove("flash"), 280);
    }
    return;
  }

  const config = settings[difficultyEl.value];
  combo += 1;
  const bonus = Math.floor(combo / 5);
  score += 10 + bonus;

  scoreEl.textContent = score;
  comboEl.textContent = combo;
  hole.dataset.active = "false";
  hole.classList.add("hit");
  window.clearTimeout(moleTimer);

  setMessage(combo >= 5 ? `${combo} 콤보! 보너스 점수 +${bonus}` : "팡!");
  moleTimer = window.setTimeout(popMole, config.delay);
}

holes.forEach((hole) => {
  hole.addEventListener("pointerdown", () => hitHole(hole));
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !running) {
    event.preventDefault();
    startGame();
    return;
  }

  const index = Number(event.key);
  if (index >= 1 && index <= 9) {
    hitHole(holes[index - 1]);
  }
});

startBtn.addEventListener("click", () => {
  if (!running) startGame();
});

rankForm.addEventListener("submit", (event) => {
  event.preventDefault();
  registerRanking(nicknameEl.value);
});

clearRankBtn.addEventListener("click", () => {
  if (supabaseClient) {
    setMessage("공용 랭킹은 사이트에서 바로 초기화할 수 없습니다.");
    return;
  }

  localStorage.removeItem("moleRankings");
  rankings = [];
  renderRankings();
  setMessage("랭킹을 초기화했습니다.");
});
