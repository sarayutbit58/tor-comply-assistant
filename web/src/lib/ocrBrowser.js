import {aiSession} from './aiSession.mjs';
export async function recognizeImage(image,ticket) {
  const capture=ticket||aiSession.captureFor('ocr');
  const result=await aiSession.request(capture.provider,'ocr',{image},capture);
  return {text:result.text,model:result.model,confidence:null};
}
