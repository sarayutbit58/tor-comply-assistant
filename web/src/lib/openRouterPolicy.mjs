// Curated families verified in OpenRouter's public catalogue on 2026-09-30.
export const OPENROUTER_OPTIONS=[
 {id:'google/gemini-3.5-flash-lite',tier:'easy',label:'งานง่าย · ค่าเริ่มต้น',description:'เริ่มทดสอบข้อความ/ภาพชัดเจนจากรุ่นขนาดเล็ก'},
 {id:'openai/gpt-6-luna',tier:'easy',label:'งานง่าย · ทางเลือก',description:'OpenAI ผ่านบัญชี OpenRouter'},
 {id:'google/gemini-3.8-flash',tier:'medium',label:'งานปานกลาง',description:'เปรียบเทียบงานหลายเงื่อนไขเมื่อรุ่นเริ่มต้นทำไม่ได้'},
 {id:'anthropic/claude-sonnet-5.5',tier:'medium',label:'งานปานกลาง · ทางเลือก',description:'เปรียบเทียบการอ่านและร่างคำตอบจากหลักฐาน'},
 {id:'anthropic/claude-opus-5.5',tier:'hard',label:'งานยาก · เลือกเอง',description:'ใช้เมื่อรุ่นง่าย/กลางไม่เพียงพอ ไม่มีการเปลี่ยนรุ่นอัตโนมัติ'},
];
export function allowedOpenRouterModel(id) {return OPENROUTER_OPTIONS.some(m=>m.id===id);}
export function recommendedOpenRouterModels(raw) {
 if(!Array.isArray(raw?.data))throw new Error('รายการโมเดล OpenRouter ไม่ถูกต้อง');
 return OPENROUTER_OPTIONS.flatMap(option=>{
  const model=raw.data.find(m=>m?.id===option.id);
  if(!model?.architecture?.output_modalities?.includes('text')||!model.architecture.input_modalities?.includes('text'))return [];
  const canOcr=model.architecture.input_modalities.includes('image');
  const canDraft=model.supported_parameters?.includes('structured_outputs')===true;
  return canOcr||canDraft?[{...option,canOcr,canDraft}]:[];
 });
}
