(function () {
  "use strict";

  /* ---------------------------------------------------
     Constants
  --------------------------------------------------- */
  var QUESTION_ORDER = ["findable", "intuitive", "necessary", "directed"];
  var LETTER_FOR_KEY = { findable: "F", intuitive: "I", necessary: "N", directed: "D" };
  var LABEL_FOR_KEY = { findable: "Findable", intuitive: "Intuitive", necessary: "Necessary", directed: "Directed" };
  var FRICTION_PROMPT_TEXT = {
    "Needs accessibility review": "accessibility concerns"
  };
  var HISTORY_KEY = "findAuditHistory";
  var HISTORY_LIMIT = 25;

  /* ---------------------------------------------------
     State (current in-progress audit)
  --------------------------------------------------- */
  function freshState() {
    return {
      page: null,
      otherPage: "",
      url: "",
      answers: { findable: null, intuitive: null, necessary: null, directed: null },
      friction: [],
      otherFriction: ""
    };
  }

  var state = freshState();

  /* ---------------------------------------------------
     Element refs
  --------------------------------------------------- */
  var stepProgressFill = document.getElementById("stepProgressFill");
  var stepProgress = document.getElementById("stepProgress");
  var stepCaption = document.getElementById("stepCaption");
  var findTracker = document.getElementById("findTracker");

  var pageChoices = document.getElementById("pageChoices");
  var otherPageWrap = document.getElementById("otherPageWrap");
  var otherPageInput = document.getElementById("otherPageInput");
  var pageUrlInput = document.getElementById("pageUrl");
  var toStep2Btn = document.getElementById("toStep2");

  var toStep3Btn = document.getElementById("toStep3");
  var backStep1Btn = document.getElementById("backStep1");
  var scoreSummary = document.getElementById("scoreSummary");
  var scoreValueEl = document.getElementById("scoreValue");
  var scoreTextEl = document.getElementById("scoreText");

  var frictionChoices = document.getElementById("frictionChoices");
  var otherFrictionWrap = document.getElementById("otherFrictionWrap");
  var otherFrictionInput = document.getElementById("otherFrictionInput");
  var backStep2Btn = document.getElementById("backStep2");
  var toStep4Btn = document.getElementById("toStep4");

  var promptOutput = document.getElementById("promptOutput");
  var promptOutputWrap = document.getElementById("promptOutputWrap");
  var copyPromptBtn = document.getElementById("copyPromptBtn");
  var downloadPromptBtn = document.getElementById("downloadPromptBtn");
  var copyConfirm = document.getElementById("copyConfirm");
  var startOverBtn = document.getElementById("startOverBtn");

  var shareToggleRow = document.getElementById("shareToggleRow");
  var shareToggleInput = document.getElementById("shareToggleInput");
  var shareConfirm = document.getElementById("shareConfirm");

  var savedAuditsSection = document.getElementById("savedAuditsSection");
  var savedAuditsList = document.getElementById("savedAuditsList");
  var clearAuditsBtn = document.getElementById("clearAuditsBtn");
  var savedAuditItemTemplate = document.getElementById("savedAuditItemTemplate");

  var STEP_CAPTIONS = {
    1: "Step 1 of 4 \u00B7 Choose a page",
    2: "Step 2 of 4 \u00B7 Score the page",
    3: "Step 3 of 4 \u00B7 Identify friction",
    4: "Step 4 of 4 \u00B7 Your prompt"
  };

  /* ---------------------------------------------------
     Step navigation
  --------------------------------------------------- */
  function goToStep(stepNumber) {
    var steps = document.querySelectorAll(".step");
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var num = parseInt(s.getAttribute("data-step"), 10);
      s.hidden = num !== stepNumber;
    }
    var pct = (stepNumber / 4) * 100;
    stepProgressFill.style.width = pct + "%";
    stepProgress.setAttribute("aria-valuenow", String(stepNumber));
    stepCaption.textContent = STEP_CAPTIONS[stepNumber];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------------------------------------------
     Step 1: page selection
  --------------------------------------------------- */
  pageChoices.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;

    var chips = pageChoices.querySelectorAll(".chip");
    chips.forEach(function (c) { c.classList.remove("is-selected"); });
    chip.classList.add("is-selected");

    state.page = chip.getAttribute("data-value");

    var isOther = state.page === "Other";
    otherPageWrap.hidden = !isOther;
    if (isOther) {
      otherPageInput.focus();
    }

    updateStep1Validity();
  });

  otherPageInput.addEventListener("input", function () {
    state.otherPage = otherPageInput.value.trim();
    updateStep1Validity();
  });

  pageUrlInput.addEventListener("input", function () {
    state.url = pageUrlInput.value.trim();
  });

  function updateStep1Validity() {
    var valid = !!state.page && (state.page !== "Other" || state.otherPage.length > 0);
    toStep2Btn.disabled = !valid;
  }

  toStep2Btn.addEventListener("click", function () {
    goToStep(2);
  });

  /* ---------------------------------------------------
     Step 2: FIND scoring
  --------------------------------------------------- */
  var findQuestionEls = document.querySelectorAll(".find-question");

  findQuestionEls.forEach(function (qEl) {
    var key = qEl.getAttribute("data-key");
    var buttons = qEl.querySelectorAll(".answer-btn");

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("is-selected"); });
        btn.classList.add("is-selected");
        state.answers[key] = btn.getAttribute("data-answer");
        updateFindTracker(key, state.answers[key]);
        updateScoreSummary();
        updateStep2Validity();
      });
    });
  });

  function updateFindTracker(key, answer) {
    var letterEl = findTracker.querySelector('[data-letter="' + LETTER_FOR_KEY[key] + '"]');
    if (!letterEl) return;
    letterEl.classList.add("is-answered");
    if (answer === "No" || answer === "Not sure") {
      letterEl.classList.add("is-flagged");
      letterEl.classList.remove("is-clean");
    } else {
      letterEl.classList.add("is-clean");
      letterEl.classList.remove("is-flagged");
    }
  }

  function computeScore() {
    var score = 0;
    QUESTION_ORDER.forEach(function (key) {
      var a = state.answers[key];
      if (a === "No" || a === "Not sure") score += 1;
    });
    return score;
  }

  function flaggedLabels() {
    return QUESTION_ORDER
      .filter(function (key) {
        var a = state.answers[key];
        return a === "No" || a === "Not sure";
      })
      .map(function (key) { return LABEL_FOR_KEY[key]; });
  }

  function updateScoreSummary() {
    var answeredCount = QUESTION_ORDER.filter(function (k) { return state.answers[k] !== null; }).length;
    if (answeredCount === 0) {
      scoreSummary.hidden = true;
      return;
    }
    scoreSummary.hidden = false;
    var score = computeScore();
    scoreValueEl.textContent = String(score);

    var recommendation;
    if (score <= 1) {
      recommendation = "This page may only need a light review.";
    } else if (score <= 3) {
      recommendation = "This page is a good candidate for an AI-assisted audit.";
    } else {
      recommendation = "This page is a strong candidate for a deeper AI-assisted review.";
    }
    scoreTextEl.textContent = recommendation;
  }

  function updateStep2Validity() {
    var allAnswered = QUESTION_ORDER.every(function (k) { return state.answers[k] !== null; });
    toStep3Btn.disabled = !allAnswered;
  }

  backStep1Btn.addEventListener("click", function () { goToStep(1); });
  toStep3Btn.addEventListener("click", function () { goToStep(3); });

  /* ---------------------------------------------------
     Step 3: friction points
  --------------------------------------------------- */
  frictionChoices.addEventListener("change", function (e) {
    var input = e.target;
    if (input.type !== "checkbox") return;

    var label = input.closest(".checkbox-chip");
    if (label) {
      label.classList.toggle("is-checked", input.checked);
    }

    var value = input.value;
    if (input.checked) {
      if (state.friction.indexOf(value) === -1) state.friction.push(value);
    } else {
      state.friction = state.friction.filter(function (v) { return v !== value; });
    }

    var otherChecked = state.friction.indexOf("Other") !== -1;
    otherFrictionWrap.hidden = !otherChecked;
    if (otherChecked) {
      otherFrictionInput.focus();
    }
  });

  otherFrictionInput.addEventListener("input", function () {
    state.otherFriction = otherFrictionInput.value.trim();
  });

  backStep2Btn.addEventListener("click", function () { goToStep(2); });

  toStep4Btn.addEventListener("click", function () {
    var prompt = buildPrompt();
    promptOutput.value = prompt;
    promptOutput.scrollTop = 0;
    updatePromptFades();
    saveAuditToHistory(prompt);
    renderSavedAudits();
    submitToRoomResults();
    goToStep(4);
  });

  /* ---------------------------------------------------
     Prompt generation
  --------------------------------------------------- */
  function frictionPhrase(value) {
    return (FRICTION_PROMPT_TEXT[value] || value).toLowerCase();
  }

  function frictionList() {
    var items = state.friction
      .filter(function (v) { return v !== "Other"; })
      .map(frictionPhrase);
    if (state.friction.indexOf("Other") !== -1 && state.otherFriction) {
      items.push(state.otherFriction.toLowerCase());
    }
    if (items.length === 0) {
      return "general usability and clarity";
    }
    return items.join(", ");
  }

  function pageLabel() {
    if (state.page === "Other" && state.otherPage) return state.otherPage;
    return state.page || "this page";
  }

  function scoreLine() {
    var score = computeScore();
    var flags = flaggedLabels();
    var flagText = flags.length > 0 ? " (flagged: " + flags.join(", ") + ")" : " (no flags)";
    return "Internal FIND score: " + score + "/4" + flagText;
  }

  function buildPrompt() {
    var focusList = frictionList();
    var pageRef = state.url
      ? "Page to review: " + state.url
      : "I will paste the page content below.";

    var lines = [
      "Act as a member-experience website auditor. Review this webpage using the FIND Framework:",
      "",
      "Findable: Can members quickly locate this page or information without knowing our internal department structure?",
      "Intuitive: Does the navigation, wording, and page structure make sense without explanation?",
      "Necessary: Does the content serve a clear member purpose, or is it outdated, duplicated, or unnecessary?",
      "Directed: Does the page clearly guide members toward the next step?",
      "",
      "Page: " + pageLabel(),
      scoreLine(),
      "",
      "Evaluate whether the page is easy for members to find, understand, use, and act on. Focus especially on: " + focusList + ".",
      "",
      "Organize your response into three sections:",
      "1. Issues found",
      "2. Recommended fixes",
      "3. Items that need human review",
      "",
      "Prioritize changes that would make the page clearer, more useful, and more member-centered.",
      "",
      pageRef
    ];

    return lines.join("\n");
  }

  /* ---------------------------------------------------
     Prompt scroll fade indicators
  --------------------------------------------------- */
  function updatePromptFades() {
    if (!promptOutputWrap) return;
    var el = promptOutput;
    var scrollable = el.scrollHeight > el.clientHeight + 2;
    if (!scrollable) {
      promptOutputWrap.classList.remove("show-fade-top", "show-fade-bottom");
      return;
    }
    var atTop = el.scrollTop <= 2;
    var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    promptOutputWrap.classList.toggle("show-fade-top", !atTop);
    promptOutputWrap.classList.toggle("show-fade-bottom", !atBottom);
  }

  promptOutput.addEventListener("scroll", updatePromptFades);
  window.addEventListener("resize", updatePromptFades);

  /* ---------------------------------------------------
     Copy / Download
  --------------------------------------------------- */
  function showConfirm(msg) {
    copyConfirm.textContent = msg;
    copyConfirm.classList.add("is-visible");
    window.setTimeout(function () {
      copyConfirm.classList.remove("is-visible");
    }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error("Clipboard API unavailable"));
  }

  function copyTextWithFallback(text, onSuccess, onFallback) {
    copyText(text).then(onSuccess, function () {
      var temp = document.createElement("textarea");
      temp.value = text;
      temp.setAttribute("readonly", "");
      temp.style.position = "fixed";
      temp.style.top = "-1000px";
      temp.style.left = "-1000px";
      document.body.appendChild(temp);
      temp.focus();
      temp.select();
      temp.setSelectionRange(0, temp.value.length);
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(temp);
      if (ok) {
        onSuccess();
      } else {
        onFallback();
      }
    });
  }

  copyPromptBtn.addEventListener("click", function () {
    promptOutput.focus();
    promptOutput.select();
    promptOutput.setSelectionRange(0, promptOutput.value.length);

    copyTextWithFallback(
      promptOutput.value,
      function () { showConfirm("Copied to clipboard"); },
      function () { showConfirm("Prompt selected \u2014 copy with Ctrl/Cmd+C"); }
    );
  });

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "page";
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  downloadPromptBtn.addEventListener("click", function () {
    if (!promptOutput.value) return;
    var filename = "find-audit-" + slugify(pageLabel()) + ".txt";
    try {
      downloadText(filename, promptOutput.value);
      showConfirm("Downloaded " + filename);
    } catch (err) {
      showConfirm("Download unavailable \u2014 copy the prompt instead");
    }
  });

  /* ---------------------------------------------------
     Live room results (Firebase — optional, non-blocking)
  --------------------------------------------------- */
  var firebaseApp = null;
  var firestoreDb = null;

  function isFirebaseConfigured() {
    var cfg = window.FIREBASE_CONFIG;
    if (!cfg || typeof window.firebase === "undefined") return false;
    var placeholderPattern = /^PASTE_/;
    return !placeholderPattern.test(cfg.apiKey || "") &&
      !placeholderPattern.test(cfg.projectId || "");
  }

  function getFirestoreDb() {
    if (firestoreDb) return firestoreDb;
    try {
      firebaseApp = window.firebase.apps && window.firebase.apps.length
        ? window.firebase.apps[0]
        : window.firebase.initializeApp(window.FIREBASE_CONFIG);
      firestoreDb = window.firebase.firestore();
      return firestoreDb;
    } catch (err) {
      return null;
    }
  }

  function pageForShare() {
    return state.page || "Other";
  }

  function frictionForShare() {
    return state.friction.slice();
  }

  function submitToRoomResults() {
    if (!shareToggleInput || !shareToggleInput.checked) return;
    if (!isFirebaseConfigured()) return;

    var db = getFirestoreDb();
    if (!db) return;

    var collectionName = window.FIREBASE_COLLECTION || "submissions";
    var entry = {
      page: pageForShare(),
      score: computeScore(),
      flags: flaggedLabels(),
      friction: frictionForShare(),
      submittedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection(collectionName).add(entry).then(
      function () {
        if (shareConfirm) shareConfirm.hidden = false;
      },
      function () {
        /* Fails silently — sharing is a bonus, never blocks the core flow */
      }
    );
  }

  function initShareToggleVisibility() {
    if (!shareToggleRow) return;
    shareToggleRow.hidden = !isFirebaseConfigured();
  }

  /* ---------------------------------------------------
     Saved audits (localStorage)
  --------------------------------------------------- */
  function readHistory() {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeHistory(list) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (err) {
      /* localStorage unavailable (private browsing, quota, etc.) — fail silently */
    }
  }

  function saveAuditToHistory(prompt) {
    var history = readHistory();
    var entry = {
      id: "audit-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      page: pageLabel(),
      url: state.url || "",
      score: computeScore(),
      flags: flaggedLabels(),
      prompt: prompt,
      savedAt: new Date().toISOString()
    };
    history.unshift(entry);
    if (history.length > HISTORY_LIMIT) {
      history = history.slice(0, HISTORY_LIMIT);
    }
    writeHistory(history);
  }

  function formatSavedAt(isoString) {
    try {
      var d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " \u00B7 " +
        d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch (err) {
      return "";
    }
  }

  function renderSavedAudits() {
    var history = readHistory();
    savedAuditsList.innerHTML = "";

    if (history.length === 0) {
      savedAuditsSection.hidden = true;
      return;
    }

    savedAuditsSection.hidden = false;

    history.forEach(function (entry) {
      var node = savedAuditItemTemplate.content.cloneNode(true);
      var li = node.querySelector(".saved-audit-item");
      li.setAttribute("data-id", entry.id);
      node.querySelector(".saved-audit-page").textContent = entry.page;
      node.querySelector(".saved-audit-meta").textContent =
        entry.score + "/4 \u00B7 " + formatSavedAt(entry.savedAt);

      node.querySelector(".saved-audit-copy").addEventListener("click", function () {
        copyTextWithFallback(
          entry.prompt,
          function () { showConfirm("Copied \u201C" + entry.page + "\u201D prompt"); },
          function () { showConfirm("Copy unavailable \u2014 use Download on the current prompt instead"); }
        );
      });

      node.querySelector(".saved-audit-delete").addEventListener("click", function () {
        var remaining = readHistory().filter(function (e) { return e.id !== entry.id; });
        writeHistory(remaining);
        renderSavedAudits();
      });

      savedAuditsList.appendChild(node);
    });
  }

  clearAuditsBtn.addEventListener("click", function () {
    writeHistory([]);
    renderSavedAudits();
  });

  /* ---------------------------------------------------
     Audit another page (resets current form, keeps history)
  --------------------------------------------------- */
  startOverBtn.addEventListener("click", function () {
    state = freshState();

    pageChoices.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-selected"); });
    otherPageWrap.hidden = true;
    otherPageInput.value = "";
    pageUrlInput.value = "";
    toStep2Btn.disabled = true;

    findQuestionEls.forEach(function (qEl) {
      qEl.querySelectorAll(".answer-btn").forEach(function (b) { b.classList.remove("is-selected"); });
    });
    findTracker.querySelectorAll(".find-letter").forEach(function (el) {
      el.classList.remove("is-answered", "is-flagged", "is-clean");
    });
    scoreSummary.hidden = true;
    toStep3Btn.disabled = true;

    frictionChoices.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.checked = false;
      var label = cb.closest(".checkbox-chip");
      if (label) label.classList.remove("is-checked");
    });
    otherFrictionWrap.hidden = true;
    otherFrictionInput.value = "";

    promptOutput.value = "";
    if (promptOutputWrap) {
      promptOutputWrap.classList.remove("show-fade-top", "show-fade-bottom");
    }
    copyConfirm.classList.remove("is-visible");
    if (shareConfirm) shareConfirm.hidden = true;

    goToStep(1);
  });

  /* ---------------------------------------------------
     Init
  --------------------------------------------------- */
  renderSavedAudits();
  initShareToggleVisibility();
  goToStep(1);
})();
