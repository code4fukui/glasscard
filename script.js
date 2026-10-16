import { SaberaClient } from 'https://code4fukui.github.io/webglass-sdk/sabera.js';

const defaultCards = [
  { question: '電気を通しやすい物質を何という？', answer: '導体。金属など、電気抵抗が小さい物質のこと。' },
  { question: '電圧・電流・抵抗の関係を表す法則は？', answer: 'オームの法則。E = I × R（電圧 = 電流 × 抵抗）。' },
  { question: '単相100Vのコンセントに接続する線の名称は？', answer: '電圧側の「非接地側電線」と、0V側の「接地側電線」。' },
  { question: '漏電を検知して回路を遮断する装置は？', answer: '漏電遮断器。感電や火災を防ぐために使われる。' },
  { question: '電線を接続するときに使う工具は？', answer: 'リングスリーブ用圧着工具。接続方法に合ったサイズを選ぶ。' }
];
const defaultCsvUrl = 'https://raw.githubusercontent.com/code4fukui/denki2/main/card.csv';

let cards = [...defaultCards];
let index = 0;
let answerShown = false;
let timer = null;
let sessionCount = Number(localStorage.getItem('glasscard-session') || 0);
let mastered = new Set(JSON.parse(localStorage.getItem('glasscard-mastered') || '[]'));
const sabera = new SaberaClient();
let saberaConnected = false;

const $ = (selector) => document.querySelector(selector);
const flashcard = $('#flashcard');

function render() {
  const card = cards[index];
  $('#card-content').textContent = card.question;
  $('#card-answer').textContent = card.answer;
  $('#card-number').textContent = String(index + 1).padStart(2, '0');
  $('#progress-label').textContent = `${index + 1} / ${cards.length}`;
  $('#progress-bar').style.width = `${((index + 1) / cards.length) * 100}%`;
  $('#card-total').textContent = `${cards.length} cards`;
  $('#session-count').textContent = sessionCount;
  flashcard.classList.toggle('is-answer', answerShown);
  const isMastered = mastered.has(index);
  $('#mastered-button').classList.toggle('is-mastered', isMastered);
  $('#mastered-label').textContent = isMastered ? 'スキップを解除' : '覚えたのでスキップ';
  sendCurrentCard();
}

async function sendCurrentCard() {
  if (!saberaConnected) return;
  const card = cards[index];
  const text = answerShown ? `${card.question}\n\n${card.answer}` : card.question;
  try {
    await sabera.sendText(text);
  } catch (error) {
    saberaConnected = false;
    $('#sabera-connect').classList.remove('is-connected');
    $('#connection-label').textContent = 'SABERAに接続';
    showToast('SABERAとの接続が切れました');
  }
}

function move(step) {
  index = (index + step + cards.length) % cards.length;
  answerShown = false;
  sessionCount++;
  localStorage.setItem('glasscard-session', sessionCount);
  render();
}

function toggleAnswer() { answerShown = !answerShown; render(); }
function nextUnmastered() {
  if (mastered.size >= cards.length) return;
  for (let step = 1; step <= cards.length; step++) {
    const candidate = (index + step) % cards.length;
    if (!mastered.has(candidate)) { index = candidate; return; }
  }
}
function stopAutoplay() { clearInterval(timer); timer = null; $('#play-button').classList.remove('is-playing'); $('#play-label').textContent = '連続表示'; }
function toggleAutoplay() {
  if (timer) { stopAutoplay(); return; }
  if (mastered.size >= cards.length) { showToast('すべてのカードを覚えました'); return; }
  timer = setInterval(() => {
    if (answerShown) {
      nextUnmastered();
      answerShown = false;
    } else {
      answerShown = true;
    }
    sessionCount++;
    localStorage.setItem('glasscard-session', sessionCount);
    render();
  }, 1000);
  $('#play-button').classList.add('is-playing'); $('#play-label').textContent = '一時停止';
}

$('#flashcard').addEventListener('click', () => {
  if (answerShown) move(1);
  else toggleAnswer();
});
$('#prev-button').addEventListener('click', () => { stopAutoplay(); move(-1); });
$('#next-button').addEventListener('click', () => { stopAutoplay(); move(1); });
$('#play-button').addEventListener('click', toggleAutoplay);
$('#mastered-button').addEventListener('click', () => {
  if (mastered.has(index)) mastered.delete(index); else mastered.add(index);
  localStorage.setItem('glasscard-mastered', JSON.stringify([...mastered]));
  render();
});
$('#sabera-connect').addEventListener('click', async () => {
  const button = $('#sabera-connect');
  button.disabled = true;
  $('#connection-label').textContent = '接続中…';
  try {
    await sabera.connect();
    await sabera.showScreen(0x47);
    saberaConnected = true;
    button.classList.add('is-connected');
    $('#connection-label').textContent = 'SABERA接続中';
    await sendCurrentCard();
    showToast('SABERAに接続しました');
  } catch (error) {
    saberaConnected = false;
    $('#connection-label').textContent = 'SABERAに接続';
    showToast('接続できませんでした。SABERAを近くで起動してください');
  } finally {
    button.disabled = false;
  }
});
$('#reset-button').addEventListener('click', () => { stopAutoplay(); index = 0; answerShown = false; render(); showToast('最初のカードに戻りました'); });

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') { stopAutoplay(); move(-1); }
  if (event.key === 'ArrowRight') { stopAutoplay(); move(1); }
  if (event.code === 'Space') { event.preventDefault(); toggleAnswer(); }
});

$('#csv-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  if (!rows.length) { showToast('2列のCSV（問題,答え）を選んでください'); return; }
  cards = rows.map(([question, answer]) => ({ question, answer }));
  index = 0; answerShown = false; mastered.clear();
  localStorage.removeItem('glasscard-mastered');
  $('#deck-name').textContent = file.name.replace(/\.csv$/i, '');
  render(); showToast(`${cards.length}枚のカードを読み込みました`);
  event.target.value = '';
});

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"' && quoted) { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.length >= 2 && row[0] && row[1]) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.length >= 2 && row[0] && row[1]) rows.push(row);
  // 先頭行はCSVの項目名（ヘッダー）として扱う
  return rows.slice(1);
}

async function loadDefaultCards() {
  try {
    const response = await fetch(defaultCsvUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = parseCsv(await response.text());
    if (!rows.length) throw new Error('empty CSV');
    cards = rows.map(([question, answer]) => ({ question, answer }));
    index = 0; answerShown = false; mastered.clear();
    localStorage.removeItem('glasscard-mastered');
    $('#deck-name').textContent = '電気工事士 二種';
    render();
  } catch (error) {
    showToast('電気工事士二種のデータを取得できないため、サンプルを表示中');
  }
}

let toastTimer;
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2300); }
render();
loadDefaultCards();
