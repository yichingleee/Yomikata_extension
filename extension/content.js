const POPUP_ROOT_ID = "yomi-popup-root";
const STORAGE_KEYS = {
  vocab: "vocabList",
  quiz: "quizSettings"
};

let popupReady = null;
let popupElements = null;
let currentPayload = null;
let furiganaConverter = null;
let quizState = {
  items: [],
  current: null,
  correct: 0,
  total: 0
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "yomi-request-selection") {
    sendResponse(getSelectionInfo());
    return;
  }

  if (message.type === "yomi-show-popup") {
    showPopup(message.payload).catch(() => {});
  }
});

function getSelectionInfo() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { error: "no-selection" };
  }

  const text = selection.toString().trim();
  if (!text) {
    return { error: "no-selection" };
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  return {
    text,
    rect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    }
  };
}

async function showPopup(payload) {
  const root = await ensurePopup();
  const elements = popupElements;
  currentPayload = payload;

  if (payload?.status === "loading") {
    setStatus("Loading...");
    setWord(payload.word || "");
    setReading("");
    clearContent();
  } else if (payload?.status === "error") {
    setStatus(payload.error || "Lookup failed.");
    setReading("");
    clearContent();
  } else if (payload?.status === "ready") {
    clearStatus();
    setWord(payload.word || "");
    setReading(payload.reading || "");
    renderDefinitions(payload.englishDefs || [], payload.chineseDefs || []);
    await renderSentences(payload.sentences || []);
  }

  positionPopup(root, payload?.selectionRect);
  root.classList.remove("yomi-hidden");
}

async function ensurePopup() {
  if (popupReady) {
    return popupReady;
  }

  popupReady = (async () => {
    const root = document.createElement("div");
    root.id = POPUP_ROOT_ID;
    root.className = "yomi-hidden";
    document.body.appendChild(root);

    const [htmlText, cssText] = await Promise.all([
      fetch(chrome.runtime.getURL("popup.html")).then((res) => res.text()),
      fetch(chrome.runtime.getURL("popup.css")).then((res) => res.text())
    ]);

    root.innerHTML = htmlText;

    const style = document.createElement("style");
    style.textContent = cssText;
    document.head.appendChild(style);

    popupElements = mapPopupElements(root);
    bindPopupEvents();
    await hydrateQuizSettings();

    document.addEventListener("mousedown", handleClickAway, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return root;
  })();

  return popupReady;
}

function mapPopupElements(root) {
  return {
    root,
    word: root.querySelector("#yomi-word"),
    reading: root.querySelector("#yomi-reading"),
    status: root.querySelector("#yomi-status"),
    defEn: root.querySelector("#yomi-def-en"),
    defZh: root.querySelector("#yomi-def-zh"),
    sentences: root.querySelector("#yomi-sentences"),
    furiganaNote: root.querySelector("#yomi-furigana-note"),
    audio: root.querySelector("#yomi-audio"),
    save: root.querySelector("#yomi-save"),
    close: root.querySelector("#yomi-close"),
    vocabToggle: root.querySelector("#yomi-toggle-vocab"),
    quizToggle: root.querySelector("#yomi-toggle-quiz"),
    vocabSection: root.querySelector("#yomi-vocab"),
    vocabList: root.querySelector("#yomi-vocab-list"),
    quizMixed: root.querySelector("#yomi-quiz-mixed"),
    quizStart: root.querySelector("#yomi-quiz-start"),
    quizSection: root.querySelector("#yomi-quiz"),
    quizQuestion: root.querySelector("#yomi-quiz-question"),
    quizAnswer: root.querySelector("#yomi-quiz-answer"),
    quizCheck: root.querySelector("#yomi-quiz-check"),
    quizNext: root.querySelector("#yomi-quiz-next"),
    quizStatus: root.querySelector("#yomi-quiz-status")
  };
}

function bindPopupEvents() {
  const elements = popupElements;
  elements.close.addEventListener("click", hidePopup);
  elements.audio.addEventListener("click", handleAudio);
  elements.save.addEventListener("click", handleSave);
  elements.vocabToggle.addEventListener("click", toggleVocabSection);
  elements.quizToggle.addEventListener("click", toggleQuizSection);
  elements.quizStart.addEventListener("click", startQuiz);
  elements.quizCheck.addEventListener("click", checkQuizAnswer);
  elements.quizNext.addEventListener("click", nextQuizQuestion);
  elements.quizMixed.addEventListener("change", handleQuizSettingChange);
  elements.vocabList.addEventListener("click", handleVocabListClick);
}

function positionPopup(root, rect) {
  if (!rect) {
    root.style.top = `${window.scrollY + 60}px`;
    root.style.left = `${window.scrollX + 20}px`;
    return;
  }

  root.style.visibility = "hidden";
  root.classList.remove("yomi-hidden");

  requestAnimationFrame(() => {
    const bounds = root.getBoundingClientRect();
    const padding = 8;
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 6;

    const maxLeft = window.scrollX + window.innerWidth - bounds.width - padding;
    if (left > maxLeft) {
      left = Math.max(window.scrollX + padding, maxLeft);
    }

    const maxTop = window.scrollY + window.innerHeight - bounds.height - padding;
    if (top > maxTop) {
      top = rect.top + window.scrollY - bounds.height - 6;
    }

    if (top < window.scrollY + padding) {
      top = window.scrollY + padding;
    }

    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.visibility = "visible";
  });
}

function hidePopup() {
  if (!popupElements) {
    return;
  }
  popupElements.root.classList.add("yomi-hidden");
}

function handleClickAway(event) {
  if (!popupElements || popupElements.root.classList.contains("yomi-hidden")) {
    return;
  }
  if (!popupElements.root.contains(event.target)) {
    hidePopup();
  }
}

function handleKeyDown(event) {
  if (event.key === "Escape") {
    hidePopup();
  }
}

function setWord(text) {
  if (popupElements.word) {
    popupElements.word.textContent = text;
  }
}

function setReading(text) {
  if (popupElements.reading) {
    popupElements.reading.textContent = text;
  }
}

function setStatus(text) {
  popupElements.status.textContent = text;
  popupElements.status.classList.remove("yomi-hidden");
}

function clearStatus() {
  popupElements.status.textContent = "";
  popupElements.status.classList.add("yomi-hidden");
}

function clearContent() {
  popupElements.defEn.innerHTML = "";
  popupElements.defZh.innerHTML = "";
  popupElements.sentences.innerHTML = "";
}

function renderDefinitions(englishDefs, chineseDefs) {
  popupElements.defEn.innerHTML = "";
  popupElements.defZh.innerHTML = "";

  appendListItems(popupElements.defEn, englishDefs);
  appendListItems(popupElements.defZh, chineseDefs);
}

async function renderSentences(sentences) {
  popupElements.sentences.innerHTML = "";
  const converter = await ensureFuriganaConverter();
  const hasFurigana = converter && converter.ready;

  popupElements.furiganaNote.classList.toggle("yomi-hidden", hasFurigana);

  for (const sentence of sentences) {
    const sentenceEl = document.createElement("div");
    sentenceEl.className = "yomi-sentence";
    if (hasFurigana) {
      const html = await converter.convert(sentence);
      sentenceEl.innerHTML = html;
    } else {
      sentenceEl.textContent = sentence;
    }
    popupElements.sentences.appendChild(sentenceEl);
  }

  if (!sentences.length) {
    const empty = document.createElement("div");
    empty.className = "yomi-note";
    empty.textContent = "No example sentences found.";
    popupElements.sentences.appendChild(empty);
  }
}

function appendListItems(listElement, items) {
  if (!items.length) {
    const item = document.createElement("li");
    item.textContent = "No definitions found.";
    listElement.appendChild(item);
    return;
  }

  for (const value of items) {
    const item = document.createElement("li");
    item.textContent = value;
    listElement.appendChild(item);
  }
}

function handleAudio() {
  if (!currentPayload?.word) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(currentPayload.word);
  utterance.lang = "ja-JP";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function handleSave() {
  if (!currentPayload?.word) {
    return;
  }
  const entry = {
    word: currentPayload.word,
    reading: currentPayload.reading || "",
    englishDefs: currentPayload.englishDefs || [],
    chineseDefs: currentPayload.chineseDefs || [],
    sentences: currentPayload.sentences || [],
    addedAt: Date.now()
  };

  await addToVocab(entry);
  await renderVocabList();
}

function toggleVocabSection() {
  popupElements.vocabSection.classList.toggle("yomi-hidden");
  if (!popupElements.vocabSection.classList.contains("yomi-hidden")) {
    renderVocabList().catch(() => {});
  }
}

function toggleQuizSection() {
  popupElements.quizSection.classList.toggle("yomi-hidden");
  if (!popupElements.quizSection.classList.contains("yomi-hidden")) {
    updateQuizStatus("");
  }
}

async function renderVocabList() {
  const vocabList = await loadVocabList();
  popupElements.vocabList.innerHTML = "";

  if (!vocabList.length) {
    const empty = document.createElement("div");
    empty.className = "yomi-note";
    empty.textContent = "No saved words yet.";
    popupElements.vocabList.appendChild(empty);
    return;
  }

  for (const item of vocabList) {
    const row = document.createElement("div");
    row.className = "yomi-vocab-item";

    const meta = document.createElement("div");
    meta.className = "yomi-vocab-meta";

    const word = document.createElement("div");
    word.textContent = item.word;
    meta.appendChild(word);

    const reading = document.createElement("div");
    reading.className = "yomi-reading";
    reading.textContent = item.reading || "";
    meta.appendChild(reading);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "yomi-button";
    button.dataset.action = "remove";
    button.dataset.word = item.word;
    button.textContent = "Remove";

    row.appendChild(meta);
    row.appendChild(button);
    popupElements.vocabList.appendChild(row);
  }
}

function handleVocabListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target.dataset.action === "remove") {
    const word = target.dataset.word || "";
    removeFromVocab(word).then(renderVocabList).catch(() => {});
  }
}

async function startQuiz() {
  quizState.items = await loadVocabList();
  quizState.correct = 0;
  quizState.total = 0;

  if (!quizState.items.length) {
    updateQuizStatus("No vocab items to quiz.");
    return;
  }

  nextQuizQuestion();
}

function nextQuizQuestion() {
  if (!quizState.items.length) {
    updateQuizStatus("No vocab items to quiz.");
    return;
  }

  const settings = popupElements.quizMixed.checked
    ? { mixed: true }
    : { mixed: false };

  const item = quizState.items[Math.floor(Math.random() * quizState.items.length)];
  const useMeaning = settings.mixed ? Math.random() < 0.5 : false;

  quizState.current = {
    item,
    type: useMeaning ? "meaning" : "reading"
  };

  popupElements.quizQuestion.textContent = useMeaning
    ? `Meaning for: ${item.word}`
    : `Reading for: ${item.word}`;
  popupElements.quizAnswer.value = "";
  updateQuizStatus(`Score ${quizState.correct}/${quizState.total}`);
}

function checkQuizAnswer() {
  if (!quizState.current) {
    return;
  }

  const answer = popupElements.quizAnswer.value.trim();
  if (!answer) {
    updateQuizStatus("Enter an answer first.");
    return;
  }

  const { item, type } = quizState.current;
  let isCorrect = false;

  if (type === "reading") {
    isCorrect = normalize(answer) === normalize(item.reading || "");
  } else {
    const answerNormalized = normalize(answer);
    const english = (item.englishDefs || []).map(normalize);
    const chinese = (item.chineseDefs || []).map(normalize);
    isCorrect =
      english.some((def) => def && (answerNormalized.includes(def) || def.includes(answerNormalized))) ||
      chinese.some((def) => def && (answerNormalized.includes(def) || def.includes(answerNormalized)));
  }

  quizState.total += 1;
  if (isCorrect) {
    quizState.correct += 1;
  }

  const expected =
    type === "reading"
      ? item.reading || "N/A"
      : [...(item.englishDefs || []), ...(item.chineseDefs || [])].join("; ");

  updateQuizStatus(
    `${isCorrect ? "Correct" : "Incorrect"}. ${expected} | Score ${quizState.correct}/${
      quizState.total
    }`
  );
}

function updateQuizStatus(text) {
  popupElements.quizStatus.textContent = text;
}

async function hydrateQuizSettings() {
  const settings = await loadQuizSettings();
  popupElements.quizMixed.checked = settings.mixed;
}

async function handleQuizSettingChange() {
  await saveQuizSettings({ mixed: popupElements.quizMixed.checked });
}

async function loadVocabList() {
  const result = await storageGet(STORAGE_KEYS.vocab);
  return result[STORAGE_KEYS.vocab] || [];
}

async function addToVocab(entry) {
  const list = await loadVocabList();
  const exists = list.some((item) => item.word === entry.word);
  if (!exists) {
    list.unshift(entry);
  }
  await storageSet({ [STORAGE_KEYS.vocab]: list });
}

async function removeFromVocab(word) {
  const list = await loadVocabList();
  const next = list.filter((item) => item.word !== word);
  await storageSet({ [STORAGE_KEYS.vocab]: next });
}

async function loadQuizSettings() {
  const result = await storageGet(STORAGE_KEYS.quiz);
  return result[STORAGE_KEYS.quiz] || { mixed: true };
}

async function saveQuizSettings(settings) {
  await storageSet({ [STORAGE_KEYS.quiz]: settings });
}

function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result));
  });
}

function storageSet(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function ensureFuriganaConverter() {
  if (furiganaConverter) {
    return furiganaConverter;
  }

  try {
    const module = await import(chrome.runtime.getURL("lib/furigana.js"));
    furiganaConverter = await module.getFuriganaConverter();
  } catch (error) {
    furiganaConverter = {
      ready: false,
      convert: async (text) => escapeHtml(text)
    };
  }

  return furiganaConverter;
}
