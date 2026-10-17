import struct, zlib, json, math, sys
out=sys.argv[1]
# 256x128 equirect texture: 8 vertical hue stripes, white top band (sRGB PNG)
W,H=256,128
hues=[(230,40,40),(245,150,30),(245,220,40),(60,190,70),(40,160,230),(70,70,220),(170,60,200),(240,240,240)]
rows=b''
for y in range(H):
    r=b'\x00'
    for x in range(W):
        c=(255,255,255) if y<16 else hues[x*8//W]
        r+=bytes(c)
    rows+=r
def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',W,H,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
# UV sphere (indexed), centred at x=-1.3
pos=[];uv=[];idx=[]
SEG,RING=64,32
for j in range(RING+1):
    v=j/RING;th=v*math.pi
    for i in range(SEG+1):
        u=i/SEG;ph=u*2*math.pi
        pos+= [ -1.3+math.sin(th)*math.cos(ph), math.cos(th), math.sin(th)*math.sin(ph)]; uv+=[u,v]
for j in range(RING):
    for i in range(SEG):
        a=j*(SEG+1)+i;b=a+SEG+1
        idx+=[a,b,a+1, a+1,b,b+1]
# box with base colour factor only (no texture), centred x=+1.3
bp=[];bi=[]
def quad(p0,p1,p2,p3):
    n=len(bp)//3; bp.extend(p0+p1+p2+p3); bi.extend([n,n+1,n+2,n,n+2,n+3])
s=.6;cx=1.3
C=[[cx+x*s,y*s,z*s] for x in(-1,1) for y in(-1,1) for z in(-1,1)]
for f in[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]:
    quad(*[C[k] for k in f])
# plane with vertex colours (linear), below
pp=[-1,-1.6,-1, 1,-1.6,-1, 1,-1.6,1, -1,-1.6,1]; pc=[1,0,0, 0,1,0, 0,0,1, 1,1,0]; pi=[0,2,1,0,3,2]
bin=b'';views=[];acc=[]
def add(data,fmt,count,typ,ctype,target=None,minmax=None):
    global bin
    while len(bin)%4: bin+=b'\x00'
    off=len(bin);raw=struct.pack('<'+fmt*len(data),*data);bin+=raw
    v={'buffer':0,'byteOffset':off,'byteLength':len(raw)}
    if target: v['target']=target
    views.append(v);a={'bufferView':len(views)-1,'componentType':ctype,'count':count,'type':typ}
    if minmax:a.update(minmax)
    acc.append(a);return len(acc)-1
def mm(p):return {'min':[min(p[k::3]) for k in range(3)],'max':[max(p[k::3]) for k in range(3)]}
sP=add(pos,'f',len(pos)//3,'VEC3',5126,34962,mm(pos));sU=add(uv,'f',len(uv)//2,'VEC2',5126,34962);sI=add(idx,'I',len(idx),'SCALAR',5125,34963)
bP=add(bp,'f',len(bp)//3,'VEC3',5126,34962,mm(bp));bI=add(bi,'I',len(bi),'SCALAR',5125,34963)
pP=add(pp,'f',4,'VEC3',5126,34962,mm(pp));pC=add(pc,'f',4,'VEC3',5126,34962);pI=add(pi,'I',6,'SCALAR',5125,34963)
while len(bin)%4: bin+=b'\x00'
imgOff=len(bin);bin+=png;views.append({'buffer':0,'byteOffset':imgOff,'byteLength':len(png)})
while len(bin)%4: bin+=b'\x00'
gl={'asset':{'version':'2.0','generator':'UNFOLD colour test'},'scene':0,'scenes':[{'nodes':[0,1,2]}],
 'nodes':[{'mesh':0},{'mesh':1},{'mesh':2}],
 'meshes':[{'primitives':[{'attributes':{'POSITION':sP,'TEXCOORD_0':sU},'indices':sI,'material':0}]},
           {'primitives':[{'attributes':{'POSITION':bP},'indices':bI,'material':1}]},
           {'primitives':[{'attributes':{'POSITION':pP,'COLOR_0':pC},'indices':pI}]}],
 'materials':[{'pbrMetallicRoughness':{'baseColorTexture':{'index':0}}},{'pbrMetallicRoughness':{'baseColorFactor':[0.05,0.6,0.9,1]}}],
 'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9728,'minFilter':9728}],
 'images':[{'bufferView':len(views)-1,'mimeType':'image/png'}],
 'buffers':[{'byteLength':len(bin)}],'bufferViews':views,'accessors':acc}
j=json.dumps(gl).encode();j+=b' '*((4-len(j)%4)%4)
glb=struct.pack('<III',0x46546C67,2,12+8+len(j)+8+len(bin))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(bin),0x004E4942)+bin
open(out,'wb').write(glb);print(out,len(glb),'bytes')
