(function () {
  "use strict";

  /* ---------------------------------------------------
     State
  --------------------------------------------------- */
  var state = {
    page: null,
    otherPage: "",
    url: "",
    answers: {
      findable: null,
      intuitive: null,
      necessary: null,
      directed: null
    },
    friction: [],
    otherFriction: ""
  };

  var QUESTION_ORDER = ["findable", "intuitive", "necessary", "directed"];
  var LETTER_FOR_KEY = { findable: "F", intuitive: "I", necessary: "N", directed: "D" };

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
  var copyPromptBtn = document.getElementById("copyPromptBtn");
  var copyConfirm = document.getElementById("copyConfirm");
  var startOverBtn = document.getElementById("startOverBtn");

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

    var mainEl = document.querySelector(".app-main");
    if (mainEl) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
    } else {
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
    buildPrompt();
    goToStep(4);
  });

  /* ---------------------------------------------------
     Step 4: prompt generation
  --------------------------------------------------- */
  function frictionList() {
    var items = state.friction.filter(function (v) { return v !== "Other"; });
    if (state.friction.indexOf("Other") !== -1 && state.otherFriction) {
      items.push(state.otherFriction);
    }
    if (items.length === 0) {
      return "general usability and clarity";
    }
    return items.join(", ").toLowerCase();
  }

  function pageLabel() {
    if (state.page === "Other" && state.otherPage) return state.otherPage;
    return state.page || "this page";
  }

  function buildPrompt() {
    var focusList = frictionList();
    var pageRef = state.url
      ? "Page to review: " + state.url
      : "I will paste the page content below.";

    var lines = [
      "Act as a member-experience website auditor. Review this webpage using the FIND Framework: Findable, Intuitive, Necessary, and Directed.",
      "",
      "Page: " + pageLabel(),
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

    promptOutput.value = lines.join("\n");
  }

  copyPromptBtn.addEventListener("click", function () {
    promptOutput.focus();
    promptOutput.select();
    promptOutput.setSelectionRange(0, promptOutput.value.length);

    var showConfirm = function (msg) {
      copyConfirm.textContent = msg;
      copyConfirm.classList.add("is-visible");
      window.setTimeout(function () {
        copyConfirm.classList.remove("is-visible");
      }, 2200);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(promptOutput.value).then(
        function () { showConfirm("Copied to clipboard"); },
        function () { showConfirm("Prompt selected \u2014 copy with Ctrl/Cmd+C"); }
      );
    } else {
      try {
        var ok = document.execCommand("copy");
        showConfirm(ok ? "Copied to clipboard" : "Prompt selected \u2014 copy with Ctrl/Cmd+C");
      } catch (err) {
        showConfirm("Prompt selected \u2014 copy with Ctrl/Cmd+C");
      }
    }
  });

  /* ---------------------------------------------------
     Start over
  --------------------------------------------------- */
  startOverBtn.addEventListener("click", function () {
    state = {
      page: null,
      otherPage: "",
      url: "",
      answers: { findable: null, intuitive: null, necessary: null, directed: null },
      friction: [],
      otherFriction: ""
    };

    pageChoices.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-selected"); });
    otherPageWrap.hidden = true;
    otherPageInput.value = "";
    pageUrlInput.value = "";
    toStep2Btn.disabled = true;

    findQuestionEls.forEach(function (qEl) {
      qEl.querySelectorAll(".answer-btn").forEach(function (b) { b.classList.remove("is-selected"); });
    });
    findTracker.querySelectorAll(".find-letter").forEach(function (el) {
      el.classList.remove("is-answered", "is-flagged");
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
    copyConfirm.classList.remove("is-visible");

    goToStep(1);
  });

  /* ---------------------------------------------------
     Init
  --------------------------------------------------- */
  goToStep(1);
})();
