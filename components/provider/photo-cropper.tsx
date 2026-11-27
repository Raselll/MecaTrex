"use client";
import {useEffect,useRef,useState} from "react";
const W=1600,H=900;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
function geometry(w:number,h:number,angle:number,zoom:number){
 const radians=angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
 const needX=Math.abs(c)*W+Math.abs(s)*H,needY=Math.abs(s)*W+Math.abs(c)*H;
 const scale=Math.max(needX/w,needY/h)*zoom;
 return {radians,c,s,scale,w:w*scale,h:h*scale,extraX:Math.max(0,(w*scale-needX)/2),extraY:Math.max(0,(h*scale-needY)/2)};
}
export default function PhotoCropper({file,onFile,onApply,disabled=false}:{file:File|null;onFile:(file:File|null)=>void;onApply:(file:File)=>void|Promise<void>;disabled?:boolean}){
 const [url,setUrl]=useState("");const [natural,setNatural]=useState({w:0,h:0});const [zoom,setZoom]=useState(1.15);const [angle,setAngle]=useState(0);const [pos,setPos]=useState({x:0,y:0});const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 const frame=useRef<HTMLDivElement>(null);const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null);
 useEffect(()=>{if(!file){setUrl("");return;}const u=URL.createObjectURL(file);setUrl(u);setZoom(1.15);setAngle(0);setPos({x:0,y:0});setNatural({w:0,h:0});setError("");return()=>URL.revokeObjectURL(u);},[file]);
 const g=geometry(natural.w||W,natural.h||H,angle,zoom);
 const dx=g.c*pos.x*g.extraX-g.s*pos.y*g.extraY,dy=g.s*pos.x*g.extraX+g.c*pos.y*g.extraY;
 function choose(f:File|undefined){if(!f)return;setError("");if(!["image/jpeg","image/png","image/webp"].includes(f.type)){setError("Choose JPG, PNG or WebP.");return;}if(f.size>5*1024*1024){setError("Maximum file size is 5 MB.");return;}onFile(f);}
 async function apply(){if(!url||!natural.w||!natural.h)return;setBusy(true);setError("");try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;const ctx=canvas.getContext("2d");if(!ctx)throw Error();ctx.translate(W/2+dx,H/2+dy);ctx.rotate(g.radians);ctx.drawImage(image,-g.w/2,-g.h/2,g.w,g.h);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.9));if(!blob)throw Error();await onApply(new File([blob],"business-cover.jpg",{type:"image/jpeg"}));}catch{setError("Could not save the crop. Please try again.");}finally{setBusy(false);}}
 function reset(){setZoom(1.15);setAngle(0);setPos({x:0,y:0});}
 function rotate(delta:number){setAngle(a=>((a+delta+180)%360+360)%360-180);}
 const locked=disabled||busy;
 return <div className="mt-4 space-y-3">
 <label onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!locked)choose(e.dataTransfer.files[0]);}} className="block cursor-pointer rounded-xl border border-dashed border-[#98A2B3] bg-white p-4 text-center text-sm font-bold text-[#475467] hover:border-[#FF5B13]">Drop a photo here or click to browse<input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} className="sr-only" onChange={e=>{choose(e.target.files?.[0]);e.target.value="";}}/></label>
 {file&&url&&<div className="space-y-4 rounded-xl border border-[#E4E7EC] bg-white p-3 sm:p-4">
 <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">Adjust your cover photo</p><button type="button" disabled={locked} onClick={reset} className="text-xs font-bold text-[#667085]">Reset</button></div>
 <div ref={frame} className="relative aspect-video touch-none cursor-grab overflow-hidden rounded-lg bg-[#F2F4F7]" onPointerDown={e=>{if(locked)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,px:pos.x*g.extraX,py:pos.y*g.extraY};}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onPointerMove={e=>{if(!drag.current||!frame.current||locked)return;const rect=frame.current.getBoundingClientRect();const x=(e.clientX-drag.current.x)*W/rect.width,y=(e.clientY-drag.current.y)*H/rect.height;setPos({x:g.extraX?clamp((drag.current.px+g.c*x+g.s*y)/g.extraX,-1,1):0,y:g.extraY?clamp((drag.current.py-g.s*x+g.c*y)/g.extraY,-1,1):0});}}>
 <img src={url} alt="Adjust photo crop" draggable={false} onLoad={e=>setNatural({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})} onError={()=>setError("Could not read this image.")} style={{position:"absolute",maxWidth:"none",width:g.w/W*100+"%",height:g.h/H*100+"%",left:50+dx/W*100+"%",top:50+dy/H*100+"%",transform:"translate(-50%, -50%) rotate("+angle+"deg)",transformOrigin:"center",opacity:natural.w?1:0}}/>
 <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">{Array.from({length:9},(_,i)=><div key={i} className="border border-white/25"/>)}</div></div>
 <label className="block text-xs font-bold">Zoom <span className="float-right text-[#667085]">{Math.round(zoom*100)}%</span><input disabled={locked} className="mt-2 w-full accent-[#FF5B13]" type="range" min={1} max={4} step={.05} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
 <div className="space-y-2"><div className="flex items-center justify-between gap-2"><button type="button" disabled={locked} onClick={()=>rotate(-90)} className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-bold" aria-label="Rotate left 90 degrees">↶ 90°</button><span className="text-xs font-bold">Rotation · {angle}°</span><button type="button" disabled={locked} onClick={()=>rotate(90)} className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-bold" aria-label="Rotate right 90 degrees">90° ↷</button></div><input aria-label="Rotation in degrees" disabled={locked} type="range" min={-180} max={180} step={1} value={angle} onChange={e=>setAngle(Number(e.target.value))} className="w-full accent-[#FF5B13]"/></div>
 <div className="grid grid-cols-2 gap-3">{(["x","y"] as const).map(axis=><label key={axis} className="text-xs font-medium text-[#667085]">{axis==="x"?"Horizontal":"Vertical"}<input type="range" disabled={locked} className="block w-full accent-[#FF5B13]" min={-1} max={1} step={.01} value={pos[axis]} onChange={e=>{if(zoom===1)setZoom(1.15);setPos(p=>({...p,[axis]:Number(e.target.value)}));}}/></label>)}</div>
 <p className="text-xs text-[#667085]">Drag the photo to position it. Zoom in for more room to move.</p>
 <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={locked} onClick={()=>onFile(null)} className="rounded-lg border px-3 py-2 text-xs font-bold">Cancel</button><button type="button" disabled={locked||!natural.w} onClick={()=>void apply()} className="rounded-lg bg-[#FF5B13] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?"Saving…":"Apply crop"}</button></div></div>}
 <p className="text-center text-xs text-[#667085]">16:9 cover · JPG, PNG or WebP · max 5 MB</p>{error&&<p role="alert" className="text-xs text-[#B42318]">{error}</p>}
 </div>;
}
