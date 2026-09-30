export function createKeyVault(cryptoApi=globalThis.crypto) {
  const entries=new Map(),versions=new Map();
  let epoch=0;
  const check=provider=>{if(!['openai','openrouter','typesafe'].includes(provider))throw new Error('ผู้ให้บริการไม่ถูกต้อง');};
  return {
    has(provider){return entries.has(provider);},
    async set(provider,secret) {
      check(provider);
      if(!cryptoApi?.subtle)throw new Error('ต้องใช้ HTTPS เพื่อเข้ารหัส API Key');
      if(typeof secret!=='string'||!secret.trim()||secret.length>512)throw new Error('กรอก API Key ที่ถูกต้อง');
      const currentEpoch=epoch,version=(versions.get(provider)||0)+1;versions.set(provider,version);entries.delete(provider);
      const key=await cryptoApi.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=cryptoApi.getRandomValues(new Uint8Array(12)),bytes=new TextEncoder().encode(secret.trim());
      secret='';
      try {
        const encrypted=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv},key,bytes);
        if(epoch===currentEpoch&&versions.get(provider)===version)entries.set(provider,{key,iv,encrypted,version});
      } finally {bytes.fill(0);}
    },
    async use(provider,operation) {
      check(provider);const entry=entries.get(provider),currentEpoch=epoch;
      if(!entry)throw new Error('เชื่อมต่อ API Key ในแท็บนี้ก่อน');
      const bytes=new Uint8Array(await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:entry.iv},entry.key,entry.encrypted));
      let secret='';
      try {
        if(epoch!==currentEpoch||entries.get(provider)!==entry)throw new Error('API Key ถูกล้างแล้ว');
        secret=new TextDecoder().decode(bytes);
        const result=await operation(secret);
        if(epoch!==currentEpoch||entries.get(provider)!==entry)throw new Error('API Key เปลี่ยนแล้ว ผลเดิมถูกยกเลิก');
        return result;
      } finally {bytes.fill(0);secret='';}
    },
    remove(provider){check(provider);versions.set(provider,(versions.get(provider)||0)+1);entries.delete(provider);},
    clear(){epoch++;entries.clear();versions.clear();},
  };
}
