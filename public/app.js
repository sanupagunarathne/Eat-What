const $ = (s) => document.querySelector(s);
const main = $("#main");
const app = {
  room: null,
  screen: "home",
  tab: new URLSearchParams(location.search).has("room") ? "join" : "create",
  busy: false,
  error: "",
  offline: false,
};
let navigationVersion = 0;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const arrow =
  '<span aria-hidden="true"><svg class="icon arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span>';
const money = (value) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(value);
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{ people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>', wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8V5a2 2 0 0 1 2-2h12m4 8h-6v5h6m-3-2.5h.01"/>', check: '<path d="m5 12 4 4L19 6"/>', cross: '<path d="m6 6 12 12M6 18 18 6"/>', copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>', bowl: '<path d="M3 11h18c0 7-4 10-9 10S3 18 3 11Zm3-4c-3-3 3-3 0-6m6 6c-3-3 3-3 0-6m6 6c-3-3 3-3 0-6"/>', heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>' }[name]}</svg>`;
async function api(path, data) {
  const response = await fetch(`/api/rooms${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}
function announce(text) {
  $("#announcer").textContent = text;
}
function remember(room) {
  app.room = room;
  localStorage.setItem("eatwhat-room", room.code);
  app.screen = "room";
  if (location.search !== `?room=${room.code}`)
    history.pushState({}, "", `?room=${room.code}`);
}
function goHome() {
  navigationVersion++;
  app.screen = "home";
  app.tab = "create";
  app.busy = false;
  app.error = "";
  app.offline = false;
  if (location.search || location.hash) history.pushState({}, "", "/");
  render(true);
  announce(
    "Create or join a room. You can return to your previous room below.",
  );
}
function errorMarkup() {
  return app.error
    ? `<div class="error-message" role="alert">${icon("cross")}<span>${escape(app.error)}</span></div>`
    : "";
}
function stepLabel(step) {
  return `<div class="steps" aria-label="Step ${step} of 3"><span class="${step === 1 ? "current" : ""}">01 <span>Make a room</span></span><i></i><span class="${step === 2 ? "current" : ""}">02 <span>Vote together</span></span><i></i><span class="${step === 3 ? "current" : ""}">03 <span>Let’s eat</span></span></div>`;
}
function home() {
  const join = app.tab === "join";
  const invite = new URLSearchParams(location.search).get("room") || "";
  return `<section class="home-grid"><div class="intro"><div class="eyebrow"><span class="little-star" aria-hidden="true"><svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/></svg></span> LESS DECIDING. MORE DINING.</div><h1>Big appetites.<br>Different tastes.<br><span>One happy table.</span></h1><p class="intro-copy">Finding food everyone loves shouldn’t be the hardest part of getting together. Let’s settle it, one bite at a time.</p><div class="hero-photo"><img src="/images/biryani.jpg" alt="A generous serving of fragrant golden biryani with fresh herbs" fetchpriority="high"><div class="photo-caption"><span>ON THE MENU</span><strong>Good food. Better company.</strong></div><div class="round-stamp" aria-label="100 percent group approved"><span>100%</span>GROUP<br>APPROVED <span aria-hidden="true"><svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/></svg></span></div></div><p class="photo-footnote"><span class="coral-dot" aria-hidden="true"></span> A seat for every taste. A yes from everyone.</p></div><div class="setup-column"><section class="setup-card" aria-labelledby="setup-title"><div class="card-topline"><span>THE PLAN IS SIMPLE</span><span aria-hidden="true">NO. 001 / EAT</span></div><h2 id="setup-title">Your table starts here.</h2><p class="muted">Bring the people. We’ll help with the food.</p><div class="tabs" aria-label="Choose how to gather"><button class="tab ${!join ? "active" : ""}" data-tab="create" aria-pressed="${!join}">Create a room ${arrow}</button><button class="tab ${join ? "active" : ""}" data-tab="join" aria-pressed="${join}">Join a room ${arrow}</button></div><form id="room-form"><label for="name">YOUR NAME <span class="label-note">What should we call you?</span></label><input id="name" name="name" autocomplete="given-name" maxlength="24" placeholder="e.g. Alex" required>${join ? `<label for="code">ROOM CODE</label><input id="code" name="code" class="code-input" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="6" minlength="6" pattern="[A-Za-z0-9]{6}" placeholder="ABC123" value="${escape(invite)}" required><p class="field-help">Six characters. One good meal waiting to happen.</p>` : `<div class="divider-label"><span>SET THE TABLE</span><span aria-hidden="true">↓</span></div><div class="filter-grid"><div><label for="expected">${icon("people")} PEOPLE</label><input id="expected" name="expected" type="number" inputmode="numeric" min="1" step="1" placeholder="e.g. 5" required aria-describedby="expected-help"><p class="field-help" id="expected-help">Enter any group size.</p></div><div><label for="budget">${icon("wallet")} BUDGET (LKR)</label><input id="budget" name="budget" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="e.g. 5000" required></div><div><label for="distance">${icon("pin")} DISTANCE (KM)</label><input id="distance" name="distance" type="number" inputmode="decimal" min="0.1" step="0.1" placeholder="e.g. 3" required></div></div><label for="cuisine">WHAT ARE YOU CRAVING?</label><select id="cuisine" name="cuisine"><option value="Any">A little bit of everything</option><option>Indian</option><option>Italian</option><option>Asian</option><option>American</option></select><label class="check-label"><input type="checkbox" name="vegetarian"> Vegetarian options only <span aria-hidden="true">♧</span></label>`}${errorMarkup()}<button class="button gold submit" type="submit" ${app.busy ? "disabled" : ""}>${app.busy ? "Setting your table…" : join ? "Join room" : "Create room"} ${arrow}</button><p class="form-note">${icon(join ? "people" : "heart")} ${join ? "Your people are saving you a seat." : "No accounts. No endless group-chat debates."}</p></form>${app.room ? `<button class="resume text-button" id="resume">Back to room ${escape(app.room.code)} ${arrow}</button>` : ""}</section><div class="recipe-strip"><span class="eyebrow">A RECIPE FOR AGREEMENT</span><ol><li><b>01</b><span>Gather<br>your people</span></li><li><b>02</b><span>Vote with<br>your appetite</span></li><li><b>03</b><span>Find your<br>common craving</span></li></ol></div><p class="sample-note">A sample menu, a real group decision. <button class="text-button" id="sample-info">About this edition ${arrow}</button></p></div></section>`;
}
function filters(r) {
  return `<div class="filter-summary"><span>${icon("people")} ${r.expected} people</span><span>${icon("wallet")} Up to ${money(r.filters.budget)}</span><span>${icon("pin")} ${r.filters.distance} km</span><span>${escape(r.filters.cuisine === "Any" ? "All cuisines" : r.filters.cuisine)}${r.filters.vegetarian ? " · Vegetarian" : ""}</span></div>`;
}
function lobby(r) {
  const ready = r.members.filter((m) => m.ready).length,
    canStart = r.members.length === r.expected && ready === r.expected;
  return `${stepLabel(1)}<div class="page-heading"><span class="eyebrow">GOOD COMPANY COMES FIRST</span><h1>A table worth waiting for.</h1><p>Send the invite. Gather your people. Then let your appetites decide.</p></div><div class="lobby-grid"><div><section class="invite-panel"><span class="eyebrow">YOUR ROOM CODE</span><div class="room-code">${r.code}</div><p>One little code. A whole table of possibilities.</p><button class="button gold" id="copy">${icon("copy")} Copy invite link ${arrow}</button><p class="copy-status" id="copy-status" role="status"></p><input id="invite-fallback" class="hidden" readonly aria-label="Invite link to copy manually" value="${escape(location.origin + "/?room=" + r.code)}"></section><div class="session-menu"><span class="eyebrow">THE TABLE’S TASTES</span>${filters(r)}<p class="fine-print">Filters are set by the host. All votes stay private.</p></div></div><section class="members-card"><div class="card-topline"><span>THE GUEST LIST</span>${icon("people")}</div><h2><span class="gold-number">${r.members.length}</span> of ${r.expected} joined</h2><p class="muted">${ready} of ${r.expected} ready to dig in</p><ul class="member-list">${r.members.map((m, i) => `<li><span class="avatar tone-${i % 3}">${escape(m.name.charAt(0).toUpperCase())}</span><span class="member-name">${escape(m.name)}${m.me ? " <small>(you)</small>" : ""}<small>${m.host ? "Table host" : "Dinner crew"}</small></span><span class="badge ${m.ready ? "mint" : "waiting"}">${m.ready ? icon("check") + " Ready" : "Not ready"}</span></li>`).join("")}${r.expected > r.members.length ? `<li class="empty-seat"><span class="avatar">+</span><span>${r.expected - r.members.length} seats waiting to be filled</span></li>` : ""}</ul>${errorMarkup()}<button class="button ${r.ready ? "outline" : "mint"}" id="ready" ${app.busy ? "disabled" : ""}>${icon("check")} ${r.ready ? "Ready · change status" : "I’m ready to eat"}</button>${r.isHost ? `<button class="button gold" id="start" ${!canStart || app.busy ? "disabled" : ""}>Start voting ${arrow}</button><p class="form-note">${canStart ? "The whole table is here. Let’s do this." : "Voting opens when everyone has joined and is ready."}</p>` : '<p class="form-note">The host will start voting when everyone is ready.</p>'}</section></div>`;
}
function voting(r) {
  const meal = r.meals.find((m) => !r.votedIds.includes(m.id));
  if (!meal)
    return `${stepLabel(2)}<section class="waiting-card"><span class="big-symbol">${icon("check")}</span><span class="eyebrow">YOUR VOTES ARE IN</span><h1>Good taste takes a moment.</h1><p>${r.members.filter((m) => m.done).length} of ${r.expected} people have finished. Your votes are private while the rest of the table decides.</p><div class="waiting-people">${r.members.map((m) => `<span class="badge ${m.done ? "mint" : "waiting"}">${escape(m.name)} · ${m.done ? "Finished" : "Voting"}</span>`).join("")}</div><p class="fine-print">The result will appear here automatically.</p>${errorMarkup()}</section>`;
  return `${stepLabel(2)}<div class="voting-grid"><aside class="vote-intro"><span class="eyebrow">GO WITH YOUR GUT</span><h1>Would you<br>eat this?</h1><p>A little yes. A little no.<br>A meal everyone can get behind.</p><div class="vote-counter"><strong>${String(r.votedIds.length + 1).padStart(2, "0")}</strong><span>/ ${String(r.meals.length).padStart(2, "0")}<small>ON THE MENU</small></span></div><p class="privacy-note">${icon("heart")} Just your taste. Your votes stay private.</p>${filters(r)}<p class="fine-print">Room ${r.code} · ${r.members.filter((m) => m.done).length} of ${r.expected} finished</p></aside><section class="meal-card" aria-labelledby="meal-name"><div class="meal-image" id="swipe-card"><img src="/images/${meal.image}" alt="${escape(meal.name)}"><span class="image-pill">${escape(meal.cuisine)}${meal.vegetarian ? " · Vegetarian" : ""}</span><span class="image-count">${r.votedIds.length + 1} / ${r.meals.length}</span></div><div class="meal-info"><span class="eyebrow">${escape(meal.venue)} · SAMPLE VENUE</span><h2 id="meal-name">${escape(meal.name)}</h2><p>${escape(meal.description)}</p><div class="meal-meta"><span>${icon("wallet")} <strong>${money(meal.price)}</strong> / person</span><span>${icon("pin")} ${meal.distance} km away</span></div>${errorMarkup()}<div class="vote-actions"><button class="button outline" id="pass" ${app.busy ? "disabled" : ""}>${icon("cross", "coral-icon")} Pass</button><button class="button mint" id="yes" ${app.busy ? "disabled" : ""}>${icon("check")} Yes, I’d eat this</button></div><p class="swipe-note">Swipe left to pass, right to say yes. Buttons work too.</p></div></section></div>`;
}
function result(r) {
  const m = r.winner;
  if (r.phase === "empty" || !m)
    return `${stepLabel(3)}<section class="empty-state"><span class="big-symbol">${icon("bowl")}</span><span class="eyebrow">THERE’S ALWAYS ANOTHER ROUND</span><h1>${r.phase === "empty" ? "No meals fit these filters" : "No unanimous match"}</h1><p>${r.phase === "empty" ? "The sample menu has nothing within this combination. Create a new room with a wider budget, distance, or cuisine." : "Different cravings happen. Try another round, or create a new room with different filters."}</p>${filters(r)}${errorMarkup()}${r.isHost ? '<button class="button gold" id="new-room">Create a new room <svg class="icon arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></button>' : '<p class="fine-print">Ask your host about a new room, or wait here for another round.</p>'}<button class="button outline" id="restart" ${!r.isHost || app.busy ? "disabled" : ""}>${r.isHost ? "Back to the lobby" : "Waiting for the host"}</button></section>`;
  return `${stepLabel(3)}<section class="match-panel"><div class="match-copy"><span class="badge mint">${icon("check")} Everyone agreed</span><span class="eyebrow">THE TABLE HAS SPOKEN</span><h1>It’s a match.<br>Let’s eat.</h1><p>Different people. One very good decision.</p><div class="match-rule"></div><span class="eyebrow">YOUR COMMON CRAVING</span><h2>${escape(m.name)}</h2><p class="match-venue">${escape(m.venue)} · Sample venue</p><div class="meal-meta"><span>${icon("wallet")} ${money(m.price)} / person</span><span>${icon("pin")} ${m.distance} km away</span></div><a class="button gold" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.query + " near me")}" target="_blank" rel="noopener noreferrer">${icon("pin")} Get directions ${arrow}</a><p class="directions-note">Explore nearby ${escape(m.cuisine.toLowerCase())} restaurants. Menu, venue, and distance are illustrative.</p>${errorMarkup()}<button class="text-button light" id="restart" ${!r.isHost || app.busy ? "disabled" : ""}>${r.isHost ? 'Another round? Back to the lobby <svg class="icon arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>' : "Waiting for the host to open another round"}</button></div><div class="match-image"><img src="/images/${m.image}" alt="${escape(m.name)} — your group’s unanimous choice"><span class="match-stamp">ALL<br><b>${r.expected}</b><br>SAID YES</span></div></section>`;
}
function render(focus = false) {
  const previous = document.activeElement?.id;
  main.innerHTML = `${app.offline ? '<div class="connection-banner" role="status">Connection interrupted. Reconnecting to your table…</div>' : ""}${app.screen === "home" ? home() : app.room.phase === "lobby" ? lobby(app.room) : app.room.phase === "voting" ? voting(app.room) : result(app.room)}`;
  main.className = app.screen === "home" ? "home-main" : "room-main";
  if (app.screen === "room")
    main.insertAdjacentHTML(
      "afterbegin",
      '<div class="room-navigation"><button class="text-button" id="back-home">Back to create room</button><span class="fine-print">Your room and votes are saved.</span></div>',
    );
  bind();
  if (focus) {
    const heading = main.querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } else if (previous)
    document.getElementById(previous)?.focus({ preventScroll: true });
}
async function action(action, data = {}) {
  if (app.busy) return;
  const version = navigationVersion;
  app.busy = true;
  app.error = "";
  main.querySelectorAll("button").forEach((b) => {
    b.disabled = true;
  });
  const before = app.room.phase;
  try {
    const room = await api(`/${app.room.code}/${action}`, data);
    if (version !== navigationVersion) return;
    remember(room);
    app.error = "";
    announce(
      action === "vote"
        ? "Your private vote is saved."
        : action === "ready"
          ? room.ready
            ? "You are ready."
            : "You are not ready."
          : "Room updated.",
    );
  } catch (e) {
    if (version !== navigationVersion) return;
    app.error = e.message;
  } finally {
    if (version === navigationVersion) {
      app.busy = false;
      render(before !== app.room.phase);
    }
  }
}
function bind() {
  $("#back-home")?.addEventListener("click", goHome);
  main.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      app.tab = b.dataset.tab;
      app.error = "";
      render();
      main.querySelector(`[data-tab="${app.tab}"]`).focus();
    }),
  );
  $("#room-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (app.busy) return;
    const version = navigationVersion;
    const data = Object.fromEntries(new FormData(e.target));
    app.busy = true;
    app.error = "";
    const button = e.target.querySelector("[type=submit]");
    button.disabled = true;
    button.textContent = "Setting your table…";
    try {
      const join = app.tab === "join";
      const room = await api(
        join ? `/${data.code.trim().toUpperCase()}/join` : "",
        join
          ? { name: data.name }
          : {
              name: data.name,
              expected: Number(data.expected),
              budget: Number(data.budget),
              distance: Number(data.distance),
              cuisine: data.cuisine,
              vegetarian: data.vegetarian === "on",
            },
      );
      if (version !== navigationVersion) return;
      remember(room);
      app.busy = false;
      render(true);
    } catch (error) {
      if (version !== navigationVersion) return;
      app.error = error.message;
      app.busy = false;
      e.target.querySelector(".error-message")?.remove();
      button.insertAdjacentHTML("beforebegin", errorMarkup());
      button.disabled = false;
      button.innerHTML = `${app.tab === "join" ? "Join room" : "Create room"} ${arrow}`;
      if (app.tab === "join") $("#code").setAttribute("aria-invalid", "true");
    }
  });
  $("#ready")?.addEventListener("click", () =>
    action("ready", { ready: !app.room.ready }),
  );
  $("#start")?.addEventListener("click", () => action("start"));
  $("#restart")?.addEventListener("click", () => action("restart"));
  $("#new-room")?.addEventListener("click", goHome);
  $("#resume")?.addEventListener("click", () => {
    navigationVersion++;
    remember(app.room);
    render(true);
  });
  const vote = (yes) => {
    const meal = app.room?.meals.find((m) => !app.room.votedIds.includes(m.id));
    if (meal) action("vote", { mealId: meal.id, yes });
  };
  $("#yes")?.addEventListener("click", () => vote(true));
  $("#pass")?.addEventListener("click", () => vote(false));
  let down;
  $("#swipe-card")?.addEventListener("pointerdown", (e) => {
    if (e.isPrimary) down = { x: e.clientX, y: e.clientY };
  });
  $("#swipe-card")?.addEventListener("pointerup", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x,
      dy = e.clientY - down.y;
    down = null;
    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.5) vote(dx > 0);
  });
  $("#swipe-card")?.addEventListener("pointercancel", () => {
    down = null;
  });
  $("#copy")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${app.room.code}`,
      );
      $("#copy-status").textContent =
        "✓ Invite link copied. Send it to your people!";
    } catch {
      $("#invite-fallback").classList.remove("hidden");
      $("#invite-fallback").select();
      $("#copy-status").textContent = "Select and copy the invite link below.";
    }
  });
  $("#sample-info")?.addEventListener("click", () =>
    $("#how-dialog").showModal(),
  );
}
$("#how-button").addEventListener("click", () => $("#how-dialog").showModal());
$(".brand").addEventListener("click", (event) => {
  if (
    event.button ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  goHome();
});
// Re-read the URL when using browser Back/Forward, just as on a direct visit.
window.addEventListener("popstate", () => location.reload());
$$dialog();
function $$dialog() {
  document
    .querySelectorAll(".dialog-close")
    .forEach((b) =>
      b.addEventListener("click", () => $("#how-dialog").close()),
    );
  $("#how-dialog").addEventListener("click", (e) => {
    if (
      e.target === e.currentTarget &&
      (e.clientX < e.target.getBoundingClientRect().left ||
        e.clientX > e.target.getBoundingClientRect().right ||
        e.clientY < e.target.getBoundingClientRect().top ||
        e.clientY > e.target.getBoundingClientRect().bottom)
    )
      e.target.close();
  });
}
render();
const stored = localStorage.getItem("eatwhat-room"),
  requested = new URLSearchParams(location.search).get("room");
if (stored && (!requested || stored === requested)) {
  const version = navigationVersion;
  try {
    const room = await api(`/${stored}`);
    if (version === navigationVersion) {
      if (requested) remember(room);
      else app.room = room;
      render();
    }
  } catch {
    if (version === navigationVersion) localStorage.removeItem("eatwhat-room");
  }
}
let polling = false;
setInterval(async () => {
  if (
    app.screen !== "room" ||
    !app.room ||
    app.busy ||
    polling ||
    document.hidden
  )
    return;
  const version = navigationVersion;
  const code = app.room.code;
  polling = true;
  try {
    const next = await api(`/${code}`);
    if (app.busy || version !== navigationVersion || app.room?.code !== code)
      return;
    const changed = JSON.stringify(next) !== JSON.stringify(app.room);
    const phaseChanged = next.phase !== app.room.phase;
    const wasOffline = app.offline;
    app.offline = false;
    app.room = next;
    if ((changed || wasOffline) && app.screen === "room") {
      render(phaseChanged);
      if (phaseChanged) announce("Your table has moved to the next step.");
    }
  } catch {
    if (version !== navigationVersion || app.screen !== "room") return;
    if (!app.offline) {
      app.offline = true;
      if (app.screen === "room") render();
    }
  } finally {
    polling = false;
  }
}, 1500);
