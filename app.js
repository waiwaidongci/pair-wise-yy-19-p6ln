const storageKey = "wxyy-2-thin-section-index";
const state = JSON.parse(localStorage.getItem(storageKey) || '{"samples":[],"compare":[]}');

// 参与版本管理的字段，历史快照与恢复旧版都以它们为准
const REVISION_FIELDS = ["photo", "code", "location", "magnification", "polarization", "minerals", "texture", "comment"];

// 兼容旧数据：补齐修改历史与更新时间
state.samples.forEach((sample) => {
  if (!Array.isArray(sample.history)) sample.history = [];
  if (!sample.updatedAt) sample.updatedAt = sample.createdAt || new Date().toISOString();
});

const form = document.querySelector("#sampleForm");
const formTitle = document.querySelector("#formTitle");
const submitBtn = document.querySelector("#submitBtn");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const photoInput = document.querySelector("#photoInput");
const photoPreview = document.querySelector("#photoPreview");
const codeInput = form.elements.code;
const codeError = document.querySelector("#codeError");
const sampleGrid = document.querySelector("#sampleGrid");
const comparePane = document.querySelector("#comparePane");
const mineralFilter = document.querySelector("#mineralFilter");
const polarFilter = document.querySelector("#polarFilter");
const historyDialog = document.querySelector("#historyDialog");
const historyTitle = document.querySelector("#historyTitle");
const historyList = document.querySelector("#historyList");
const historyError = document.querySelector("#historyError");

let pendingPhoto = "";
let editingId = null;
let historySampleId = null;

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function formatTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "未知时间" : date.toLocaleString("zh-CN", { hour12: false });
}

// 把样本当前内容压成一条历史记录，savedAt 记录这一版生效的时间
function snapshotOf(sample) {
  const snap = { savedAt: sample.updatedAt };
  REVISION_FIELDS.forEach((field) => {
    snap[field] = sample[field];
  });
  if (sample.restoredFrom) snap.restoredFrom = sample.restoredFrom;
  return snap;
}

function filteredSamples() {
  const mineral = mineralFilter.value.trim();
  const polarization = polarFilter.value;
  return state.samples.filter((sample) => {
    const mineralMatch = !mineral || sample.minerals.includes(mineral);
    const polarMatch = !polarization || sample.polarization === polarization;
    return mineralMatch && polarMatch;
  });
}

function render() {
  const rows = filteredSamples();
  sampleGrid.innerHTML = rows.length ? rows.map((sample) => `
    <article class="sample-card">
      ${sample.photo ? `<img src="${sample.photo}" alt="${escapeHtml(sample.code)}显微照片">` : "<div class=\"photo-placeholder\"></div>"}
      <div class="sample-body">
        <h3>${escapeHtml(sample.code)}</h3>
        <p>${escapeHtml(sample.location) || "未记录地点"} · ${escapeHtml(sample.magnification) || "未记录倍数"} · ${escapeHtml(sample.polarization)}</p>
        <p>矿物：${escapeHtml(sample.minerals) || "未记录"}</p>
        <p>结构：${escapeHtml(sample.texture) || "未记录"}</p>
        <p>${escapeHtml(sample.comment) || "未填写批注"}</p>
        <div class="card-actions">
          <label><input type="checkbox" data-compare="${sample.id}" ${state.compare.includes(sample.id) ? "checked" : ""}>对比</label>
          <div class="card-buttons">
            <button type="button" data-edit="${sample.id}">编辑</button>
            <button type="button" data-history="${sample.id}">历史</button>
            <button type="button" data-delete="${sample.id}">删除</button>
          </div>
        </div>
      </div>
    </article>
  `).join("") : "<p>还没有样本，先从左侧录入一张薄片照片。</p>";

  const compareSamples = state.compare
    .map((id) => state.samples.find((sample) => sample.id === id))
    .filter(Boolean)
    .slice(0, 2);

  comparePane.innerHTML = compareSamples.length ? compareSamples.map((sample) => `
    <article class="compare-item">
      ${sample.photo ? `<img src="${sample.photo}" alt="${escapeHtml(sample.code)}对比图">` : ""}
      <h3>${escapeHtml(sample.code)}</h3>
      <p>${escapeHtml(sample.polarization)} · ${escapeHtml(sample.minerals) || "未记录矿物"}</p>
      <p>${escapeHtml(sample.texture) || "未记录结构"}</p>
    </article>
  `).join("") : "<p>勾选两张样本卡片后可并排对比。</p>";
}

function setFormMode() {
  formTitle.textContent = editingId ? "编辑样本" : "样本录入";
  submitBtn.textContent = editingId ? "保存修改" : "保存样本";
  cancelEditBtn.hidden = !editingId;
}

function updatePhotoPreview() {
  const editing = state.samples.find((sample) => sample.id === editingId);
  const src = pendingPhoto || (editing && editing.photo) || "";
  if (src) photoPreview.src = src;
  photoPreview.hidden = !src;
}

function showCodeError(message) {
  codeError.textContent = message;
  codeError.hidden = false;
  codeInput.classList.add("invalid");
  codeInput.focus();
}

function clearCodeError() {
  codeError.hidden = true;
  codeInput.classList.remove("invalid");
}

function startEdit(id) {
  const sample = state.samples.find((item) => item.id === id);
  if (!sample) return;
  editingId = id;
  pendingPhoto = "";
  photoInput.value = "";
  form.elements.code.value = sample.code;
  form.elements.location.value = sample.location;
  form.elements.magnification.value = sample.magnification;
  form.elements.polarization.value = sample.polarization;
  form.elements.minerals.value = sample.minerals;
  form.elements.texture.value = sample.texture;
  form.elements.comment.value = sample.comment;
  clearCodeError();
  setFormMode();
  updatePhotoPreview();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  codeInput.focus();
}

function cancelEdit() {
  editingId = null;
  pendingPhoto = "";
  photoInput.value = "";
  form.reset();
  clearCodeError();
  setFormMode();
  updatePhotoPreview();
}

function openHistory(id) {
  historySampleId = id;
  historyError.hidden = true;
  renderHistory();
  if (!historyDialog.open) historyDialog.showModal();
}

function renderHistory() {
  const sample = state.samples.find((item) => item.id === historySampleId);
  if (!sample) {
    historyDialog.close();
    return;
  }
  historyTitle.textContent = `版本历史 — ${sample.code}`;
  // 当前版本在最上，历史版本按时间从新到旧排列
  const entries = [
    { ...snapshotOf(sample), isCurrent: true },
    ...sample.history.map((entry, index) => ({ ...entry, index })).reverse()
  ];
  historyList.innerHTML = entries.map((entry) => `
    <article class="history-item${entry.isCurrent ? " current" : ""}">
      <h3>
        <span>${formatTime(entry.savedAt)}</span>
        <span class="tag">${entry.isCurrent ? "当前版本" : `第 ${entry.index + 1} 版`}</span>
      </h3>
      ${entry.restoredFrom ? `<p class="restore-note">恢复自 ${formatTime(entry.restoredFrom)} 的版本</p>` : ""}
      <div class="history-body">
        ${entry.photo ? `<img src="${entry.photo}" alt="该版本显微照片">` : ""}
        <div>
          <p>编号：${escapeHtml(entry.code)}</p>
          <p>地点：${escapeHtml(entry.location) || "未记录"} · ${escapeHtml(entry.magnification) || "未记录倍数"} · ${escapeHtml(entry.polarization)}</p>
          <p>矿物：${escapeHtml(entry.minerals) || "未记录"}</p>
          <p>结构：${escapeHtml(entry.texture) || "未记录"}</p>
          <p>批注：${escapeHtml(entry.comment) || "未填写"}</p>
        </div>
      </div>
      ${entry.isCurrent ? "" : `<button type="button" data-restore="${entry.index}">恢复此版本</button>`}
    </article>
  `).join("");
}

photoInput.addEventListener("change", async () => {
  pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
  updatePhotoPreview();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  if (!pendingPhoto && photoInput.files[0]) {
    pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
  }
  const code = data.get("code").trim();
  if (!code) {
    showCodeError("样本编号不能为空。");
    return;
  }
  // 编号在全库唯一；编辑时只排除正在修改的这一条
  const duplicate = state.samples.find((sample) => sample.code === code && sample.id !== editingId);
  if (duplicate) {
    showCodeError(`编号 “${code}” 已被另一条记录使用，请更换后再保存。`);
    return;
  }
  clearCodeError();
  const fields = {
    code,
    location: data.get("location").trim(),
    magnification: data.get("magnification").trim(),
    polarization: data.get("polarization"),
    minerals: data.get("minerals").trim(),
    texture: data.get("texture").trim(),
    comment: data.get("comment").trim()
  };
  const now = new Date().toISOString();
  if (editingId) {
    const sample = state.samples.find((item) => item.id === editingId);
    if (!sample) {
      cancelEdit();
      return;
    }
    // 先把当前版本存入历史，再写入新内容
    sample.history.push(snapshotOf(sample));
    if (pendingPhoto) fields.photo = pendingPhoto;
    Object.assign(sample, fields);
    delete sample.restoredFrom;
    sample.updatedAt = now;
  } else {
    state.samples.unshift({
      id: crypto.randomUUID(),
      photo: pendingPhoto,
      ...fields,
      createdAt: now,
      updatedAt: now,
      history: []
    });
  }
  cancelEdit();
  save();
  render();
});

sampleGrid.addEventListener("click", (event) => {
  const { delete: deleteId, edit: editId, history: historyId } = event.target.dataset;
  if (deleteId) {
    state.samples = state.samples.filter((sample) => sample.id !== deleteId);
    state.compare = state.compare.filter((id) => id !== deleteId);
    if (editingId === deleteId) cancelEdit();
    if (historySampleId === deleteId) historyDialog.close();
    save();
    render();
    return;
  }
  if (editId) startEdit(editId);
  if (historyId) openHistory(historyId);
});

sampleGrid.addEventListener("change", (event) => {
  const id = event.target.dataset.compare;
  if (!id) return;
  if (event.target.checked) {
    state.compare = [id, ...state.compare.filter((item) => item !== id)].slice(0, 2);
  } else {
    state.compare = state.compare.filter((item) => item !== id);
  }
  save();
  render();
});

historyList.addEventListener("click", (event) => {
  const index = event.target.dataset.restore;
  if (index === undefined) return;
  const sample = state.samples.find((item) => item.id === historySampleId);
  const revision = sample && sample.history[Number(index)];
  if (!revision) return;
  const clash = state.samples.find((item) => item.id !== sample.id && item.code === revision.code);
  if (clash) {
    historyError.textContent = `无法恢复：编号 “${revision.code}” 已被另一条记录使用。`;
    historyError.hidden = false;
    return;
  }
  // 恢复也作为一条新记录追加：当前版本先入历史，旧内容套上新的时间戳，时间顺序不倒退
  sample.history.push(snapshotOf(sample));
  REVISION_FIELDS.forEach((field) => {
    sample[field] = revision[field];
  });
  sample.restoredFrom = revision.savedAt;
  sample.updatedAt = new Date().toISOString();
  historyError.hidden = true;
  save();
  render();
  renderHistory();
});

document.querySelector("#historyClose").addEventListener("click", () => historyDialog.close());
historyDialog.addEventListener("click", (event) => {
  if (event.target === historyDialog) historyDialog.close();
});
historyDialog.addEventListener("close", () => {
  historySampleId = null;
});

cancelEditBtn.addEventListener("click", cancelEdit);
codeInput.addEventListener("input", clearCodeError);

[mineralFilter, polarFilter].forEach((field) => field.addEventListener("input", render));

document.querySelector("#exportBtn").addEventListener("click", () => {
  const checklist = state.samples.map((sample) => ({
    样本编号: sample.code,
    采样地点: sample.location,
    放大倍数: sample.magnification,
    偏光类型: sample.polarization,
    主要矿物: sample.minerals,
    颗粒结构: sample.texture,
    老师批注: sample.comment
  }));
  const blob = new Blob([JSON.stringify(checklist, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "thin-section-checklist.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

render();
