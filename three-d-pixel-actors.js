import * as THREE from './vendor/three.module.min.js';
import { loadPixelActorAssets } from './pixel-actor-assets.js';
export { loadPixelActorAssets };

export class PixelActorResources {
    constructor(assets) {
        this.assets=assets;this.textures=new Map();
    }
    texture(key,layer) {
        const id=this.assets.metadata.atlases[key][layer===0?'bodyFile':'actionFile'];
        if(!this.textures.has(id)){
            const texture=new THREE.Texture(this.assets.images[key][layer]);
            texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;
            texture.generateMipmaps=false;texture.needsUpdate=true;this.textures.set(id,texture);
        }
        return this.textures.get(id);
    }
    dispose(){for(const texture of this.textures.values())texture.dispose();this.textures.clear();}
}

function makeLayer(name) {
    const geometry=new THREE.PlaneGeometry(1,1,16,16);
    const material=new THREE.MeshBasicMaterial({transparent:true,alphaTest:0.25,depthTest:true,depthWrite:true,side:THREE.DoubleSide,toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.frustumCulled=false;
    mesh.userData.baseUV=geometry.attributes.uv.array.slice();
    return mesh;
}
export function createPixelActor(resources,team,handedness) {
    const root=new THREE.Group();root.name=`PixelAthlete-${team}-${handedness}`;
    const visual=new THREE.Group();root.add(visual);
    const body=makeLayer('PixelBody'),arm=makeLayer('PixelPaddleArm');visual.add(body,arm);
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.3,20),new THREE.MeshBasicMaterial({color:'#263449',transparent:true,opacity:0.22,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=0.006;shadow.scale.y=0.65;root.add(shadow);
    root.userData={team,handedness,groundY:0,pixelActor:true,visual,body,arm,shadow,resources,paddleFaceWorld:new THREE.Vector3(),shoulderWorld:new THREE.Vector3(),frameKey:null};
    return root;
}

function setFrame(mesh,texture,frame,height,offsetZ=0) {
    mesh.material.map=texture;
    mesh.userData.currentFrame=frame;mesh.userData.layerIndex=mesh.name==='PixelBody'?0:1;
    const geometry=mesh.geometry,position=geometry.attributes.position,uv=geometry.attributes.uv;
    const [rx,ry,w,h]=frame.rect, [px,py]=frame.pivot;
    const image=texture.image;
    for(let i=0;i<position.count;i++){
        const u=mesh.userData.baseUV[i*2],v=mesh.userData.baseUV[i*2+1];
        position.setXYZ(i,(u*w-px)*height/h, (py-(1-v)*h)*height/h,offsetZ);
        uv.setXY(i,(rx+u*w)/image.width,1-(ry+(1-v)*h)/image.height);
    }
    position.needsUpdate=true;uv.needsUpdate=true;
    mesh.userData.rest=position.array.slice();
}

const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function updatePixelActor(root,sample,camera,contactWeight=0) {
    const data=root.userData,{resources,visual,body,arm}=data;
    const team=data.team==='team1'?'green':'orange';
    const key=`${team}/${data.handedness}/${sample.viewDirection}`;
    const atlas=resources.assets.metadata.atlases[key];
    if(!atlas)throw new Error(`Missing actor direction ${key}`);
    let action=sample.action;
    let phase=sample.phase==='follow-through'?'follow':sample.phase;
    let frameName=action==='ready'?'ready':action==='shuffle'?`shuffle-${sample.locomotionFrame%2?'b':'a'}`:`${action}-${phase}`;
    const frame=atlas.frames.find(f=>f.action===frameName)||atlas.frames.find(f=>f.action==='ready');
    if(!frame)throw new Error(`Missing actor frame ${key}/${frameName}`);
    root.position.set(sample.worldPosition.x,0,sample.worldPosition.z);
    const dx=camera.position.x-root.position.x,dz=camera.position.z-root.position.z;
    const cameraForward=new THREE.Vector3();camera.getWorldDirection(cameraForward);
    visual.rotation.y=Math.atan2(-cameraForward.x,-cameraForward.z);
    const horizontal=Math.hypot(cameraForward.x,cameraForward.z),vertical=cameraForward.y;
    // Cylindrical upright billboard: never lays across the court at steep angles.
    const elevationScale=Math.min(1.45,Math.hypot(horizontal,vertical)/Math.max(0.01,horizontal));
    const height=2.05;
    visual.scale.y=elevationScale;
    const frameKey=`${key}/${frame.action}/${height.toFixed(4)}`;
    if(data.frameKey!==frameKey){
        setFrame(body,resources.texture(key,0),frame,height);
        setFrame(arm,resources.texture(key,1),frame,height,0.004);
        data.frameKey=frameKey;
    }
    const localFace=new THREE.Vector3((frame.paddleFace[0]-frame.pivot[0])*height/frame.rect[3],(frame.pivot[1]-frame.paddleFace[1])*height/frame.rect[3],0.004);
    const localShoulder=new THREE.Vector3((frame.shoulderPivot[0]-frame.pivot[0])*height/frame.rect[3],(frame.pivot[1]-frame.shoulderPivot[1])*height/frame.rect[3],0.004);
    root.updateMatrixWorld(true);
    const target=sample.paddle?.worldContactTarget;
    const position=arm.geometry.attributes.position,rest=arm.userData.rest;
    const updateGeometry=contactWeight>0||data.lastContactWeight>0;
    data.lastContactWeight=contactWeight;
    let delta=new THREE.Vector3();
    if(target&&contactWeight>0){
        delta=visual.worldToLocal(new THREE.Vector3(target.x,target.y,target.z)).sub(localFace).multiplyScalar(contactWeight);
    }
    const axis=localFace.clone().sub(localShoulder),lengthSq=Math.max(0.001,axis.lengthSq());
    if(updateGeometry) for(let i=0;i<position.count;i++){
        const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2];
        const along=((x-localShoulder.x)*axis.x+(y-localShoulder.y)*axis.y+(z-localShoulder.z)*axis.z)/lengthSq;
        const faceDistance=Math.hypot(x-localFace.x,y-localFace.y);
        const weight=faceDistance<height*9/frame.rect[3]?1:smooth((along-0.1)/0.4);
        position.setXYZ(i,x+delta.x*weight,y+delta.y*weight,z+delta.z*weight);
    }
    if(updateGeometry)position.needsUpdate=true;
    data.paddleFaceWorld.copy(localFace).add(delta).applyMatrix4(visual.matrixWorld);
    data.shoulderWorld.copy(localShoulder).applyMatrix4(visual.matrixWorld);
    data.animation={...sample,frame:frame.action};
}
