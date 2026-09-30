'use client';
import {useState} from 'react';
export function DeleteButton({label='ลบ',confirmation='ยืนยันลบ',disabled,onConfirm}) {
 const [armed,setArmed]=useState(false);
 return armed?<span className="delete-confirm"><button type="button" className="text-button danger" disabled={disabled} onClick={()=>{setArmed(false);onConfirm();}}>{confirmation}</button><button type="button" className="text-button" disabled={disabled} onClick={()=>setArmed(false)}>ยกเลิก</button></span>:<button type="button" className="text-button danger" disabled={disabled} onClick={()=>setArmed(true)}>{label}</button>;
}
