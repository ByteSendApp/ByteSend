import type { CapturedMessage } from "./store.ts";

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const OUTCOME_LABEL: Record<CapturedMessage["outcome"], string> = {
  delivered: "Delivered",
  bounced: "Bounced",
  complained: "Complained",
  suppressed: "Suppressed",
};

const STYLE = `
  :root { --bg:#fff; --card:#fff; --fg:#151821; --muted:#646a7a; --border:#e3e6ec; --accent:#0057ff;
          --ok:#1a8a5a; --bad:#d6334a; --warn:#b97707; color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0a0b0e; --card:#0f1013; --fg:#eceef2; --muted:#959aa8; --border:#22252d; --accent:#4f8dff;
            --ok:#4cc38a; --bad:#f2606f; --warn:#f5b74f; color-scheme: dark; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:1000px; margin:0 auto; padding:24px 16px 48px; }
  header { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
  h1 { font-size:18px; margin:0; letter-spacing:-0.01em; }
  p.sub { margin:2px 0 0; color:var(--muted); font-size:13px; }
  .card { border:1px solid var(--border); border-radius:8px; background:var(--card); overflow:hidden; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; font-weight:500; color:var(--muted); font-size:12px; padding:8px 12px; border-bottom:1px solid var(--border); }
  td { padding:9px 12px; border-bottom:1px solid var(--border); vertical-align:top; }
  tr:last-child td { border-bottom:0; }
  tr:hover td { background:color-mix(in srgb, var(--fg) 4%, transparent); }
  a { color:inherit; text-decoration:none; }
  .subject { font-weight:500; }
  .muted { color:var(--muted); }
  .pill { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500; white-space:nowrap; }
  .pill::before { content:""; width:6px; height:6px; border-radius:50%; background:currentColor; }
  .delivered { color:var(--ok); } .bounced, .suppressed { color:var(--bad); } .complained { color:var(--warn); }
  .empty { padding:48px 16px; text-align:center; color:var(--muted); }
  code { font:12px ui-monospace, SFMono-Regular, Menlo, monospace; }
  button { font:inherit; font-size:13px; border:1px solid var(--border); background:var(--card); color:var(--fg); border-radius:6px; padding:5px 10px; cursor:pointer; }
  dl { display:grid; grid-template-columns:max-content 1fr; gap:6px 16px; margin:0; padding:14px 16px; font-size:13px; }
  dt { color:var(--muted); } dd { margin:0; overflow-wrap:anywhere; }
  iframe { width:100%; min-height:520px; border:0; background:#fff; display:block; }
  pre { margin:0; padding:14px 16px; white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.6 ui-monospace, monospace; }
  .tabs { display:flex; gap:4px; padding:8px; border-bottom:1px solid var(--border); }
  .tabs a { padding:4px 10px; border-radius:6px; font-size:13px; color:var(--muted); }
  .tabs a.on { background:color-mix(in srgb, var(--fg) 8%, transparent); color:var(--fg); }
  .stack > * + * { margin-top:12px; }
  @media (max-width:640px) { .hide-sm { display:none; } }
`;

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

export function renderInbox(messages: CapturedMessage[]) {
  const rows = messages
    .map(
      (m) => `<tr>
      <td><a href="/messages/${encodeURIComponent(m.id)}"><div class="subject">${esc(m.subject || "(no subject)")}</div>
      <div class="muted">${esc(m.from)} → ${esc(m.to.join(", "))}</div></a></td>
      <td><span class="pill ${m.outcome}">${OUTCOME_LABEL[m.outcome]}</span></td>
      <td class="muted hide-sm" title="${esc(m.receivedAt)}">${new Date(m.receivedAt).toLocaleString()}</td>
    </tr>`,
    )
    .join("");

  return page(
    "Local SES inbox",
    `<header><div><h1>Local SES inbox</h1><p class="sub">Mail ByteSend sent through this emulator. Nothing here leaves your machine.</p></div>
    <button onclick="fetch('/api/messages',{method:'DELETE'}).then(()=>location.reload())">Clear</button></header>
    <div class="card">${
      messages.length
        ? `<table><thead><tr><th>Message</th><th>Outcome</th><th class="hide-sm">Received</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<div class="empty">No mail yet. Send something from ByteSend and it shows up here.<br><br>
           Tip: send to <code>bounce@simulator.amazonses.com</code> or <code>you+complaint@example.com</code> to test bounces and complaints.</div>`
    }</div>
    <script>setTimeout(() => location.reload(), 5000)</script>`,
  );
}

export function renderMessage(m: CapturedMessage) {
  const tab = m.html ? "html" : "text";
  return page(
    m.subject || "Message",
    `<div class="stack"><a href="/" class="muted">← Inbox</a>
    <div class="card"><dl>
      <dt>Subject</dt><dd class="subject">${esc(m.subject || "(no subject)")}</dd>
      <dt>From</dt><dd>${esc(m.from)}</dd>
      <dt>To</dt><dd>${esc(m.to.join(", "))}</dd>
      <dt>Outcome</dt><dd><span class="pill ${m.outcome}">${OUTCOME_LABEL[m.outcome]}</span></dd>
      <dt>Message ID</dt><dd><code>${esc(m.id)}</code></dd>
      <dt>Received</dt><dd>${esc(new Date(m.receivedAt).toLocaleString())}</dd>
    </dl></div>
    <div class="card">
      <div class="tabs">
        ${m.html ? `<a href="#html" class="${tab === "html" ? "on" : ""}" onclick="show('html',this)">HTML</a>` : ""}
        ${m.text ? `<a href="#text" class="${tab === "text" ? "on" : ""}" onclick="show('text',this)">Text</a>` : ""}
        <a href="#headers" onclick="show('headers',this)">Headers</a>
      </div>
      ${m.html ? `<iframe id="html" sandbox="" srcdoc="${esc(m.html)}"></iframe>` : ""}
      ${m.text ? `<pre id="text" ${tab === "text" ? "" : "hidden"}>${esc(m.text)}</pre>` : ""}
      <pre id="headers" hidden>${esc(m.headers.map((h) => `${h.name}: ${h.value}`).join("\n"))}</pre>
    </div></div>
    <script>function show(id, el){document.querySelectorAll('#html,#text,#headers').forEach(n=>n.hidden=n.id!==id);
    document.querySelectorAll('.tabs a').forEach(a=>a.classList.toggle('on',a===el));event.preventDefault();}</script>`,
  );
}
