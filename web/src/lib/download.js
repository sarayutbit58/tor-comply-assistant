let releaseLast=null;
export function clearDownload(){releaseLast?.();releaseLast=null;}
export function downloadBlob(blob, filename) {
  clearDownload();
  const url = URL.createObjectURL(blob);
  let timer,reader,released=false;
  releaseLast=()=>{released=true;if(reader?.readyState===1)reader.abort();clearTimeout(timer);URL.revokeObjectURL(url);window.dispatchEvent(new CustomEvent('tor-download-expired',{detail:{url}}));};
  timer=setTimeout(clearDownload,120_000);
  window.dispatchEvent(new CustomEvent('tor-download-ready',{detail:{url,filename,size:blob.size}}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  if(blob.size<=1024*1024&&typeof FileReader==='function'){
    reader=new FileReader();
    reader.onload=()=>{const encoded=typeof reader.result==='string'?reader.result.split(',').at(-1):'';if(!released&&/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))window.dispatchEvent(new CustomEvent('tor-download-ready',{detail:{url,filename,size:blob.size,href:'data:application/octet-stream;base64,'+encoded}}));};
    reader.readAsDataURL(blob);
  }
}
