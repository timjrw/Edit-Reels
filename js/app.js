/* js/app.js */
const DATA_URL = "data/projects.json";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

function getYoutubeThumbnail(id){
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function setActiveNav(route){
  document.querySelectorAll('.btn[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
}

function cardHTML(item) {
  const title = escapeHtml(item.title);
  const year = item.year ? String(item.year) : "";

  const href = item.platform === "youtube"
    ? `https://youtu.be/${item.id}`
    : (item.url || "#");

  const cover = item.cover
    ? item.cover
    : (item.platform === "youtube" ? getYoutubeThumbnail(item.id) : "");

  const platformLabel = item.platform === "youtube" ? "YouTube" : (item.platform || "Link");
  const ytClass = item.platform === "youtube" ? "yt-hover" : "";

  return `
    <a class="item" href="${href}" target="_blank" rel="noopener">
      <p class="title" title="${title}">${title}</p>

      <div class="thumb ${ytClass}" ${item.platform === "youtube" ? `data-video="${item.id}"` : ""}>
        <img src="${cover}" alt="${title}" loading="lazy">
        <div class="player"></div>
      </div>

      <div class="meta">
        <p class="sub">${escapeHtml(platformLabel)}</p>
        ${year ? `<span class="year" aria-label="On air year">${escapeHtml(year)}</span>` : ""}
      </div>
    </a>
  `;
}

function seeMoreCardHTML(label, url){
  return `
    <a class="item" href="${url}">
      <p class="title">See more</p>
      <div class="see-more">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>View full page</span>
        </div>
      </div>
      <div class="meta">
        <p class="sub">Menu</p>
        <span class="year"></span>
      </div>
    </a>
  `;
}

// Home section = 8 items + 1 see more = 9 slots
function sectionHTML(title, note, items, seeMoreLabel, seeMoreUrl) {
  const sliced = items.slice(0, 8);
  const slots = [
    ...sliced.map(cardHTML),
    seeMoreCardHTML(seeMoreLabel, seeMoreUrl)
  ];

  return `
    <section class="section">
      <div class="section-head">
        <h2 class="section-title">${escapeHtml(title)}</h2>
        <p class="section-note">${escapeHtml(note)}</p>
      </div>
      <div class="grid">
        ${slots.join("")}
      </div>
    </section>
  `;
}

function gridHTML(items) {
  return `
    <section class="section">
      <div class="grid">
        ${items.map(cardHTML).join("")}
      </div>
    </section>
  `;
}

/* ---------- YouTube Hover Preview ---------- */
const players = new Map();

function ensurePlayer(el) {
  if (players.has(el)) return players.get(el);
  const id = el.dataset.video;
  const mount = el.querySelector(".player");

  const player = new YT.Player(mount, {
    videoId: id,
    playerVars: {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1
    },
    events: { onReady: (e) => e.target.mute() }
  });

  players.set(el, player);
  return player;
}

function play(el) {
  el.classList.add("is-playing");
  const p = ensurePlayer(el);

  if (!el._loopTimer) {
    el._loopTimer = setInterval(() => {
      try {
        const dur = p.getDuration?.() || 0;
        const cur = p.getCurrentTime?.() || 0;
        if (dur && cur > dur - 0.25) p.seekTo(0, true);
      } catch {}
    }, 200);
  }

  let tries = 0;
  const t = setInterval(() => {
    tries++;
    try {
      if (p?.playVideo) {
        p.mute();
        p.playVideo();
        clearInterval(t);
      }
    } catch {}
    if (tries > 20) clearInterval(t);
  }, 50);
}

function stop(el) {
  const p = players.get(el);
  if (p?.pauseVideo) {
    try { p.pauseVideo(); } catch {}
  }
  el.classList.remove("is-playing");
  if (el._loopTimer) {
    clearInterval(el._loopTimer);
    el._loopTimer = null;
  }
}

function bindHover() {
  document.querySelectorAll(".yt-hover").forEach(el => {
    if (el.__bound) return;
    el.__bound = true;

    el.addEventListener("mouseenter", () => play(el));
    el.addEventListener("mouseleave", () => stop(el));

    el.addEventListener("touchstart", (ev) => {
      if (!el.classList.contains("is-playing")) {
        ev.preventDefault();
        play(el);
        setTimeout(() => stop(el), 2000);
      }
    }, { passive: false });
  });
}

window.onYouTubeIframeAPIReady = () => {
  window.__YT_READY__ = true;
  bindHover();
};

/* ---------- Page render ---------- */
function sortByYearDesc(a, b){
  const ya = Number(a.year || 0);
  const yb = Number(b.year || 0);
  if (yb !== ya) return yb - ya;
  return String(a.title).localeCompare(String(b.title));
}

function renderPage(route, data){
  const app = document.getElementById("app");
  if (!app) return;

  setActiveNav(route);

  const ads = data.filter(x => x.category === "ads").sort(sortByYearDesc);
  const mv  = data.filter(x => x.category === "mv").sort(sortByYearDesc);
  const series = data.filter(x => x.category === "series").sort(sortByYearDesc);

  if (route === "home") {
    app.innerHTML = [
      sectionHTML("Ads / Shorts", "Ads / Branded Content", ads, "Ads / Shorts", "./ads.html"),
      sectionHTML("MV", "Music Videos", mv, "MV", "./mv.html")
    ].join("");
  }

  if (route === "ads") app.innerHTML = gridHTML(ads);
  if (route === "mv") app.innerHTML = gridHTML(mv);

  if (route === "series") {
    app.innerHTML = series.length
      ? gridHTML(series)
      : `<p class="empty">Series coming soon.</p>`;
  }

  if (window.__YT_READY__) bindHover();
}

function initPage(route){
  fetch(DATA_URL)
    .then(r => r.json())
    .then(data => renderPage(route, data))
    .catch(err => {
      const app = document.getElementById("app");
      if (app) app.innerHTML = `<p style="color:#b00">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
    });
}

window.TIMJRW = { initPage, setActiveNav };
