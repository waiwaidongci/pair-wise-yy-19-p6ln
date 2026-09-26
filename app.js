const storageKey = "wxyy-2-thin-section-index";
const state = JSON.parse(localStorage.getItem(storageKey) || '{"samples":[],"compare":[]}');

const form = document.querySelector("#sampleForm");
const formTitle = document.querySelector("#formTitle");
const submitBtn = document.querySelector("#submitBtn");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const codeInput = form.elements.code;
const codeError = document.querySelector("#codeError");
const photoInput = document.querySelector("#photoInput");
const sampleGrid = document.querySelector("#sampleGrid");
const comparePane = document.querySelector("#comparePane");
const mineralFilter = document.querySelector("#mineralFilter");
const polarFilter = document.querySelector("#polarFilter");
const historyDialog = document.querySelector("#historyDialog");
const historyTitle = document.querySelector("#historyTitle");
const historyList = document.querySelector("#historyList");
const closeHistoryBtn = document.querySelector("#closeHistoryBtn");

let pendingPhoto = "";
let editingId = null;
let historySampleId = null;

const EDITABLE_FIELDS = ["photo", "code", "location", "magnification", "polarization", "minerals", "texture", "comment"];

// 兼容旧数据：补上版本历史所需的字段
state.samples.forEach((sample) => {
  sample.history = Array.isArray(sample.history) ? sample.history : [];
  sample.updatedAt = sample.updatedAt || sample.createdAt;
  sample.revisionNote = sample.revisionNote || "初始录入";
});

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

function snapshotOf(sample) {
  const snapshot = {};
  EDITABLE_FIELDS.forEach((field) => {
    snapshot[field] = sample[field];
  });
  return snapshot;
}

function formatTime(isoString) {
  if (!isoString) return "未知时间";
  return new Date(isoString).toLocaleString("zh-CN", { hour12: false });
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
      ${sample.photo ? `<img src="${sample.photo}" alt="${sample.code}显微照片">` : "<div class=\"photo-placeholder\"></div>"}
      <div class="sample-body">
        <h3>${sample.code}</h3>
        <p>${sample.location || "未记录地点"} · ${sample.magnification || "未记录倍数"} · ${sample.polarization}</p>
        <p>矿物：${sample.minerals || "未记录"}</p>
        <p>结构：${sample.texture || "未记录"}</p>
        <p>${sample.comment || "未填写批注"}</p>
        ${sample.history.length ? `<p class="edited-mark">已修改 · 最近保存 ${formatTime(sample.updatedAt)}</p>` : ""}
        <div class="card-actions">
          <label><input type="checkbox" data-compare="${sample.id}" ${state.compare.includes(sample.id) ? "checked" : ""}>对比</label>
          <button type="button" data-edit="${sample.id}">编辑</button>
          <button type="button" data-history="${sample.id}">历史${sample.history.length ? `(${sample.history.length})` : ""}</button>
          <button type="button" data-delete="${sample.id}">删除</button>
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
      ${sample.photo ? `<img src="${sample.photo}" alt="${sample.code}对比图">` : ""}
      <h3>${sample.code}</h3>
      <p>${sample.polarization} · ${sample.minerals || "未记录矿物"}</p>
      <p>${sample.texture || "未记录结构"}</p>
    </article>
  `).join("") : "<p>勾选两张样本卡片后可并排对比。</p>";
}

function showCodeError(message) {
  codeError.textContent = message;
  codeError.hidden = false;
  codeInput.setAttribute("aria-invalid", "true");
  codeInput.focus();
}

function clearCodeError() {
  codeError.hidden = true;
  codeError.textContent = "";
  codeInput.removeAttribute("aria-invalid");
}

function resetForm() {
  editingId = null;
  pendingPhoto = "";
  photoInput.value = "";
  form.reset();
  formTitle.textContent = "样本录入";
  submitBtn.textContent = "保存样本";
  cancelEditBtn.hidden = true;
  clearCodeError();
}

function startEdit(id) {
  const sample = state.samples.find((item) => item.id === id);
  if (!sample) return;
  editingId = id;
  form.elements.code.value = sample.code;
  form.elements.location.value = sample.location;
  form.elements.magnification.value = sample.magnification;
  form.elements.polarization.value = sample.polarization;
  form.elements.minerals.value = sample.minerals;
  form.elements.texture.value = sample.texture;
  form.elements.comment.value = sample.comment;
  pendingPhoto = sample.photo || "";
  photoInput.value = "";
  formTitle.textContent = `编辑样本 ${sample.code}`;
  submitBtn.textContent = "保存修改";
  cancelEditBtn.hidden = false;
  clearCodeError();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function versionCardHtml(version, { isCurrent, index }) {
  return `
    <article class="version-card${isCurrent ? " current" : ""}">
      <header>
        <strong>${isCurrent ? "当前版本" : `旧版本 ${index + 1}`}</strong>
        <span>保存于 ${formatTime(version.savedAt)}</span>
      </header>
      <p class="version-note">${version.note}</p>
      ${version.photo ? `<img src="${version.photo}" alt="该版本显微照片">` : ""}
      <p>编号：${version.code || "未记录"}</p>
      <p>地点：${version.location || "未记录"} · 倍数：${version.magnification || "未记录"} · ${version.polarization}</p>
      <p>矿物：${version.minerals || "未记录"}</p>
      <p>结构：${version.texture || "未记录"}</p>
      <p>批注：${version.comment || "未填写"}</p>
      ${isCurrent ? "" : `<button type="button" data-restore="${index}">恢复此版本</button>`}
    </article>
  `;
}

function renderHistory() {
  const sample = state.samples.find((item) => item.id === historySampleId);
  if (!sample) {
    historyDialog.close();
    return;
  }
  historyTitle.textContent = `修改历史 · ${sample.code}`;
  const current = { ...snapshotOf(sample), savedAt: sample.updatedAt, note: sample.revisionNote };
  historyList.innerHTML = [
    versionCardHtml(current, { isCurrent: true }),
    ...sample.history.map((version, index) => versionCardHtml(version, { isCurrent: false, index }))
  ].join("");
}

function openHistory(id) {
  historySampleId = id;
  renderHistory();
  if (!historyDialog.open) historyDialog.showModal();
}

photoInput.addEventListener("change", async () => {
  pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
});

codeInput.addEventListener("input", clearCodeError);

cancelEditBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const code = data.get("code").trim();

  // 编号不得与除被修改样本之外的已有记录重复
  const duplicate = state.samples.find((sample) => sample.code === code && sample.id !== editingId);
  if (duplicate) {
    showCodeError(`编号「${code}」已被另一条记录使用（录入于 ${formatTime(duplicate.createdAt)}），保存已停止，请更换编号。`);
    return;
  }
  clearCodeError();

  if (!pendingPhoto && photoInput.files[0]) {
    pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
  }
  const fields = {
    photo: pendingPhoto,
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
      resetForm();
      return;
    }
    // 旧版本先归档，再以新内容覆盖当前版本
    sample.history.unshift({ ...snapshotOf(sample), savedAt: sample.updatedAt, note: "编辑前的版本" });
    Object.assign(sample, fields, { updatedAt: now, revisionNote: "手动编辑" });
  } else {
    state.samples.unshift({
      id: crypto.randomUUID(),
      ...fields,
      createdAt: now,
      updatedAt: now,
      revisionNote: "初始录入",
      history: []
    });
  }
  resetForm();
  save();
  render();
});

sampleGrid.addEventListener("click", (event) => {
  const deleteId = event.target.dataset.delete;
  if (deleteId) {
    state.samples = state.samples.filter((sample) => sample.id !== deleteId);
    state.compare = state.compare.filter((id) => id !== deleteId);
    if (deleteId === editingId) resetForm();
    if (deleteId === historySampleId) historyDialog.close();
    save();
    render();
    return;
  }
  const editId = event.target.dataset.edit;
  if (editId) {
    startEdit(editId);
    return;
  }
  const historyId = event.target.dataset.history;
  if (historyId) {
    openHistory(historyId);
  }
});

historyList.addEventListener("click", (event) => {
  const restoreIndex = event.target.dataset.restore;
  if (restoreIndex === undefined) return;
  const sample = state.samples.find((item) => item.id === historySampleId);
  if (!sample) return;
  const version = sample.history[Number(restoreIndex)];
  if (!version) return;
  // 恢复旧版 = 生成一条新的修改记录：当前版本归档，旧内容以新时间成为最新版本
  sample.history.unshift({ ...snapshotOf(sample), savedAt: sample.updatedAt, note: "恢复旧版前的版本" });
  EDITABLE_FIELDS.forEach((field) => {
    sample[field] = version[field];
  });
  sample.updatedAt = new Date().toISOString();
  sample.revisionNote = `恢复自 ${formatTime(version.savedAt)} 的旧版本`;
  if (editingId === sample.id) resetForm();
  save();
  render();
  renderHistory();
});

closeHistoryBtn.addEventListener("click", () => historyDialog.close());

historyDialog.addEventListener("click", (event) => {
  if (event.target === historyDialog) historyDialog.close();
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
