const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state = { projects: [], project: null, requirementId: null, documentId: null, page: 1, box: null, view: 'tor' };
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || `คำขอไม่สำเร็จ (${response.status})`);
  return data;
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 5200);
}

async function loadProjects(preferredId) {
  state.projects = await api('/api/projects');
  const picker = $('#projectSelect');
  picker.innerHTML = state.projects.length
    ? state.projects.map(project => `<option value="${project.id}">${esc(project.name)}</option>`).join('')
    : '<option value="">ยังไม่มีโครงการ</option>';
  const remembered = Number(localStorage.getItem('tor-comply-project'));
  const selected = preferredId || (state.projects.some(project => project.id === remembered) ? remembered : state.projects[0]?.id);
  if (selected) await loadProject(selected);
  else showWelcome();
}

function showWelcome() {
  $('#welcome').hidden = false;
  $('#workspace').hidden = true;
  $('#createProjectForm').reset();
  window.scrollTo(0, 0);
}

async function loadProject(projectId) {
  state.project = await api(`/api/projects/${projectId}`);
  localStorage.setItem('tor-comply-project', String(projectId));
  $('#projectSelect').value = String(projectId);
  $('#welcome').hidden = true;
  $('#workspace').hidden = false;
  if (!state.project.requirements.some(item => item.id === state.requirementId)) state.requirementId = state.project.requirements[0]?.id || null;
  if (!state.project.documents.some(item => item.id === state.documentId)) state.documentId = state.project.documents[0]?.id || null;
  render();
}

async function refresh(message) {
  if (state.project) await loadProject(state.project.id);
  if (message) toast(message);
}

function setView(view, scroll = true) {
  state.view = view;
  if (state.project) { $('#welcome').hidden = true; $('#workspace').hidden = false; }
  document.querySelectorAll('.step').forEach(node => node.classList.toggle('active', node.dataset.view === view));
  document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== `view-${view}`; });
  if (view === 'evidence') renderEvidence();
  if (view === 'table') renderTable();
  if (scroll) window.scrollTo({top: 0, behavior: 'smooth'});
}

function render() {
  const project = state.project;
  $('#projectTitle').textContent = project.name;
  $('#projectSubline').textContent = project.tor_filename ? `TOR: ${project.tor_filename}` : 'โครงการที่สร้างโดยไม่แนบ TOR';
  const ready = project.requirements.filter(item => item.comparison === 'ตรงตามข้อกำหนด').length;
  const total = project.requirements.length;
  $('#progressFigure').innerHTML = `${ready}<span>/${total}</span>`;
  $('#progressFill').style.width = `${total ? Math.round(ready / total * 100) : 0}%`;
  renderTor();
  renderLibrary();
  setView(state.view, false);
}

function renderTor() {
  const project = state.project;
  const source = $('#torSourceLink');
  source.hidden = !project.tor_filename;
  if (project.tor_filename) source.href = `/api/projects/${project.id}/tor`;
  const warning = $('#scanWarning');
  warning.hidden = !project.unreadable_pages.length;
  if (!warning.hidden) warning.textContent = `หน้า PDF ที่อ่านตัวอักษรไม่ได้: ${project.unreadable_pages.join(', ')} — ใช้ OCR ทีละหน้าแล้วตรวจข้อความ หรือเพิ่มข้อ TOR ด้วยตนเอง`;
  const ocrPanel = $('#ocrPanel');
  ocrPanel.hidden = !project.unreadable_pages.length;
  if (!ocrPanel.hidden) {
    const currentPage = $('#ocrPage').value;
    $('#ocrPage').innerHTML = project.unreadable_pages.map(page => `<option value="${page}">หน้า ${page}</option>`).join('');
    if (project.unreadable_pages.includes(Number(currentPage))) $('#ocrPage').value = currentPage;
  } else $('#ocrImportForm').hidden = true;
  $('#reqCount').textContent = project.requirements.length;
  $('#requirementList').innerHTML = project.requirements.length
    ? project.requirements.map(req => `<button class="requirement-item ${req.id === state.requirementId ? 'selected' : ''}" type="button" data-requirement="${req.id}"><span class="req-num">${esc(req.number)}</span><span class="req-text">${esc(req.text)}</span><span class="req-meta">${req.source_page ? `TOR หน้า PDF ${req.source_page}` : 'เพิ่มจากไฟล์ Word หรือกรอกเอง'}${req.source_method === 'ocr' ? ' · OCR: โปรดตรวจข้อความ' : ''} · ${esc(req.comparison)}</span></button>`).join('')
    : '<div class="empty-note">ยังไม่มีข้อกำหนดที่อ่านได้<br>เพิ่มข้อความจาก TOR ด้านซ้ายเพื่อเริ่มเช็กลิสต์</div>';
  const editor = $('#torEditor');
  const req = project.requirements.find(item => item.id === state.requirementId);
  editor.hidden = !req;
  if (req) editor.innerHTML = `<div class="editor-heading"><h3>ตรวจและแก้ข้อ ${esc(req.number)}</h3><button type="button" class="icon-button" id="closeTorEditor" aria-label="ปิด">×</button></div><form id="editRequirementForm" class="stack-form"><div class="field-grid"><label>เลขข้อ<input name="number" required value="${esc(req.number)}"></label><label>หน้า PDF ของ TOR<input name="source_page" type="number" min="1" value="${req.source_page ?? ''}"></label></div><label>ข้อความตาม TOR<textarea name="text" rows="5" required>${esc(req.text)}</textarea></label><button type="submit" class="button button-dark">บันทึกข้อ TOR</button></form>`;
}

function renderLibrary() {
  const project = state.project;
  $('#productList').innerHTML = project.products.length
    ? project.products.map(product => `<div class="simple-item"><div><strong>${esc(product.name)}</strong><small>${esc(product.model || 'ไม่ระบุรุ่น')}</small></div></div>`).join('')
    : '<div class="empty-note">ยังไม่มีสินค้า / บริการในโครงการ</div>';
  $('#uploadProductSelect').innerHTML = '<option value="">เอกสารทั่วไปของโครงการ</option>' + project.products.map(product => `<option value="${product.id}">${esc(product.name)}${product.model ? ` · ${esc(product.model)}` : ''}</option>`).join('');
  $('#documentList').innerHTML = project.documents.length
    ? project.documents.map(doc => { const product = project.products.find(item => item.id === doc.product_id); return `<div class="simple-item"><div><strong>${esc(doc.filename)}</strong><small>${doc.page_count} หน้า PDF${product ? ` · ${esc(product.name)}` : ''}</small></div><a href="/api/documents/${doc.id}/file" target="_blank" rel="noopener">เปิด ↗</a></div>`; }).join('')
    : '<div class="empty-note">ยังไม่มีเอกสารหลักฐาน PDF</div>';
}

function renderEvidence() {
  const project = state.project;
  const requirements = $('#evidenceRequirement');
  requirements.innerHTML = project.requirements.length
    ? project.requirements.map(req => `<option value="${req.id}">ข้อ ${esc(req.number)} · ${esc(req.text.slice(0, 60))}</option>`).join('')
    : '<option value="">เพิ่มข้อ TOR ก่อน</option>';
  if (state.requirementId) requirements.value = String(state.requirementId);
  const documents = $('#evidenceDocument');
  documents.innerHTML = project.documents.length
    ? project.documents.map(doc => `<option value="${doc.id}">${esc(doc.filename)}</option>`).join('')
    : '<option value="">เพิ่มเอกสาร PDF ก่อน</option>';
  if (state.documentId) documents.value = String(state.documentId);
  const req = project.requirements.find(item => item.id === state.requirementId);
  $('#selectedRequirement').innerHTML = req ? `<strong>ข้อ ${esc(req.number)}</strong>${esc(req.text)}` : 'ยังไม่มีข้อ TOR';
  renderSuggestions();
  renderEvidenceList();
  renderPage();
}

async function renderSuggestions() {
  const id = state.requirementId;
  const list = $('#suggestionList');
  if (!id) { list.innerHTML = '<div class="pending-text">เพิ่มข้อ TOR ก่อน</div>'; return; }
  list.innerHTML = '<div class="pending-text">กำลังหาคำที่ตรงกัน…</div>';
  try {
    const suggestions = await api(`/api/requirements/${id}/suggestions`);
    if (state.requirementId !== id) return;
    list.innerHTML = suggestions.length
      ? suggestions.slice(0, 5).map(item => `<button type="button" class="suggestion" data-suggest-doc="${item.id}"><strong>${esc(item.filename)}</strong><small>คำตรงกัน: ${esc(item.matched_terms.join(', '))}</small></button>`).join('')
      : '<div class="pending-text">ยังไม่พบคำตรงกันในเอกสารที่เพิ่ม</div>';
  } catch (error) { list.textContent = error.message; }
}

function renderEvidenceList() {
  const evidence = state.project.evidence.filter(item => item.requirement_id === state.requirementId);
  $('#evidenceList').innerHTML = evidence.length
    ? evidence.map(item => `<div class="evidence-chip"><div><strong>${esc(item.filename)}</strong><small>หน้า ${esc(item.printed_page || `PDF ${item.pdf_page}`)}${item.printed_page ? ` · PDF ${item.pdf_page}` : ''}${item.keyword ? ` · ${esc(item.keyword)}` : ''}</small></div><button type="button" data-delete-evidence="${item.id}">ลบ</button></div>`).join('')
    : '<div class="pending-text">ยังไม่มีจุดอ้างอิงของข้อนี้</div>';
}

function renderPage() {
  const doc = state.project.documents.find(item => item.id === state.documentId);
  const image = $('#pageImage');
  const canvas = $('#pageCanvas');
  const empty = $('#pageEmpty');
  if (!doc) { canvas.hidden = true; empty.hidden = false; $('#pageTextState').textContent = ''; return; }
  state.page = Math.max(1, Math.min(state.page, doc.page_count));
  $('#pageNumber').textContent = state.page;
  $('#pageTotal').textContent = doc.page_count;
  $('#prevPage').disabled = state.page <= 1;
  $('#nextPage').disabled = state.page >= doc.page_count;
  canvas.hidden = false;
  empty.hidden = true;
  image.src = `/api/documents/${doc.id}/page/${state.page}.png`;
  image.onload = renderMarks;
  image.onerror = () => { $('#pageTextState').textContent = 'แสดงหน้า PDF ไม่สำเร็จ'; };
  $('#pageTextState').textContent = 'กำลังอ่านตัวอักษรในหน้านี้…';
  const requestedDoc = doc.id, requestedPage = state.page;
  api(`/api/documents/${doc.id}/page/${state.page}/text`).then(data => {
    if (state.documentId !== requestedDoc || state.page !== requestedPage) return;
    $('#pageTextState').textContent = data.text.trim() ? 'หน้านี้ค้นข้อความได้ · ลากกรอบบนหลักฐานที่ต้องการ' : 'หน้านี้เป็นภาพหรือไม่มีข้อความ · ลากกรอบบนภาพได้';
  }).catch(error => { $('#pageTextState').textContent = error.message; });
  updateBoxState();
}

function renderMarks() {
  const marks = state.project.evidence.filter(item => item.document_id === state.documentId && item.pdf_page === state.page);
  $('#markLayer').innerHTML = marks.map(item => {
    const req = state.project.requirements.find(row => row.id === item.requirement_id);
    const [x, y, width, height] = item.box;
    return `<div class="mark" style="left:${x * 100}%;top:${y * 100}%;width:${width * 100}%;height:${height * 100}%"><span class="mark-label">ข้อที่ ${esc(req?.number || '')}</span></div>`;
  }).join('');
}

function updateBoxState() {
  const node = $('#boxState');
  node.classList.toggle('ready', Boolean(state.box));
  node.textContent = state.box ? 'เลือกตำแหน่งไฮไลต์แล้ว · พร้อมบันทึก' : 'ยังไม่ได้ลากกรอบไฮไลต์';
  if (!state.box) $('#selection').hidden = true;
}

function renderTable() {
  const project = state.project;
  $('#exportTable').href = `/api/projects/${project.id}/export.xlsx`;
  const productOptions = project.products.map(item => `<option value="${item.id}">${esc(item.name)}${item.model ? ` · ${esc(item.model)}` : ''}</option>`).join('');
  $('#complyRows').innerHTML = project.requirements.length
    ? project.requirements.map(req => {
      const refs = project.evidence.filter(item => item.requirement_id === req.id);
      return `<form class="comply-row" data-row-id="${req.id}"><div class="comply-cell"><span class="cell-label">รายละเอียดการดำเนินงาน</span><strong>ข้อ ${esc(req.number)}</strong>${esc(req.text)}</div><div class="comply-cell"><span class="cell-label">รายละเอียดที่ผู้เสนอราคาเสนอ</span><textarea name="proposal" rows="4" placeholder="ระบุสินค้า / บริการและรายละเอียดที่เสนอ">${esc(req.proposal)}</textarea></div><div class="comply-cell"><span class="cell-label">ผลเปรียบเทียบ</span><select name="comparison"><option value="รอตรวจสอบ" ${req.comparison === 'รอตรวจสอบ' ? 'selected' : ''}>รอตรวจสอบ</option><option value="ตรงตามข้อกำหนด" ${req.comparison === 'ตรงตามข้อกำหนด' ? 'selected' : ''}>ตรงตามข้อกำหนด</option><option value="ไม่ตรงตามข้อกำหนด" ${req.comparison === 'ไม่ตรงตามข้อกำหนด' ? 'selected' : ''}>ไม่ตรงตามข้อกำหนด</option></select><select name="product_id"><option value="">ไม่ระบุสินค้า / บริการ</option>${productOptions}</select><button class="button button-dark" type="submit">บันทึกข้อนี้</button></div><div class="comply-cell"><span class="cell-label">เอกสารอ้างอิง</span>${refs.length ? refs.map(item => `<div class="reference-line">${esc(item.filename)}<small>หน้า ${esc(item.printed_page || `PDF ${item.pdf_page}`)}${item.printed_page ? ` (PDF ${item.pdf_page})` : ''}</small></div>`).join('') : '<span class="pending-text">ยังไม่มีหลักฐาน</span>'}</div></form>`;
    }).join('')
    : '<div class="empty-note">ยังไม่มีข้อ TOR สำหรับสร้างตาราง</div>';
  document.querySelectorAll('.comply-row select[name="product_id"]').forEach(select => {
    const req = project.requirements.find(item => item.id === Number(select.closest('.comply-row').dataset.rowId));
    select.value = req.product_id == null ? '' : String(req.product_id);
  });
  $('#markedDownloads').innerHTML = project.documents.length
    ? project.documents.map(doc => `<a href="/api/documents/${doc.id}/marked.pdf" download>↓ ${esc(doc.filename)}</a>`).join('')
    : '<span class="pending-text">ยังไม่มี PDF หลักฐาน</span>';
}

async function submitBusy(form, task) {
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try { await task(); }
  catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}

$('#stepNav').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  if (!state.project) { toast('สร้างโครงการก่อนเริ่มทำงาน'); return; }
  setView(button.dataset.view);
});
$('#newProjectButton').addEventListener('click', showWelcome);
$('#projectSelect').addEventListener('change', event => { if (event.target.value) loadProject(Number(event.target.value)).catch(error => toast(error.message)); });
$('#createProjectForm').addEventListener('submit', event => {
  event.preventDefault();
  submitBusy(event.currentTarget, async () => {
    const form = new FormData(event.currentTarget);
    const file = form.get('tor');
    if (!file?.name) form.delete('tor');
    const created = await api('/api/projects', {method:'POST', body:form});
    await loadProjects(created.id);
    setView('tor');
    toast('สร้างโครงการและอ่าน TOR แล้ว');
  });
});
$('#ocrPage').addEventListener('change', () => { $('#ocrImportForm').hidden = true; });
$('#runOcr').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'กำลังอ่านหน้านี้…';
  const page = Number($('#ocrPage').value);
  try {
    const result = await api(`/api/projects/${state.project.id}/ocr`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page})});
    $('#ocrText').value = result.text;
    $('#ocrConfidence').textContent = `OCR ประเมินความชัด ${Math.round(result.confidence)}% · ต้องตรวจเทียบกับ TOR ต้นฉบับก่อนเพิ่ม`;
    $('#ocrImportForm').dataset.page = String(page);
    $('#ocrImportForm').hidden = false;
    if (!result.text.trim()) toast('OCR ไม่พบข้อความในหน้านี้ กรุณาพิมพ์จาก TOR ต้นฉบับ');
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = 'อ่านหน้านี้'; }
});
$('#ocrImportForm').addEventListener('submit', event => {
  event.preventDefault();
  submitBusy(event.currentTarget, async () => {
    const page = Number(event.currentTarget.dataset.page);
    const result = await api(`/api/projects/${state.project.id}/ocr/import`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page,text:$('#ocrText').value})});
    event.currentTarget.hidden = true;
    await refresh(`เพิ่ม ${result.created} ข้อจาก OCR แล้ว กรุณาตรวจแต่ละข้อ`);
  });
});
$('#addRequirementForm').addEventListener('submit', event => {
  event.preventDefault();
  submitBusy(event.currentTarget, async () => {
    const form = new FormData(event.currentTarget);
    const created = await api(`/api/projects/${state.project.id}/requirements`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:form.get('number'),text:form.get('text'),source_page:form.get('source_page') ? Number(form.get('source_page')) : null})});
    state.requirementId = created.id;
    event.currentTarget.reset();
    await refresh('เพิ่มข้อ TOR แล้ว');
  });
});
$('#requirementList').addEventListener('click', event => {
  const button = event.target.closest('[data-requirement]');
  if (!button) return;
  state.requirementId = Number(button.dataset.requirement);
  renderTor();
  $('#torEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
});
$('#torEditor').addEventListener('click', event => { if (event.target.id === 'closeTorEditor') $('#torEditor').hidden = true; });
$('#torEditor').addEventListener('submit', event => {
  if (event.target.id !== 'editRequirementForm') return;
  event.preventDefault();
  submitBusy(event.target, async () => {
    const form = new FormData(event.target);
    await api(`/api/requirements/${state.requirementId}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:form.get('number'),text:form.get('text'),source_page:form.get('source_page') ? Number(form.get('source_page')) : null})});
    await refresh('บันทึกข้อ TOR แล้ว');
  });
});
$('#addProductForm').addEventListener('submit', event => {
  event.preventDefault();
  submitBusy(event.currentTarget, async () => {
    const form = new FormData(event.currentTarget);
    await api(`/api/projects/${state.project.id}/products`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.get('name'),model:form.get('model')})});
    event.currentTarget.reset();
    await refresh('เพิ่มสินค้า / บริการแล้ว');
  });
});
$('#uploadDocumentForm').addEventListener('submit', event => {
  event.preventDefault();
  submitBusy(event.currentTarget, async () => {
    const form = new FormData(event.currentTarget);
    const result = await api(`/api/projects/${state.project.id}/documents`, {method:'POST',body:form});
    state.documentId = result.id;
    event.currentTarget.reset();
    await refresh('เพิ่มเอกสาร PDF แล้ว');
  });
});
$('#evidenceRequirement').addEventListener('change', event => { state.requirementId = Number(event.target.value) || null; state.box = null; renderEvidence(); });
$('#evidenceDocument').addEventListener('change', event => { state.documentId = Number(event.target.value) || null; state.page = 1; state.box = null; renderEvidence(); });
$('#suggestionList').addEventListener('click', event => {
  const button = event.target.closest('[data-suggest-doc]');
  if (!button) return;
  state.documentId = Number(button.dataset.suggestDoc);
  state.page = 1;
  state.box = null;
  renderEvidence();
});
$('#prevPage').addEventListener('click', () => { if (state.page > 1) { state.page--; state.box = null; renderPage(); } });
$('#nextPage').addEventListener('click', () => { const doc = state.project.documents.find(item => item.id === state.documentId); if (doc && state.page < doc.page_count) { state.page++; state.box = null; renderPage(); } });

let dragStart = null;
function pointInPage(event) {
  const rect = $('#pageImage').getBoundingClientRect();
  return [Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))];
}
function paintSelection(box) {
  const node = $('#selection');
  node.hidden = false;
  node.style.left = `${box[0] * 100}%`;
  node.style.top = `${box[1] * 100}%`;
  node.style.width = `${box[2] * 100}%`;
  node.style.height = `${box[3] * 100}%`;
}
$('#pageCanvas').addEventListener('pointerdown', event => {
  if (!state.documentId || !$('#pageImage').complete) return;
  event.preventDefault();
  dragStart = pointInPage(event);
  $('#pageCanvas').setPointerCapture(event.pointerId);
  paintSelection([dragStart[0],dragStart[1],0,0]);
});
$('#pageCanvas').addEventListener('pointermove', event => {
  if (!dragStart) return;
  const end = pointInPage(event);
  paintSelection([Math.min(dragStart[0],end[0]),Math.min(dragStart[1],end[1]),Math.abs(end[0]-dragStart[0]),Math.abs(end[1]-dragStart[1])]);
});
$('#pageCanvas').addEventListener('pointerup', event => {
  if (!dragStart) return;
  const end = pointInPage(event);
  const box = [Math.min(dragStart[0],end[0]),Math.min(dragStart[1],end[1]),Math.abs(end[0]-dragStart[0]),Math.abs(end[1]-dragStart[1])];
  dragStart = null;
  state.box = box[2] > .005 && box[3] > .005 ? box : null;
  updateBoxState();
  if (state.box) paintSelection(state.box);
});
$('#addEvidenceForm').addEventListener('submit', event => {
  event.preventDefault();
  submitBusy(event.currentTarget, async () => {
    if (!state.requirementId || !state.documentId) throw new Error('เลือกข้อ TOR และเอกสาร PDF ก่อน');
    if (!state.box) throw new Error('ลากกรอบบนหน้า PDF เพื่อเลือกจุดอ้างอิงก่อน');
    const form = new FormData(event.currentTarget);
    await api(`/api/requirements/${state.requirementId}/evidence`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document_id:state.documentId,pdf_page:state.page,printed_page:form.get('printed_page') || '',keyword:form.get('keyword') || '',box:state.box})});
    state.box = null;
    event.currentTarget.reset();
    await refresh('บันทึกจุดอ้างอิงแล้ว');
  });
});
$('#evidenceList').addEventListener('click', event => {
  const button = event.target.closest('[data-delete-evidence]');
  if (!button) return;
  api(`/api/evidence/${button.dataset.deleteEvidence}`, {method:'DELETE'}).then(() => refresh('ลบจุดอ้างอิงแล้ว')).catch(error => toast(error.message));
});
$('#complyRows').addEventListener('submit', event => {
  const form = event.target.closest('.comply-row');
  if (!form) return;
  event.preventDefault();
  submitBusy(form, async () => {
    await api(`/api/requirements/${form.dataset.rowId}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({proposal:form.elements.proposal.value,comparison:form.elements.comparison.value,product_id:form.elements.product_id.value ? Number(form.elements.product_id.value) : null})});
    await refresh('บันทึกผลเปรียบเทียบแล้ว');
  });
});

loadProjects().catch(error => toast(error.message));
