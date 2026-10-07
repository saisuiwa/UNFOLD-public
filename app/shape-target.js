export const shapeTargetGLSL = `
vec3 unfoldTarget(vec2 uv,float shape,float seed,float preset,vec3 targetPosition,float depth){
  float a=(uv.x-.5)*6.2831853;
  float b=(uv.y-.5)*3.1415926;
  vec3 target;
  if(shape<.5){
    target=vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b))*1.55;
  }else if(shape<1.5){
    float c=uv.y*6.2831853;
    target=vec3((1.30+.47*cos(c))*sin(a),.47*sin(c),(1.30+.47*cos(c))*cos(a));
  }else if(shape<2.5){
    float c=uv.y*12.5663706;
    float r=.75+uv.x*.55;
    target=vec3(cos(c)*r,(uv.y-.5)*3.3,sin(c)*r);
  }else if(shape<3.5){
    float r=1.18+.25*sin(a*3.+b*5.+seed)+.2*cos(a*7.-b*4.);
    target=vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b))*r;
  }else if(shape<4.5){
    vec3 d=vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b));
    target=d/max(max(abs(d.x),abs(d.y)),abs(d.z))*1.12;
  }else if(shape<5.5){
    // heart pillow
    vec2 h=vec2(16.*pow(sin(a),3.),13.*cos(a)-5.*cos(2.*a)-2.*cos(3.*a)-cos(4.*a))/17.;
    float s=cos(b);
    target=vec3(h.x*s,h.y*s+.12,sin(b)*.34)*1.75;
  }else if(shape<6.5){
    // five-point star pillow
    float f=abs(fract(a/6.2831853*5.+.5)-.5)*2.;
    float r=mix(1.62,.66,f),s=cos(b);
    target=vec3(sin(a)*r*s,cos(a)*r*s,sin(b)*.42);
  }else if(shape<7.5){
    // saturn: planet + tilted ring
    vec3 r3;
    if(uv.y<.62){float bb=(uv.y/.62-.5)*3.1415926;r3=vec3(sin(a)*cos(bb),sin(bb),cos(a)*cos(bb))*1.02;}
    else{float rr=1.42+(uv.y-.62)/.38*.9;r3=vec3(sin(a)*rr,0.,cos(a)*rr);}
    float tl=.42,tz=.3;
    r3=vec3(r3.x,r3.y*cos(tl)-r3.z*sin(tl),r3.y*sin(tl)+r3.z*cos(tl));
    target=vec3(r3.x*cos(tz)-r3.y*sin(tz),r3.x*sin(tz)+r3.y*cos(tz),r3.z);
  }else if(shape<8.5){
    // mobius strip
    float u=uv.x*6.2831853,v=(uv.y-.5)*1.1;
    vec3 m=vec3((1.3+v*cos(u*.5))*cos(u),v*sin(u*.5),(1.3+v*cos(u*.5))*sin(u));
    float tl=.95;
    target=vec3(m.x,m.y*cos(tl)-m.z*sin(tl),m.y*sin(tl)+m.z*cos(tl));
  }else if(shape<9.5){
    // diamond (stretched octahedron)
    vec3 d=vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b));
    d/=abs(d.x)+abs(d.y)+abs(d.z);
    target=vec3(d.x,d.y*1.3,d.z)*1.75;
  }else{
    // six-petal flower pillow
    float r=.5+1.05*pow(abs(cos(a*3.)),.7),s=cos(b);
    target=vec3(sin(a)*r*s,cos(a)*r*s,sin(b)*.4+(1.-s)*.15);
  }
  // Keep the destination independent of deformation strength and method.
  // The timeline blends the scrambled plane into this clean surface.
  target=mix(target,targetPosition,preset);
  target.z*=depth;
  return target;
}
`;
