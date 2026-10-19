import type { HighlighterCore } from "shiki/core";

export type HighlightLang = "ts" | "python" | "go" | "php" | "rust" | "ruby" | "json" | "bash";

let highlighterPromise: Promise<HighlighterCore> | null = null;

// Importing `codeToHtml` from "shiki" bundles every grammar and theme (hundreds of chunks)
// into the client graph; loading only what the site renders keeps dev compiles and bundles small.
function getHighlighter() {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      themes: [import("shiki/themes/catppuccin-mocha.mjs"), import("shiki/themes/catppuccin-latte.mjs")],
      langs: [
        import("shiki/langs/typescript.mjs"),
        import("shiki/langs/python.mjs"),
        import("shiki/langs/go.mjs"),
        import("shiki/langs/php.mjs"),
        import("shiki/langs/rust.mjs"),
        import("shiki/langs/ruby.mjs"),
        import("shiki/langs/json.mjs"),
        import("shiki/langs/bash.mjs"),
      ],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return highlighterPromise;
}

export async function highlightCode(
  code: string,
  options:
    | { lang: HighlightLang; theme: "catppuccin-mocha" | "catppuccin-latte" }
    | { lang: HighlightLang; themes: { dark: "catppuccin-mocha"; light: "catppuccin-latte" } },
) {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, { ...options, cssVariablePrefix: "--shiki-" });
}
