export function ocrProgressMessage({status,progress}={}) {
 const percent=Math.round(Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0))*100);
 return (status==='recognizing text'?'อ่านข้อความ':status==='loading language traineddata'?'เตรียมภาษาไทย/อังกฤษ':'เตรียมเครื่องมืออ่านภาพ')+' '+percent+'%';
}
export async function recognizeLocal(image,{factory,assertCurrent=()=>{},subscribe=()=>()=>{},onProgress,timeoutMs=60000}={}) {
 if(typeof factory!=='function')throw new Error('ตัวอ่าน OCR ในเครื่องยังไม่พร้อม ใช้การถอดข้อความเองได้');
 let worker,terminated=false,cancelError,failCancellation;
 const cancellation=new Promise((_,reject)=>{failCancellation=reject;});
 cancellation.catch(()=>{});
 const terminate=async()=>{if(worker&&!terminated){terminated=true;await worker.terminate();}};
 const check=()=>{if(cancelError)throw cancelError;assertCurrent();};
 const unsubscribe=subscribe(()=>{
  try{assertCurrent();}catch(error){cancelError=error;failCancellation(error);terminate().catch(()=>{});}
 });
 const timer=setTimeout(()=>{cancelError=new Error('OCR ใช้เวลานานเกินไป ลองเลือกกรอบเล็กลงหรือถอดข้อความเอง');failCancellation(cancelError);terminate().catch(()=>{});},timeoutMs);
 try {
  check();
  const initialization=Promise.resolve(factory(['tha','eng'],1,{langPath:'/ocr-data',gzip:false,cacheMethod:'readOnly',logger:progress=>{if(!cancelError&&!terminated)onProgress?.({status:progress.status,progress:progress.progress});}})).then(async value=>{worker=value;if(cancelError)await terminate();return value;});
  await Promise.race([initialization,cancellation]);
  check();
  const result=await Promise.race([worker.recognize(image),cancellation]);
  check();
  return {text:result.data?.text||'',confidence:result.data?.confidence??null,model:'local-tesseract'};
 } finally {clearTimeout(timer);unsubscribe();await terminate();}
}
