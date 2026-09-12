
    /* ---------- Hero ripple field ----------
       Rings emanate from an origin point that drifts after the cursor
       (or along a slow path on touch). Each frame, a precomputed mask
       quiets the ink behind the hero text and fades the field out as it
       bleeds into the next section. */
    (function () {
      var hero = document.querySelector(".hero");
      var canvas = document.querySelector(".hero__canvas");
      if (!hero || !canvas || !canvas.getContext) return;

      var ctx = canvas.getContext("2d");
      var mask = document.createElement("canvas");
      var mctx = mask.getContext("2d");
      var scratch = document.createElement("canvas");
      var sctx = scratch.getContext("2d");

      var INK = "90,0,18";        // Deep Burgundy
      var MAX_RINGS = 12;
      var LIFETIME = 22;          // seconds for an ambient ring to reach full size
      var EASE = 0.02;            // origin moves 2% of the way to its target per frame
      var QUIET = 0.84;           // share of ink removed behind text
      var TAU = Math.PI * 2;

      var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

      var W = 0, H = 0, heroH = 0, dpr = 1;
      var maxR = 0, speed = 0, spawnEvery = LIFETIME / (MAX_RINGS - 1), spawnClock = 0;
      var rings = [];
      var origin = { x: 0, y: 0 };
      var pointer = null;
      var clock = 0, raf = 0, last = 0, inView = true;

      // Slow autonomous path: used on touch, and until a mouse moves
      function home(t) {
        var narrow = W < 720;
        var cx = W * (narrow ? 0.64 : 0.7), cy = heroH * (narrow ? 0.3 : 0.48);
        var ax = W * (narrow ? 0.2 : 0.13), ay = heroH * (narrow ? 0.1 : 0.16);
        return {
          x: cx + ax * Math.sin(t * 0.11) + ax * 0.3 * Math.sin(t * 0.27 + 2),
          y: cy + ay * Math.sin(t * 0.083 + 1.3)
        };
      }

      function makeRing(x, y, r, pulse) {
        return { x: x, y: y, r: r, speed: pulse ? speed * 3.2 : speed,
                 alpha: pulse ? 0.9 : 0.5, width: pulse ? 1.6 : 1 };
      }

      // Keep at most MAX_RINGS; the largest ring is also the faintest, so it goes first
      function addRing(ring) {
        rings.push(ring);
        if (rings.length > MAX_RINGS) {
          var big = 0;
          for (var i = 1; i < rings.length; i++) if (rings[i].r > rings[big].r) big = i;
          rings.splice(big, 1);
        }
      }

      // One concentric set around the origin: the opening frame and the reduced-motion view
      function seed() {
        var p = home(clock);
        origin.x = p.x; origin.y = p.y;
        rings = [];
        var step = speed * spawnEvery;
        for (var i = MAX_RINGS - 2; i >= 0; i--) rings.push(makeRing(p.x, p.y, i * step, false));
      }

      // A feathered rectangle of erasure behind one piece of text
      function quiet(x, y, w, h) {
        var pad = 20, f = 56;
        var zw = w + 2 * (pad + f), zh = h + 2 * (pad + f);
        scratch.width = Math.ceil(zw * dpr);
        scratch.height = Math.ceil(zh * dpr);
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var gx = sctx.createLinearGradient(0, 0, zw, 0);
        gx.addColorStop(0, "rgba(0,0,0,0)");
        gx.addColorStop(f / zw, "rgba(0,0,0," + QUIET + ")");
        gx.addColorStop(1 - f / zw, "rgba(0,0,0," + QUIET + ")");
        gx.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = gx;
        sctx.fillRect(0, 0, zw, zh);
        sctx.globalCompositeOperation = "destination-in";
        var gy = sctx.createLinearGradient(0, 0, 0, zh);
        gy.addColorStop(0, "rgba(0,0,0,0)");
        gy.addColorStop(f / zh, "#000");
        gy.addColorStop(1 - f / zh, "#000");
        gy.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = gy;
        sctx.fillRect(0, 0, zw, zh);
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.drawImage(scratch, Math.round((x - pad - f) * dpr), Math.round((y - pad - f) * dpr));
      }

      function buildMask(heroRect, bleed) {
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.clearRect(0, 0, mask.width, mask.height);
        hero.querySelectorAll("[data-quiet]").forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.width && r.height) quiet(r.left - heroRect.left, r.top - heroRect.top, r.width, r.height);
        });
        // Fade the field out through the bleed so rings dissolve into the next section
        var top = heroH - bleed * 0.35;
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var g = mctx.createLinearGradient(0, top, 0, H);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,1)");
        mctx.fillStyle = g;
        mctx.fillRect(0, top, W, H - top);
      }

      function resize() {
        var rect = hero.getBoundingClientRect();
        var bleed = Math.round(Math.min(240, Math.max(120, rect.height * 0.22)));
        W = rect.width; heroH = rect.height; H = heroH + bleed;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = mask.width = Math.round(W * dpr);
        canvas.height = mask.height = Math.round(H * dpr);
        canvas.style.height = H + "px";
        maxR = Math.hypot(W, H) * 0.8;
        speed = maxR / LIFETIME;
        buildMask(rect, bleed);
        if (!rings.length || reduced.matches) seed();
        draw();
      }

      function draw() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Semi-transparent strokes: where rings cross, the ink is denser
        for (var i = 0; i < rings.length; i++) {
          var ring = rings[i];
          var a = ring.alpha * Math.pow(1 - ring.r / maxR, 1.6) * Math.min(1, ring.r / 30);
          if (a < 0.004) continue;
          ctx.lineWidth = ring.width;
          ctx.strokeStyle = "rgba(" + INK + "," + a.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
          ctx.stroke();
        }
        // The origin point itself
        ctx.fillStyle = "rgba(" + INK + ",0.9)";
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, 3, 0, TAU);
        ctx.fill();
        // Quiet the ink behind text and through the bleed
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(mask, 0, 0);
      }

      function frame(now) {
        raf = requestAnimationFrame(frame);
        var dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        clock += dt;
        var target = pointer || home(clock);
        var k = 1 - Math.pow(1 - EASE, dt * 60);   // frame-rate independent lerp
        origin.x += (target.x - origin.x) * k;
        origin.y += (target.y - origin.y) * k;
        spawnClock += dt;
        if (spawnClock >= spawnEvery) {
          spawnClock -= spawnEvery;
          addRing(makeRing(origin.x, origin.y, 0, false));
        }
        for (var i = rings.length - 1; i >= 0; i--) {
          rings[i].r += rings[i].speed * dt;
          if (rings[i].r >= maxR) rings.splice(i, 1);
        }
        draw();
      }

      function start() {
        if (raf || reduced.matches || document.hidden || !inView) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
      function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }

      // Pause when the tab is hidden or the field has scrolled out of view
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else start();
      });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          inView = entries[entries.length - 1].isIntersecting;
          if (inView) start(); else stop();
        }).observe(hero);
      }

      // Mouse: the origin drifts after the cursor while it is over the field
      window.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse" || !finePointer.matches) return;
        var r = canvas.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        pointer = (x >= 0 && y >= 0 && x <= r.width && y <= r.height) ? { x: x, y: y } : null;
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", function () { pointer = null; });

      // Click or tap: one brighter, faster ring from the origin
      hero.addEventListener("pointerdown", function (e) {
        if (reduced.matches || e.button > 0 || e.target.closest("a, button")) return;
        addRing(makeRing(origin.x, origin.y, 0, true));
      });

      function onMotionChange() {
        if (reduced.matches) { stop(); seed(); draw(); } else start();
      }
      if (reduced.addEventListener) reduced.addEventListener("change", onMotionChange);

      var pending = 0;
      function scheduleResize() {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(resize);
      }
      if ("ResizeObserver" in window) new ResizeObserver(scheduleResize).observe(hero);
      else window.addEventListener("resize", scheduleResize);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleResize);

      resize();
      start();
    })();
    /* ---------- The two scroll moments ----------
       Timeline rings appear as each stage enters the viewport (staggered
       when several arrive together), and the pull-quote rises once.
       The CSS only hides them when motion is allowed. */
    (function () {
      var targets = document.querySelectorAll(".stage, .pullquote");
      function reveal(el, delay) {
        el.style.setProperty("--reveal-delay", delay + "ms");
        el.classList.add("is-inview");
      }
      if (!("IntersectionObserver" in window)) {
        targets.forEach(function (el) { reveal(el, 0); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.filter(function (e) { return e.isIntersecting; }).forEach(function (entry, i) {
          reveal(entry.target, i * 160);
          io.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.25 });
      targets.forEach(function (el) { io.observe(el); });
    })();
    /* ---------- Mobile menu ---------- */
    (function () {
      var header = document.querySelector(".site-header");
      var toggle = document.querySelector(".nav-toggle");
      var nav = document.getElementById("site-nav");
      if (!header || !toggle || !nav) return;

      function setOpen(open) {
        toggle.setAttribute("aria-expanded", String(open));
        header.classList.toggle("is-open", open);
      }

      toggle.addEventListener("click", function () {
        setOpen(toggle.getAttribute("aria-expanded") !== "true");
      });

      // Close after choosing a link, on Escape, or on a click outside the header
      nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) setOpen(false);
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && header.classList.contains("is-open")) {
          setOpen(false);
          toggle.focus();
        }
      });
      document.addEventListener("click", function (event) {
        if (!header.contains(event.target)) setOpen(false);
      });
    })();

    /* ---------- Contact form: client-side validation only ---------- */
    (function () {
      var form = document.getElementById("contact-form");
      var success = document.getElementById("form-success");
      if (!form || !success) return;

      form.noValidate = true; // We show our own inline messages instead of the browser's

      var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      var rules = {
        name: function (v) {
          return v ? "" : "Please enter your name.";
        },
        email: function (v) {
          if (!v) return "Please enter your email address.";
          return EMAIL.test(v) ? "" : "Please enter a valid email address, such as name@company.com.";
        },
        stage: function (v) {
          return v ? "" : "Please choose the stage you’re at.";
        },
        message: function (v) {
          if (!v) return "Please add a short message.";
          return v.length >= 10 ? "" : "Please add a little more detail. A sentence or two is plenty.";
        }
      };

      function validate(name) {
        var input = form.elements[name];
        var error = document.getElementById(name + "-error");
        var message = rules[name](input.value.trim());
        if (message) {
          input.setAttribute("aria-invalid", "true");
        } else {
          input.removeAttribute("aria-invalid");
        }
        error.textContent = message;
        error.hidden = !message;
        return !message;
      }

      // Check a field when the user leaves it (if they typed anything),
      // and re-check a flagged field as they correct it.
      form.addEventListener("focusout", function (event) {
        var name = event.target.name;
        if (rules[name] && event.target.value.trim()) validate(name);
      });
      form.addEventListener("input", function (event) {
        var name = event.target.name;
        if (rules[name] && event.target.getAttribute("aria-invalid") === "true") validate(name);
      });
      form.addEventListener("change", function (event) {
        if (event.target.name === "stage") validate("stage");
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();

        var invalid = Object.keys(rules).filter(function (name) {
          return !validate(name);
        });
        if (invalid.length) {
          form.elements[invalid[0]].focus();
          return;
        }

        window.__brief = "OriginPoint — Project brief\n\n" + ["name", "email", "stage", "message"].map(function (key) { return key.charAt(0).toUpperCase() + key.slice(1) + ": " + form.elements[key].value.trim(); }).join("\n\n"); document.getElementById("brief-preview").textContent = window.__brief;
        var firstName = form.elements.name.value.trim().split(/\s+/)[0];
        success.querySelector("[data-success-name]").textContent = ", " + firstName;
        form.hidden = true;
        success.hidden = false;
        success.querySelector(".form-success__title").focus();
      });
    })();

    /* ---------- Footer year ---------- */
    document.getElementById("year").textContent = new Date().getFullYear();
  (function(){
 const system=[['A clear first impression.','Your customer finds what they need and starts a conversation, without getting lost between tools.'],['An enquiry, understood.','An agent answers routine questions and gathers the details your team needs for a useful next step.'],['Context that stays connected.','Customer details reach the right record, so the next conversation can start where the last one ended.'],['A team ready to act.','The right person receives the enquiry with its context, ready to follow up rather than start again.']];
 document.querySelectorAll('[data-system]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.system;document.querySelectorAll('[data-system]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.getElementById('system-title').textContent=system[i][0];document.getElementById('system-copy').textContent=system[i][1];document.querySelector('.system-number').textContent='0'+(i+1);document.querySelectorAll('.system-track span').forEach((x,j)=>x.classList.toggle('active',j===i))}));
 const caps=[['Foundation / Stage 1','A place to begin.','A focused website with a clear offer, useful content, and a route for customers to reach you.',['Website and responsive interface','Domain and hosting setup','Maintenance after launch'],'website'],['Customer interaction / Stage 2','Never lose the thread.','Support, booking, and lead-qualification agents that help turn incoming questions into useful conversations.',['Answers to routine questions','Booking and lead qualification','A handoff to your team'],'AI agent'],['Data & operations / Stage 3','One clearer picture.','Bring customer information into a structure that supports the way your business actually works.',['Customer records and databases','Internal tools for daily work','Useful reporting dashboards'],'internal tools'],['Internal efficiency / Stage 4','Close the gaps.','Connect the tools you already use, so information moves with the work rather than being copied by hand.',['Website and CRM connections','Invoicing and workflow integrations','Context passed between systems'],'integrations']];
 document.querySelectorAll('[data-cap]').forEach(b=>b.addEventListener('click',()=>{const c=caps[+b.dataset.cap];document.querySelectorAll('[data-cap]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));['label','title','copy'].forEach((k,i)=>document.getElementById('cap-'+k).textContent=c[i]);const list=document.getElementById('cap-list');list.replaceChildren(...c[3].map(t=>{const li=document.createElement('li');li.textContent=t;return li}));document.getElementById('cap-link').href='contact.html?need='+encodeURIComponent(c[4])}));
 const plans=[['Just an idea','Make the offer clear.','A clear proposition, a simple landing page, and one way to start a customer conversation.','Complex platforms and advanced automation. Learn what people need before building around it.'],['Pre-launch','Build the foundation.','Domain, branding, website, and hosting. Make the first customer journey easy to follow.','A large internal platform before you know how the business will operate.'],['First customers','Turn interest into a system.','Booking, payments, customer records, and answers to recurring questions.','Features that don’t help you serve the customers you already have.'],['Growing team','Give the work a home.','Shared internal tools, connected customer data, and reporting that helps the team act.','Replacing every tool at once. Keep what works and connect the gaps.'],['Scaling','Strengthen what carries you.','Custom platforms, ERP-lite systems, and infrastructure shaped around established operations.','Complexity without a clear operational benefit.']];
 document.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.plan,c=plans[i];document.querySelectorAll('[data-plan]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.getElementById('plan-label').textContent='0'+(i+1)+' / '+c[0];['title','next','wait'].forEach((k,j)=>document.getElementById('plan-'+k).textContent=c[j+1]);document.getElementById('plan-link').href='contact.html?stage='+encodeURIComponent(c[0])}));
 const form=document.getElementById('contact-form');if(form){const params=new URLSearchParams(location.search),stage=params.get('stage'),need=params.get('need');const map={'First customers':'Launched, first customers'};if(stage){const value=map[stage]||stage;for(const o of form.elements.stage.options)if(o.value===value)form.elements.stage.value=value}if(need)form.elements.message.value='I’m interested in '+need+'. ';
 document.getElementById('download-brief').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([window.__brief],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='OriginPoint-project-brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});document.getElementById('edit-brief').addEventListener('click',()=>{document.getElementById('form-success').hidden=true;form.hidden=false;form.elements.name.focus()})}
})();
/* OriginPoint motion layer: native navigation, input-driven movement. */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const progress = document.createElement('div');
  progress.className = 'reading-progress'; progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);
  let scrollFrame = 0;
  function updateProgress() {
    scrollFrame = 0;
    const total = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = 'scaleX(' + (total > 0 ? Math.min(1, scrollY / total) : 0) + ')';
    document.querySelector('.site-header')?.classList.toggle('has-scrolled', scrollY > 30);
  }
  addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); }, {passive:true});
  addEventListener('resize', updateProgress); updateProgress();

  // A small pull toward the pointer; the native cursor and focus target stay intact.
  document.querySelectorAll('.button, .giant-link > span').forEach(el => {
    el.classList.add('magnetic');
    el.addEventListener('pointermove', e => {
      if (reduced.matches || !fine.matches || e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      el.style.translate = Math.max(-5, Math.min(5, (e.clientX-r.left-r.width/2)*.08))+'px '+Math.max(-4, Math.min(4,(e.clientY-r.top-r.height/2)*.08))+'px';
    });
    const reset = () => {el.style.translate='0px 0px';};
    el.addEventListener('pointerleave', reset); el.addEventListener('blur', reset);
    reduced.addEventListener('change', reset);
  });

  // Animate only deliberately changed content, never whole pages of scroll reveals.
  const panels = [['[data-cap]', '.cap-result'], ['[data-plan]', '.plan-result'], ['[data-system]', '.system-result']];
  panels.forEach(([selector, target]) => {
    document.querySelectorAll(selector).forEach(button => button.addEventListener('click', () => {
      const el = document.querySelector(target); if (!el || reduced.matches) return;
      el.getAnimations().forEach(a=>a.cancel());
      el.animate([{opacity:.55,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'cubic-bezier(.2,.7,.2,1)'});
    }));
  });
  reduced.addEventListener('change',()=>{if(reduced.matches)document.getAnimations().forEach(a=>a.cancel());});

  // Orbital origin: three-dimensional ring geometry on secondary-page covers.
  const cover = document.querySelector('.page-intro'); if (!cover) return;
  const canvas = document.createElement('canvas'); canvas.className='orbital-canvas';
  canvas.setAttribute('aria-hidden','true'); cover.prepend(canvas);
  const ctx=canvas.getContext('2d'); if(!ctx)return;
  let w=0,h=0,dpr=1,t=0,raf=0,last=0,visible=true,pointer=null,tilt={x:0,y:0},pulses=[];
  const ink='90,0,18';
  function resize(){const r=cover.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);draw();}
  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const cx=w*(w<700?.8:.77),cy=h*.56,R=Math.min(w*.29,h*.43);
    const yaw=.7+Math.sin(t*.12)*.3+tilt.x, pitch=.45+Math.cos(t*.09)*.2+tilt.y;
    function project(x,y,z){const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);return [cx+a,cy+y*Math.cos(pitch)-b*Math.sin(pitch),y*Math.sin(pitch)+b*Math.cos(pitch)];}
    for(let ring=0;ring<9;ring++){
      const lat=(ring-4)*.19, radius=R*Math.sqrt(1-lat*lat),y=R*lat;
      for(let side=0;side<2;side++){
        ctx.beginPath();let pen=false;
        for(let i=0;i<=128;i++){const a=i/128*Math.PI*2;const p=project(Math.cos(a)*radius,y,Math.sin(a)*radius);const front=p[2]>=0;if(front===!!side){if(!pen)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);pen=true}else pen=false;}
        ctx.strokeStyle='rgba('+ink+','+(side?.25:.085)+')';ctx.lineWidth=.8;ctx.stroke();
      }
    }
    for(let meridian=0;meridian<3;meridian++){ctx.beginPath();for(let i=0;i<=128;i++){const a=i/128*Math.PI*2,m=meridian*Math.PI/3+t*.04;const p=project(R*Math.cos(a)*Math.cos(m),R*Math.sin(a),R*Math.cos(a)*Math.sin(m));if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);}ctx.strokeStyle='rgba('+ink+',.15)';ctx.stroke();}
    const satellite=project(R*Math.cos(t*.24),0,R*Math.sin(t*.24));ctx.beginPath();ctx.arc(satellite[0],satellite[1],4,0,Math.PI*2);ctx.fillStyle='rgba('+ink+',.65)';ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();
    pulses.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.strokeStyle='rgba('+ink+','+Math.max(0,.4*(1-p.r/(R*2)))+')';ctx.stroke()});
    // An opaque protection field under text, softening toward the orbital side.
    ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,'+(w<700?.84:.9)+')';ctx.fillRect(0,0,w*(w<700?.75:.63),h);ctx.globalCompositeOperation='source-over';
  }
  function frame(now){raf=0;const dt=Math.min((now-last)/1000,.05);last=now;t+=dt;const k=1-Math.pow(.98,dt*60);tilt.x+=((pointer?.x||0)-tilt.x)*k;tilt.y+=((pointer?.y||0)-tilt.y)*k;pulses=pulses.filter(p=>(p.r+=dt*150)<Math.min(w*.29,h*.43)*2);draw();start();}
  function start(){if(raf||reduced.matches||document.hidden||!visible)return;last=performance.now();raf=requestAnimationFrame(frame)}
  function stop(){cancelAnimationFrame(raf);raf=0}
  cover.addEventListener('pointermove',e=>{if(!fine.matches||e.pointerType!=='mouse')return;const r=cover.getBoundingClientRect();pointer={x:(e.clientX-r.left-w/2)/w*.65,y:(e.clientY-r.top-h/2)/h*.45}});
  cover.addEventListener('pointerleave',()=>pointer=null);
  cover.addEventListener('pointerdown',e=>{if(reduced.matches||e.button>0||e.target.closest('a,button'))return;const r=cover.getBoundingClientRect();pulses.push({x:e.clientX-r.left,y:e.clientY-r.top,r:0});if(pulses.length>4)pulses.shift()});
  new ResizeObserver(resize).observe(cover);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visible?start():stop()}).observe(cover);
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  reduced.addEventListener('change',()=>{stop();pulses=[];tilt={x:0,y:0};draw();start()});
  resize();start();
})();
