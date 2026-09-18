const CS_CONFIG = {
  owner: "A13329206792-art",
  repo: "lll-data",
  branch: "main",
  dataFile: "ledger.json",
  photoFile: "photo.jpg"
};

const CS_TOKEN_KEY = "pink-cat-github-sync-token-v1";
const CS_TOMBSTONE_KEY = "pink-cat-sync-tombstones-v1";

let csToken = localStorage.getItem(CS_TOKEN_KEY) || "";
let csBusy = false;
let csQueued = false;
let csSyncTimer = null;
let csLastSha = null;
let csTombstones = loadCsTombstones();
let csLastSnapshot = csSnapshotRecords(records);

const csStatus = document.getElementById("syncStatus");
const csSetup = document.getElementById("syncSetup");
const csTokenInput = document.getElementById("syncTokenInput");
const csSaveTokenButton = document.getElementById("saveTokenButton");
const csSyncNowButton = document.getElementById("syncNowButton");
const csPairButton = document.getElementById("pairButton");
const csDisconnectButton = document.getElementById("disconnectSyncButton");
const csPairModal = document.getElementById("syncPairModal");
const csPairLink = document.getElementById("syncPairLink");
const csCopyPair = document.getElementById("copyPairLinkButton");
const csQrCanvas = document.getElementById("syncQrCanvas");

const csOriginalSaveRecords = saveRecords;
const csOriginalSaveSettings = saveLoveSettings;

saveRecords = function saveRecordsWithCloudSync() {
  csCaptureLocalChanges();
  csOriginalSaveRecords();
  csScheduleSync();
};

saveLoveSettings = function saveSettingsWithCloudSync() {
  lfSettings.updatedAt = new Date().toISOString();
  csOriginalSaveSettings();
  csScheduleSync();
};

document.getElementById("photoInput").addEventListener("change", () => {
  setTimeout(() => {
    lfSettings.photoUpdatedAt = new Date().toISOString();
    csOriginalSaveSettings();
    csScheduleSync();
  }, 700);
});
document.getElementById("removePhotoButton").addEventListener("click", () => {
  lfSettings.photoUpdatedAt = new Date().toISOString();
  csOriginalSaveSettings();
  csScheduleSync();
});

function loadCsTombstones() {
  try {
    return JSON.parse(localStorage.getItem(CS_TOMBSTONE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function saveCsTombstones() {
  localStorage.setItem(CS_TOMBSTONE_KEY, JSON.stringify(csTombstones));
}

function csSnapshotRecords(list) {
  const map = {};
  list.forEach((record) => {
    map[record.id] = {
      id: record.id,
      type: record.type,
      category: record.category,
      description: record.description,
      amount: Number(record.amount),
      date: record.date,
      source: record.source,
      updatedAt: record.updatedAt || record.date || new Date().toISOString()
    };
  });
  return map;
}

function csCaptureLocalChanges() {
  const now = new Date().toISOString();
  const current = csSnapshotRecords(records);

  records.forEach((record) => {
    const previous = csLastSnapshot[record.id];
    const comparable = {
      type: record.type,
      category: record.category,
      description: record.description,
      amount: Number(record.amount),
      date: record.date,
      source: record.source
    };

    if (!previous) {
      record.updatedAt = now;
      return;
    }

    const previousComparable = {
      type: previous.type,
      category: previous.category,
      description: previous.description,
      amount: Number(previous.amount),
      date: previous.date,
      source: previous.source
    };

    if (JSON.stringify(comparable) !== JSON.stringify(previousComparable)) {
      record.updatedAt = now;
    }
  });

  Object.keys(csLastSnapshot).forEach((id) => {
    if (!current[id]) {
      csTombstones[id] = now;
    }
  });

  saveCsTombstones();
  csLastSnapshot = csSnapshotRecords(records);
}

function csLocalState() {
  const now = new Date().toISOString();
  const cloudRecords = records.map((record) => ({
    ...record,
    amount: Number(record.amount),
    updatedAt: record.updatedAt || record.date || now
  }));

  Object.entries(csTombstones).forEach(([id, deletedAt]) => {
    cloudRecords.push({ id, deleted: true, updatedAt: deletedAt });
  });

  return {
    version: 1,
    updatedAt: now,
    records: cloudRecords,
    settings: { ...lfSettings, updatedAt: lfSettings.updatedAt || now },
    photoUpdatedAt: lfSettings.photoUpdatedAt || ""
  };
}

function csMergeStates(remote, local) {
  const map = new Map();
  [...(remote?.records || []), ...(local.records || [])].forEach((record) => {
    if (!record || !record.id) return;
    const timestamp = Date.parse(record.updatedAt || record.date || 0) || 0;
    const existing = map.get(record.id);
    const existingTime = existing ? (Date.parse(existing.updatedAt || existing.date || 0) || 0) : -1;
    if (!existing || timestamp >= existingTime) map.set(record.id, record);
  });

  const mergedRecords = Array.from(map.values());
  const activeRecords = mergedRecords.filter((record) => !record.deleted);
  const deletedRecords = mergedRecords.filter((record) => record.deleted);

  const remoteSettings = remote?.settings || {};
  const localSettings = local.settings || {};
  const remoteTime = Date.parse(remoteSettings.updatedAt || 0) || 0;
  const localTime = Date.parse(localSettings.updatedAt || 0) || 0;
  const settings = remoteTime > localTime ? remoteSettings : localSettings;

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    records: [...activeRecords, ...deletedRecords],
    settings,
    photoUpdatedAt: remote?.photoUpdatedAt || local.photoUpdatedAt || ""
  };
}

function csApplyRemoteState(merged) {
  const activeRecords = (merged.records || []).filter((record) => !record.deleted);
  const deletedRecords = (merged.records || []).filter((record) => record.deleted);

  records.splice(0, records.length, ...activeRecords);
  csTombstones = {};
  deletedRecords.forEach((record) => {
    csTombstones[record.id] = record.updatedAt || new Date().toISOString();
  });
  saveCsTombstones();

  const mergedSettings = { ...(merged.settings || {}) };
  for (const key of Object.keys(lfSettings)) {
    if (!(key in mergedSettings)) delete lfSettings[key];
  }
  Object.assign(lfSettings, mergedSettings, { updatedAt: mergedSettings.updatedAt || new Date().toISOString() });
  if (!lfSettings.photoUpdatedAt && merged.photoUpdatedAt) {
    lfSettings.photoUpdatedAt = merged.photoUpdatedAt;
  }

  csLastSnapshot = csSnapshotRecords(records);
  csOriginalSaveRecords();
  csOriginalSaveSettings();
  applyNickname();
  render();
}

async function csRequest(path, options = {}) {
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${csToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {})
  };

  return fetch(`https://api.github.com${path}`, { ...options, headers });
}

function csBase64Encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function csBase64Decode(text) {
  return decodeURIComponent(escape(atob(text.replace(/\n/g, ""))));
}

async function csValidateToken() {
  const response = await csRequest(`/repos/${CS_CONFIG.owner}/${CS_CONFIG.repo}`);
  if (!response.ok) throw new Error("同步密钥无效或没有访问私人仓库的权限");
}

async function csReadData() {
  const response = await csRequest(`/repos/${CS_CONFIG.owner}/${CS_CONFIG.repo}/contents/${CS_CONFIG.dataFile}?ref=${CS_CONFIG.branch}`);
  if (response.status === 404) {
    csLastSha = null;
    return null;
  }
  if (!response.ok) throw new Error("读取云端账本失败");
  const payload = await response.json();
  csLastSha = payload.sha;
  return JSON.parse(csBase64Decode(payload.content));
}

async function csWriteData(state) {
  const body = {
    message: `Sync ledger ${new Date().toISOString()}`,
    content: csBase64Encode(JSON.stringify(state, null, 2)),
    branch: CS_CONFIG.branch
  };
  if (csLastSha) body.sha = csLastSha;

  const response = await csRequest(`/repos/${CS_CONFIG.owner}/${CS_CONFIG.repo}/contents/${CS_CONFIG.dataFile}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (response.status === 409) {
    const remote = await csReadData();
    const merged = csMergeStates(remote, csLocalState());
    return csWriteData(merged);
  }
  if (!response.ok) throw new Error("写入云端账本失败");
  const payload = await response.json();
  csLastSha = payload.content?.sha || null;
}

async function csReadPhoto() {
  const response = await csRequest(`/repos/${CS_CONFIG.owner}/${CS_CONFIG.repo}/contents/${CS_CONFIG.photoFile}?ref=${CS_CONFIG.branch}`, {
    headers: { "Accept": "application/vnd.github.v3.raw" }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("读取云端照片失败");
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

async function csWritePhoto(dataUrl) {
  const content = dataUrl.split(",")[1];
  const body = {
    message: "Update Qingqing photo",
    content,
    branch: CS_CONFIG.branch
  };

  const info = await csRequest(`/repos/${CS_CONFIG.owner}/${CS_CONFIG.repo}/contents/${CS_CONFIG.photoFile}?ref=${CS_CONFIG.branch}`);
  if (info.ok) {
    const payload = await info.json();
    body.sha = payload.sha;
  }

  const response = await csRequest(`/repos/${CS_CONFIG.owner}/${CS_CONFIG.repo}/contents/${CS_CONFIG.photoFile}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("上传照片到私人仓库失败");
}

async function csSyncPhoto(cloudPhotoUpdatedAt) {
  const localPhoto = localStorage.getItem(LF_PHOTO_KEY);
  const localPhotoTime = Date.parse(lfSettings.photoUpdatedAt || 0) || 0;
  const remoteTime = Date.parse(cloudPhotoUpdatedAt || 0) || 0;

  if (localPhoto && (!remoteTime || localPhotoTime > remoteTime)) {
    await csWritePhoto(localPhoto);
    lfSettings.photoUpdatedAt = new Date().toISOString();
    return true;
  }

  if (!localPhoto) {
    const cloudPhoto = await csReadPhoto();
    if (cloudPhoto) {
      localStorage.setItem(LF_PHOTO_KEY, cloudPhoto);
      memoryPhoto.src = cloudPhoto;
      lfSettings.photoUpdatedAt = cloudPhotoUpdatedAt || new Date().toISOString();
      return true;
    }
  }

  if (localPhoto && remoteTime > localPhotoTime) {
    const cloudPhoto = await csReadPhoto();
    if (cloudPhoto) {
      localStorage.setItem(LF_PHOTO_KEY, cloudPhoto);
      memoryPhoto.src = cloudPhoto;
      lfSettings.photoUpdatedAt = cloudPhotoUpdatedAt;
      return true;
    }
  }

  return false;
}

async function csSyncNow(silent = false) {
  if (!csToken) {
    csSetStatus("未连接", true);
    if (!silent) showToast("请先保存同步密钥");
    return;
  }
  if (csBusy) {
    csQueued = true;
    return;
  }

  csBusy = true;
  csSetStatus("同步中...", false);
  try {
    await csValidateToken();
    const remote = await csReadData();
    const merged = csMergeStates(remote, csLocalState());
    csApplyRemoteState(merged);

    const photoChanged = await csSyncPhoto(remote?.photoUpdatedAt);
    if (photoChanged) {
      merged.photoUpdatedAt = lfSettings.photoUpdatedAt;
      merged.settings = { ...lfSettings };
    }

    await csWriteData(merged);
    csSetStatus("已同步", false);
    if (!silent) showToast("云端同步完成");
  } catch (error) {
    csSetStatus("同步失败", true);
    if (!silent) showToast(error.message || "同步失败，请检查网络和密钥");
  } finally {
    csBusy = false;
    if (csQueued) {
      csQueued = false;
      csScheduleSync(800);
    }
  }
}

function csScheduleSync(delay = 1200) {
  clearTimeout(csSyncTimer);
  if (!csToken) return;
  csSyncTimer = setTimeout(() => csSyncNow(true), delay);
}

function csSetStatus(text, error) {
  if (!csStatus) return;
  csStatus.textContent = text;
  csStatus.style.color = error ? "#d95778" : "#23a371";
}

function csShowSetup() {
  csSetup.style.display = csToken ? "none" : "grid";
}

async function csSaveToken() {
  const token = csTokenInput.value.trim();
  if (!/^github_pat_/.test(token)) {
    showToast("同步密钥格式不正确");
    return;
  }
  csToken = token;
  localStorage.setItem(CS_TOKEN_KEY, csToken);
  csTokenInput.value = "";
  csShowSetup();
  await csSyncNow(false);
}

function csGeneratePairLink() {
  if (!csToken) {
    showToast("请先保存同步密钥");
    return;
  }
  const base = `${location.origin}${location.pathname}`;
  const url = `${base}#sync=${encodeURIComponent(csToken)}`;
  csPairLink.value = url;
  if (window.QRCode && csQrCanvas) {
    QRCode.toCanvas(csQrCanvas, url, {
      width: 240,
      margin: 2,
      color: { dark: "#bc3f70", light: "#ffffff" }
    }).catch(() => {});
  }
  openModal("syncPairModal");
}

async function csCopyPairLink() {
  if (!csPairLink.value) return;
  try {
    await navigator.clipboard.writeText(csPairLink.value);
    showToast("配对链接已复制");
  } catch (error) {
    csPairLink.select();
    document.execCommand("copy");
    showToast("配对链接已复制");
  }
}

function csDisconnect() {
  if (!window.confirm("确定断开这台设备的云同步吗？本地账本不会删除。")) return;
  csToken = "";
  localStorage.removeItem(CS_TOKEN_KEY);
  csLastSha = null;
  csSetStatus("未连接", true);
  csShowSetup();
  showToast("已断开云同步");
}

function csHandlePairFragment() {
  const match = location.hash.match(/^#sync=(.+)$/);
  if (!match) return;
  try {
    const token = decodeURIComponent(match[1]);
    if (/^github_pat_/.test(token)) {
      csToken = token;
      localStorage.setItem(CS_TOKEN_KEY, csToken);
      history.replaceState({}, document.title, location.pathname + location.search);
      showToast("同步配对成功");
      setTimeout(() => csSyncNow(false), 300);
    }
  } catch (error) {
    // Ignore a damaged pairing link.
  }
}

csSaveTokenButton.addEventListener("click", csSaveToken);
csSyncNowButton.addEventListener("click", () => csSyncNow(false));
csPairButton.addEventListener("click", csGeneratePairLink);
csCopyPair.addEventListener("click", csCopyPairLink);
csDisconnectButton.addEventListener("click", csDisconnect);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal("syncPairModal");
});

csHandlePairFragment();
csShowSetup();
csSetStatus(csToken ? "等待同步" : "未连接", !csToken);
if (csToken) setTimeout(() => csSyncNow(true), 800);
setInterval(() => {
  if (csToken && !document.hidden) csSyncNow(true);
}, 60000);
window.addEventListener("online", () => csScheduleSync(300));
window.addEventListener("focus", () => {
  if (csToken) csScheduleSync(800);
});