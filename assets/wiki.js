/* Swarm Survivor Wiki: mobile menu, language memory, instant search, random page, sortable tables. No dependencies. */
(function () {
  "use strict";
  var body = document.body, lang = body.getAttribute("data-lang") || "en", here = body.getAttribute("data-page") || "";
  var T = lang === "ru"
    ? { none: "Ничего не найдено", all: "Все результаты для «%s»", results: "Результаты поиска", count: "Найдено: %d", empty: "Введите запрос в поле поиска вверху." }
    : { none: "No pages found", all: "All results for “%s”", results: "Search results", count: "%d pages found", empty: "Type a query into the search box above." };

  // mobile menu
  var burger = document.getElementById("burger"), scrim = document.getElementById("scrim");
  function setNav(open) { body.classList.toggle("nav-open", open); if (burger) burger.setAttribute("aria-expanded", open ? "true" : "false"); }
  if (burger) burger.addEventListener("click", function () { setNav(!body.classList.contains("nav-open")); });
  if (scrim) scrim.addEventListener("click", function () { setNav(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });

  // remember the language choice (the root index.html reads it)
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  store("ssw-lang", lang);
  Array.prototype.forEach.call(document.querySelectorAll(".langs a"), function (a) {
    a.addEventListener("click", function () { store("ssw-lang", a.getAttribute("data-lang")); });
  });

  // search index (lazy: loaded on first use)
  var INDEX = null, waiting = [];
  function withIndex(cb) {
    if (INDEX) return cb(INDEX);
    waiting.push(cb);
    if (waiting.length > 1) return;
    var s = document.createElement("script");
    s.src = "search-index.js";
    s.onload = function () { INDEX = window.SSW_INDEX || []; var w = waiting; waiting = []; w.forEach(function (f) { f(INDEX); }); };
    document.head.appendChild(s);
  }
  function norm(x) { return (x || "").toLowerCase().replace(/ё/g, "е"); }
  // light stemming so "молния" also finds "молнии", "bosses" finds "boss"
  function stem(w) {
    if (/[а-я]/.test(w) && w.length >= 5) return w.slice(0, w.length - (w.length >= 7 ? 3 : 2));
    if (/^[a-z]+$/.test(w) && w.length >= 5) return w.replace(/(ies|es|s|ing|ed)$/, "");
    return w;
  }
  function score(e, terms) {
    var t = norm(e.t), k = norm(e.k), h = norm(e.h.join(" ")), d = norm(e.d), x = norm(e.x), total = 0;
    for (var i = 0; i < terms.length; i++) {
      var q = terms[i], s = 0;
      if (t === q) s += 120; else if (t.indexOf(q) === 0) s += 90; else if (t.indexOf(q) >= 0) s += 60;
      if (k.indexOf(q) >= 0) s += 35;
      if (h.indexOf(q) >= 0) s += 22;
      if (d.indexOf(q) >= 0) s += 15;
      if (x.indexOf(q) >= 0) s += 6 + Math.min(10, x.split(q).length - 1);
      if (!s) return 0;
      total += s;
    }
    return total;
  }
  function find(q, idx) {
    var terms = norm(q).split(/[\s,.;:!?()«»"]+/).filter(function (w) { return w.length > 0; }).map(stem);
    if (!terms.length) return [];
    var out = [];
    for (var i = 0; i < idx.length; i++) { var s = score(idx[i], terms); if (s) out.push([s, idx[i]]); }
    out.sort(function (a, b) { return b[0] - a[0]; });
    return out.map(function (r) { return r[1]; });
  }
  function escH(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hl(text, q) {
    var out = escH(text);
    norm(q).split(/\s+/).filter(function (w) { return w.length > 1; }).forEach(function (w) {
      var re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }
  function snippet(e, q) {
    var x = e.x, terms = norm(q).split(/\s+/).filter(Boolean), nx = norm(x), pos = -1;
    for (var i = 0; i < terms.length && pos < 0; i++) pos = nx.indexOf(terms[i]);
    if (pos < 0 || norm(e.d).indexOf(terms[0]) >= 0) return e.d;
    var a = Math.max(0, pos - 60);
    return (a ? "…" : "") + x.substr(a, 170) + "…";
  }

  var q = document.getElementById("q"), box = document.getElementById("results"), sel = -1;
  function render(list, query) {
    if (!box) return;
    if (!query.trim()) { box.hidden = true; return; }
    var html = "";
    if (!list.length) html = '<div class="none">' + T.none + "</div>";
    list.slice(0, 8).forEach(function (e, i) {
      html += '<a href="' + e.s + '.html" role="option" data-i="' + i + '"><span class="rt">' + hl(e.t, query) + '</span><span class="rc">' + escH(e.c) +
        '</span><span class="rd">' + hl(snippet(e, query), query) + "</span></a>";
    });
    if (list.length > 8) html += '<a class="more" href="search.html?q=' + encodeURIComponent(query) + '">' + T.all.replace("%s", escH(query)) + "</a>";
    box.innerHTML = html; box.hidden = false; sel = -1;
  }
  if (q) {
    q.addEventListener("focus", function () { withIndex(function () { }); });
    q.addEventListener("input", function () { var v = q.value; withIndex(function (idx) { if (q.value === v) render(find(v, idx), v); }); });
    q.addEventListener("keydown", function (e) {
      var items = box ? box.querySelectorAll("a") : [];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        sel = e.key === "ArrowDown" ? (sel + 1) % items.length : (sel <= 0 ? items.length - 1 : sel - 1);
        Array.prototype.forEach.call(items, function (a, i) { a.classList.toggle("sel", i === sel); });
      } else if (e.key === "Enter" && sel >= 0 && items[sel]) { e.preventDefault(); location.href = items[sel].getAttribute("href"); }
      else if (e.key === "Escape") { box.hidden = true; }
    });
    document.addEventListener("click", function (e) { if (box && !box.contains(e.target) && e.target !== q) box.hidden = true; });
  }

  // random page
  Array.prototype.forEach.call(document.querySelectorAll("[data-random]"), function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      withIndex(function (idx) {
        var pool = idx.filter(function (x) { return x.s !== here && x.s.indexOf("category-") !== 0 && x.s !== "search" && x.s !== "all-pages"; });
        if (pool.length) location.href = pool[Math.floor(Math.random() * pool.length)].s + ".html";
      });
    });
  });

  // full search page
  var sp = document.getElementById("search-results");
  if (sp) {
    var m = /[?&]q=([^&]*)/.exec(location.search), query = m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    if (q) q.value = query;
    if (!query) sp.innerHTML = "<p>" + T.empty + "</p>";
    else withIndex(function (idx) {
      var list = find(query, idx), html = "<p>" + T.count.replace("%d", list.length) + "</p>";
      list.forEach(function (e) {
        html += '<div class="hit"><a href="' + e.s + '.html">' + hl(e.t, query) + '</a><span class="rc">' + escH(e.c) + "</span><p>" + hl(snippet(e, query), query) + "</p></div>";
      });
      if (!list.length) html = "<p>" + T.none + "</p>";
      sp.innerHTML = html;
    });
  }

  // sortable tables (numbers sort numerically)
  Array.prototype.forEach.call(document.querySelectorAll("table.sortable"), function (tb) {
    var ths = tb.querySelectorAll("thead th");
    Array.prototype.forEach.call(ths, function (th, col) {
      th.classList.add("sortable");
      var asc = false;
      th.addEventListener("click", function () {
        var rows = Array.prototype.slice.call(tb.tBodies[0].rows);
        asc = !asc;
        function val(r) {
          var t = (r.cells[col] ? r.cells[col].textContent : "").trim();
          var n = parseFloat(t.replace(/[\s ]/g, "").replace(",", ".").replace(/^[×+]/, ""));
          return isNaN(n) ? t.toLowerCase() : n;
        }
        rows.sort(function (a, b) { var x = val(a), y = val(b); if (x === y) return 0; return (x > y ? 1 : -1) * (asc ? 1 : -1); });
        rows.forEach(function (r) { tb.tBodies[0].appendChild(r); });
      });
    });
  });
})();
