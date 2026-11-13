const digits = ['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
const segments = {
  a:[.14,.05,.86,.05], b:[.88,.10,.88,.45], c:[.88,.55,.88,.90],
  d:[.14,.95,.86,.95], e:[.12,.55,.12,.90], f:[.12,.10,.12,.45], g:[.14,.50,.86,.50],
};
const pad = (number) => String(number).padStart(2,'0');

export function createDeskProps() {
  const make=(width,height)=>{
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    return canvas;
  };
  const ClockLCD=make(768,371), CalendarPaper=make(560,450);
  let minute='', day='';
  function clock(now) {
    const ctx=ClockLCD.getContext('2d');
    const glass=ctx.createLinearGradient(0,0,768,371);
    glass.addColorStop(0,'#a4ad92');
    glass.addColorStop(.46,'#87937c');
    glass.addColorStop(1,'#626f60');
    ctx.fillStyle=glass;
    ctx.fillRect(0,0,768,371);
    function number(value,x,y,w,h) {
      ctx.lineWidth=w*.125;
      ctx.lineCap='round';
      for(const [name,[a,b,c,d]] of Object.entries(segments)){
        ctx.strokeStyle=digits[value].includes(name)?'#1f2925':'#26332b14';
        ctx.beginPath();
        ctx.moveTo(x+a*w,y+b*h);
        ctx.lineTo(x+c*w,y+d*h);
        ctx.stroke();
      }
    }
    const value=pad(now.getHours())+pad(now.getMinutes());
    [...value].forEach((digit,i)=>number(Number(digit),25+i*119+(i>=2?30:0),80,102,210));
    ctx.fillStyle='#26322b';
    for(const y of [146,224]){ctx.beginPath();ctx.arc(258,y,8,0,Math.PI*2);ctx.fill();}
    ctx.font='600 18px monospace';
    ctx.fillText('LOCAL  /  24H',28,44);
    const items=[['ALARM','07:30'],['DATE',pad(now.getDate())+' / '+pad(now.getMonth()+1)],['ROOM  ·  DEMO','22.4 °C']];
    items.forEach(([label,value],i)=>{
      const y=54+i*109;
      ctx.fillStyle='#26322b';
      ctx.font='600 16px monospace';
      ctx.fillText(label,547,y);
      ctx.font='600 38px monospace';
      ctx.fillText(value,547,y+48);
      ctx.fillStyle='#26322b55';
      ctx.fillRect(547,y+66,180,1);
    });
    grain(ctx,768,371,.13,2200);
    const glare=ctx.createLinearGradient(0,0,65,140);
    glare.addColorStop(0,'#ffffff3e');
    glare.addColorStop(1,'#ffffff00');
    ctx.fillStyle=glare;
    ctx.fillRect(0,0,768,371);
  }
  function calendar(now) {
    const ctx=CalendarPaper.getContext('2d');
    const paper=ctx.createLinearGradient(0,0,35,450);
    paper.addColorStop(0,'#e5dfd0');
    paper.addColorStop(.26,'#f7f2e7');
    paper.addColorStop(1,'#eee9dc');
    ctx.fillStyle=paper;
    ctx.fillRect(0,0,560,450);
    grain(ctx,560,450,.17,9300);
    ctx.textAlign='center';
    ctx.fillStyle='#2b3541';
    ctx.font='bold 45px Georgia';
    ctx.fillText(now.toLocaleDateString('en-GB',{month:'long',year:'numeric'}),280,92);
    ctx.fillStyle='#304052';
    ctx.fillRect(25,109,510,35);
    ctx.fillStyle='#fff4e3';
    ctx.font='bold 19px sans-serif';
    ['MON','TUE','WED','THU','FRI','SAT','SUN'].forEach((d,i)=>ctx.fillText(d,61+i*73,134));
    const offset=(new Date(now.getFullYear(),now.getMonth(),1).getDay()+6)%7;
    const count=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    ctx.font='27px Georgia';
    for(let i=1;i<=count;i++){
      const cell=i-1+offset,col=cell%7,x=61+col*73,y=184+Math.floor(cell/7)*43;
      ctx.fillStyle=col===6?'#8f4c42':'#302e2b';
      ctx.fillText(i,x,y);
      if(i===now.getDate()) {
        for(let pass=0;pass<3;pass++) {
          ctx.beginPath();
          for(let j=0;j<=44;j++){
            const a=j/44*6.37+pass*.12;
            const wobble=1.2*Math.sin(j*1.71+pass)+.7*Math.cos(j*3.1);
            const px=x+(25+wobble+pass*.65)*Math.cos(a);
            const py=y-9+(17+wobble)*Math.sin(a)-2.8*Math.cos(a);
            if(j)ctx.lineTo(px,py);else ctx.moveTo(px,py);
          }
          ctx.strokeStyle=['#4b4438a9','#52473d70','#66574736'][pass];
          ctx.lineWidth=pass===0?1.8:1.15;
          ctx.stroke();
        }
      }
    }
  }
  function grain(ctx,width,height,alpha,count) {
    let seed=177;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<count;i++){
      ctx.fillStyle=i%2?`rgba(68,56,42,${alpha*random()})`:`rgba(255,255,255,${alpha*random()})`;
      ctx.fillRect(random()*width,random()*height,1+random()*2,1+random()*2);
    }
  }
  function update(now=new Date()) {
    const changes=[];
    const nextDay=now.getFullYear()+'-'+now.getMonth()+'-'+now.getDate();
    const nextMinute=nextDay+'-'+now.getHours()+'-'+now.getMinutes();
    if(nextMinute!==minute){minute=nextMinute;clock(now);changes.push('ClockLCD');}
    if(nextDay!==day){day=nextDay;calendar(now);changes.push('CalendarPaper');}
    return changes;
  }
  return {canvases:{ClockLCD,CalendarPaper},update};
}
