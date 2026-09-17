/** Mount the canvas engine after React has committed the game UI.
 * Returns a cleanup function for unmounts and React Strict Mode remounts.
 * The rendering/physics engine is plain JS; the Next.js UI is TypeScript.
 * @param {HTMLElement} root
 * @returns {() => void}
 */
export function mountGame(root) {
    const controller = new AbortController();
    const timers = new Set();
    let frame = 0;
    function listen(target, type, handler) { target.addEventListener(type, handler, { signal: controller.signal }); }
    function schedule(fn, delay) { const timer = window.setTimeout(() => { timers.delete(timer); fn(); }, delay); timers.add(timer); }
    const canvas = root.querySelector('canvas'), c = canvas.getContext('2d'), $ = id => root.querySelector(`#${id}`);
    let W = 1280, H = 720;
    canvas.width = W;
    canvas.height = H;
    let mode = 'ready', t = 0, last = 0, p, arrows = [], enemies = [], particles = [], drops = [], wave = 0, spawned = 0, kills = 0, score = 0, gate = 100, spawnTime = 0, shot = 0, dash = 0, shake = 0, mouse = { x: 640, y: 130, down: false }, keys = {}, sound = false, ac;
    const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    function tone(f, d = .08) { if (!sound)
        return; ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); let o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.035, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d); }
    $('sound').onclick = () => { sound = !sound; $('sound').textContent = 'ДУУ: ' + (sound ? 'ON' : 'OFF'); tone(440); };
    function burst(x, y, color, n = 12) { for (let i = 0; i < n; i++)
        particles.push({ x, y, vx: rand(-140, 140), vy: rand(-140, 140), life: rand(.2, .7), color }); }
    function toast(s) { $('toast').textContent = s; schedule(() => { if ($('toast').textContent === s)
        $('toast').textContent = ''; }, 2100); }
    function reset() { p = { x: 640, y: 560, hp: 100, inv: 0 }; arrows = []; enemies = []; particles = []; drops = []; wave = 1; spawned = 0; kills = 0; score = 0; gate = 100; spawnTime = 1; shot = 0; dash = 0; t = 0; mode = 'play'; keys = {}; mouse.down = false; autoFire = false; $('overlay').style.display = 'none'; $('status').textContent = 'ЦАЙЗЫГ ЭЗЭЛ'; toast('I • БҮСЛЭЛТ ЭХЭЛЛЭЭ'); hud(); }
    $('start').onclick = () => { tone(330, .2); reset(); };
    function hud() { $('hp').style.width = Math.max(0, p?.hp ?? 100) + '%'; $('gate').style.width = gate + '%'; $('score').textContent = String(score).padStart(4, '0'); $('wave').textContent = String(wave || 1).padStart(2, '0') + ' / 03'; }
    function end(win) { mode = win ? 'win' : 'lose'; $('overlay').style.display = 'flex'; $('overlay').querySelector('h1').innerHTML = win ? 'ЦАЙЗЫГ<br><em>ЭЗЭЛЛЭЭ!</em>' : 'ДАХИН<br><em>ТУЛАЛДЪЯ</em>'; $('message').textContent = (win ? 'Тал нутгийн баатар, ялалт чинийх. ' : 'Бүслэлт үргэлжилнэ. ') + `Оноо: ${score} · Дарсан дайсан: ${kills}`; $('start').innerHTML = 'ДАХИН ТОГЛОХ <span>↗</span>'; $('status').textContent = win ? 'ЯЛАЛТ' : 'ТУЛААН ДУУСЛАА'; tone(win ? 660 : 110, .5); }
    function pause() { if (mode === 'play') {
        mode = 'pause';
        toast('ТҮР ЗОГСЛОО · P дарж үргэлжлүүл');
    }
    else if (mode === 'pause') {
        mode = 'play';
        $('toast').textContent = '';
    } }
    listen(window, 'keydown', e => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
        e.preventDefault(); keys[e.code] = true; if (e.code === 'KeyP' && !e.repeat)
        pause(); if (e.code === 'Enter' && ['ready', 'win', 'lose'].includes(mode))
        reset(); });
    listen(window, 'keyup', e => keys[e.code] = false);
    listen(window, 'blur', () => { keys = {}; mouse.down = false; if (mode === 'play')
        pause(); });
    listen(canvas, 'pointermove', e => { let r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width * W; mouse.y = (e.clientY - r.top) / r.height * H; });
    listen(canvas, 'pointerdown', e => { let r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width * W; mouse.y = (e.clientY - r.top) / r.height * H; mouse.down = true; canvas.setPointerCapture(e.pointerId); });
    listen(window, 'pointerup', () => mouse.down = false);
    canvas.style.touchAction = 'none';
    for (const b of root.querySelectorAll('[data-key]')) {
        const key = 'Key' + b.dataset.key.toUpperCase();
        b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); keys[key] = true; };
        b.onpointerup = b.onpointercancel = () => keys[key] = false;
    }
    let autoFire = false;
    $('mobileFire').onpointerdown = e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); autoFire = true; };
    $('mobileFire').onpointerup = $('mobileFire').onpointercancel = () => autoFire = false;
    function shoot(x, y, tx, ty, enemy = false) { let a = Math.atan2(ty - y, tx - x); arrows.push({ x, y, vx: Math.cos(a) * (enemy ? 245 : 660), vy: Math.sin(a) * (enemy ? 245 : 660), a, enemy, life: 3 }); if (!enemy)
        tone(680, .035); }
    function update(dt) {
        t += dt;
        shot -= dt;
        dash -= dt;
        p.inv -= dt;
        spawnTime -= dt;
        let dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0), len = Math.hypot(dx, dy);
        if (len) {
            dx /= len;
            dy /= len;
        }
        if (keys.Space && dash <= 0 && len) {
            dash = 1.6;
            p.inv = .25;
            burst(p.x, p.y, '#e9cf91', 18);
            p.x += dx * 100;
            p.y += dy * 100;
            tone(160);
        }
        p.x = clamp(p.x + dx * 235 * dt, 35, W - 35);
        p.y = clamp(p.y + dy * 235 * dt, 205, H - 35);
        if ((mouse.down || autoFire) && shot <= 0) {
            let target = autoFire ? (enemies.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] || { x: 640, y: 145 }) : mouse;
            shoot(p.x, p.y, target.x, target.y);
            shot = .19;
        }
        let total = 5 + wave * 3;
        if (spawned < total && spawnTime <= 0) {
            let side = Math.random() < .5;
            enemies.push({ x: side ? 22 : W - 22, y: rand(260, 650), hp: wave === 3 ? 3 : 2, type: spawned % 4 === 3 ? 'archer' : 'guard', cool: rand(1, 2), phase: rand(0, 6) });
            spawned++;
            spawnTime = Math.max(.65, 1.5 - wave * .2);
        }
        for (const e of enemies) {
            let a = Math.atan2(p.y - e.y, p.x - e.x), dist = Math.hypot(p.x - e.x, p.y - e.y);
            if (e.type !== 'archer' || dist > 270) {
                e.x += Math.cos(a) * (55 + wave * 15) * dt;
                e.y += Math.sin(a) * (55 + wave * 15) * dt;
            }
            e.cool -= dt;
            if (e.type === 'archer' && e.cool <= 0) {
                shoot(e.x, e.y, p.x, p.y, true);
                e.cool = 2.1;
            }
            if (dist < 25 && p.inv <= 0) {
                p.hp -= 12;
                p.inv = .7;
                shake = 9;
                burst(p.x, p.y, '#c78962');
                tone(100);
            }
        }
        for (const a of arrows) {
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.life -= dt;
            if (a.enemy) {
                if (Math.hypot(a.x - p.x, a.y - p.y) < 20 && p.inv <= 0) {
                    p.hp -= 9;
                    p.inv = .4;
                    a.life = 0;
                    shake = 5;
                    burst(p.x, p.y, '#d79966');
                }
            }
            else {
                for (const e of enemies) {
                    if (e.hp > 0 && Math.hypot(a.x - e.x, a.y - e.y) < 22) {
                        e.hp--;
                        a.life = 0;
                        burst(e.x, e.y, '#d8b576', 7);
                        if (e.hp <= 0) {
                            score += 100;
                            kills++;
                            if (Math.random() < .23)
                                drops.push({ x: e.x, y: e.y });
                            tone(250);
                        }
                        break;
                    }
                }
                if (a.life > 0 && a.y < 175) {
                    a.life = 0;
                    if (a.x > 565 && a.x < 715) {
                        gate = Math.max(0, gate - 2);
                        burst(a.x, 172, '#e6b765', 6);
                        shake = 2;
                        score += 5;
                    }
                }
            }
        }
        arrows = arrows.filter(a => a.life > 0 && a.x > -20 && a.x < W + 20 && a.y > -20 && a.y < H + 20);
        enemies = enemies.filter(e => e.hp > 0);
        for (const d of drops) {
            if (Math.hypot(d.x - p.x, d.y - p.y) < 28) {
                p.hp = Math.min(100, p.hp + 22);
                d.used = true;
                burst(p.x, p.y, '#9dce98');
                tone(520);
            }
        }
        drops = drops.filter(d => !d.used);
        if (spawned >= total && enemies.length === 0) {
            if (wave < 3) {
                wave++;
                spawned = 0;
                spawnTime = 2;
                p.hp = Math.min(100, p.hp + 15);
                toast('ДАВАЛГАА ' + wave + ' • АМИН ХҮЧ +15');
            }
            else if (gate <= 0) {
                score += 500;
                hud();
                end(true);
                return;
            }
            else if (!$('toast').textContent) {
                toast('ХАМГААЛАГЧИД ДАРАГДЛАА • ХААЛГЫГ ХАРВА');
            }
        }
        if (p.hp <= 0)
            end(false);
        hud();
    }
    const terrain = [];
    let seed = 821;
    function seeded() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    for (let i = 0; i < 520; i++)
        terrain.push({ x: seeded() * W, y: 190 + seeded() * 530, s: seeded() * 3 });
    function person(x, y, a, hero = false, phase = 0) { c.save(); c.translate(x, y); c.fillStyle = '#071c1466'; c.beginPath(); c.ellipse(2, 14, 17, 7, 0, 0, 7); c.fill(); c.rotate(a + Math.PI / 2); c.fillStyle = hero ? '#c49b55' : '#945f47'; c.beginPath(); c.moveTo(-10, 3); c.lineTo(0, 23 + Math.sin(t * 8 + phase) * 3); c.lineTo(10, 3); c.fill(); c.fillStyle = hero ? '#d9c79b' : '#59665d'; c.fillRect(-9, -6, 18, 18); c.fillStyle = '#b8bca6'; c.fillRect(-7, -11, 14, 8); c.fillStyle = '#ded0ab'; c.fillRect(-4, -7, 8, 5); c.strokeStyle = hero ? '#f4d690' : '#bca987'; c.lineWidth = 2; c.beginPath(); c.arc(13, 0, 12, -1.6, 1.6); c.stroke(); c.beginPath(); c.moveTo(13, -12); c.lineTo(13, 12); c.stroke(); c.restore(); }
    function draw(dt) {
        c.save();
        if (shake > 0) {
            c.translate(rand(-shake, shake), rand(-shake, shake));
            shake = Math.max(0, shake - 30 * dt);
        }
        c.fillStyle = '#33473a';
        c.fillRect(0, 0, W, H);
        let gr = c.createRadialGradient(650, 440, 50, 650, 440, 800);
        gr.addColorStop(0, '#64704b');
        gr.addColorStop(1, '#213b32');
        c.fillStyle = gr;
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#a69c6c15';
        c.beginPath();
        c.moveTo(588, 175);
        c.lineTo(690, 175);
        c.lineTo(900, H);
        c.lineTo(375, H);
        c.fill();
        for (const g of terrain) {
            c.fillStyle = g.s > 2 ? '#b4ba8130' : '#112e2545';
            c.fillRect(g.x, g.y, g.s + 1, 2);
        }
        // The wall, gate and battlements are world geometry with gameplay significance.
        c.fillStyle = '#14241f';
        c.fillRect(0, 0, W, 165);
        c.fillStyle = '#47534a';
        c.fillRect(0, 90, W, 76);
        for (let row = 0; row < 3; row++)
            for (let x = -40; x < W; x += 80) {
                c.strokeStyle = '#27382f';
                c.strokeRect(x + (row % 2) * 40, 94 + row * 24, 80, 24);
            }
        c.fillStyle = '#596255';
        for (let x = 0; x < W; x += 45)
            c.fillRect(x, 74, 27, 22);
        c.fillStyle = '#1b2c25';
        c.fillRect(551, 56, 178, 130);
        c.fillStyle = '#6a7360';
        c.fillRect(539, 57, 22, 131);
        c.fillRect(719, 57, 22, 131);
        c.fillStyle = '#182a23';
        c.beginPath();
        c.arc(640, 116, 78, Math.PI, 0);
        c.lineTo(718, 179);
        c.lineTo(562, 179);
        c.fill();
        if (gate > 0) {
            c.fillStyle = '#6b5137';
            c.fillRect(570, 107, 140, 72);
            c.beginPath();
            c.arc(640, 107, 70, Math.PI, 0);
            c.fill();
            c.strokeStyle = '#302d22';
            c.lineWidth = 4;
            for (let x = 580; x < 710; x += 17) {
                c.beginPath();
                c.moveTo(x, 75);
                c.lineTo(x, 177);
                c.stroke();
            }
            c.fillStyle = '#302e22';
            c.fillRect(570, 119, 140, 7);
            c.fillRect(570, 160, 140, 7);
        }
        else {
            c.fillStyle = '#ac9560';
            for (let i = 0; i < 10; i++)
                c.fillRect(574 + i * 14, 176 + (i % 3) * 6, 9, 5);
        }
        for (let x of [493, 788]) {
            c.fillStyle = '#a58d59';
            c.fillRect(x, 35, 3, 97);
            c.fillStyle = '#9f4939';
            c.beginPath();
            c.moveTo(x + 3, 35);
            c.lineTo(x + 38 + Math.sin(t * 3) * 3, 41);
            c.lineTo(x + 31, 72);
            c.lineTo(x + 3, 64);
            c.fill();
            c.fillStyle = '#d2b576';
            c.fillRect(x + 11, 44, 3, 15);
        }
        for (const d of drops) {
            c.save();
            c.translate(d.x, d.y);
            c.shadowColor = '#b4d697';
            c.shadowBlur = 15;
            c.fillStyle = '#b4d697';
            c.fillRect(-3, -9, 6, 18);
            c.fillRect(-9, -3, 18, 6);
            c.restore();
        }
        for (const e of enemies)
            person(e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), false, e.phase);
        if (p) {
            c.globalAlpha = p.inv > 0 ? .55 + .45 * Math.sin(t * 40) : 1;
            person(p.x, p.y, Math.atan2(mouse.y - p.y, mouse.x - p.x), true);
            c.globalAlpha = 1;
            if (dash <= 0) {
                c.strokeStyle = '#c5b57566';
                c.lineWidth = 1;
                c.beginPath();
                c.ellipse(p.x, p.y + 15, 22, 9, 0, 0, 7);
                c.stroke();
            }
        }
        else
            person(790, 480, -1.8, true);
        for (const a of arrows) {
            c.strokeStyle = a.enemy ? '#ed8f66' : '#f9dea3';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(a.x - Math.cos(a.a) * 19, a.y - Math.sin(a.a) * 19);
            c.stroke();
        }
        for (const q of particles) {
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.life -= dt;
            c.globalAlpha = Math.max(0, q.life * 2);
            c.fillStyle = q.color;
            c.fillRect(q.x, q.y, 3, 3);
        }
        particles = particles.filter(q => q.life > 0);
        c.globalAlpha = 1;
        let vignette = c.createRadialGradient(640, 370, 200, 640, 370, 760);
        vignette.addColorStop(0, '#0000');
        vignette.addColorStop(1, '#05150bbb');
        c.fillStyle = vignette;
        c.fillRect(0, 0, W, H);
        c.restore();
        if (mode === 'play') {
            c.strokeStyle = '#f1d695aa';
            c.lineWidth = 1;
            c.beginPath();
            c.arc(mouse.x, mouse.y, 8, 0, 7);
            c.moveTo(mouse.x - 13, mouse.y);
            c.lineTo(mouse.x + 13, mouse.y);
            c.moveTo(mouse.x, mouse.y - 13);
            c.lineTo(mouse.x, mouse.y + 13);
            c.stroke();
        }
    }
    function loop(now) { let dt = Math.min((now - last) / 1000, .035); last = now; if (mode === 'play')
        update(dt); if (mode === 'ready')
        t += dt; draw(mode === 'pause' ? 0 : dt); frame = requestAnimationFrame(loop); }
    frame = requestAnimationFrame(loop);
    return () => { controller.abort(); cancelAnimationFrame(frame); timers.forEach(window.clearTimeout); if (ac)
        void ac.close(); for (const node of root.querySelectorAll('button')) {
        node.onclick = node.onpointerdown = node.onpointerup = node.onpointercancel = null;
    } };
}
