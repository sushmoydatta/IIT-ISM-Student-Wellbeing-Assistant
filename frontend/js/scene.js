// Sukoon living background. One WebGL canvas, three "vibes".
// Every vibe breathes on the same 4s-in / 6s-out curve as the breathing tool,
// tints itself to the mood the student picks, follows the pointer gently,
// draws its centrepiece over #orb-anchor, and fades that centrepiece back
// once a conversation starts so text stays easy to read.
(function () {
  "use strict";

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("scene");
  const anchor = () => document.getElementById("orb-anchor");

  const MOODS = {
    none: [0.49, 0.95, 0.91], calm: [0.49, 0.95, 0.91], curious: [0.71, 0.61, 1.0],
    anxious: [1.0, 0.80, 0.50], low: [0.52, 0.64, 1.0], overwhelmed: [1.0, 0.58, 0.72], numb: [0.70, 0.74, 0.82],
  };

  function breath(t) {
    const p = ((t % 10) + 10) % 10;
    return p < 4 ? 0.5 - 0.5 * Math.cos(Math.PI * p / 4) : 0.5 + 0.5 * Math.cos(Math.PI * (p - 4) / 6);
  }

  // ---------- shaders ----------
  const QUAD_VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const HEAD = `precision highp float;
    uniform vec2 r; uniform float t,b,f,R; uniform vec2 m,oc; uniform vec3 tint;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);
      return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+1.),u.x),u.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
    vec2 P(){return (gl_FragCoord.xy-.5*r)/r.y;}
    vec2 O(){return (oc-.5*r)/r.y;}
  `;

  const FRAG = {
    aurora: HEAD + `
      void main(){
        vec2 uv=gl_FragCoord.xy/r, p=P();
        float T=t*.035;
        vec2 q=vec2(fbm(p*1.3+T),fbm(p*1.3-T+3.1));
        vec2 w=vec2(fbm(p*1.1+2.*q+vec2(1.7,9.2)+T*1.4),fbm(p*1.1+2.*q+vec2(8.3,2.8)-T));
        float fl=fbm(p+2.6*w+(m-.5)*.25);
        vec3 deep=vec3(.015,.02,.055), ind=vec3(.22,.28,.95), vio=vec3(.62,.45,1.);
        vec3 col=mix(tint,ind,clamp(w.x*1.3,0.,1.)); col=mix(col,vio,clamp(q.y*q.y*1.5,0.,1.));
        float cur=smoothstep(.25,.95,fl)*smoothstep(-.7,.45,p.y+.35*w.y);
        vec3 c=deep+col*cur*(.42+.28*b)*mix(1.,.6,f);
        vec2 o=p-O()-(m-.5)*vec2(.04,.025);
        float Rr=R*(1.+.16*b), d=length(o), vis=1.-f;
        c+=(tint*.55+vio*.3)*exp(-max(d-Rr,0.)*7./max(R*5.,.3))*(.25+.45*b)*vis;
        if(d<Rr&&vis>.01){
          vec2 s=o/Rr; vec3 nr=vec3(s,sqrt(max(1.-dot(s,s),0.)));
          float fres=pow(1.-nr.z,2.2), inner=fbm(nr.xy*2.2+T*5.+w*1.5);
          vec3 ic=mix(vec3(.82,1.,.98),tint,smoothstep(.3,.8,inner)); ic=mix(ic,vio,fres*.9);
          float sp=pow(max(dot(nr,normalize(vec3(-.45,.55,1.))),0.),36.);
          vec3 oc2=ic*(.5+.6*nr.z)+fres*vio*.7+sp*.9;
          c=mix(c,oc2,smoothstep(Rr+.002,Rr-.01,d)*vis);
        }
        c*=1.-.4*pow(length(uv-.5),1.6);
        c+=(h(gl_FragCoord.xy+fract(t)*91.)-.5)*.03;
        gl_FragColor=vec4(c,1.);
      }`,

    dusk: HEAD + `
      float field(vec2 p,float T){
        vec2 c1=vec2(sin(T*.31)*.32,cos(T*.27)*.10)+(m-.5)*.12;
        vec2 c2=vec2(cos(T*.23+1.)*.36,-.05+sin(T*.33+2.)*.12);
        vec2 c3=vec2(sin(T*.19+4.)*.28,.08+cos(T*.21+1.)*.08)-(m-.5)*.08;
        float s=1.+.14*b;
        return .030*s/dot(p-c1,p-c1)+.022*s/dot(p-c2,p-c2)+.016*s/dot(p-c3,p-c3);
      }
      void main(){
        vec2 uv=gl_FragCoord.xy/r, p=P();
        vec3 top=vec3(.07,.04,.11), mid=vec3(.26,.12,.30), low=vec3(.78,.42,.46);
        float y=uv.y+.06*fbm(p*2.+t*.03);
        vec3 c=mix(low,mid,smoothstep(.0,.55,y)); c=mix(c,top,smoothstep(.5,1.,y));
        c=mix(c,c*tint*1.3,.18);
        float S=R/.22, vis=1.-f*.85;
        vec2 q=(p-O())/S;
        float k=field(q,t), e=.004;
        vec2 g=vec2(1./field(q+vec2(e,0),t)-1./field(q-vec2(e,0),t),1./field(q+vec2(0,e),t)-1./field(q-vec2(0,e),t))/(2.*e);
        vec3 nr=normalize(vec3(g*.35,1.));
        float inner=clamp(1.-1./k,0.,1.), inside=smoothstep(.97,1.03,k)*vis;
        vec3 iri=(.80+.20*cos(6.2832*(inner*.9+q.x*.35-q.y*.2+t*.025+vec3(0.,.33,.67))))*vec3(1.,.92,.95);
        float rim=pow(1.-inner,3.), sp=pow(max(dot(nr,normalize(vec3(-.45,.6,.65))),0.),24.);
        vec3 blob=iri*(.78+.22*nr.z)+rim*vec3(.75,.6,1.)*.35+sp*.45;
        c=mix(c,blob,inside);
        c+=vec3(1.,.72,.82)*smoothstep(.35,1.,k)*(1.-smoothstep(.97,1.03,k))*.22*(.6+.4*b)*vis;
        c*=1.-.35*pow(length(uv-.5),1.8);
        c+=(h(gl_FragCoord.xy*.5+fract(t*.7)*77.)-.5)*.07;
        gl_FragColor=vec4(c,1.);
      }`
  };

  const NEURAL_VS = `
    attribute vec3 a; attribute vec2 s;
    uniform float t,b,asp,dpr,f,sc; uniform vec2 m,ctr;
    varying float vD, vS, vK;
    mat3 ry(float x){float c=cos(x),z=sin(x);return mat3(c,0.,-z,0.,1.,0.,z,0.,c);}
    mat3 rx(float x){float c=cos(x),z=sin(x);return mat3(1.,0.,0.,0.,c,z,0.,-z,c);}
    void main(){
      vec3 P;
      if(s.y<.5){
        float d=sin(a.x*4.+t*.7)*sin(a.y*5.-t*.55)*sin(a.z*3.5+t*.45);
        P=a*(.62+.13*b+.07*d);
      } else {
        float ang=a.x+t*.08*(1.+a.z*.4), rad=1.02+a.y*.12;
        P=rx(.42)*vec3(cos(ang)*rad,(a.z-.5)*.04,sin(ang)*rad);
      }
      P=rx((m.y-.5)*.5+.18)*ry(t*.07+(m.x-.5)*.9)*P;
      float z=P.z+2.6;
      vec2 xy=P.xy/z*2.*sc;
      xy.x/=asp;
      gl_Position=vec4(xy+ctr,0.,1.);
      gl_PointSize=(1.1+2.2*s.x)*dpr*(2.6/z)*(s.y>.5?1.2:1.)*clamp(sc*1.4,.7,1.6);
      vD=clamp((3.6-z)/2.,0.,1.); vS=s.x; vK=s.y;
    }`;
  const NEURAL_FS = `precision highp float;
    uniform vec3 tint; uniform float b,t,f;
    varying float vD, vS, vK;
    void main(){
      float d=length(gl_PointCoord-.5), al=smoothstep(.5,.0,d);
      vec3 col=mix(tint,vec3(1.,.37,.82),smoothstep(.55,1.,vS));
      if(vK>.5) col=mix(vec3(.8,.95,1.),tint,.5);
      float tw=.7+.3*sin(t*2.+vS*40.);
      gl_FragColor=vec4(col*al*(.25+.75*vD)*tw*(.75+.35*b)*(1.-f*.72),1.);
    }`;
  // Faint drifting grid behind the particles for the HUD look.
  const NEURAL_BG = HEAD + `
    void main(){
      vec2 uv=gl_FragCoord.xy/r, p=P();
      vec3 c=vec3(.008,.012,.035);
      c+=tint*.05*exp(-length(p-O())*2.2)*(1.-f*.6);
      vec2 g=abs(fract(vec2(p.x,p.y+t*.01)*9.)-.5);
      float grid=smoothstep(.49,.5,max(g.x,g.y));
      c+=tint*grid*.035*smoothstep(1.,.2,length(uv-.5)*1.6);
      gl_FragColor=vec4(c,1.);
    }`;

  // ---------- GL plumbing ----------
  let gl = null, current = null, programs = {}, quad = null, parts = null;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function link(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const loc = name => (name in u ? u[name] : (u[name] = gl.getUniformLocation(p, name)));
    return { p, loc };
  }
  function getProgram(name) {
    if (programs[name]) return programs[name];
    if (name === "neural") programs[name] = { bg: link(QUAD_VS, NEURAL_BG), pts: link(NEURAL_VS, NEURAL_FS) };
    else programs[name] = link(QUAD_VS, FRAG[name]);
    return programs[name];
  }
  function initBuffers() {
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const small = innerWidth < 700;
    const N = small ? 4200 : 7200, Rn = small ? 1100 : 1800, total = N + Rn;
    const pos = new Float32Array(total * 3), seed = new Float32Array(total * 2);
    for (let i = 0; i < N; i++) {
      const y = 1 - 2 * (i + .5) / N, rr = Math.sqrt(1 - y * y), th = i * 2.399963;
      pos.set([Math.cos(th) * rr, y, Math.sin(th) * rr], i * 3); seed.set([Math.random(), 0], i * 2);
    }
    for (let j = 0; j < Rn; j++) {
      const i = N + j;
      pos.set([Math.random() * Math.PI * 2, Math.random(), Math.random()], i * 3); seed.set([Math.random(), 1], i * 2);
    }
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, seed, gl.STATIC_DRAW);
    parts = { pb, sb, total };
  }
  function bindQuad(prog) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const l = gl.getAttribLocation(prog.p, "a");
    gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
  }

  // ---------- state ----------
  const S = {
    vibe: "aurora", mouse: [.5, .5], mouseT: [.5, .5], tint: MOODS.none.slice(), tintT: MOODS.none.slice(),
    focus: 0, focusT: 0, offset: 0, center: [0, 0], radius: 90, phase: "", t: 0,
  };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const scale = S.vibe === "neural" ? Math.min(dpr, 1.75) : Math.min(dpr, 1.5) * 0.7;
    const w = Math.max(1, Math.round(canvas.clientWidth * scale)), hh = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    S.scale = scale; S.dpr = dpr;
    const el = anchor();
    if (el && el.offsetParent !== null) {
      const rc = el.getBoundingClientRect();
      if (rc.width > 0) {
        S.center = [(rc.left + rc.width / 2) * scale, canvas.height - (rc.top + rc.height / 2) * scale];
        S.radius = (rc.width / 2) * scale * 0.82;
      }
    }
  }

  function draw(now) {
    const t = reduce ? 6 : now / 1000;
    S.t = t;
    const b = reduce ? 0.6 : breath(t - S.offset);
    const phase = ((((t - S.offset) % 10) + 10) % 10) < 4 ? "in" : "out";
    if (phase !== S.phase) { S.phase = phase; window.dispatchEvent(new CustomEvent("sukoon:phase", { detail: phase })); }
    document.documentElement.style.setProperty("--breath", b.toFixed(3));
    for (let i = 0; i < 2; i++) S.mouse[i] += (S.mouseT[i] - S.mouse[i]) * 0.04;
    for (let i = 0; i < 3; i++) S.tint[i] += (S.tintT[i] - S.tint[i]) * 0.02;
    S.focus += (S.focusT - S.focus) * (reduce ? 1 : 0.03);

    if (gl) {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      const set = (pr, extra) => {
        gl.useProgram(pr.p);
        gl.uniform2f(pr.loc("r"), canvas.width, canvas.height);
        gl.uniform1f(pr.loc("t"), t); gl.uniform1f(pr.loc("b"), b); gl.uniform1f(pr.loc("f"), S.focus);
        gl.uniform2f(pr.loc("m"), S.mouse[0], S.mouse[1]);
        gl.uniform2f(pr.loc("oc"), S.center[0], S.center[1]);
        gl.uniform1f(pr.loc("R"), S.radius / canvas.height);
        gl.uniform3f(pr.loc("tint"), S.tint[0], S.tint[1], S.tint[2]);
        if (extra) extra(pr);
      };
      const prog = getProgram(S.vibe);
      if (S.vibe === "neural") {
        gl.disable(gl.BLEND);
        set(prog.bg); bindQuad(prog.bg); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        set(prog.pts, pr => {
          gl.uniform1f(pr.loc("asp"), canvas.width / canvas.height);
          gl.uniform1f(pr.loc("dpr"), S.scale);
          // sphere radius ~0.58 NDC-half-heights at sc=1; match the anchor
          gl.uniform1f(pr.loc("sc"), (S.radius / (canvas.height / 2)) / 0.58 * 0.95);
          gl.uniform2f(pr.loc("ctr"), S.center[0] / canvas.width * 2 - 1, S.center[1] / canvas.height * 2 - 1);
        });
        gl.bindBuffer(gl.ARRAY_BUFFER, parts.pb);
        let l = gl.getAttribLocation(prog.pts.p, "a"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, parts.sb);
        l = gl.getAttribLocation(prog.pts.p, "s"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, parts.total);
        gl.disableVertexAttribArray(l);
      } else {
        gl.disable(gl.BLEND);
        set(prog); bindQuad(prog); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    if (!reduce) requestAnimationFrame(draw);
  }

  // ---------- public API ----------
  const Scene = {
    vibes: ["aurora", "neural", "dusk"],
    setVibe(v) {
      if (!this.vibes.includes(v)) v = "aurora";
      S.vibe = v;
      if (gl) { try { getProgram(v); } catch (e) { console.error(e); } }
      if (reduce) requestAnimationFrame(draw);
    },
    setMood(m) { S.tintT = (MOODS[m] || MOODS.none).slice(); if (reduce) S.tint = S.tintT.slice(); },
    setFocus(v) { S.focusT = v; },
    /** Restart the breathing curve at "breathe in" now (used by the breathing tool). */
    syncBreath() { S.offset = S.t; },
    refresh() { if (reduce) requestAnimationFrame(draw); },
    get ok() { return !!gl; },
  };
  window.Scene = Scene;

  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (gl) { initBuffers(); document.documentElement.classList.add("gl"); }
  } catch (e) { console.error(e); gl = null; }

  addEventListener("pointermove", e => { S.mouseT = [e.clientX / innerWidth, 1 - e.clientY / innerHeight]; }, { passive: true });
  addEventListener("resize", () => Scene.refresh());
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); gl = null; document.documentElement.classList.remove("gl"); });
  requestAnimationFrame(draw);
})();
