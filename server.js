import fs from "fs";
import path from "path";
import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic config
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");
const TUNNEL_FILE = path.join(DATA_DIR, "tunnel_url.txt");

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(EVENTS_FILE)) {
  fs.writeFileSync(EVENTS_FILE, "", "utf-8");
}

const app = express();

// Middleware
app.use(morgan("dev"));
app.use(bodyParser.json({ type: ["application/json", "application/*+json"], limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true })); // fallback if Basecamp ever posts form-encoded
app.use((req, res, next) => {
  // Basecamp can deliver webhooks without content-type sometimes
  if (!req.is("application/json") && req.method === "POST" && req.headers["content-type"]?.includes("json") === false) {
    // Attempt to parse raw body if needed (Express needs a body parser for raw, but keep simple)
  }
  next();
});

// Serve static site
app.use("/", express.static(__dirname));

// Utility: write event to JSONL
function appendEvent(rec) {
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(rec) + "\n");
}

// Utility: read last N normalized events
function readRecent(n = 50) {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  const text = fs.readFileSync(EVENTS_FILE, "utf-8");
  const lines = text.trim() ? text.trim().split("\n") : [];
  const slice = lines.slice(-n);
  const out = [];
  for (const l of slice) {
    try {
      const parsed = JSON.parse(l);
      out.push(parsed.normalized || parsed);
    } catch {
      // skip
    }
  }
  return out.reverse();
}

// Utility: basic summarizer (extract first sentence or 160 chars)
function summarizeText(text) {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim().replace(/\s+/g, " ");
  const sentence = trimmed.split(/(?<=[.!?])\s+/)[0];
  const candidate = sentence.length > 0 ? sentence : trimmed;
  return candidate.length > 160 ? candidate.slice(0, 157) + "..." : candidate;
}

// Utility: naive keyword extraction
const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","this","that","those","these",
  "is","am","are","was","were","be","been","being","to","for","of","on","in",
  "it","with","as","at","by","from","we","you","they","i","he","she","them",
  "our","us","your","yours","their","theirs","me","my","mine","so","not","do",
  "did","does","will","would","can","could","should","have","has","had","about",
  "just","like","up","down","over","under","into","out","than","too","very"
]);
function extractKeywords(text, max = 10) {
  if (!text) return [];
  const counts = {};
  for (const raw of text.toLowerCase().match(/[a-z0-9\-']+/g) || []) {
    const token = raw.replace(/^'|'\$/g, "");
    if (!token || STOPWORDS.has(token)) continue;
    counts[token] = (counts[token] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k, v]) => ({ word: k, count: v }));
}

// Webhook endpoint
app.post("/webhooks/basecamp", (req, res) => {
  // Basecamp posts JSON bodies. We store everything we get to allow future enrichment.
  const event = req.body || {};

  // Identify message-like events
  const type = event?.recording_type || event?.kind || event?.content_type || "unknown";
  const action = event?.action || event?.event || "unknown";
  const created_at = event?.created_at || event?.timestamp || new Date().toISOString();

  // Try to pull message content fields that Basecamp commonly uses
  const message =
    event?.data?.content ||
    event?.data?.message ||
    event?.content ||
    event?.details?.content ||
    event?.summary ||
    "";

  const sender_name =
    event?.creator?.name ||
    event?.creator?.full_name ||
    event?.user?.name ||
    event?.person?.name ||
    "Unknown";

  const sender_id =
    event?.creator?.id || event?.user?.id || event?.person?.id || null;

  const project_id =
    event?.project?.id || event?.bucket?.id || event?.project_id || null;

  const chat_id =
    event?.chat?.id || event?.recording?.id || event?.target?.id || null;

  const normalized = {
    id: uuidv4(),
    received_at: new Date().toISOString(),
    headers: {
      "x-basecamp-webhook": req.headers["x-basecamp-webhook"] || null,
      "user-agent": req.headers["user-agent"] || null
    },
    type,
    action,
    created_at,
    project_id,
    chat_id,
    sender: { id: sender_id, name: sender_name },
    message,
    summary: summarizeText(message),
    keywords: extractKeywords(message)
  };

  appendEvent({ raw: event, normalized });

  // Log to console to help with debugging during testing
  console.log(`[Basecamp webhook] type=${normalized.type} action=${normalized.action} sender="${normalized.sender.name}" summary="${normalized.summary}"`);

  // Always acknowledge quickly
  res.status(200).json({ ok: true });
});

// Recent events (for homepage preview/debug)
app.get("/events/recent", (req, res) => {
  const n = Number(req.query.n || 25);
  res.json({ events: readRecent(Math.max(1, Math.min(n, 200))) });
});

// Analytics JSON
app.get("/analytics.json", (req, res) => {
  const text = fs.existsSync(EVENTS_FILE) ? fs.readFileSync(EVENTS_FILE, "utf-8") : "";
  const lines = text.trim() ? text.trim().split("\n") : [];
  const events = lines.map(l => {
    try { return JSON.parse(l).normalized; } catch { return null; }
  }).filter(Boolean);

  const total = events.length;

  // by day
  const byDayMap = {};
  for (const ev of events) {
    const day = (ev.created_at || ev.received_at).slice(0, 10);
    byDayMap[day] = (byDayMap[day] || 0) + 1;
  }
  const byDay = Object.entries(byDayMap).sort(([a],[b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  // by sender
  const bySenderMap = {};
  for (const ev of events) {
    const name = ev.sender?.name || "Unknown";
    bySenderMap[name] = (bySenderMap[name] || 0) + 1;
  }
  const bySender = Object.entries(bySenderMap).sort((a,b) => b[1]-a[1]).map(([name,count]) => ({ name, count }));

  // top keywords
  const keywordCounts = {};
  for (const ev of events) {
    for (const { word, count } of ev.keywords || []) {
      keywordCounts[word] = (keywordCounts[word] || 0) + count;
    }
  }
  const topKeywords = Object.entries(keywordCounts).sort((a,b) => b[1]-a[1]).slice(0, 20).map(([word, count]) => ({ word, count }));

  res.json({ total, byDay, bySender, topKeywords, latest: events.slice(-20).reverse() });
});

// Simple analytics page
app.get("/analytics", (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Basecamp Chat Analytics</title>
<link rel="stylesheet" href="/assets/style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
</head>
<body>
<main>
  <h1>Basecamp Chat Analytics</h1>
  <section>
    <div id="totals"></div>
    <canvas id="byDay" height="120"></canvas>
    <canvas id="bySender" height="120" style="margin-top: 26px;"></canvas>
    <h3 style="margin-top:28px;">Top Keywords</h3>
    <ul id="keywords"></ul>
    <h3 style="margin-top:28px;">Latest Messages</h3>
    <ol id="latest"></ol>
  </section>
</main>
<footer>
  <p>&copy; ${new Date().getFullYear()} Basecamp Webhook Collector</p>
</footer>
<script>
async function load() {
  const res = await fetch('/analytics.json');
  const data = await res.json();

  document.getElementById('totals').innerHTML = '<strong>Total messages:</strong> ' + data.total;

  const labels = data.byDay.map(d => d.date);
  const counts = data.byDay.map(d => d.count);
  new Chart(document.getElementById('byDay'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Messages per day', data: counts, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', tension: 0.25 }]},
    options: { plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
  });

  const sLabels = data.bySender.map(d => d.name);
  const sCounts = data.bySender.map(d => d.count);
  new Chart(document.getElementById('bySender'), {
    type: 'bar',
    data: { labels: sLabels, datasets: [{ label: 'By sender', data: sCounts, backgroundColor: '#10b981' }]},
    options: { indexAxis: 'y', plugins: { legend: { display: true } }, scales: { x: { beginAtZero: true } } }
  });

  document.getElementById('keywords').innerHTML =
    data.topKeywords.map(k => '<li>' + k.word + ' (' + k.count + ')</li>').join('');

  document.getElementById('latest').innerHTML =
    data.latest.map(ev => '<li><em>' + (ev.sender?.name || 'Unknown') + '</em>: ' + (ev.summary || '(no text)') + '</li>').join('');
}
load();
</script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// Health check
app.get("/healthz", (req, res) => res.json({ ok: true }));

// Localtunnel support for free public URL
let currentTunnelUrl = null;
app.get("/_tunnel", (req, res) => {
  res.json({ url: currentTunnelUrl });
});

app.listen(PORT, async () => {
  // eslint-disable-next-line no-console
  console.log(`Webhook server listening on http://localhost:${PORT}`);
  console.log(`POST your Basecamp webhook to: http://localhost:${PORT}/webhooks/basecamp`);
  console.log(`View analytics at: http://localhost:${PORT}/analytics`);

  if (process.env.ENABLE_TUNNEL === "true") {
    try {
      const localtunnel = (await import("localtunnel")).default;
      const tunnel = await localtunnel({ port: Number(PORT) });
      currentTunnelUrl = `${tunnel.url}/webhooks/basecamp`;
      fs.writeFileSync(TUNNEL_FILE, currentTunnelUrl, "utf-8");
      console.log(`Public Payload URL (via localtunnel): ${currentTunnelUrl}`);
      tunnel.on("close", () => {
        console.log("Localtunnel closed");
      });
    } catch (e) {
      console.error("Failed to start localtunnel. You can still use localhost or start ngrok manually.", e?.message || e);
    }
  }
});