const STORAGE_KEY = "pink-cat-ledger-records-v1";

const CATEGORIES = {
  expense: ["餐饮", "交通", "购物", "居家", "娱乐", "医疗", "学习", "其他"],
  income: ["工资", "奖金", "红包", "退款", "理财", "其他"]
};

let selectedType = "expense";
let records = loadRecords();

const incomeValue = document.getElementById("incomeValue");
const expenseValue = document.getElementById("expenseValue");
const balanceValue = document.getElementById("balanceValue");
const categorySelect = document.getElementById("categorySelect");
const descriptionInput = document.getElementById("descriptionInput");
const amountInput = document.getElementById("amountInput");
const addButton = document.getElementById("addButton");
const statusText = document.getElementById("statusText");
const recordList = document.getElementById("recordList");
const recordCount = document.getElementById("recordCount");
const csvInput = document.getElementById("csvInput");
const pasteInput = document.getElementById("pasteInput");
const pasteButton = document.getElementById("pasteButton");
const exportButton = document.getElementById("exportButton");
const clearButton = document.getElementById("clearButton");
const toastElement = document.getElementById("toast");
const loveButton = document.getElementById("loveButton");
const loveModal = document.getElementById("loveModal");
const loveClose = document.getElementById("loveClose");
const loveMessage = document.getElementById("loveMessage");

const loveMessages = [
  "晴晴，今天有没有好好吃饭呀？",
  "无论今天花了多少，都要记得开心最重要。",
  "和你在一起的每一天，都是值得记下的小日子。",
  "希望你打开这个账本的时候，能偷偷笑一下。",
  "我们的未来，会像这些小记录一样，一点一点攒起来。",
  "晴晴专属认证：这只猫咪只听你的话。"
];
let catTapCount = 0;

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    selectedType = button.dataset.type;
    document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("active", item === button));
    addButton.textContent = selectedType === "income" ? "💖 添加收入" : "🎀 添加支出";
    renderCategories();
  });
});

addButton.addEventListener("click", handleAdd);
amountInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleAdd();
});
pasteButton.addEventListener("click", handlePasteImport);
csvInput.addEventListener("change", handleCsvFile);
exportButton.addEventListener("click", exportCsv);
clearButton.addEventListener("click", clearAllRecords);
recordList.addEventListener("click", handleRecordClick);
loveButton.addEventListener("click", () => openLoveNote());
loveClose.addEventListener("click", closeLoveNote);
loveModal.addEventListener("click", (event) => {
  if (event.target === loveModal) closeLoveNote();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLoveNote();
});
document.querySelector(".cat").addEventListener("click", handleCatTap);

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function handleAdd() {
  const description = descriptionInput.value.trim();
  const amount = parseAmount(amountInput.value);

  if (!description) {
    setStatus("请先填写说明。", true);
    descriptionInput.focus();
    return;
  }
  if (!amount || amount <= 0) {
    setStatus("请输入正确的金额。", true);
    amountInput.focus();
    return;
  }

  addRecord({
    id: createId(),
    type: selectedType,
    category: categorySelect.value || "其他",
    description,
    amount,
    date: new Date().toISOString(),
    source: "手动"
  });

  descriptionInput.value = "";
  amountInput.value = "";
  descriptionInput.focus();
  setStatus("记账成功。", false);
  render();
  celebrate();
  showToast("晴晴，已记好一笔～");
}

function addRecord(record) {
  records.unshift(record);
  saveRecords();
}

function handleRecordClick(event) {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = button.dataset.delete;
  const record = records.find((item) => item.id === id);
  if (!record) return;

  if (!window.confirm("确定删除这条记录吗？\n\n" + record.description + "  " + formatMoney(record.amount))) {
    return;
  }

  records = records.filter((item) => item.id !== id);
  saveRecords();
  render();
  showToast("记录已删除");
}

function render() {
  renderCategories();
  renderSummary();
  renderRecords();
}

function renderCategories() {
  const current = categorySelect.value;
  categorySelect.innerHTML = "";
  CATEGORIES[selectedType].forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
  if (CATEGORIES[selectedType].includes(current)) categorySelect.value = current;
}

function renderSummary() {
  let income = 0;
  let expense = 0;

  records.forEach((record) => {
    if (record.type === "income") income += Number(record.amount) || 0;
    else expense += Number(record.amount) || 0;
  });

  const balance = income - expense;
  incomeValue.textContent = formatMoney(income);
  expenseValue.textContent = formatMoney(expense);
  balanceValue.textContent = formatMoney(balance);
}

function renderRecords() {
  recordCount.textContent = records.length + " 条";

  if (!records.length) {
    recordList.innerHTML = '<div class="empty-state">晴晴还没有记录，猫咪在等你的第一笔～</div>';
    return;
  }

  recordList.innerHTML = records.map((record) => {
    const typeClass = record.type === "income" ? "income" : "expense";
    const sign = record.type === "income" ? "+ " : "- ";
    return `
      <article class="record">
        <div class="record-main">
          <p class="record-title">${escapeHtml(record.description)}</p>
          <p class="record-meta">${escapeHtml(record.category || "其他")} · ${formatDate(record.date)} · ${escapeHtml(record.source || "手动")}</p>
        </div>
        <div class="record-side">
          <span class="record-amount ${typeClass}">${sign}${formatMoney(record.amount)}</span>
          <button class="delete-button" type="button" data-delete="${escapeAttribute(record.id)}">删除</button>
        </div>
      </article>`;
  }).join("");
}

function handlePasteImport() {
  const text = pasteInput.value.trim();
  if (!text) {
    setStatus("请先粘贴付款文字。", true);
    return;
  }

  const parsed = parsePaymentText(text);
  if (!parsed) {
    setStatus("没有识别到金额，请手动填写。", true);
    return;
  }

  addRecord(parsed);
  pasteInput.value = "";
  setStatus("已从文字中识别并添加。", false);
  render();
  celebrate();
  showToast("识别成功");
}

function parsePaymentText(text) {
  const amount = extractAmount(text);
  if (!amount) return null;

  const income = /收入|收款|退款|红包|到账/.test(text) && !/支出|付款|支付/.test(text);
  const type = income ? "income" : "expense";
  const merchantMatch = text.match(/(?:给|商户|对方|收款方|付款方)[：:\s]*([^\n，。,]+)/);
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  const description = (merchantMatch ? merchantMatch[1] : firstLine || "粘贴导入").slice(0, 40);
  const category = detectCategory(description, type);

  return {
    id: createId(),
    type,
    category,
    description,
    amount,
    date: new Date().toISOString(),
    source: "文字识别"
  };
}

function extractAmount(text) {
  const patterns = [
    /[¥￥]\s*([0-9]+(?:\.[0-9]{1,2})?)/,
    /(?:金额|支付|付款|收款|收入|支出)[：:\s]*[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/,
    /([0-9]+(?:\.[0-9]{1,2})?)\s*元/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseAmount(match[1]);
  }
  return 0;
}

async function handleCsvFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await readFileText(file);
    const imported = importCsvText(text);
    csvInput.value = "";

    if (!imported) {
      setStatus("没有在 CSV 中找到可导入的交易。", true);
      return;
    }

    const known = new Set(records.map((record) => recordFingerprint(record)));
    let added = 0;
    imported.forEach((record) => {
      const fingerprint = recordFingerprint(record);
      if (!known.has(fingerprint)) {
        known.add(fingerprint);
        records.unshift(record);
        added += 1;
      }
    });

    saveRecords();
    render();
    setStatus(`CSV 导入完成，共新增 ${added} 条。`, false);
    celebrate();
    showToast(`导入 ${added} 条记录`);
  } catch (error) {
    setStatus("CSV 读取失败，请确认文件格式。", true);
  }
}

async function readFileText(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8").decode(buffer);
  } catch (error) {
    return new TextDecoder("gbk").decode(buffer);
  }
}

function importCsvText(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const headerIndex = rows.slice(0, 25).findIndex((row) =>
    row.some((cell) => /交易时间|交易类型|交易对方|金额|收\/支|收支/.test(cell))
  );

  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map((cell) => normalizeHeader(cell));
  const dateIndex = findColumn(headers, ["交易时间", "时间", "日期"]);
  const merchantIndex = findColumn(headers, ["交易对方", "对方", "商户", "收款方"]);
  const productIndex = findColumn(headers, ["商品", "商品说明", "说明", "备注"]);
  const amountIndex = findColumn(headers, ["金额", "交易金额", "金额(元)"]);
  const typeIndex = findColumn(headers, ["收/支", "收支", "交易类型"]);
  const result = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row.length) continue;

    const amount = parseAmount(amountIndex >= 0 ? row[amountIndex] : "");
    if (!amount) continue;

    const typeText = typeIndex >= 0 ? row[typeIndex] || "" : "";
    let type = /收入|收/.test(typeText) && !/支出|支/.test(typeText) ? "income" : "expense";
    if (!typeText && amount < 0) type = "expense";

    const description = [
      merchantIndex >= 0 ? row[merchantIndex] : "",
      productIndex >= 0 ? row[productIndex] : ""
    ].filter(Boolean).join(" ").trim() || "账单导入";

    result.push({
      id: createId(),
      type,
      category: detectCategory(description, type),
      description: description.slice(0, 60),
      amount: Math.abs(amount),
      date: parseDate(dateIndex >= 0 ? row[dateIndex] : "") || new Date().toISOString(),
      source: "CSV导入"
    });
  }

  return result;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[（）()]/g, "").toLowerCase();
}

function findColumn(headers, names) {
  return headers.findIndex((header) => names.some((name) => header.includes(normalizeHeader(name))));
}

function parseAmount(value) {
  if (typeof value === "number") return Math.abs(value);
  const text = String(value || "").replace(/,/g, "").replace(/\s/g, "");
  const match = text.match(/-?[0-9]+(?:\.[0-9]+)?/);
  return match ? Math.abs(Number(match[0])) : 0;
}

function parseDate(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(/-/g, "/"));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function detectCategory(description, type) {
  const text = String(description || "");
  const rules = [
    ["餐饮", /餐|饭|外卖|咖啡|奶茶|早餐|午餐|晚餐|烧烤|火锅/],
    ["交通", /地铁|公交|打车|滴滴|出租|高铁|火车|机票|加油|停车/],
    ["购物", /淘宝|天猫|京东|拼多多|超市|商场|便利店|购物/],
    ["居家", /房租|水费|电费|燃气|物业|家居/],
    ["娱乐", /电影|游戏|音乐|视频|会员|演出|旅游/],
    ["医疗", /医院|药房|药店|挂号|医疗/],
    ["学习", /书|课程|培训|教育|文具/],
    ["工资", /工资|薪资|奖金/],
    ["红包", /红包|转账/],
    ["退款", /退款|退货/]
  ];

  for (const [category, pattern] of rules) {
    if (pattern.test(text) && CATEGORIES[type].includes(category)) return category;
  }
  return "其他";
}

function exportCsv() {
  if (!records.length) {
    setStatus("当前没有可导出的记录。", true);
    return;
  }

  const header = ["日期", "类型", "分类", "说明", "金额", "来源"];
  const lines = records.map((record) => [
    record.date,
    record.type === "income" ? "收入" : "支出",
    record.category || "其他",
    record.description,
    record.amount,
    record.source || "手动"
  ].map(csvCell).join(","));

  const csv = "\ufeff" + [header.join(",")].concat(lines).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `粉色猫咪记账-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV 已导出");
}

function csvCell(value) {
  const text = String(value == null ? "" : value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function clearAllRecords() {
  if (!records.length) return;
  if (!window.confirm("确定清空全部记录吗？此操作不能撤销。")) return;
  records = [];
  saveRecords();
  render();
  showToast("已清空全部记录");
}

function recordFingerprint(record) {
  return [record.type, record.description, Number(record.amount).toFixed(2), String(record.date).slice(0, 10)].join("|");
}

function setStatus(message, isError) {
  statusText.textContent = message;
  statusText.classList.toggle("error", Boolean(isError));
}

function openLoveNote(message) {
  const text = message || loveMessages[Math.floor(Math.random() * loveMessages.length)];
  loveMessage.textContent = text;
  loveModal.classList.add("open");
  loveModal.setAttribute("aria-hidden", "false");
  celebrate();
}

function closeLoveNote() {
  loveModal.classList.remove("open");
  loveModal.setAttribute("aria-hidden", "true");
}

function handleCatTap() {
  catTapCount += 1;
  if (catTapCount === 7) {
    catTapCount = 0;
    openLoveNote("彩蛋被发现啦！晴晴，今天也要被爱包围 🎀");
  } else if (catTapCount >= 3) {
    showToast(`再摸一下猫咪有惊喜～ ${catTapCount}/7`);
  }
}

function celebrate() {
  const icons = ["💖", "✨", "🐾", "🎀", "🌸"];
  for (let index = 0; index < 12; index += 1) {
    const item = document.createElement("span");
    item.className = "heart-burst";
    item.textContent = icons[index % icons.length];
    item.style.left = `${window.innerWidth / 2 + (Math.random() * 120 - 60)}px`;
    item.style.top = `${window.innerHeight * 0.48 + (Math.random() * 60 - 30)}px`;
    item.style.setProperty("--x", `${Math.random() * 180 - 90}px`);
    item.style.setProperty("--r", `${Math.random() * 120 - 60}deg`);
    document.body.appendChild(item);
    setTimeout(() => item.remove(), 1200);
  }
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastElement.classList.remove("show"), 1900);
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function createId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function importFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const amount = parseAmount(params.get("amount"));
  if (!amount) return;

  const type = params.get("type") === "income" ? "income" : "expense";
  const description = (params.get("description") || "快捷指令导入").slice(0, 60);
  addRecord({
    id: createId(),
    type,
    category: params.get("category") || detectCategory(description, type),
    description,
    amount,
    date: new Date().toISOString(),
    source: "快捷指令"
  });
  history.replaceState({}, document.title, window.location.pathname);
  showToast("已从快捷指令导入");
}

render();
importFromQuery();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}