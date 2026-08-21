(function () {
  "use strict";

  var LETTER_FULL_NAME = { F: "Findable", I: "Intuitive", N: "Necessary", D: "Directed" };
  var LETTER_ORDER = ["F", "I", "N", "D"];
  var ACTIVITY_LIMIT = 6;
  var FRICTION_LIMIT = 6;

  var statusDot = document.getElementById("statusDot");
  var statusText = document.getElementById("statusText");
  var notConfiguredState = document.getElementById("notConfiguredState");
  var waitingState = document.getElementById("waitingState");
  var wallMain = document.getElementById("wallMain");

  var statTotal = document.getElementById("statTotal");
  var statAvgScore = document.getElementById("statAvgScore");
  var statTopPage = document.getElementById("statTopPage");
  var letterBars = document.getElementById("letterBars");
  var frictionList = document.getElementById("frictionList");
  var activityList = document.getElementById("activityList");

  var adminBar = document.getElementById("adminBar");
  var adminClearBtn = document.getElementById("adminClearBtn");
  var adminStatus = document.getElementById("adminStatus");

  var dbRef = null;
  var collectionNameRef = "submissions";
  var lastTotal = 0;

  function setStatus(state, text) {
    statusDot.classList.remove("is-live", "is-error");
    if (state === "live") statusDot.classList.add("is-live");
    if (state === "error") statusDot.classList.add("is-error");
    statusText.textContent = text;
  }

  function isFirebaseConfigured() {
    var cfg = window.FIREBASE_CONFIG;
    if (!cfg || typeof window.firebase === "undefined") return false;
    var placeholderPattern = /^PASTE_/;
    return !placeholderPattern.test(cfg.apiKey || "") &&
      !placeholderPattern.test(cfg.projectId || "");
  }

  /* ---------------------------------------------------
     Build the letter bar rows once
  --------------------------------------------------- */
  function buildLetterBarSkeleton() {
    letterBars.innerHTML = "";
    LETTER_ORDER.forEach(function (letter) {
      var row = document.createElement("div");
      row.className = "letter-bar-row";
      row.innerHTML =
        '<div class="letter-bar-label">' +
          '<span class="letter-bar-glyph">' + letter + '</span>' +
          '<span>' + LETTER_FULL_NAME[letter] + '</span>' +
        '</div>' +
        '<div class="letter-bar-track"><div class="letter-bar-fill" id="fill-' + letter + '"></div></div>' +
        '<div class="letter-bar-pct" id="pct-' + letter + '">0%</div>';
      letterBars.appendChild(row);
    });
  }

  /* ---------------------------------------------------
     Aggregate raw submission docs into display data
  --------------------------------------------------- */
  function computeAggregates(docs) {
    var total = docs.length;
    var scoreSum = 0;
    var letterCounts = { F: 0, I: 0, N: 0, D: 0 };
    var frictionCounts = {};
    var pageCounts = {};

    docs.forEach(function (d) {
      scoreSum += (typeof d.score === "number" ? d.score : 0);

      (d.flags || []).forEach(function (label) {
        var letter = (label || "").charAt(0).toUpperCase();
        if (Object.prototype.hasOwnProperty.call(letterCounts, letter)) {
          letterCounts[letter] += 1;
        }
      });

      (d.friction || []).forEach(function (f) {
        frictionCounts[f] = (frictionCounts[f] || 0) + 1;
      });

      var page = d.page || "Other";
      pageCounts[page] = (pageCounts[page] || 0) + 1;
    });

    var topPage = null;
    var topPageCount = -1;
    Object.keys(pageCounts).forEach(function (p) {
      if (pageCounts[p] > topPageCount) {
        topPageCount = pageCounts[p];
        topPage = p;
      }
    });

    return {
      total: total,
      avgScore: total > 0 ? scoreSum / total : 0,
      letterCounts: letterCounts,
      frictionCounts: frictionCounts,
      topPage: topPage
    };
  }

  function docMillis(d) {
    if (d.submittedAt && typeof d.submittedAt.toMillis === "function") {
      return d.submittedAt.toMillis();
    }
    return 0;
  }

  /* ---------------------------------------------------
     Render
  --------------------------------------------------- */
  function render(docs) {
    lastTotal = docs.length;

    if (docs.length === 0) {
      waitingState.hidden = false;
      wallMain.hidden = true;
      return;
    }
    waitingState.hidden = true;
    wallMain.hidden = false;

    var agg = computeAggregates(docs);

    statTotal.textContent = String(agg.total);
    statAvgScore.textContent = agg.avgScore.toFixed(1) + "/4";
    statTopPage.textContent = agg.topPage || "\u2014";

    LETTER_ORDER.forEach(function (letter) {
      var count = agg.letterCounts[letter];
      var pct = agg.total > 0 ? Math.round((count / agg.total) * 100) : 0;
      var fillEl = document.getElementById("fill-" + letter);
      var pctEl = document.getElementById("pct-" + letter);
      if (fillEl) fillEl.style.width = pct + "%";
      if (pctEl) pctEl.textContent = pct + "%";
    });

    var frictionEntries = Object.keys(agg.frictionCounts).map(function (label) {
      return { label: label, count: agg.frictionCounts[label] };
    });
    frictionEntries.sort(function (a, b) { return b.count - a.count; });
    frictionEntries = frictionEntries.slice(0, FRICTION_LIMIT);

    frictionList.innerHTML = "";
    if (frictionEntries.length === 0) {
      var emptyLi = document.createElement("li");
      emptyLi.className = "friction-empty";
      emptyLi.textContent = "No friction points reported yet.";
      frictionList.appendChild(emptyLi);
    } else {
      frictionEntries.forEach(function (entry) {
        var li = document.createElement("li");
        li.innerHTML =
          '<span>' + escapeHtml(entry.label) + '</span>' +
          '<span class="friction-count">' + entry.count + '</span>';
        frictionList.appendChild(li);
      });
    }

    var recent = docs.slice().sort(function (a, b) {
      return docMillis(b) - docMillis(a);
    }).slice(0, ACTIVITY_LIMIT);

    activityList.innerHTML = "";
    recent.forEach(function (d) {
      var li = document.createElement("li");
      var page = escapeHtml(d.page || "Other");
      var score = (typeof d.score === "number") ? d.score : "\u2014";
      li.innerHTML = '<strong>' + page + '</strong> page &mdash; scored ' + score + '/4';
      activityList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------------------------------------------
     Boot
  --------------------------------------------------- */
  function init() {
    if (!isFirebaseConfigured()) {
      notConfiguredState.hidden = false;
      setStatus("error", "Not connected");
      return;
    }

    try {
      var app = window.firebase.apps && window.firebase.apps.length
        ? window.firebase.apps[0]
        : window.firebase.initializeApp(window.FIREBASE_CONFIG);
      var db = window.firebase.firestore(app);
      var collectionName = window.FIREBASE_COLLECTION || "submissions";
      dbRef = db;
      collectionNameRef = collectionName;

      buildLetterBarSkeleton();
      setStatus("connecting", "Connecting\u2026");

      db.collection(collectionName).onSnapshot(
        function (snapshot) {
          setStatus("live", "Live");
          var docs = snapshot.docs.map(function (d) { return d.data(); });
          render(docs);
        },
        function (err) {
          setStatus("error", "Connection error");
          waitingState.hidden = false;
          wallMain.hidden = true;
          console.warn("Live results listener error:", err);
        }
      );

      initAdminBar();
    } catch (err) {
      notConfiguredState.hidden = false;
      setStatus("error", "Not connected");
      console.warn("Firebase init failed:", err);
    }
  }

  /* ---------------------------------------------------
     Admin bar (only visible with ?manage=1 in the URL)
  --------------------------------------------------- */
  function initAdminBar() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("manage") !== "1") return;

    adminBar.hidden = false;

    adminClearBtn.addEventListener("click", function () {
      var confirmed = window.confirm(
        "Delete all " + lastTotal + " submission" + (lastTotal === 1 ? "" : "s") +
        " from the live results? This can't be undone."
      );
      if (!confirmed) return;

      adminClearBtn.disabled = true;
      adminStatus.textContent = "Clearing\u2026";

      clearAllResults(dbRef, collectionNameRef).then(
        function (count) {
          adminStatus.textContent = "Cleared " + count + " submission" + (count === 1 ? "" : "s") + ".";
          adminClearBtn.disabled = false;
        },
        function (err) {
          adminStatus.textContent = "Delete failed \u2014 check console.";
          adminClearBtn.disabled = false;
          console.warn("Clear results failed:", err);
        }
      );
    });
  }

  function clearAllResults(db, collectionName) {
    return db.collection(collectionName).get().then(function (snapshot) {
      var docs = snapshot.docs;
      if (docs.length === 0) return 0;

      var chunkSize = 450; // stay under Firestore's 500-writes-per-batch limit
      var chunks = [];
      for (var i = 0; i < docs.length; i += chunkSize) {
        chunks.push(docs.slice(i, i + chunkSize));
      }

      var batchPromises = chunks.map(function (chunk) {
        var batch = db.batch();
        chunk.forEach(function (docSnap) { batch.delete(docSnap.ref); });
        return batch.commit();
      });

      return Promise.all(batchPromises).then(function () { return docs.length; });
    });
  }

  init();
})();
