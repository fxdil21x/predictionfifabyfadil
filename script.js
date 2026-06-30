// Firebase + app logic
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';

const adminEmail = 'fadilfadu90@gmail.com';
const firebaseConfig = {
  apiKey: "AIzaSyCluYT-f3AQXYz5ByDR7-dgpOtdiq9AZKg",
  authDomain: "predictionfifa-2aff4.firebaseapp.com",
  projectId: "predictionfifa-2aff4",
  storageBucket: "predictionfifa-2aff4.firebasestorage.app",
  messagingSenderId: "466566810729",
  appId: "1:466566810729:web:1fe0e8f11d8ceba34aa6f8",
  measurementId: "G-L3V4DCWY7V"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (err) { /* analytics may fail on local hosts */ }
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userInfo = document.getElementById('userInfo');

const officialResultCard = document.getElementById('officialResultCard');
const officialResultView = document.getElementById('officialResultView');
const officialResultInfo = document.getElementById('officialResultInfo');
const editResultBtn = document.getElementById('editResultBtn');
const adminControls = document.getElementById('adminControls');
const adminBadge = document.getElementById('adminBadge');
const adminMessage = document.getElementById('adminMessage');
const actualBrazilGoalsInput = document.getElementById('actualBrazilGoals');
const actualJapanGoalsInput = document.getElementById('actualJapanGoals');
const saveResultBtn = document.getElementById('saveResultBtn');
const cancelEditResultBtn = document.getElementById('cancelEditResultBtn');
const predictionsStatusBadge = document.getElementById('predictionsStatusBadge');
const togglePredictionsBtn = document.getElementById('togglePredictionsBtn');

const leaderboardCard = document.getElementById('leaderboardCard');
const summaryBlock = document.getElementById('summary');
const predictionsListEl = document.getElementById('predictionsList');
const winnersTabBtn = document.getElementById('winnersTabBtn');
const allTabBtn = document.getElementById('allTabBtn');
const pickCountInput = document.getElementById('pickCount');
const pickWinnersBtn = document.getElementById('pickWinnersBtn');
const pickerResult = document.getElementById('pickerResult');

const signedOutNotice = document.getElementById('signedOutNotice');
const predictionsClosedNotice = document.getElementById('predictionsClosedNotice');
const predictionForm = document.getElementById('predictionForm');
const predictionLocked = document.getElementById('predictionLocked');
const lockedSummary = document.getElementById('lockedSummary');
const userNameInput = document.getElementById('userName');
const brazilInput = document.getElementById('brazilGoals');
const japanInput = document.getElementById('japanGoals');
const resultDiv = document.getElementById('result');

const matchDocRef = doc(db, 'config', 'match');
const settingsDocRef = doc(db, 'config', 'settings');
const predictionsQuery = query(collection(db, 'predictions'), orderBy('createdAt', 'desc'));

let currentPredictions = [];
let currentMatch = null;
let myPrediction = null;
let predictionsClosed = false;
let activeTab = 'winners';

function formatScore(b, j) {
  return `${b} - ${j}`;
}

function predictedWinnerLabel(b, j) {
  if (b > j) return 'Brazil';
  if (j > b) return 'Japan';
  return 'Draw';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function setMessage(el, text, tone) {
  el.textContent = text;
  el.classList.remove('success', 'error');
  if (tone) el.classList.add(tone);
}

function setButtonLoading(btn, isLoading) {
  btn.disabled = isLoading;
  btn.classList.toggle('is-loading', isLoading);
}

function isExactMatch(pred, matchData) {
  return !!matchData
    && pred.predictedBrazil === matchData.actualBrazil
    && pred.predictedJapan === matchData.actualJapan;
}

// --- Prediction entry card (every signed-in user) ---

function renderLockedSummary(pred) {
  lockedSummary.innerHTML = `
    <p><strong>Name:</strong> ${escapeHtml(pred.userName || pred.userEmail)}</p>
    <p><strong>Prediction:</strong> Brazil ${pred.predictedBrazil} - Japan ${pred.predictedJapan}</p>
  `;
}

function updatePredictionCardVisibility() {
  const signedIn = !!auth.currentUser;

  signedOutNotice.style.display = signedIn ? 'none' : 'block';
  if (!signedIn) {
    predictionsClosedNotice.style.display = 'none';
    predictionForm.style.display = 'none';
    predictionLocked.style.display = 'none';
    return;
  }

  if (myPrediction) {
    predictionsClosedNotice.style.display = 'none';
    predictionForm.style.display = 'none';
    predictionLocked.style.display = 'block';
    renderLockedSummary(myPrediction);
    return;
  }

  predictionLocked.style.display = 'none';
  if (predictionsClosed) {
    predictionsClosedNotice.style.display = 'block';
    predictionForm.style.display = 'none';
  } else {
    predictionsClosedNotice.style.display = 'none';
    predictionForm.style.display = '';
  }
}

async function saveUserPrediction(event) {
  event.preventDefault();
  setMessage(resultDiv, '');

  const user = auth.currentUser;
  if (!user) {
    setMessage(resultDiv, 'Please sign in with Google before submitting your prediction.', 'error');
    return;
  }

  if (predictionsClosed) {
    setMessage(resultDiv, 'Predictions are closed. The match has already started.', 'error');
    return;
  }

  const userName = userNameInput.value.trim();
  if (!userName) {
    setMessage(resultDiv, 'Please enter your name.', 'error');
    return;
  }

  const predictedBrazil = parseInt(brazilInput.value || 0, 10);
  const predictedJapan = parseInt(japanInput.value || 0, 10);
  const chosenScore = formatScore(predictedBrazil, predictedJapan);
  const submitBtn = predictionForm.querySelector('button[type="submit"]');

  setButtonLoading(submitBtn, true);
  try {
    await setDoc(doc(db, 'predictions', user.uid), {
      userId: user.uid,
      userEmail: user.email,
      userName,
      predictedBrazil,
      predictedJapan,
      chosenScore,
      createdAt: serverTimestamp()
    });
    setMessage(resultDiv, 'Prediction submitted successfully.', 'success');
  } catch (err) {
    setMessage(resultDiv, `Could not save prediction: ${err.message}`, 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

function subscribeMyPrediction(uid) {
  return onSnapshot(doc(db, 'predictions', uid), docSnap => {
    myPrediction = docSnap.exists() ? docSnap.data() : null;
    updatePredictionCardVisibility();
  }, err => {
    setMessage(resultDiv, `Error loading your prediction: ${err.message}`, 'error');
  });
}

function subscribeSettings() {
  return onSnapshot(settingsDocRef, docSnap => {
    predictionsClosed = docSnap.exists() && docSnap.data().predictionsClosed === true;
    renderPredictionsStatus();
    updatePredictionCardVisibility();
  }, err => {
    setMessage(resultDiv, `Error loading predictions status: ${err.message}`, 'error');
  });
}

// --- Admin: official result (view / edit) ---

function renderOfficialResult(matchData) {
  if (!matchData) {
    officialResultInfo.innerHTML = '<p>No official result set yet.</p>';
    editResultBtn.querySelector('.btn-label').textContent = 'Set official result';
    return;
  }

  const { actualBrazil, actualJapan } = matchData;
  officialResultInfo.innerHTML = `
    <p><strong>Official score:</strong> Brazil ${actualBrazil} - Japan ${actualJapan}</p>
  `;
  editResultBtn.querySelector('.btn-label').textContent = 'Edit official result';
}

function showResultForm() {
  actualBrazilGoalsInput.value = currentMatch ? (currentMatch.actualBrazil || 0) : 0;
  actualJapanGoalsInput.value = currentMatch ? (currentMatch.actualJapan || 0) : 0;
  officialResultView.style.display = 'none';
  adminControls.style.display = 'grid';
  cancelEditResultBtn.style.display = currentMatch ? 'inline-flex' : 'none';
  setMessage(adminMessage, '');
}

function showResultView() {
  officialResultView.style.display = '';
  adminControls.style.display = 'none';
}

async function saveOfficialResult() {
  setMessage(adminMessage, '');
  const actualBrazil = parseInt(actualBrazilGoalsInput.value || 0, 10);
  const actualJapan = parseInt(actualJapanGoalsInput.value || 0, 10);

  setButtonLoading(saveResultBtn, true);
  try {
    await setDoc(matchDocRef, {
      actualBrazil,
      actualJapan,
      updatedAt: serverTimestamp()
    });
    setMessage(adminMessage, 'Official match result saved successfully.', 'success');
    showResultView();
  } catch (err) {
    setMessage(adminMessage, `Could not save official result: ${err.message}`, 'error');
  } finally {
    setButtonLoading(saveResultBtn, false);
  }
}

// --- Admin: open/close predictions ---

function renderPredictionsStatus() {
  predictionsStatusBadge.textContent = predictionsClosed ? 'Closed' : 'Open';
  predictionsStatusBadge.classList.toggle('badge-admin', predictionsClosed);
  togglePredictionsBtn.querySelector('.btn-label').textContent = predictionsClosed ? 'Reopen predictions' : 'Close predictions';
}

async function togglePredictionsClosed() {
  setButtonLoading(togglePredictionsBtn, true);
  try {
    await setDoc(settingsDocRef, {
      predictionsClosed: !predictionsClosed,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    alert(`Could not update predictions status: ${err.message}`);
  } finally {
    setButtonLoading(togglePredictionsBtn, false);
  }
}

// --- Admin: predictions list + winners summary ---

function renderSummary(matchData, predictions) {
  const totalCount = predictions.length;

  if (!matchData) {
    summaryBlock.innerHTML = `
      <p><strong>Total predictions:</strong> ${totalCount}</p>
      <p>The official result is not set yet. Once you enter the score above, winners will be marked below.</p>
    `;
  } else {
    const correctCount = predictions.filter(pred => isExactMatch(pred, matchData)).length;
    summaryBlock.innerHTML = `
      <p><strong>Total predictions:</strong> ${totalCount}</p>
      <p><strong>Correct predictions:</strong> ${correctCount}</p>
      <p><strong>Official result:</strong> Brazil ${matchData.actualBrazil} - Japan ${matchData.actualJapan}</p>
    `;
  }

  renderPredictionsList(matchData, predictions);
}

function setActiveTab(tab) {
  activeTab = tab;
  winnersTabBtn.classList.toggle('active', tab === 'winners');
  winnersTabBtn.setAttribute('aria-selected', tab === 'winners');
  allTabBtn.classList.toggle('active', tab === 'all');
  allTabBtn.setAttribute('aria-selected', tab === 'all');
  renderPredictionsList(currentMatch, currentPredictions);
}

function renderPredictionsList(matchData, predictions) {
  const visiblePredictions = activeTab === 'winners'
    ? predictions.filter(pred => isExactMatch(pred, matchData))
    : predictions;

  if (!visiblePredictions.length) {
    if (activeTab === 'winners') {
      predictionsListEl.innerHTML = matchData
        ? '<div class="empty-state">No winners yet.</div>'
        : '<div class="empty-state">Set the official result above to see winners here.</div>';
    } else {
      predictionsListEl.innerHTML = '<div class="empty-state">No predictions submitted yet.</div>';
    }
    return;
  }

  const initials = name => (name || '?').trim().charAt(0).toUpperCase();

  predictionsListEl.innerHTML = visiblePredictions.map(pred => {
    const displayName = pred.userName || pred.userEmail;
    const correct = isExactMatch(pred, matchData);
    return `
    <div class="list-item">
      <div class="list-item-left">
        <span class="rank">${escapeHtml(initials(displayName))}</span>
        <div class="list-item-text">
          <strong>${escapeHtml(displayName)}</strong>
          <span>${pred.chosenScore} (${predictedWinnerLabel(pred.predictedBrazil, pred.predictedJapan)}) &middot; ${escapeHtml(pred.userEmail)}</span>
        </div>
      </div>
      <div class="list-item-actions">
        ${correct ? '<span class="badge badge-winner">Winner</span>' : ''}
        <button type="button" class="btn-delete" data-id="${escapeHtml(pred.id)}">Delete</button>
      </div>
    </div>
  `;
  }).join('');
}

async function deletePrediction(id, button) {
  const pred = currentPredictions.find(p => p.id === id);
  const name = pred ? (pred.userName || pred.userEmail) : 'this entry';
  if (!confirm(`Delete ${name}'s prediction? This cannot be undone.`)) return;

  button.disabled = true;
  button.textContent = 'Deleting...';
  try {
    await deleteDoc(doc(db, 'predictions', id));
  } catch (err) {
    alert(`Could not delete prediction: ${err.message}`);
    button.disabled = false;
    button.textContent = 'Delete';
  }
}

predictionsListEl.addEventListener('click', event => {
  const button = event.target.closest('.btn-delete');
  if (!button) return;
  deletePrediction(button.dataset.id, button);
});

// --- Admin: random winner picker ---

function pickRandomWinners() {
  const winners = currentPredictions.filter(pred => isExactMatch(pred, currentMatch));

  if (!winners.length) {
    pickerResult.style.display = 'block';
    pickerResult.innerHTML = '<p>There are no winners to pick from yet.</p>';
    return;
  }

  let count = parseInt(pickCountInput.value || 1, 10);
  if (!Number.isFinite(count) || count < 1) count = 1;
  if (count > winners.length) count = winners.length;
  pickCountInput.value = count;

  const pool = [...winners];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, count);

  pickerResult.style.display = 'block';
  pickerResult.innerHTML = `
    <p><strong>${picked.length === 1 ? 'Selected winner:' : `Selected ${picked.length} winners:`}</strong></p>
    ${picked.map((pred, i) => `<p>${i + 1}. ${escapeHtml(pred.userName || pred.userEmail)} &middot; ${pred.chosenScore} &middot; ${escapeHtml(pred.userEmail)}</p>`).join('')}
  `;
}

pickWinnersBtn.addEventListener('click', pickRandomWinners);

function setAdminUI(isAdmin) {
  adminBadge.style.display = isAdmin ? 'inline-flex' : 'none';
  officialResultCard.style.display = isAdmin ? '' : 'none';
  leaderboardCard.style.display = isAdmin ? '' : 'none';
  if (!isAdmin) {
    showResultView();
  }
}

let matchUnsub = null;
let predictionsUnsub = null;
let myPredictionUnsub = null;
let settingsUnsub = null;

function clearAdminSubscriptions() {
  if (matchUnsub) {
    matchUnsub();
    matchUnsub = null;
  }
  if (predictionsUnsub) {
    predictionsUnsub();
    predictionsUnsub = null;
  }
}

function clearUserSubscriptions() {
  if (myPredictionUnsub) {
    myPredictionUnsub();
    myPredictionUnsub = null;
  }
  if (settingsUnsub) {
    settingsUnsub();
    settingsUnsub = null;
  }
}

function subscribeAdminUpdates() {
  summaryBlock.innerHTML = '<p>Loading match status and predictions...</p>';
  officialResultInfo.innerHTML = '<p>Loading official result...</p>';

  matchUnsub = onSnapshot(matchDocRef, docSnap => {
    currentMatch = docSnap.exists() ? docSnap.data() : null;
    renderOfficialResult(currentMatch);
    renderSummary(currentMatch, currentPredictions);
  }, err => {
    officialResultInfo.textContent = `Error loading official result: ${err.message}`;
  });

  predictionsUnsub = onSnapshot(predictionsQuery, querySnap => {
    currentPredictions = [];
    querySnap.forEach(docSnap => currentPredictions.push({ id: docSnap.id, ...docSnap.data() }));
    renderSummary(currentMatch, currentPredictions);
  }, err => {
    summaryBlock.textContent = `Error loading predictions: ${err.message}`;
  });
}

signInBtn.addEventListener('click', async () => {
  setButtonLoading(signInBtn, true);
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert(`Sign-in failed: ${err.message}`);
  } finally {
    setButtonLoading(signInBtn, false);
  }
});

signOutBtn.addEventListener('click', async () => {
  setButtonLoading(signOutBtn, true);
  await signOut(auth);
  setButtonLoading(signOutBtn, false);
});

onAuthStateChanged(auth, user => {
  if (user) {
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-flex';
    userInfo.textContent = user.email;

    if (!userNameInput.value && user.displayName) {
      userNameInput.value = user.displayName;
    }

    const isAdmin = user.email === adminEmail;
    setAdminUI(isAdmin);

    myPredictionUnsub = subscribeMyPrediction(user.uid);
    settingsUnsub = subscribeSettings();
    if (isAdmin) {
      subscribeAdminUpdates();
    }
  } else {
    signInBtn.style.display = 'inline-flex';
    signOutBtn.style.display = 'none';
    userInfo.textContent = '';

    setAdminUI(false);
    clearAdminSubscriptions();
    clearUserSubscriptions();
    myPrediction = null;
    predictionsClosed = false;
    updatePredictionCardVisibility();
    setMessage(resultDiv, '');
  }
});

saveResultBtn.addEventListener('click', saveOfficialResult);
editResultBtn.addEventListener('click', showResultForm);
cancelEditResultBtn.addEventListener('click', showResultView);
togglePredictionsBtn.addEventListener('click', togglePredictionsClosed);
winnersTabBtn.addEventListener('click', () => setActiveTab('winners'));
allTabBtn.addEventListener('click', () => setActiveTab('all'));
predictionForm.addEventListener('submit', saveUserPrediction);
