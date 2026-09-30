import {aiSession} from './aiSession.mjs';
export async function recognizeImage(image,ticket) {
  const result=await aiSession.request('openai','ocr',{image},ticket);
  return {text:result.text,model:result.model,confidence:null};
}
