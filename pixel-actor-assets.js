// Shared immutable decoded artwork; no renderer or playback state.
import { VIEW_DIRECTIONS } from './three-d-presentation.js';
const REQUIRED_ACTIONS=['ready','shuffle-a','shuffle-b',...['serve','forehand','backhand','drive','drop','block','lob','overhead'].flatMap(f=>['prepare','contact','follow','recover'].map(p=>`${f}-${p}`))];

let decodedAssets;
const loadImage = url => new Promise((resolve,reject) => {
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Pixel actor image unavailable: ${url}`));image.src=url;
});
export async function loadPixelActorAssets() {
    if (!decodedAssets) decodedAssets=(async()=>{
        const response=await fetch(new URL('./assets/replay/metadata.json',import.meta.url));
        if(!response.ok)throw new Error('Pixel actor metadata unavailable');
        const metadata=await response.json();
        if(metadata.version!==2||!metadata.atlases||!Array.isArray(metadata.directions)||VIEW_DIRECTIONS.some(d=>!metadata.directions.includes(d)))throw new Error('Invalid pixel actor metadata');
        for(const team of ['green','orange'])for(const hand of ['left','right'])for(const direction of VIEW_DIRECTIONS){
            if(!metadata.atlases[`${team}/${hand}/${direction}`])throw new Error('Incomplete pixel actor directions');
        }
        const images={},imagePromises=new Map();
        await Promise.all(Object.entries(metadata.atlases).map(async([key,atlas])=>{
            if(!atlas.bodyFile||!atlas.actionFile||!Array.isArray(atlas.frames)||!atlas.frames.length)throw new Error(`Invalid actor atlas: ${key}`);
            if(new Set(atlas.frames.map(f=>f.action)).size!==atlas.frames.length||REQUIRED_ACTIONS.some(action=>!atlas.frames.some(f=>f.action===action)))throw new Error(`Incomplete actor actions: ${key}`);
            for(const frame of atlas.frames){
                for(const field of ['rect','pivot','paddleGrip','paddleFace','shoulderPivot']) {
                    if(!Array.isArray(frame[field])||frame[field].length!==(field==='rect'?4:2)||!frame[field].every(Number.isInteger))throw new Error(`Invalid ${field}: ${key}/${frame.action}`);
                }
            }
            for(const frame of atlas.frames){
                const [x,y,w,h]=frame.rect;
                if(x<0||y<0||w<=0||h<=0)throw new Error('Invalid actor frame bounds');
                for(const field of ['pivot','paddleGrip','paddleFace','shoulderPivot'])if(frame[field][0]<0||frame[field][0]>=w||frame[field][1]<0||frame[field][1]>=h)throw new Error('Invalid actor anchor bounds');
            }
            images[key]=await Promise.all([atlas.bodyFile,atlas.actionFile].map(file=>{if(!imagePromises.has(file))imagePromises.set(file,loadImage(new URL(`./assets/replay/${file}`,import.meta.url).href));return imagePromises.get(file);}));
            for(const image of images[key])for(const frame of atlas.frames)if(frame.rect[0]+frame.rect[2]>image.width||frame.rect[1]+frame.rect[3]>image.height)throw new Error('Actor image bounds mismatch');
        }));
        return {metadata,images};
    })().catch(error=>{decodedAssets=null;throw error;});
    return decodedAssets;
}

