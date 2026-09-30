let releaseLast=null;
export function clearDownload(){releaseLast?.();releaseLast=null;}
export function downloadBlob(blob, filename) {
  clearDownload();
  const url = URL.createObjectURL(blob);
  let timer;
  releaseLast=()=>{clearTimeout(timer);URL.revokeObjectURL(url);window.dispatchEvent(new CustomEvent('tor-download-expired',{detail:{url}}));};
  timer=setTimeout(clearDownload,120_000);
  window.dispatchEvent(new CustomEvent('tor-download-ready',{detail:{url,filename,size:blob.size}}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}
