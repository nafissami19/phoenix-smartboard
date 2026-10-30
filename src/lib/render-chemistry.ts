import {equipmentPolygon,liquidSurface,VESSELS,type EquipmentObject} from './chemistry-equipment';
import {indicatorColor,solutionPH} from './chemistry-beaker';

export function drawChemistryEquipment(ctx:CanvasRenderingContext2D,object:EquipmentObject) {
  const data=object.chemistry,poly=equipmentPolygon(object),ph=solutionPH(data.solution),color=indicatorColor(ph,data.indicator,data.customColor),capacity=VESSELS[data.vessel].capacity;
  const path=()=>{ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();};
  
  ctx.save();
  path();
  ctx.fillStyle='#bce5f5';
  ctx.globalAlpha=.12;
  ctx.fill();
  ctx.globalAlpha=1;

  if(data.solution.volumeMl && capacity > 0){
    ctx.save();
    path();
    ctx.clip();
    const surface=liquidSurface(poly,data.solution.volumeMl/capacity);
    const left=Math.min(...poly.map(p=>p.x));
    const right=Math.max(...poly.map(p=>p.x));
    const bottom=Math.max(...poly.map(p=>p.y));
    const midX=(left+right)/2;
    const meniscusDrop=Math.min(5,Math.max(1,(right-left)*0.035));

    // Liquid fill with curved capillary meniscus
    ctx.fillStyle=color;
    ctx.globalAlpha=.72;
    ctx.beginPath();
    ctx.moveTo(left-2,surface);
    ctx.quadraticCurveTo(midX,surface+meniscusDrop,right+2,surface);
    ctx.lineTo(right+2,bottom+2);
    ctx.lineTo(left-2,bottom+2);
    ctx.closePath();
    ctx.fill();

    // Curved meniscus surface outline
    ctx.globalAlpha=.9;
    ctx.strokeStyle=color;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(left,surface);
    ctx.quadraticCurveTo(midX,surface+meniscusDrop,right,surface);
    ctx.stroke();

    // Subtle translucent bubbles inside the solution
    const liquidH=Math.max(0,bottom-surface);
    if(liquidH>16){
      ctx.fillStyle='rgba(255, 255, 255, 0.4)';
      ctx.strokeStyle='rgba(255, 255, 255, 0.7)';
      ctx.lineWidth=0.7;
      const bubbleSeeds=[
        {fx:0.25,fy:0.7,r:2},
        {fx:0.48,fy:0.4,r:1.6},
        {fx:0.65,fy:0.8,r:2.4},
        {fx:0.8,fy:0.5,r:1.8},
        {fx:0.35,fy:0.25,r:1.4}
      ];
      for(const b of bubbleSeeds){
        const bx=left+(right-left)*b.fx;
        const by=bottom-liquidH*b.fy;
        ctx.beginPath();
        ctx.arc(bx,by,b.r,0,Math.PI*2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  path();
  ctx.strokeStyle=object.color;
  ctx.lineWidth=Math.max(1.5,object.width);
  ctx.lineJoin='round';
  ctx.stroke();

  ctx.translate(object.x+object.w/2,object.y+object.h/2);
  ctx.rotate(object.rotation);
  ctx.scale(object.mirrorX?-1:1,object.mirrorY?-1:1);
  ctx.translate(-object.w/2,-object.h/2);
  ctx.strokeStyle=object.color;
  ctx.fillStyle=object.color;
  ctx.font=`${Math.max(11,Math.min(16,object.w*.09))}px Arial`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  if(data.vessel!=='funnel'&&data.vessel!=='bunsen-burner'){
    const count=data.vessel==='burette'?9:4;
    for(let n=1;n<=count;n++){
      const y=object.h*(.87-.8*n/(count+1));
      ctx.beginPath();
      ctx.moveTo(object.w*(data.vessel==='burette'?.55:.7),y);
      ctx.lineTo(object.w*.86,y);
      ctx.stroke();
    }
  }
  if(data.vessel==='burette'){
    ctx.fillStyle=object.color;
    ctx.fillRect(object.w*0.35,object.h*0.80,object.w*0.3,object.h*0.03);
  }
  if(data.vessel==='bunsen-burner'){
    ctx.fillStyle='#38bdf8';
    ctx.beginPath();
    ctx.moveTo(object.w*0.45,object.h*0.26);
    ctx.quadraticCurveTo(object.w*0.5,object.h*0.04,object.w*0.55,object.h*0.26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle='rgba(251, 146, 60, 0.75)';
    ctx.beginPath();
    ctx.moveTo(object.w*0.41,object.h*0.26);
    ctx.quadraticCurveTo(object.w*0.5,object.h*0.0,object.w*0.59,object.h*0.26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle=object.color;
  }
  if(data.vessel==='cylinder'){
    ctx.beginPath();
    ctx.moveTo(object.w*.05,object.h*.9);
    ctx.lineTo(object.w*.95,object.h*.9);
    ctx.stroke();
  }
  ctx.fillText(data.label.slice(0,24),object.w/2,object.h*.94,object.w);
  if(data.vessel!=='funnel'&&data.vessel!=='bunsen-burner')ctx.fillText(`${Number(data.solution.volumeMl.toFixed(1))}/${capacity} mL`,object.w/2,object.h*.995,object.w);
  ctx.restore();
}