function bands(points,gap=3) {
  const groups=[];
  for(const point of points){const last=groups[groups.length-1];if(last&&point-last[last.length-1]<=gap)last.push(point);else groups.push([point]);}
  return groups;
}
export function detectTableGrid({width,height,data},count,headerBand=null) {
  const dark=(x,y)=>{const i=(y*width+x)*4;return data[i]*.299+data[i+1]*.587+data[i+2]*.114<200;};
  const candidates=[];
  for(let x=5;x<width-5;x++) {
    let run=0,best=0,gap=0;
    for(let y=8;y<height-8;y++){
      if(headerBand&&y>=headerBand[0]*height&&y<=headerBand[1]*height){best=Math.max(best,run);run=0;gap=0;continue;}
      if(dark(x,y)){run++;gap=0;}else if(run&&gap<1){run++;gap++;}else{best=Math.max(best,run);run=0;gap=0;}
    }
    best=Math.max(best,run);if(best>Math.max(38,height*.05))candidates.push(x);
  }
  const vertical=bands(candidates).map(g=>g.reduce((a,b)=>a+b,0)/g.length);
  if(vertical.length!==count+1)return null;
  const left=Math.round(vertical[0]),right=Math.round(vertical[vertical.length-1]),horizontal=[];
  for(let y=8;y<height-8;y++){
    let run=0,best=0,gap=0;
    for(let x=left;x<=right;x++){if(dark(x,y)){run++;gap=0;}else if(run&&gap<1){run++;gap++;}else{best=Math.max(best,run);run=0;gap=0;}}
    if(Math.max(best,run)>(right-left)*.75)horizontal.push(y);
  }
  // A filled header is a band, not a single border at its center.
  const rows=bands(horizontal).flatMap(g=>g[g.length-1]-g[0]>4?[g[0]/height,g[g.length-1]/height]:[g.reduce((a,b)=>a+b,0)/g.length/height]);
  return {edges:vertical.map(x=>x/width),rows};
}
