import {aiSession} from './aiSession.mjs';
import {recognizeLocal} from './localOcr.mjs';
export async function recognizeImage(image,ticket,options={}) {
  const capture=ticket||aiSession.captureFor('ocr');
  if(capture.provider==='local'){
    const {createWorker}=await import('tesseract.js');
    return recognizeLocal(image,{factory:createWorker,assertCurrent:()=>aiSession.assertTicket(capture),subscribe:aiSession.subscribe,onProgress:options.onProgress});
  }
  const result=await aiSession.request(capture.provider,'ocr',{image},capture);
  return {text:result.text,model:result.model,confidence:null};
}
