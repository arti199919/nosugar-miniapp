const STORAGE_KEY = "nosugar-progress-v1";
const PRO_UPSELL_URL = "https://example.com/pay"; // замените на реальную ссылку оплаты
const SHARE_TEXT =
  "Пройди мини-челлендж «7 дней без сахара в кофейне» и оцени вкус напитков без сиропов. Открыть:";

const dayPlans = [
  {
    title: "Эспрессо + горсть орехов",
    description:
      "Горечь кофе уравновешивает жиры орехов — голод отступает, а энергия растёт.",
    tip: "Положи орехи в карман или сумку и выпей эспрессо без сахара.",
  },
  {
    title: "Капучино на овсяном молоке",
    description:
      "Овёс сладковат сам по себе, поэтому сироп не понадобится. Текстура густая и уютная.",
    tip: "Проси бариста сварить без сиропа. При желании добавь щепотку какао.",
  },
  {
    title: "Американо с лимоном",
    description:
      "Лимонная долька освежает вкус и подсвечивает естественную сладость зёрен.",
    tip: "Сделай вдох ароматом лимона до первого глотка — тяга к сладкому уменьшается.",
  },
  {
    title: "Латте на миндальном молоке + корица",
    description:
      "Корица создаёт ощущение десерта, а миндаль даёт кремовость без сахара.",
    tip: "Смешай корицу до подачи, чтобы аромат раскрылся.",
  },
  {
    title: "Флэт уайт + кубик 85% шоколада",
    description:
      "Один кусочек горького шоколада — и рецепторы получают праздник без скачков сахара.",
    tip: "Кусай шоколад маленькими порциями, попеременно с глотком кофе.",
  },
  {
    title: "Cold brew с апельсиновой цедрой",
    description:
      "Цитрусовый аромат заменяет сироп, а холодный кофе освежает лучше десерта.",
    tip: "Добавь тонкую полоску цедры и дай настояться 1–2 минуты.",
  },
  {
    title: "Раф на кокосовом молоке",
    description:
      "Натуральные жиры кокоса насыщают, а ваниль делает вкус мягким и сладким без сахара.",
    tip: "Возьми любимую ваниль — стручок или экстракт на натуральной основе.",
  },
];

const initialState = {
  screen: "intro",
  currentDayIndex: 0,
  completedDays: [],
  startedAt: null,
};

let state = loadState();
const tg = window.Telegram?.WebApp ?? null;
let mainButtonHandler = null;
const screenNode = document.getElementById("screen");

/**
 * Load saved state or fallback to defaults.
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialState);

    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(initialState),
      ...parsed,
      completedDays: Array.isArray(parsed.completedDays)
        ? parsed.completedDays
        : [],
    };
  } catch (error) {
    console.warn("[MiniApp] Failed to read state:", error);
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state = structuredClone(initialState);
  saveState();
  render();
}

function getNextIncompleteDay() {
  for (let i = 0; i < dayPlans.length; i += 1) {
    if (!state.completedDays.includes(i)) return i;
  }
  return null;
}

function setScreen(screen, options = {}) {
  state.screen = screen;
  if (typeof options.index === "number") {
    state.currentDayIndex = options.index;
  }
  saveState();
  render();
}

function markCurrentDayDone() {
  const idx = state.currentDayIndex;
  if (idx == null) return;

  if (!state.completedDays.includes(idx)) {
    state.completedDays.push(idx);
  }

  const next = getNextIncompleteDay();
  if (next == null) {
    setScreen("finish");
  } else {
    setScreen("day", { index: next });
  }
}

function formatReminderCopy() {
  if (!state.startedAt) {
    return "Когда начнёшь, бот пришлёт напоминание через 24 часа.";
  }

  if (state.completedDays.length >= dayPlans.length) {
    return "Ты завершил челлендж — можешь поделиться результатом!";
  }

  const hoursPassed = (Date.now() - state.startedAt) / (1000 * 60 * 60);
  if (hoursPassed < 24) {
    const remaining = Math.max(1, Math.round(24 - hoursPassed));
    return `Следующее напоминание через ≈${remaining} ч.`;
  }
  return "Мы напомним о следующем дне прямо в Telegram.";
}

function updateProgressUI() {
  const completed = state.completedDays.length;
  const progressCount = document.getElementById("progress-count");
  const barFill = document.getElementById("progress-bar-fill");

  progressCount.textContent = `${completed} / ${dayPlans.length}`;
  barFill.style.width = `${(completed / dayPlans.length) * 100}%`;

  document.getElementById("reminder-copy").textContent = formatReminderCopy();
}

function attachActionHandlers(node) {
  node.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      handleAction(action);
    });
  });
}

function renderIntroScreen() {
  const template = document
    .getElementById("intro-screen")
    .content.cloneNode(true);
  screenNode.replaceChildren(template);
  attachActionHandlers(screenNode);
}

function renderDayScreen(index) {
  const template = document
    .getElementById("day-screen")
    .content.cloneNode(true);

  const dayNumber = template.querySelector("[data-slot='day-number']");
  const dayTitle = template.querySelector("[data-slot='day-title']");
  const dayDescription = template.querySelector(
    "[data-slot='day-description']"
  );
  const tip = template.querySelector("[data-slot='day-tip']");
  const checkbox = template.querySelector("[data-slot='day-checkbox']");

  dayNumber.textContent = `День ${index + 1}`;
  dayTitle.textContent = dayPlans[index].title;
  dayDescription.textContent = dayPlans[index].description;
  tip.textContent = dayPlans[index].tip;

  checkbox.checked = state.completedDays.includes(index);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      markCurrentDayDone();
    } else {
      state.completedDays = state.completedDays.filter((i) => i !== index);
      saveState();
    }
  });

  screenNode.replaceChildren(template);
  attachActionHandlers(screenNode);
}

function renderFinishScreen() {
  const template = document
    .getElementById("finish-screen")
    .content.cloneNode(true);
  screenNode.replaceChildren(template);
  attachActionHandlers(screenNode);
}

function render() {
  updateProgressUI();

  if (state.screen === "finish") {
    renderFinishScreen();
    updateMainButton("buy");
    return;
  }

  if (state.screen === "day") {
    renderDayScreen(state.currentDayIndex ?? 0);
    updateMainButton("mark");
    return;
  }

  renderIntroScreen();
  updateMainButton("start");
}

function handleAction(action) {
  switch (action) {
    case "start":
      if (!state.startedAt) {
        state.startedAt = Date.now();
      }
      setScreen("day", { index: getNextIncompleteDay() ?? 0 });
      break;
    case "share":
      shareChallenge();
      break;
    case "back":
      if (state.currentDayIndex <= 0) {
        setScreen("intro", { index: 0 });
      } else {
        setScreen("day", { index: state.currentDayIndex - 1 });
      }
      break;
    case "mark":
      markCurrentDayDone();
      break;
    case "buy":
      openBuyLink();
      break;
    case "restart":
      resetState();
      break;
    default:
      break;
  }
}

function shareChallenge() {
  const link = window.location.href;
  const fullCopy = `${SHARE_TEXT} ${link}`;

  if (navigator.share) {
    navigator
      .share({ title: "7 дней без сахара", text: SHARE_TEXT, url: link })
      .catch(() => {});
    return;
  }

  if (tg && tg.openLink) {
    tg.openLink(`https://t.me/share/url?url=${encodeURIComponent(link)}`);
    return;
  }

  navigator.clipboard?.writeText(fullCopy);
  alert("Ссылка скопирована — отправь другу!");
}

function openBuyLink() {
  if (tg?.openInvoice) {
    tg.openInvoice({
      slug: "nosugar-full", // создайте invoice в @BotFather и подставьте slug
    });
    return;
  }

  const url = PRO_UPSELL_URL;
  if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

function updateMainButton(mode) {
  if (!tg || !tg.MainButton) return;

  if (mainButtonHandler) {
    tg.MainButton.offClick(mainButtonHandler);
    mainButtonHandler = null;
  }

  if (mode === "start") {
    tg.MainButton.setText("Начать 7 дней");
    tg.MainButton.show();
    mainButtonHandler = () => handleAction("start");
    tg.MainButton.onClick(mainButtonHandler);
  } else if (mode === "mark") {
    tg.MainButton.setText("✅ Сделано");
    tg.MainButton.show();
    mainButtonHandler = () => handleAction("mark");
    tg.MainButton.onClick(mainButtonHandler);
  } else if (mode === "buy") {
    tg.MainButton.setText("Получить полную версию");
    tg.MainButton.show();
    mainButtonHandler = () => handleAction("buy");
    tg.MainButton.onClick(mainButtonHandler);
  }
}

function bootstrap() {
  if (tg) {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
  }

  // Resume previously achieved state
  if (state.completedDays.length === dayPlans.length) {
    setScreen("finish");
    return;
  }

  if (state.screen === "day" && typeof state.currentDayIndex === "number") {
    setScreen("day", { index: state.currentDayIndex });
    return;
  }

  render();
}

bootstrap();

