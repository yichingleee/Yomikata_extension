let converter = null;
let initialized = false;

export async function getFuriganaConverter() {
  if (initialized) {
    return converter;
  }
  initialized = true;

  try {
    const kuroshiroModule = await import(
      chrome.runtime.getURL("lib/kuroshiro/kuroshiro.esm.js")
    );
    const analyzerModule = await import(
      chrome.runtime.getURL("lib/kuroshiro/kuroshiro-analyzer-kuromoji.esm.js")
    );

    const Kuroshiro = kuroshiroModule.default || kuroshiroModule.Kuroshiro;
    const Analyzer = analyzerModule.default || analyzerModule.KuromojiAnalyzer;

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
    converter = {
      ready: false,
      convert: async (text) => text
    };
  }

  return converter;
}
