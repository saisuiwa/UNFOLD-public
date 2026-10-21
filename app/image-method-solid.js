import * as THREE from 'three';
import {shapeTargetGLSL} from './shape-target.js';

// the GLB's own texture (target.texture: an ImageBitmap and its wrapping, image-method-runtime.js), made once per target and kept for rebuilds
const modelTextures=new WeakMap(),WRAPS=[THREE.RepeatWrapping,THREE.ClampToEdgeWrapping,THREE.MirroredRepeatWrapping];
function modelTexture(t){
 if(!t?.image)return null;if(modelTextures.has(t))return modelTextures.get(t);
 const texture=new THREE.Texture(t.image);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 texture.wrapS=WRAPS.includes(t.wrapS)?t.wrapS:THREE.RepeatWrapping;texture.wrapT=WRAPS.includes(t.wrapT)?t.wrapT:THREE.RepeatWrapping;texture.needsUpdate=true;
 modelTextures.set(t,texture);return texture;
}
// Full target triangles preserve GLB detail; only image-piece matrices change each frame.
// target.color / modelUv / texture: the model's own colours, mixed in by frame.modelColor as it becomes the solid (as motion.js does for GLSL methods).
export function createImageSolid(target,pieces,root,textures,size){
 if(!target)return null;
 const count=target.uv.length/2,local=new Float32Array(count*3),slots=new Float32Array(count);
 const rows=Math.max(1,pieces.length+1),matrices=new Float32Array(rows*16);
 const transforms=new THREE.DataTexture(matrices,4,rows,THREE.RGBAFormat,THREE.FloatType);
 transforms.needsUpdate=true;
 const visibility=new Float32Array(rows*4),visibilityTexture=new THREE.DataTexture(visibility,1,rows,THREE.RGBAFormat,THREE.FloatType);
 const identity=new THREE.Matrix4();identity.toArray(matrices,0);
 // Bin UV rectangles: bounded lookup even for a million-triangle imported model.
 const N=64,bins=Array.from({length:N*N},()=>[]),bin=x=>Math.min(N-1,Math.max(0,Math.floor(x*N)));
 pieces.forEach((piece,i)=>{const [u0,v0,u1,v1]=piece.uv;for(let y=bin(Math.min(v0,v1));y<=bin(Math.max(v0,v1));y++)for(let x=bin(Math.min(u0,u1));x<=bin(Math.max(u0,u1));x++)bins[y*N+x].push(i)});
 for(let i=0;i<count;i+=3){
  const u=(target.uv[i*2]+target.uv[i*2+2]+target.uv[i*2+4])/3,v=(target.uv[i*2+1]+target.uv[i*2+3]+target.uv[i*2+5])/3;
  const found=bins[bin(v)*N+bin(u)].find(j=>{const [a,b,c,d]=pieces[j].uv;return u>=Math.min(a,c)-1e-6&&u<=Math.max(a,c)+1e-6&&v>=Math.min(b,d)-1e-6&&v<=Math.max(b,d)+1e-6});
  const piece=found===undefined?null:pieces[found];
  for(let j=i;j<i+3;j++){
   const u=target.uv[j*2],v=target.uv[j*2+1];slots[j]=piece?found+1:0;
   local[j*3]=piece?((u-piece.uv[0])/(piece.uv[2]-piece.uv[0])-.5)*piece.width:(u-.5)*size.width;
   local[j*3+1]=piece?((v-piece.uv[1])/(piece.uv[3]-piece.uv[1])-.5)*piece.height:(v-.5)*size.height;
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(local,3));geometry.setAttribute('uv',new THREE.BufferAttribute(target.uv,2));geometry.setAttribute('targetPosition',new THREE.BufferAttribute(target.positions,3));geometry.setAttribute('pieceSlot',new THREE.BufferAttribute(slots,1));
 if(target.color)geometry.setAttribute('modelColor',new THREE.BufferAttribute(target.color,4));if(target.modelUv)geometry.setAttribute('modelUv',new THREE.BufferAttribute(target.modelUv,3));
 const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,defaultAttributeValues:{color:[1,1,1],uv:[0,0],uv1:[0,0],modelColor:[0,0,0,0],modelUv:[0,0,0]},uniforms:{a:{value:textures[0]},b:{value:textures[1]},mixImage:{value:0},modelColorAmount:{value:0},modelTex:{value:modelTexture(target.texture)},pieceMatrices:{value:transforms},pieceVisibility:{value:visibilityTexture},matrixRows:{value:rows},form:{value:0},shape:{value:target.shape},preset:{value:target.preset?1:0},depth:{value:1},seed:{value:28},project:{value:target.project?1:0},size:{value:new THREE.Vector2(size.width,size.height)}},vertexShader:`
 ${shapeTargetGLSL}
 attribute vec3 targetPosition;attribute float pieceSlot;
 attribute vec4 modelColor;attribute vec3 modelUv;   // the GLB's own colour per corner (linear rgb, a = 2 when it has colour) and texture coordinates (z = 1 where its texture paints)
 uniform sampler2D pieceMatrices,pieceVisibility;uniform float matrixRows,form,shape,preset,depth,seed,project;uniform vec2 size;
 uniform float modelColorAmount;   // how much of that colour shows on the solid (0 = the picture only)
 varying vec2 vUv;varying vec3 vPosition;varying float vVisibility;varying vec4 vModelColor;varying vec3 vModelUv;
 void main(){float row=(pieceSlot+.5)/matrixRows;vVisibility=mix(texture2D(pieceVisibility,vec2(.5,row)).r,1.,form);
 mat4 move=mat4(texture2D(pieceMatrices,vec2(.125,row)),texture2D(pieceMatrices,vec2(.375,row)),texture2D(pieceMatrices,vec2(.625,row)),texture2D(pieceMatrices,vec2(.875,row)));
 vec3 from=(move*vec4(position,1.)).xyz;
 vec3 to=unfoldTarget(uv,shape,seed,preset,targetPosition,depth);
 vec4 mv=modelViewMatrix*vec4(mix(from,to,form),1.);vPosition=mv.xyz;
 vUv=mix(uv,targetPosition.xy/size+.5,project*smoothstep(.5,.95,form));
 vModelColor=vec4(modelColor.rgb,step(1.5,modelColor.a)*modelColorAmount*smoothstep(.5,.95,form));vModelUv=modelUv;
 gl_Position=projectionMatrix*mv;
 }`,fragmentShader:`uniform sampler2D a,b,modelTex;uniform float mixImage,form;varying vec2 vUv;varying vec3 vPosition;varying float vVisibility;varying vec4 vModelColor;varying vec3 vModelUv;
 void main(){gl_FragColor=mix(texture2D(a,vUv),texture2D(b,vUv),mixImage);
 if(vModelColor.a>.001){vec3 own=vModelColor.rgb;if(vModelUv.z>.5)own*=texture2D(modelTex,vModelUv.xy).rgb;gl_FragColor.rgb=mix(gl_FragColor.rgb,own,vModelColor.a);}
 gl_FragColor.a*=vVisibility;
 vec3 normal=normalize(cross(dFdx(vPosition),dFdy(vPosition)));
 gl_FragColor.rgb*=mix(1.,.65+.35*abs(normal.z),form);
 #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;root.add(mesh);
 const inv=new THREE.Matrix4(),relative=new THREE.Matrix4();let hidden=[];
 return {
  pieceCount:pieces.length,
  restore(){for(const [o,visible]of hidden)o.visible=visible;hidden=[];mesh.visible=false},
  update(frame){
   const form=Math.max(0,Math.min(1,Number(frame.form)||0));if(!form)return;
   root.updateWorldMatrix(true,true);inv.copy(root.matrixWorld).invert();
   // Read all visibility before hiding any mesh (pieces may be nested).
   pieces.forEach((piece,i)=>{let node=piece.mesh,visible=true;while(node&&node!==root){if(!node.visible)visible=false;node=node.parent}visibility[(i+1)*4]=visible&&node===root?1:0});visibilityTexture.needsUpdate=true;
   pieces.forEach((piece,i)=>{relative.multiplyMatrices(inv,piece.mesh.matrixWorld).toArray(matrices,(i+1)*16);hidden.push([piece.mesh,piece.mesh.visible]);piece.mesh.visible=false});
   transforms.needsUpdate=true;
   const u=material.uniforms;u.form.value=form;u.depth.value=frame.depth??1;u.seed.value=frame.seed??28;u.mixImage.value=frame.imageMix;u.modelColorAmount.value=Math.max(0,Math.min(1,Number(frame.modelColor)||0));
   mesh.visible=true;
  },
  dispose(){transforms.dispose();visibilityTexture.dispose();geometry.dispose();material.dispose();mesh.removeFromParent()}
 };
}
