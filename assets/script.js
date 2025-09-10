// Front-end glue: show health, payload URL (if tunnel active), totals and recent messages
async function tryFetch(url, opts) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(r.status + " " + r.statusText);
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function hydrate() {
  const healthEl = document.getElementById("health");
  const payloadEl = document.getElementById("payloadUrl");
  const totalEl = document.getElementById("total");
  const recentList = document.getElementById("recentList");

  const health = await tryFetch("/healthz");
  if (health && health.ok) {
    healthEl.textContent = "OK";
    healthEl.classList.add("ok");
  } else {
    healthEl.textContent = "Unavailable";
    healthEl.classList.add("fail");
  }

  const t = await tryFetch("/_tunnel");
  const url = t && t.url ? t.url : null;
  payloadEl.textContent = url ? url : "Waiting for tunnel…";
  payloadEl.dataset.url = url || "";

  const analytics = await tryFetch("/analytics.json");
  if (analytics) {
    totalEl.textContent = analytics.total;
  }

  const recent = await tryFetch("/events/recent?n=12");
  if (recent && Array.isArray(recent.events)) {
    recentList.innerHTML = recent.events
      .map(ev => `<li><em>${(ev.sender && ev.sender.name) || "Unknown"}</em>: ${ev.summary || "(no text)"}</li>`)
      .join("");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  hydrate();
  const copyBtn = document.getElementById("copyPayload");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const el = document.getElementById("payloadUrl");
      const url = el && el.dataset.url;
      if (!url) {
        alert("No public Payload URL yet. Start the server with: npm run dev:tunnel");
        return;
      }
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy Payload URL"), 1500);
    });
  }
});