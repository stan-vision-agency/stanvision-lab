/*!
 * Murmuration runtime v1.0.0 (StanVision Lab, made for Primer)
 * Lean embed of lab.stan.vision/murmuration: same shader, settings model (S), PRESETS and triggers; no UI.
 * Mounts on every [data-murmuration] element. Attributes:
 *   data-preset="Murmuration 1"   one of PRESETS (default Murmuration 1)
 *   data-settings='{...}'         JSON from the lab's COPY SETTINGS (overrides the preset)
 *   data-cursor="Attract|Repel|Off"
 * API: window.Murmuration.get(el) -> { trigger(name), set(key, value), settings(obj), preset(name), get(), pause(), play(), destroy() }
 * Source: github.com/stan-vision-agency/stanvision-lab (branch primer-embed), embed/README.md
 */
(function () {
  'use strict';
  if (window.Murmuration && window.Murmuration.version) return;

  var FS = "precision highp float;uniform vec2 uRes;uniform float uTime;uniform int uTex,uDither,uBase;uniform float uCell,uDot,uSizeBy,uBarW,uBarRows,uBarJit;uniform float uGain,uGamma,uJitter,uZoom;uniform vec3 uBg,uFg;uniform float uAngle,uBandW,uBandOff,uGrain,uNScale,uNDetail,uNStretch,uNoiseT;uniform vec2 uFlow;uniform vec4 uStA[3],uStB[3];uniform float uStW[3],uStOn[3];uniform float uCore,uCoreW,uTaper,uFanW,uFanAmt,uFanScale,uEndFade;uniform vec2 uMouse;uniform float uMouseR,uMouseAmt;uniform float uSweep,uSweepAmt,uSweepW,uReveal,uRevealSoft,uBurst,uCollapse;uniform vec2 uHole;uniform float uHoleR;float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y);}float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<6;i++){if(float(i)>=uNDetail)break;v+=a*vnoise(p);p=r*p*2.03+11.7;a*=.5;}return v/(1.-a);}float bayer2(vec2 a){a=floor(a);return fract(a.x/2.+a.y*a.y*.75);}float bayer4(vec2 a){return bayer2(.5*a)*.25+bayer2(a);}float bayer8(vec2 a){return bayer4(.5*a)*.25+bayer2(a);}float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}vec2 bez(vec2 a,vec2 b,vec2 c,vec2 d,float t){float s=1.-t;return s*s*s*a+3.*s*s*t*b+3.*s*t*t*c+t*t*t*d;}void strokeDist(vec2 q,vec2 a,vec2 b,vec2 c,vec2 d,out float md,out float mt){md=1e9;mt=0.;vec2 prev=a;for(int i=1;i<=28;i++){float t=float(i)/28.;vec2 p=bez(a,b,c,d,t);vec2 pa=q-prev,ba=p-prev;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);float dd=length(pa-ba*h);if(dd<md){md=dd;mt=(float(i-1)+h)/28.;}prev=p;}}vec2 toField(vec2 px){return((px/uRes)-.5)*vec2(uRes.x/uRes.y,1.)/uZoom;}float field(vec2 q,vec2 cellId){float aspect=uRes.x/uRes.y;float v=0.;vec2 dir=vec2(cos(uAngle),sin(uAngle)),nrm=vec2(-dir.y,dir.x);float along=dot(q,dir),across=dot(q,nrm);float proj=along/(aspect*.5+.5);if(uBase==1){float band=exp(-pow((across-uBandOff)/max(uBandW,.001),2.));vec2 np=vec2(along,across*uNStretch)*uNScale+uFlow;float n=fbm(np+uNoiseT);n=smoothstep(.28,.78,n);v=band*mix(1.,n*1.4,uGrain);}else if(uBase==2){vec2 np=q*uNScale+uFlow;float n=fbm(np+uNoiseT);v=smoothstep(.3,.8,n)*1.2;}for(int i=0;i<3;i++){if(uStOn[i]<.5)continue;float d,t;strokeDist(q,uStA[i].xy,uStA[i].zw,uStB[i].xy,uStB[i].zw,d,t);float w=uStW[i]*(1.+uTaper*pow(abs(t-.5)*2.,2.));float ends=smoothstep(0.,uEndFade,t)*smoothstep(1.,1.-uEndFade,t);float body=exp(-pow(d/w,2.));float core=exp(-pow(d/(w*uCoreW),2.))*uCore;float nf=fbm((q+vec2(t*3.1,float(i)*7.))*uFanScale+uFlow*.5+uNoiseT);float fan=exp(-pow(d/(w*uFanW),2.))*smoothstep(.3,.8,nf)*uFanAmt;v=max(v,(body+core+fan)*ends);}if(uSweepAmt>0.){float sw=exp(-pow((proj-uSweep)/uSweepW,2.));float n2=smoothstep(.25,.8,fbm(q*5.+uNoiseT*2.+3.));v+=sw*uSweepAmt*(.35+.65*n2);}if(uMouseAmt !=0.){float dm=length(q-uMouse);v+=uMouseAmt*exp(-pow(dm/uMouseR,2.));}if(uCollapse>0.){float dh=length(q-uHole);v=mix(v,exp(-pow(dh/uHoleR,2.))*2.4*smoothstep(.2,.8,fbm(q*6.+uNoiseT)),uCollapse);}if(uReveal<1.5){v*=smoothstep(uReveal+uRevealSoft,uReveal-uRevealSoft,proj);}return v;}void main(){vec2 px=gl_FragCoord.xy;float cell=uCell;vec2 cellSize=(uTex==0)?vec2(cell,cell*uBarRows):vec2(cell);vec2 id=floor(px/cellSize);vec2 centre=(id+.5)*cellSize;vec2 f=fract(px/cellSize);float jit=uJitter+uBurst;vec2 j=(hash22(id+3.7)-.5)*jit*cell*6./uRes.y;vec2 q=toField(centre)+j;float v=field(q,id);v=pow(max(v*uGain,0.),uGamma);float thr;if(uDither==0)thr=bayer8(id);else if(uDither==1)thr=hash12(id+11.);else thr=ign(id);thr=thr*.96+.02;float on=0.;if(uTex==0){float h=hash12(id+5.);float vv=clamp(v+(h-.5)*uBarJit,0.,1.);float start=hash12(id+9.)*(1.-vv);float inBar=step(start,f.y)*step(f.y,start+vv)*step(abs(f.x-.5),uBarW*.5);on=inBar*step(.03,vv)*step(thr*.6,vv+.15);}else{float sz=uDot*mix(1.,clamp(v,0.,1.),uSizeBy);float lit=step(thr,v);if(uTex==1){on=lit*step(abs(f.x-.5),sz*.5)*step(abs(f.y-.5),sz*.5);}else{float r=length((f-.5)*cellSize);on=lit*step(r,sz*.5*cell);}}vec3 col=mix(uBg,uFg,on);gl_FragColor=vec4(col,1.);}";
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  var TEXTURES = ['Bars', 'Dither', 'Rounded'];
  var DITHERS = ['Ordered', 'Random', 'Blue'];
  var BASES = ['None', 'Cloud', 'Noise'];
  var UNIFORMS = ['uRes', 'uTime', 'uTex', 'uDither', 'uBase', 'uCell', 'uDot', 'uSizeBy', 'uBarW', 'uBarRows', 'uBarJit', 'uGain', 'uGamma', 'uJitter', 'uZoom',
    'uBg', 'uFg', 'uAngle', 'uBandW', 'uBandOff', 'uGrain', 'uNScale', 'uNDetail', 'uNStretch', 'uNoiseT', 'uFlow',
    'uStA', 'uStB', 'uStW', 'uStOn', 'uCore', 'uCoreW', 'uTaper', 'uFanW', 'uFanAmt', 'uFanScale', 'uEndFade',
    'uMouse', 'uMouseR', 'uMouseAmt', 'uSweep', 'uSweepAmt', 'uSweepW', 'uReveal', 'uRevealSoft', 'uBurst', 'uCollapse', 'uHole', 'uHoleR'];

  function strokeSet(a, b, c, d, w, on) { return { on: on !== false, w: w, p: [a, b, c, d] }; }
  function SWOOSH(on) { return strokeSet([-0.80, 0.24], [-0.28, 0.16], [-0.30, -0.40], [0.82, 0.12], 0.028, on); }
  function ARC(on) { return strokeSet([-0.78, -0.30], [-0.32, 0.40], [0.32, 0.40], [0.78, -0.30], 0.03, on === true); }
  function LINE() { return strokeSet([-0.66, 0.36], [-0.2, 0.1], [0.2, -0.1], [0.66, -0.36], 0.025, false); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function assign(t, s) { for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; return t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }); }

  /* same defaults as the lab's S */
  function defaults() {
    return {
      base: 'Cloud', angle: -28, bandW: 0.26, bandOff: 0.02, grain: 0.9, nScale: 2.6, nDetail: 4, nStretch: 1.6, zoom: 1,
      strokes: [SWOOSH(false), ARC(), LINE()],
      core: 0.8, coreW: 0.3, taper: 2.2, fanW: 5, fanAmt: 0.6, fanScale: 4, endFade: 0.08,
      tex: 'Dither', dither: 'Random', cell: 7, dot: 0.55, sizeBy: 0, barW: 0.34, barRows: 6, barJit: 0.5,
      gain: 0.95, gamma: 1.7, jitter: 0.3,
      bg: '#FF540A', fg: '#F9FAF7',
      anim: 'Flow', speed: 1, flowAngle: 35, turb: 0.3,
      cursor: 'Attract', mouseR: 0.18, mouseAmt: 0.5,
      sweepAmt: 1.2, sweepW: 0.12, burstAmt: 1.6, revealSoft: 0.15
    };
  }

  /* same PRESETS as the lab */
  var PRESETS = {
    'Murmuration 1': {
      base: 'Cloud', angle: -28, bandW: 0.26, bandOff: 0.02, grain: 0.9, nScale: 2.6, nDetail: 4, nStretch: 1.6, zoom: 1,
      strokes: [SWOOSH(false), ARC(), LINE()],
      tex: 'Dither', dither: 'Random', cell: 7, dot: 0.55, sizeBy: 0, gain: 0.95, gamma: 1.7, jitter: 0.3,
      bg: '#FF540A', fg: '#F9FAF7', anim: 'Flow', speed: 1, flowAngle: 35, turb: 0.3, cursor: 'Attract'
    },
    'Murmuration 2': {
      base: 'None', zoom: 1,
      strokes: [SWOOSH(), ARC(), LINE()],
      core: 0.9, coreW: 0.28, taper: 2.6, fanW: 6, fanAmt: 0.55, fanScale: 4, endFade: 0.08,
      tex: 'Rounded', dither: 'Ordered', cell: 9, dot: 0.55, sizeBy: 0.75, gain: 0.85, gamma: 1.6, jitter: 0.15,
      bg: '#A098FD', fg: '#F9FAF7', anim: 'Morph', speed: 0.8, turb: 0.25, cursor: 'Attract'
    },
    'Bars': {
      base: 'Cloud', angle: -24, bandW: 0.3, bandOff: 0.04, grain: 0.85, nScale: 2.2, nDetail: 4, nStretch: 1.4, zoom: 1,
      strokes: [SWOOSH(false), ARC(), LINE()],
      tex: 'Bars', dither: 'Random', cell: 4, barW: 0.4, barRows: 7, barJit: 0.7, gain: 0.9, gamma: 1.7, jitter: 0.25,
      bg: '#FF540A', fg: '#F9FAF7', anim: 'Flow', speed: 0.8, flowAngle: 35, turb: 0.35, cursor: 'Attract'
    },
    'Cover': {
      base: 'Cloud', angle: -14, bandW: 0.22, bandOff: 0.42, grain: 1, nScale: 2.4, nDetail: 4, nStretch: 1.2, zoom: 1,
      strokes: [SWOOSH(false), ARC(), LINE()],
      tex: 'Dither', dither: 'Ordered', cell: 6, dot: 0.5, sizeBy: 0, gain: 1.3, gamma: 1.4, jitter: 0.1,
      bg: '#FFF0E4', fg: '#FF540A', anim: 'Turbulence', speed: 0.6, flowAngle: 0, turb: 0.4, cursor: 'Attract'
    },
    'Night': {
      base: 'Cloud', angle: 18, bandW: 0.34, bandOff: -0.1, grain: 1, nScale: 2, nDetail: 5, nStretch: 1.8, zoom: 1,
      strokes: [SWOOSH(), ARC(), LINE()],
      core: 1, coreW: 0.25, taper: 3, fanW: 6, fanAmt: 0.5, fanScale: 4, endFade: 0.1,
      tex: 'Rounded', dither: 'Blue', cell: 8, dot: 0.5, sizeBy: 0.5, gain: 0.8, gamma: 1.8, jitter: 0.3,
      bg: '#0D0D0D', fg: '#F9FAF7', anim: 'Flow', speed: 0.7, flowAngle: 200, turb: 0.3, cursor: 'Attract'
    },
    'Lime': {
      base: 'None', zoom: 1,
      strokes: [SWOOSH(), ARC(true), LINE()],
      core: 0.6, coreW: 0.35, taper: 1.6, fanW: 4, fanAmt: 0.7, fanScale: 5, endFade: 0.06,
      tex: 'Dither', dither: 'Ordered', cell: 6, dot: 0.6, sizeBy: 0.3, gain: 0.8, gamma: 1.6, jitter: 0.2,
      bg: '#D6FB58', fg: '#0D0D0D', anim: 'Breathe', speed: 1, turb: 0.3, cursor: 'Repel'
    }
  };

  function randomStrokes(base) {
    return base.map(function (s) {
      var flip = Math.random() < 0.5 ? -1 : 1;
      return { on: s.on, w: +rnd(0.02, 0.045).toFixed(3), p: [
        [-0.8 + rnd(-0.1, 0.2), rnd(-0.4, 0.4)], [rnd(-0.6, 0.1), rnd(-0.5, 0.5) * flip], [rnd(-0.1, 0.6), rnd(-0.5, 0.5) * -flip], [0.8 + rnd(-0.2, 0.1), rnd(-0.4, 0.4)]
      ] };
    });
  }

  var mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var mqSmall = window.matchMedia ? matchMedia('(max-width: 767px), (pointer: coarse)') : { matches: false };
  var instances = [];

  function Instance(el) {
    this.el = el;
    this.S = defaults();
    this.T = { flow: [0, 0], noiseT: 0, breath: 1, sweep: -3, sweepAmt: 0, reveal: 9, burst: 0, collapse: 0, hole: [0, 0],
      mouse: [0, 0], mouseTarget: [0, 0], mouseActive: false, lastMove: -1e9 };
    this.timeline = []; this.strokeDisplay = null; this.now = 0; this.last = 0; this.morphClock = 0; this.idleAngle = 0;
    this.visible = false; this.paused = false; this.raf = 0; this.gl = null;
    this.readConfig();
  }
  var P = Instance.prototype;

  P.readConfig = function () {
    var el = this.el, name = el.getAttribute('data-preset');
    assign(this.S, clone(PRESETS[name] || PRESETS['Murmuration 1']));
    var js = el.getAttribute('data-settings');
    if (js && js.trim()) { try { assign(this.S, JSON.parse(js)); } catch (e) { el.setAttribute('data-murmuration-error', 'settings'); } }
    var c = el.getAttribute('data-cursor');
    if (c === 'Attract' || c === 'Repel' || c === 'Off') this.S.cursor = c;
  };

  P.init = function () {
    if (this.gl || this.failed) return !!this.gl;
    var el = this.el, cvs = document.createElement('canvas');
    cvs.setAttribute('aria-hidden', 'true');
    cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    var gl = null;
    try { gl = cvs.getContext('webgl', { antialias: false, preserveDrawingBuffer: false, premultipliedAlpha: false, alpha: false }); } catch (e) { gl = null; }
    if (!gl) return this.fail();
    try {
      var prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      var U = {}; UNIFORMS.forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      this.U = U;
    } catch (e) { return this.fail(); }
    this.gl = gl; this.cvs = cvs;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(cvs);
    var self = this;
    cvs.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.stop(); cvs.remove(); self.gl = null; self.failed = true; el.setAttribute('data-murmuration-state', 'fallback'); });
    this.ro = window.ResizeObserver ? new ResizeObserver(function () { self.resize(); if (!self.raf) self.draw(); }) : null;
    if (this.ro) this.ro.observe(el); else addEventListener('resize', function () { self.resize(); });
    this.resize();
    el.setAttribute('data-murmuration-state', 'ready');
    return true;
  };
  P.fail = function () { this.failed = true; this.el.setAttribute('data-murmuration-state', 'fallback'); return false; };
  function compile(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader'); return s; }

  P.dpr = function () { return Math.min(window.devicePixelRatio || 1, mqSmall.matches ? 1.5 : 2); };
  P.resize = function () {
    if (!this.gl) return;
    var r = this.el.getBoundingClientRect(), d = this.dpr();
    var w = Math.max(1, Math.floor(r.width * d)), h = Math.max(1, Math.floor(r.height * d));
    if (this.cvs.width !== w || this.cvs.height !== h) { this.cvs.width = w; this.cvs.height = h; }
  };

  P.uniforms = function (w, h, dpr, time) {
    var gl = this.gl, U = this.U, S = this.S, T = this.T, strokes = this.strokeDisplay || S.strokes;
    gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uTime, time);
    gl.uniform1i(U.uTex, TEXTURES.indexOf(S.tex)); gl.uniform1i(U.uDither, DITHERS.indexOf(S.dither)); gl.uniform1i(U.uBase, BASES.indexOf(S.base));
    gl.uniform1f(U.uCell, Math.max(2, S.cell * dpr)); gl.uniform1f(U.uDot, S.dot); gl.uniform1f(U.uSizeBy, S.sizeBy);
    gl.uniform1f(U.uBarW, S.barW); gl.uniform1f(U.uBarRows, S.barRows); gl.uniform1f(U.uBarJit, S.barJit);
    gl.uniform1f(U.uGain, S.gain * T.breath); gl.uniform1f(U.uGamma, S.gamma); gl.uniform1f(U.uJitter, S.jitter); gl.uniform1f(U.uZoom, S.zoom);
    gl.uniform3fv(U.uBg, hex(S.bg)); gl.uniform3fv(U.uFg, hex(S.fg));
    gl.uniform1f(U.uAngle, S.angle * Math.PI / 180); gl.uniform1f(U.uBandW, S.bandW); gl.uniform1f(U.uBandOff, S.bandOff);
    gl.uniform1f(U.uGrain, S.grain); gl.uniform1f(U.uNScale, S.nScale); gl.uniform1f(U.uNDetail, S.nDetail); gl.uniform1f(U.uNStretch, S.nStretch);
    gl.uniform1f(U.uNoiseT, T.noiseT); gl.uniform2f(U.uFlow, T.flow[0], T.flow[1]);
    var A = [], B = [], W = [], O = [];
    strokes.forEach(function (s) { A.push(s.p[0][0], s.p[0][1], s.p[1][0], s.p[1][1]); B.push(s.p[2][0], s.p[2][1], s.p[3][0], s.p[3][1]); W.push(s.w); O.push(s.on ? 1 : 0); });
    gl.uniform4fv(U.uStA, A); gl.uniform4fv(U.uStB, B); gl.uniform1fv(U.uStW, W); gl.uniform1fv(U.uStOn, O);
    gl.uniform1f(U.uCore, S.core); gl.uniform1f(U.uCoreW, S.coreW); gl.uniform1f(U.uTaper, S.taper); gl.uniform1f(U.uFanW, S.fanW); gl.uniform1f(U.uFanAmt, S.fanAmt); gl.uniform1f(U.uFanScale, S.fanScale); gl.uniform1f(U.uEndFade, S.endFade);
    var mAmt = S.cursor === 'Off' ? 0 : (S.cursor === 'Attract' ? 1 : -1) * S.mouseAmt * (T.mouseActive ? 1 : 0);
    gl.uniform2f(U.uMouse, T.mouse[0], T.mouse[1]); gl.uniform1f(U.uMouseR, S.mouseR); gl.uniform1f(U.uMouseAmt, mAmt);
    gl.uniform1f(U.uSweep, T.sweep); gl.uniform1f(U.uSweepAmt, T.sweepAmt); gl.uniform1f(U.uSweepW, S.sweepW);
    gl.uniform1f(U.uReveal, T.reveal); gl.uniform1f(U.uRevealSoft, S.revealSoft); gl.uniform1f(U.uBurst, T.burst);
    gl.uniform1f(U.uCollapse, T.collapse); gl.uniform2f(U.uHole, T.hole[0], T.hole[1]); gl.uniform1f(U.uHoleR, 0.2);
  };

  P.draw = function () {
    if (!this.gl) return;
    this.resize();
    var c = this.cvs; this.gl.viewport(0, 0, c.width, c.height);
    this.uniforms(c.width, c.height, this.dpr(), this.now);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  };

  /* one frame of the lab's motion model */
  P.step = function (t) {
    var S = this.S, T = this.T, dt = Math.min(0.05, t - this.last), sp = S.speed;
    this.last = t; this.now = t;
    T.noiseT += dt * S.turb * sp * (S.anim === 'Turbulence' ? 2.2 : 0.35);
    if (S.anim === 'Flow' || S.anim === 'Turbulence') {
      var a = S.flowAngle * Math.PI / 180, v = (S.anim === 'Flow' ? 0.16 : 0.06) * sp;
      T.flow[0] -= Math.cos(a) * v * dt * S.nScale; T.flow[1] -= Math.sin(a) * v * dt * S.nScale;
    }
    T.breath = S.anim === 'Breathe' ? 1 + 0.45 * Math.sin(t * 1.3 * sp) : 1;
    if (S.anim === 'Morph') { this.morphClock += dt * sp; if (this.morphClock > 3.2 && !this.timeline.some(function (x) { return x.morph; })) { this.morphClock = 0; this.TRIG('morph'); } }
    /* cursor: idle figure-eight when no pointer */
    if (t - T.lastMove > 2.5) {
      this.idleAngle += dt * 0.35 * sp;
      T.mouseTarget = [Math.sin(this.idleAngle) * 0.45, Math.sin(this.idleAngle * 2) * 0.22];
      T.mouseActive = S.cursor !== 'Off';
    }
    T.mouse[0] += (T.mouseTarget[0] - T.mouse[0]) * 0.06; T.mouse[1] += (T.mouseTarget[1] - T.mouse[1]) * 0.06;
    this.timeline = this.timeline.filter(function (x) { var u = (t - x.t0) / x.dur; if (u >= 1) { x.fn(1); if (x.done) x.done(); return false; } x.fn(Math.max(0, u)); return true; });
  };

  P.loop = function () {
    var self = this;
    this.raf = requestAnimationFrame(function () {
      self.raf = 0;
      if (!self.shouldRun()) return;
      self.step(performance.now() / 1000); self.draw(); self.frames = (self.frames || 0) + 1;
      self.loop();
    });
  };
  P.shouldRun = function () { return !!this.gl && this.visible && !this.paused && !document.hidden && !mqReduce.matches; };
  P.start = function () { if (this.raf || !this.shouldRun()) return; this.last = performance.now() / 1000; this.loop(); };
  P.stop = function () { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; };
  P.update = function () {
    if (!this.gl) return;
    if (this.shouldRun()) this.start();
    else { this.stop(); this.draw(); } /* reduced motion / paused: one static frame */
    this.syncPause();
  };

  /* pointer relative to the element (lab: toFieldPx on the window) */
  P.pointer = function (x, y) {
    if (this.S.cursor === 'Off' || mqReduce.matches || !this.gl) return;
    var r = this.el.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom || !r.height) return;
    var a = r.width / r.height, S = this.S, T = this.T;
    T.mouseTarget = [((x - r.left) / r.width - 0.5) * a / S.zoom, (0.5 - (y - r.top) / r.height) / S.zoom];
    T.lastMove = performance.now() / 1000; T.mouseActive = true;
  };

  /* one-shot triggers (same curves as the lab) */
  P.tween = function (dur, fn, done, morph) { this.timeline.push({ t0: this.now || performance.now() / 1000, dur: dur, fn: fn, done: done, morph: morph }); };
  P.TRIG = function (name, target) {
    var self = this, S = this.S, T = this.T;
    if (name === 'sweep') { T.sweepAmt = S.sweepAmt; this.tween(2.2, function (u) { T.sweep = -1.3 + u * 2.6; T.sweepAmt = S.sweepAmt * Math.pow(Math.sin(Math.min(1, u) * Math.PI), 0.5); }, function () { T.sweepAmt = 0; }); }
    else if (name === 'burst') this.tween(1.6, function (u) { T.burst = S.burstAmt * Math.exp(-u * 4.5) * Math.sin(Math.min(u * 6, 1) * Math.PI / 2); }, function () { T.burst = 0; });
    else if (name === 'reveal') this.tween(2.4, function (u) { var e = 1 - Math.pow(1 - u, 3); T.reveal = -1.3 + e * 2.6; }, function () { T.reveal = 9; });
    else if (name === 'collapse') {
      T.hole = T.mouseActive ? [T.mouse[0], T.mouse[1]] : [rnd(-0.4, 0.4), rnd(-0.25, 0.25)];
      this.tween(2.6, function (u) { var a = u < 0.35 ? u / 0.35 : (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45); var e = a * a * (3 - 2 * a); T.collapse = e; T.burst = (1 - e) * (u > 0.55 ? S.burstAmt * 0.6 * e : 0); }, function () { T.collapse = 0; T.burst = 0; });
    } else if (name === 'morph') {
      var from = clone(this.strokeDisplay || S.strokes), to = target || randomStrokes(S.strokes);
      this.tween(1.8, function (u) {
        var e = u * u * (3 - 2 * u);
        self.strokeDisplay = from.map(function (s, i) { return { on: to[i].on, w: s.w + (to[i].w - s.w) * e, p: s.p.map(function (pt, k) { return [pt[0] + (to[i].p[k][0] - pt[0]) * e, pt[1] + (to[i].p[k][1] - pt[1]) * e]; }) }; });
      }, function () { S.strokes = clone(to); self.strokeDisplay = null; }, true);
    } else return;
    this.start();
  };

  /* pause control: optional sibling button[data-murmuration-pause] (WCAG 2.2.2) */
  P.syncPause = function () {
    var p = this.el.parentElement, b = p && p.querySelector('[data-murmuration-pause]');
    if (!b) return;
    var self = this;
    if (!b._murm) {
      b._murm = 1;
      b.addEventListener('click', function () { self.paused = !self.paused; self.update(); });
    }
    b.hidden = !this.gl || mqReduce.matches;
    b.setAttribute('aria-pressed', this.paused ? 'true' : 'false');
    b.setAttribute('aria-label', this.paused ? 'Play background animation' : 'Pause background animation');
  };

  P.api = function () {
    var self = this;
    return {
      el: this.el,
      trigger: function (n) { self.TRIG(n); },
      set: function (k, v) { self.S[k] = v; self.update(); },
      settings: function (o) { self.strokeDisplay = null; assign(self.S, clone(o)); self.update(); },
      preset: function (n) { if (PRESETS[n]) { self.strokeDisplay = null; assign(self.S, clone(PRESETS[n])); self.update(); } },
      get: function () { return clone(self.S); },
      pause: function () { self.paused = true; self.update(); },
      play: function () { self.paused = false; self.update(); },
      state: function () { return { ready: !!self.gl, running: !!self.raf, visible: self.visible, paused: self.paused, frames: self.frames || 0 }; },
      destroy: function () { self.stop(); if (self.ro) self.ro.disconnect(); if (self.cvs) self.cvs.remove(); self.gl = null; instances.splice(instances.indexOf(self), 1); delete self.el._murmuration; }
    };
  };

  /* near: create the GL context when the element is within 200px; visible: run the loop only on screen */
  var ioNear = window.IntersectionObserver ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { ioNear.unobserve(e.target); var i = e.target._murmuration; if (i && i.init()) i.update(); } });
  }, { rootMargin: '200px 0px' }) : null;
  var ioVis = window.IntersectionObserver ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { var i = e.target._murmuration; if (i) { i.visible = e.isIntersecting; i.update(); } });
  }) : null;

  function mount(el) {
    if (el._murmuration) return el._murmuration.api;
    var i = new Instance(el);
    el._murmuration = i; i.api = i.api(); instances.push(i);
    if (ioNear) { ioNear.observe(el); ioVis.observe(el); }
    else { i.visible = true; if (i.init()) i.update(); }
    return i.api;
  }
  function mountAll(root) { Array.prototype.forEach.call((root || document).querySelectorAll('[data-murmuration]'), mount); }

  function each(fn) { instances.forEach(fn); }
  addEventListener('pointermove', function (e) { each(function (i) { i.pointer(e.clientX, e.clientY); }); }, { passive: true });
  document.addEventListener('visibilitychange', function () { each(function (i) { i.update(); }); });
  function onMq() { each(function (i) { i.update(); }); }
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onMq);

  window.Murmuration = {
    version: '1.0.0',
    presets: Object.keys(PRESETS),
    triggers: ['sweep', 'burst', 'reveal', 'collapse', 'morph'],
    mount: mount,
    mountAll: mountAll,
    get: function (el) { if (typeof el === 'string') el = document.querySelector(el); return el && el._murmuration ? el._murmuration.api : null; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountAll(); });
  else mountAll();
  try { document.dispatchEvent(new CustomEvent('murmuration:ready')); } catch (e) { /* old browsers */ }
})();
