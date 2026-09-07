import { boardToWorld, worldToBoard } from './three-d-core.js';
const NS='http://www.w3.org/2000/svg';
const element=(tag,attrs={})=>{const node=document.createElementNS(NS,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);return node;};
export class BuilderCourtTools {
    constructor(builder){
        this.builder=builder;this.placing=false;this.drag=null;this.THREE=null;this.surface=null;
        this.layer=element('svg',{'aria-hidden':'true',class:'builder-court-tools'});
        this.layer.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4500';
        document.body.append(this.layer);
        this.handlers={pointerdown:e=>this.down(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:e=>this.cancel(e)};
        this.resize=()=>this.render();window.addEventListener('resize',this.resize);
    }
    async bind(){
        const view=this.builder.board.threeD,surface=this.builder.view==='3d'?view.renderer?.domElement:this.builder.board.court;
        if(surface!==this.surface){if(this.surface)for(const[type,handler]of Object.entries(this.handlers))this.surface.removeEventListener(type,handler);this.surface=surface;if(surface)for(const[type,handler]of Object.entries(this.handlers))surface.addEventListener(type,handler);}
        if(this.builder.view==='3d'&&!this.THREE){this.THREE=await import('./vendor/three.module.min.js');this.render();}
    }
    project(position,height=0){
        const viewer=this.builder.board.threeD;
        if(this.builder.view==='3d'){
            if(!this.THREE||!viewer.camera||!viewer.renderer)return null;
            const point=boardToWorld(position,height),v=new this.THREE.Vector3(point.x,point.y,point.z).project(viewer.camera),box=viewer.renderer.domElement.getBoundingClientRect();
            if(v.z>1)return null;return{x:box.left+(v.x+1)*box.width/2,y:box.top+(1-v.y)*box.height/2};
        }
        const p=this.builder.board.projection.courtToView(position),m=this.builder.board.court.getScreenCTM();if(!m)return null;
        const q=new DOMPoint(p.x,p.y-this.builder.board.projection.projectHeight(height)).matrixTransform(m);return{x:q.x,y:q.y};
    }
    unproject(event){
        if(this.builder.view==='3d'){
            const viewer=this.builder.board.threeD;if(!this.THREE||!viewer.camera)return null;
            const box=this.surface.getBoundingClientRect(),ray=new this.THREE.Raycaster();ray.setFromCamera(new this.THREE.Vector2((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2),viewer.camera);
            const hit=ray.ray.intersectPlane(new this.THREE.Plane(new this.THREE.Vector3(0,1,0),0),new this.THREE.Vector3());return hit?worldToBoard(hit):null;
        }
        const m=this.builder.board.court.getScreenCTM();if(!m)return null;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(m.inverse());return this.builder.board.projection.viewToCourt(p);
    }
    down(event){
        if(this.builder.workspace!=='builder'||event.button>0||this.builder.busy)return;
        const shot=this.builder.selectedShot;if(!shot)return;const target=this.project(shot.target);
        const near=target&&Math.hypot(event.clientX-target.x,event.clientY-target.y)<25;
        if(!this.placing&&!near)return;
        const point=this.unproject(event);if(!point)return;
        this.builder.pause();event.preventDefault();event.stopPropagation();this.surface.setPointerCapture(event.pointerId);
        this.drag={pointer:event.pointerId,offset:near?{x:point.x-shot.target.x,y:point.y-shot.target.y}:{x:0,y:0},target:{...shot.target}};
        this.move(event);
    }
    move(event){if(!this.drag||event.pointerId!==this.drag.pointer)return;const p=this.unproject(event);if(!p)return;this.drag.target={x:Math.max(0,Math.min(20,p.x-this.drag.offset.x)),y:Math.max(0,Math.min(44,p.y-this.drag.offset.y))};this.render();}
    up(event){if(!this.drag||event.pointerId!==this.drag.pointer)return;const target=this.drag.target;this.drag=null;this.placing=false;this.surface.releasePointerCapture(event.pointerId);this.builder.action('editShot',{field:'target',value:target});}
    cancel(event){if(this.drag&&event.pointerId===this.drag.pointer){this.drag=null;this.placing=false;this.render();}}
    clear(){this.drag=null;this.placing=false;this.layer.replaceChildren();}
    render(){
        const b=this.builder;if(b.workspace!=='builder'){this.clear();return;}this.bind();
                this.layer.replaceChildren();const shot=b.selectedShot;if(!shot)return;
        const point=this.project(this.drag?.target || shot.target);
        if(point&&!b.session.clock.playing){const group=element('g');group.append(element('circle',{cx:point.x,cy:point.y,r:13,fill:'none',stroke:'#fff6db','stroke-width':5}),element('circle',{cx:point.x,cy:point.y,r:13,fill:'none',stroke:'#6f365f','stroke-width':3}),element('path',{d:`M${point.x-20} ${point.y}h40 M${point.x} ${point.y-20}v40`,stroke:'#6f365f','stroke-width':2}));const label=element('text',{x:point.x+17,y:point.y-17,fill:'#203449',stroke:'#fff6db','stroke-width':3,'paint-order':'stroke','font-size':13,'font-family':'system-ui','font-weight':700});label.textContent='Target';group.append(label);this.layer.append(group);}
        for(const annotation of b.document.annotations){
            if(annotation.type!=='path'||typeof annotation.d!=='string')continue;
            const pairs=[...annotation.d.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi)].slice(0,2000);
            const points=pairs.map(match=>this.project({x:Number(match[1]),y:Number(match[2])})).filter(Boolean);
            if(points.length)this.layer.append(element('path',{d:points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' '),fill:'none',stroke:'#bf6843','stroke-width':3,opacity:.8}));
        }
        if(!b.document.assistance.showGuides)return;
        const segment=b.compiled.timeline.segments.find(s=>b.session.clock.elapsed<=s.endTime);
        const activeId=b.session.clock.playing?segment?.step.id:shot.id;
        const coverage=b.compiled.coverage?.find(c=>c.shotId===activeId);if(!coverage)return;
        const origin=this.project(coverage.threat);if(!origin)return;
        const positions=Object.values(coverage.positions || {});for(const position of positions){const p=this.project(position);if(!p)continue;this.layer.append(element('path',{d:`M${origin.x} ${origin.y}L${p.x} ${p.y}`,stroke:'#526d86','stroke-width':2,'stroke-dasharray':'5 5',opacity:.65}),element('circle',{cx:p.x,cy:p.y,r:17,fill:'none',stroke:'#526d86','stroke-width':2,'stroke-dasharray':'3 3'}));}
        const label=element('text',{x:Math.max(16,b.ui.element.querySelector('.builder-court-region').getBoundingClientRect().x+16),y:b.ui.element.querySelector('.builder-court-region').getBoundingClientRect().y+25,fill:'#203449',stroke:'#fff6db','stroke-width':3,'paint-order':'stroke','font-size':13,'font-family':'system-ui'});label.textContent='Suggested Coverage · instructional approximation';this.layer.append(label);
    }
    destroy(){if(this.surface)for(const[type,handler]of Object.entries(this.handlers))this.surface.removeEventListener(type,handler);window.removeEventListener('resize',this.resize);this.layer.remove();}
}
