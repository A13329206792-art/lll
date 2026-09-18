const LF_SETTINGS_KEY = "pink-cat-love-settings-v1";
const LF_PIN_KEY = "pink-cat-love-pin-v1";
const LF_PHOTO_KEY = "pink-cat-love-photo-v1";

let lfSettings = loadLoveSettings();
let lfEditingId = null;
let lfPinMode = "setup";
let lfAutoLockTimer;
let lfHiddenAt = 0;

const settingsButton = document.getElementById("settingsButton");
const editSettingsButton = document.getElementById("editSettingsButton");
const settingsModal = document.getElementById("settingsModal");
const nicknameInput = document.getElementById("nicknameInput");
const anniversaryInput = document.getElementById("anniversaryInput");
const birthdayInput = document.getElementById("birthdayInput");
const goalNameInput = document.getElementById("goalNameInput");
const goalTargetInput = document.getElementById("goalTargetInput");
const saveSettingsButton = document.getElementById("saveSettingsButton");
const pinSettingButton = document.getElementById("pinSettingButton");
const daysTogether = document.getElementById("daysTogether");
const daysBirthday = document.getElementById("daysBirthday");
const goalName = document.getElementById("goalName");
const goalPercent = document.getElementById("goalPercent");
const goalProgress = document.getElementById("goalProgress");
const goalText = document.getElementById("goalText");
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const reportButton = document.getElementById("reportButton");
const reportModal = document.getElementById("reportModal");
const reportStats = document.getElementById("reportStats");
const reportMessage = document.getElementById("reportMessage");
const editModal = document.getElementById("editModal");
const editType = document.getElementById("editType");
const editCategory = document.getElementById("editCategory");
const editDescription = document.getElementById("editDescription");
const editAmount = document.getElementById("editAmount");
const saveEditButton = document.getElementById("saveEditButton");
const pinModal = document.getElementById("pinModal");
const pinTitle = document.getElementById("pinTitle");
const pinHint = document.getElementById("pinHint");
const pinInput = document.getElementById("pinInput");
const pinConfirm = document.getElementById("pinConfirm");
const pinError = document.getElementById("pinError");
const pinSubmitButton = document.getElementById("pinSubmitButton");
const pinCancelButton = document.getElementById("pinCancelButton");
const removePinButton = document.getElementById("removePinButton");
const memoryPhoto = document.getElementById("memoryPhoto");
const photoInput = document.getElementById("photoInput");
const removePhotoButton = document.getElementById("removePhotoButton");

const originalRenderRecords = renderRecords;

renderRecords = function renderRecordsWithLoveFeatures() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const filtered = records.filter((record) => {
    const typeMatches = selectedType === "all" || record.type === selectedType;
    const text = [record.description, record.category, record.type === "income" ? "收入" : "支出"]
      .join(" ")
      .toLowerCase();
    return typeMatches && (!query || text.includes(query));
  });

  recordCount.textContent = query || selectedType !== "all"
    ? `${filtered.length} / ${records.length} 条`
    : `${records.length} 条`;

  if (!filtered.length) {
    const name = lfSettings.nickname || "晴晴";
    recordList.innerHTML = records.length
      ? '<div class="empty-state">没有找到匹配的记录，换个词试试吧～</div>'
      : `<div class="empty-state">${name}还没有记录，猫咪在等你的第一笔～</div>`;
    renderCouplePanel();
    return;
  }

  recordList.innerHTML = filtered.map((record) => {
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
          <div class="record-actions">
            <button class="edit-button" type="button" data-edit="${escapeAttribute(record.id)}">编辑</button>
            <button class="delete-button" type="button" data-delete="${escapeAttribute(record.id)}">删除</button>
          </div>
        </div>
      </article>`;
  }).join("");

  renderCouplePanel();
};

function loadLoveSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(LF_SETTINGS_KEY) || "{}");
    return {
      nickname: saved.nickname || "晴晴",
      anniversaryDate: saved.anniversaryDate || "",
      birthdayDate: saved.birthdayDate || "",
      goalName: saved.goalName || "一起去看海",
      goalTarget: Number(saved.goalTarget) || 5000
    };
  } catch (error) {
    return { nickname: "晴晴", anniversaryDate: "", birthdayDate: "", goalName: "一起去看海", goalTarget: 5000 };
  }
}

function saveLoveSettings() {
  localStorage.setItem(LF_SETTINGS_KEY, JSON.stringify(lfSettings));
}

function openSettings() {
  nicknameInput.value = lfSettings.nickname;
  anniversaryInput.value = lfSettings.anniversaryDate;
  birthdayInput.value = lfSettings.birthdayDate;
  goalNameInput.value = lfSettings.goalName;
  goalTargetInput.value = String(lfSettings.goalTarget);
  openModal("settingsModal");
}

function saveSettings() {
  const target = parseAmount(goalTargetInput.value);
  lfSettings = {
    nickname: nicknameInput.value.trim() || "晴晴",
    anniversaryDate: anniversaryInput.value,
    birthdayDate: birthdayInput.value,
    goalName: goalNameInput.value.trim() || "我们的小目标",
    goalTarget: target > 0 ? target : 5000
  };
  saveLoveSettings();
  applyNickname();
  renderCouplePanel();
  closeModal("settingsModal");
  showToast("专属设置已保存");
}

function applyNickname() {
  const name = lfSettings.nickname || "晴晴";
  const title = document.querySelector(".hero h1");
  if (title) title.textContent = `${name}的猫咪小账本`;
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute("content", `${name}账本`);
}

function renderCouplePanel() {
  const name = lfSettings.nickname || "晴晴";
  daysTogether.textContent = calculateDaysTogether(lfSettings.anniversaryDate);
  daysBirthday.textContent = calculateDaysUntilBirthday(lfSettings.birthdayDate);

  const balance = records.reduce((total, record) => {
    return record.type === "income" ? total + Number(record.amount) : total - Number(record.amount);
  }, 0);
  const saved = Math.max(0, balance);
  const target = Number(lfSettings.goalTarget) || 0;
  const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

  goalName.textContent = lfSettings.goalName || "我们的小目标";
  goalPercent.textContent = `${percent}%`;
  goalProgress.style.width = `${percent}%`;
  goalText.textContent = `目标：${formatMoney(target)} · 已攒：${formatMoney(saved)}`;
  editSettingsButton.textContent = lfSettings.anniversaryDate || lfSettings.birthdayDate ? "修改" : "编辑";
}

function calculateDaysTogether(value) {
  if (!value) return "--";
  const start = new Date(value + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || start > today) return "--";
  return String(Math.floor((today - start) / 86400000) + 1);
}

function calculateDaysUntilBirthday(value) {
  if (!value) return "--";
  const saved = new Date(value + "T00:00:00");
  if (Number.isNaN(saved.getTime())) return "--";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), saved.getMonth(), saved.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, saved.getMonth(), saved.getDate());
  return String(Math.ceil((next - today) / 86400000));
}

function openEditModal(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  lfEditingId = id;
  editType.value = record.type;
  renderEditCategories(record.category);
  editDescription.value = record.description;
  editAmount.value = String(record.amount);
  openModal("editModal");
}

function renderEditCategories(selectedCategory) {
  editCategory.innerHTML = "";
  const categories = CATEGORIES[editType.value] || CATEGORIES.expense;
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    editCategory.appendChild(option);
  });
  if (categories.includes(selectedCategory)) editCategory.value = selectedCategory;
}

function saveEdit() {
  const record = records.find((item) => item.id === lfEditingId);
  if (!record) return;
  const description = editDescription.value.trim();
  const amount = parseAmount(editAmount.value);
  if (!description || !amount) {
    showToast("请填写完整的说明和金额");
    return;
  }
  record.type = editType.value;
  record.category = editCategory.value;
  record.description = description;
  record.amount = amount;
  saveRecords();
  render();
  closeModal("editModal");
  showToast("记录已修改");
}

function openMonthlyReport() {
  const now = new Date();
  const current = records.filter((record) => {
    const date = new Date(record.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const income = current.filter((record) => record.type === "income").reduce((sum, record) => sum + Number(record.amount), 0);
  const expense = current.filter((record) => record.type === "expense").reduce((sum, record) => sum + Number(record.amount), 0);
  const balance = income - expense;
  const categories = {};
  current.forEach((record) => {
    if (record.type === "expense") categories[record.category] = (categories[record.category] || 0) + Number(record.amount);
  });
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  reportStats.innerHTML = `
    <div><span>本月收入</span><strong>${formatMoney(income)}</strong></div>
    <div><span>本月支出</span><strong>${formatMoney(expense)}</strong></div>
    <div><span>本月结余</span><strong>${formatMoney(balance)}</strong></div>`;
  const topText = topCategory ? `这个月花得最多的是「${topCategory[0]}」，一共 ${formatMoney(topCategory[1])}。` : "这个月还没有支出记录。";
  const message = balance >= 0
    ? `谢谢你认真记录生活。${topText} 我们的日子正在一点点变好。`
    : `这个月花得有点多，但没关系，和你一起慢慢调整就好。${topText}`;
  reportMessage.textContent = message;
  openModal("reportModal");
}

function applyLocalPhoto() {
  const savedPhoto = localStorage.getItem(LF_PHOTO_KEY);
  if (savedPhoto) memoryPhoto.src = savedPhoto;
}

async function handlePhotoUpload() {
  const file = photoInput.files && photoInput.files[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImage(file, 900, 0.84);
    localStorage.setItem(LF_PHOTO_KEY, dataUrl);
    memoryPhoto.src = dataUrl;
    photoInput.value = "";
    showToast("晴晴的照片已保存到本机");
  } catch (error) {
    showToast("照片读取失败，换一张试试");
  }
}

function resizeImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function removeLocalPhoto() {
  if (!localStorage.getItem(LF_PHOTO_KEY)) {
    showToast("当前没有本机照片");
    return;
  }
  localStorage.removeItem(LF_PHOTO_KEY);
  memoryPhoto.src = "assets/qingqing-photo.jpg";
  showToast("本机照片已移除");
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

async function hashPin(value) {
  const text = `pink-cat-${value}`;
  if (window.crypto && window.crypto.subtle) {
    const bytes = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(text))).split("").reverse().join("");
}

function openPinSetup() {
  lfPinMode = "setup";
  pinTitle.textContent = localStorage.getItem(LF_PIN_KEY) ? "修改专属密码" : "设置专属密码";
  pinHint.textContent = "设置 4 到 6 位数字密码";
  pinConfirm.style.display = "block";
  pinCancelButton.style.display = "block";
  removePinButton.style.display = localStorage.getItem(LF_PIN_KEY) ? "block" : "none";
  pinInput.value = "";
  pinConfirm.value = "";
  pinError.textContent = "";
  openModal("pinModal");
  setTimeout(() => pinInput.focus(), 100);
}

function openPinUnlock() {
  if (!localStorage.getItem(LF_PIN_KEY)) return;
  lfPinMode = "unlock";
  pinTitle.textContent = "晴晴的专属账本";
  pinHint.textContent = "输入密码才能打开";
  pinConfirm.style.display = "none";
  pinCancelButton.style.display = "none";
  removePinButton.style.display = "none";
  pinInput.value = "";
  pinError.textContent = "";
  openModal("pinModal");
  setTimeout(() => pinInput.focus(), 100);
}

async function submitPin() {
  const value = pinInput.value.trim();
  if (!/^\d{4,6}$/.test(value)) {
    pinError.textContent = "请输入 4 到 6 位数字";
    pinModal.querySelector(".pin-card").classList.add("pin-shake");
    setTimeout(() => pinModal.querySelector(".pin-card").classList.remove("pin-shake"), 450);
    return;
  }

  const stored = localStorage.getItem(LF_PIN_KEY);
  if (lfPinMode === "unlock") {
    const valueHash = await hashPin(value);
    if (valueHash !== stored) {
      pinError.textContent = "密码不正确，再试一次吧";
      pinInput.value = "";
      pinModal.querySelector(".pin-card").classList.add("pin-shake");
      setTimeout(() => pinModal.querySelector(".pin-card").classList.remove("pin-shake"), 450);
      return;
    }
    closeModal("pinModal");
    resetAutoLock();
    showToast("欢迎回来，晴晴～");
    return;
  }

  if (value !== pinConfirm.value.trim()) {
    pinError.textContent = "两次输入的密码不一致";
    return;
  }
  localStorage.setItem(LF_PIN_KEY, await hashPin(value));
  closeModal("pinModal");
  resetAutoLock();
  showToast("密码已设置");
}

function removePin() {
  if (!window.confirm("确定移除密码保护吗？")) return;
  localStorage.removeItem(LF_PIN_KEY);
  closeModal("pinModal");
  showToast("密码已移除");
}

function resetAutoLock() {
  clearTimeout(lfAutoLockTimer);
  if (!localStorage.getItem(LF_PIN_KEY)) return;
  lfAutoLockTimer = setTimeout(openPinUnlock, 180000);
}

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeModal(button.dataset.close));
});
settingsModal.addEventListener("click", (event) => { if (event.target === settingsModal) closeModal("settingsModal"); });
editModal.addEventListener("click", (event) => { if (event.target === editModal) closeModal("editModal"); });
reportModal.addEventListener("click", (event) => { if (event.target === reportModal) closeModal("reportModal"); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal("settingsModal");
    closeModal("editModal");
    closeModal("reportModal");
  }
});

recordList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit]");
  if (button) openEditModal(button.dataset.edit);
});
settingsButton.addEventListener("click", openSettings);
editSettingsButton.addEventListener("click", openSettings);
saveSettingsButton.addEventListener("click", saveSettings);
pinSettingButton.addEventListener("click", () => {
  closeModal("settingsModal");
  openPinSetup();
});
searchInput.addEventListener("input", () => renderRecords());
typeFilter.addEventListener("change", () => renderRecords());
reportButton.addEventListener("click", openMonthlyReport);
editType.addEventListener("change", () => renderEditCategories(editCategory.value));
saveEditButton.addEventListener("click", saveEdit);
photoInput.addEventListener("change", handlePhotoUpload);
removePhotoButton.addEventListener("click", removeLocalPhoto);
pinSubmitButton.addEventListener("click", submitPin);
pinCancelButton.addEventListener("click", () => closeModal("pinModal"));
removePinButton.addEventListener("click", removePin);
pinInput.addEventListener("keydown", (event) => { if (event.key === "Enter") submitPin(); });
pinConfirm.addEventListener("keydown", (event) => { if (event.key === "Enter") submitPin(); });

["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
  document.addEventListener(eventName, resetAutoLock, { passive: true });
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    lfHiddenAt = Date.now();
  } else if (lfHiddenAt && Date.now() - lfHiddenAt > 30000) {
    openPinUnlock();
  }
});

applyNickname();
applyLocalPhoto();
render();
if (localStorage.getItem(LF_PIN_KEY)) openPinUnlock();
resetAutoLock();