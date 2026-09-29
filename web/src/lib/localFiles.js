const DATABASE = 'tor-comply-files-v1';
const STORE = 'files';
let opening;

function database() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('เปิดพื้นที่เก็บไฟล์ไม่สำเร็จ'));
  });
  return opening;
}

export async function putFile(id, blob, pageTexts = [], pages = []) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ id, blob, pageTexts, pages });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('บันทึกไฟล์ไม่สำเร็จ'));
    transaction.onabort = () => reject(transaction.error || new Error('การบันทึกไฟล์ถูกยกเลิก'));
  });
}

export async function getFile(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('เปิดไฟล์ไม่สำเร็จ'));
  });
}

export async function deleteFile(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('ลบไฟล์ไม่สำเร็จ'));
  });
}
