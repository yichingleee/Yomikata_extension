let converter = null;
let initialized = false;

export async function getFuriganaConverter() {
  if (initialized) {
    return converter;
  }
  initialized = true;

  try {
    const Kuroshiro = await resolveKuroshiro();
    const Analyzer = await resolveKuromojiAnalyzer();

    if (!Kuroshiro || !Analyzer) {
      throw new Error("Furigana modules missing.");
    }

    const kuroshiro = new Kuroshiro();
    await kuroshiro.init(
      new Analyzer({
        dictPath: chrome.runtime.getURL("lib/kuromoji/dict/")
      })
    );

    converter = {
      ready: true,
      convert: (text) => kuroshiro.convert(text, { to: "hiragana", mode: "furigana" })
    };
  } catch (error) {
    console.warn("Furigana init failed", error);
    converter = {
      ready: false,
      convert: async (text) => text
    };
  }

  return converter;
}

async function resolveKuroshiro() {
  let module = null;
  try {
    module = await import(chrome.runtime.getURL("lib/kuroshiro/kuroshiro.esm.js"));
  } catch (error) {
    module = null;
  }

  let Kuroshiro =
    unwrapDefault(readGlobal("Kuroshiro")) ||
    unwrapDefault(module?.default) ||
    unwrapDefault(module?.Kuroshiro);
  if (!Kuroshiro) {
    await import(chrome.runtime.getURL("lib/kuroshiro/kuroshiro.js"));
    Kuroshiro = unwrapDefault(readGlobal("Kuroshiro"));
  }

  return Kuroshiro;
}

async function resolveKuromojiAnalyzer() {
  let module = null;
  try {
    module = await import(
      chrome.runtime.getURL("lib/kuroshiro/kuroshiro-analyzer-kuromoji.esm.js")
    );
  } catch (error) {
    module = null;
  }

  let Analyzer =
    unwrapDefault(readGlobal("KuromojiAnalyzer")) ||
    unwrapDefault(module?.default) ||
    unwrapDefault(module?.KuromojiAnalyzer);
  if (!Analyzer) {
    await import(chrome.runtime.getURL("lib/kuroshiro/kuroshiro-analyzer-kuromoji.js"));
    Analyzer = unwrapDefault(readGlobal("KuromojiAnalyzer"));
  }

  return Analyzer;
}

function readGlobal(key) {
  if (typeof globalThis !== "undefined" && globalThis[key]) {
    return globalThis[key];
  }
  if (typeof window !== "undefined" && window[key]) {
    return window[key];
  }
  if (typeof self !== "undefined" && self[key]) {
    return self[key];
  }
  return null;
}

function unwrapDefault(value) {
  let result = value;
  let depth = 0;
  while (
    result &&
    (typeof result === "object" || typeof result === "function") &&
    "default" in result &&
    depth < 3
  ) {
    result = result.default;
    depth += 1;
  }
  return result;
}
