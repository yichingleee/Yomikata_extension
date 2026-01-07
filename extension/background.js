const API_ENDPOINTS = {
  jisho: "https://jisho.org/api/v1/search/words?keyword=",
  tatoeba: "https://tatoeba.org/en/api_v0/search?from=jpn&query=",
  libreTranslate: "https://libretranslate.de/translate",
  libreTranslateFallback: "https://libretranslate.com/translate"
};

const STORAGE_KEYS = {
  cache: "lookupCache"
};

chrome.commands.onCommand.addListener((command) => {
  if (command === "lookup-selection") {
    handleLookupCommand().catch(() => {});
  }
});

async function handleLookupCommand() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    return;
  }

  let selection = await requestSelection(tab.id);

  if (!selection) {
    const injected = await ensureContentScript(tab.id);
    if (injected) {
      selection = await requestSelection(tab.id);
    }
  }

  if (!selection || selection.error || !selection.text) {
    await sendMessageToTab(tab.id, {
      type: "yomi-show-popup",
      payload: {
        status: "error",
        error: "No selection detected."
      }
    });
    return;
  }

  await sendMessageToTab(tab.id, {
    type: "yomi-show-popup",
    payload: {
      status: "loading",
      word: selection.text,
      selectionRect: selection.rect
    }
  });

  const cached = await getCachedLookup(selection.text);
  if (cached) {
    await sendMessageToTab(tab.id, {
      type: "yomi-show-popup",
      payload: {
        status: "ready",
        selectionRect: selection.rect,
        ...cached
      }
    });
    return;
  }

  const lookupResult = await fetchLookupData(selection.text);
  if (lookupResult.error) {
    await sendMessageToTab(tab.id, {
      type: "yomi-show-popup",
      payload: {
        status: "error",
        selectionRect: selection.rect,
        error: lookupResult.error
      }
    });
    return;
  }

  await setCachedLookup(selection.text, lookupResult);

  await sendMessageToTab(tab.id, {
    type: "yomi-show-popup",
    payload: {
      status: "ready",
      selectionRect: selection.rect,
      ...lookupResult
    }
  });
}

async function requestSelection(tabId) {
  return await sendMessageToTab(tabId, {
    type: "yomi-request-selection"
  });
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    return true;
  } catch (error) {
    return false;
  }
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

async function fetchLookupData(word) {
  const trimmed = word.trim();
  if (!trimmed) {
    return { error: "Empty selection." };
  }

  try {
    const jishoData = await fetchJisho(trimmed);
    if (!jishoData) {
      return { error: "No Jisho results." };
    }

    const englishDefs = jishoData.englishDefs;
    let chineseDefs = [];
    let sentences = [];

    try {
      chineseDefs = await translateDefinitions(englishDefs);
    } catch (error) {
      console.warn("LibreTranslate failed", error);
    }

    try {
      sentences = await fetchTatoebaSentences(trimmed);
    } catch (error) {
      console.warn("Tatoeba lookup failed", error);
    }

    return {
      word: jishoData.word,
      reading: jishoData.reading,
      englishDefs,
      chineseDefs,
      sentences
    };
  } catch (error) {
    console.warn("Lookup failed", error);
    return { error: "Lookup failed. Try again." };
  }
}

async function fetchJisho(word) {
  const response = await fetch(`${API_ENDPOINTS.jisho}${encodeURIComponent(word)}`);
  if (!response.ok) {
    console.warn("Jisho response not ok", response.status);
    return null;
  }

  const data = await response.json();
  const entry = data?.data?.[0];
  if (!entry || !entry.japanese || !entry.japanese.length) {
    return null;
  }

  const japanese = entry.japanese[0];
  const reading = japanese.reading || "";
  const displayWord = japanese.word || word;
  const englishDefs = collectEnglishDefs(entry.senses || []);

  return {
    word: displayWord,
    reading,
    englishDefs
  };
}

function collectEnglishDefs(senses) {
  const defs = [];
  for (const sense of senses) {
    if (!sense.english_definitions) {
      continue;
    }
    for (const def of sense.english_definitions) {
      if (defs.length >= 6) {
        break;
      }
      defs.push(def);
    }
    if (defs.length >= 6) {
      break;
    }
  }
  return defs;
}

async function translateDefinitions(defs) {
  if (!defs || defs.length === 0) {
    return [];
  }

  const joined = defs.join(" ||| ");
  const payload = {
    q: joined,
    source: "en",
    target: "zh",
    format: "text"
  };

  let result = await postTranslate(API_ENDPOINTS.libreTranslate, payload);
  if (!result.ok) {
    result = await postTranslate(API_ENDPOINTS.libreTranslateFallback, payload);
  }

  if (!result.ok) {
    console.warn("LibreTranslate failed", result.status, result.preview);
    return [];
  }

  const translated = (result.data?.translatedText || "").trim();
  if (!translated) {
    return [];
  }

  const parts = translated.split("|||").map((part) => part.trim()).filter(Boolean);
  if (parts.length === defs.length) {
    return parts;
  }
  return [translated];
}

async function postTranslate(url, payload) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, preview: text.slice(0, 120) };
    }

    try {
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, status: response.status, preview: text.slice(0, 120) };
    }
  } catch (error) {
    return { ok: false, status: "network-error", preview: String(error) };
  }
}

async function fetchTatoebaSentences(word) {
  const response = await fetch(
    `${API_ENDPOINTS.tatoeba}${encodeURIComponent(word)}`
  );
  if (!response.ok) {
    console.warn("Tatoeba response not ok", response.status);
    return [];
  }

  const data = await response.json();
  const results = data?.results || [];
  const sentences = [];

  for (const result of results) {
    if (sentences.length >= 2) {
      break;
    }
    if (result?.text) {
      sentences.push(result.text);
    }
  }

  return sentences;
}

async function getCachedLookup(word) {
  const stored = await storageGet(STORAGE_KEYS.cache);
  const cache = stored[STORAGE_KEYS.cache] || {};
  const entry = cache[word];
  if (!entry) {
    return null;
  }
  return entry.data || null;
}

async function setCachedLookup(word, data) {
  const stored = await storageGet(STORAGE_KEYS.cache);
  const cache = stored[STORAGE_KEYS.cache] || {};
  cache[word] = {
    data,
    timestamp: Date.now()
  };
  await storageSet({ [STORAGE_KEYS.cache]: cache });
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
