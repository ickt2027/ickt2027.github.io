/**
 * ICKT 2027 - 田中先生 たばこもくもくイースターエッグ
 * 先生のお顔を5回以上連打すると、口元にタバコが現れて自然な白い煙がもくもく立ち上ります！
 */

(function () {
  'use strict';

  // 煙パーティクルクラス
  class SmokeParticle {
    constructor(x, y, intensity) {
      this.x = x + (Math.random() - 0.5) * 10;
      this.y = y + (Math.random() - 0.5) * 6;
      this.vx = (Math.random() - 0.5) * 0.9 * Math.min(intensity, 2.5);
      this.vy = -(1.2 + Math.random() * 1.6) * Math.min(intensity, 2.2); // 上昇速度
      this.radius = 7 + Math.random() * 8;
      this.maxRadius = 40 + Math.random() * 35;
      this.growth = 0.45 + Math.random() * 0.4;
      this.alpha = 0.4 + Math.random() * 0.22;
      this.fade = 0.0035 + Math.random() * 0.004;
      this.rotation = Math.random() * Math.PI * 2;
      this.vRotation = (Math.random() - 0.5) * 0.03;
      this.wobbleSpeed = 0.03 + Math.random() * 0.03;
      this.wobbleAmp = 0.4 + Math.random() * 0.6;
      this.life = 0;
    }

    update() {
      this.life++;
      this.x += this.vx + Math.sin(this.life * this.wobbleSpeed) * this.wobbleAmp;
      this.y += this.vy;
      this.vy *= 0.985;
      if (this.vy > -0.6) this.vy = -0.6;
      if (this.radius < this.maxRadius) {
        this.radius += this.growth;
      }
      this.alpha -= this.fade;
      this.rotation += this.vRotation;
      return this.alpha > 0;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // 紫味のない、自然でリアルなたばこの白煙グラデーション
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${this.alpha * 0.9})`);
      grad.addColorStop(0.45, `rgba(240, 240, 242, ${this.alpha * 0.6})`);
      grad.addColorStop(0.8, `rgba(220, 220, 224, ${this.alpha * 0.2})`);
      grad.addColorStop(1, 'rgba(210, 210, 215, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function initEasterEgg(imgEl) {
    if (!imgEl || imgEl.dataset.smokeInitialized) return;
    imgEl.dataset.smokeInitialized = 'true';

    // ラッパーの準備
    let wrapper = imgEl.parentElement;
    if (!wrapper.classList.contains('smoke-egg-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'smoke-egg-wrapper';
      imgEl.parentNode.insertBefore(wrapper, imgEl);
      wrapper.appendChild(imgEl);
    }

    // Canvas の生成
    const canvas = document.createElement('canvas');
    canvas.className = 'smoke-canvas';
    wrapper.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // タバコ SVG 要素の生成
    const cigEl = document.createElement('div');
    cigEl.className = 'smoke-cigarette';
    cigEl.innerHTML = `
      <svg viewBox="0 0 65 18" width="55" height="15" style="overflow: visible;">
        <!-- フィルター（コルク色） -->
        <rect x="0" y="4" width="16" height="8" rx="1.5" fill="#d99955"/>
        <line x1="14" y1="4" x2="14" y2="12" stroke="#b07536" stroke-width="1"/>
        <!-- 巻紙（白） -->
        <rect x="16" y="4" width="40" height="8" rx="1" fill="#fdfdfd" stroke="#e3e0e8" stroke-width="0.5"/>
        <!-- 先端の灰と火 -->
        <rect x="56" y="4" width="5" height="8" rx="1" fill="#4a4a50"/>
        <circle cx="61" cy="8" r="3.2" fill="#ff4400" class="c-fire"/>
      </svg>
    `;
    wrapper.appendChild(cigEl);

    // 吹き出し要素の生成
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'smoke-bubble';
    bubbleEl.textContent = 'ふぅ…🚬';
    wrapper.appendChild(bubbleEl);

    let particles = [];
    let clickCount = 0;
    let isSmoking = false;
    let clickResetTimer = null;
    let animFrameId = null;

    // Canvas のリサイズ（写真より上・横に広く取る）
    const PADDING_TOP = 140;
    const PADDING_SIDE = 60;
    let dpr = 1;

    function resizeCanvas() {
      const rect = imgEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      dpr = window.devicePixelRatio || 1;
      const w = rect.width + PADDING_SIDE * 2;
      const h = rect.height + PADDING_TOP;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.style.top = -PADDING_TOP + 'px';
      canvas.style.left = -PADDING_SIDE + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // 口元の座標を計算（Canvas 内座標系）
    function getMouthPosition() {
      const rect = imgEl.getBoundingClientRect();
      const isRound = imgEl.classList.contains('speaker-photo');
      // 丸型アイコンと長方形メイン写真での口元調整
      const mouthXRatio = isRound ? 0.52 : 0.51;
      const mouthYRatio = isRound ? 0.61 : 0.57;

      const px = PADDING_SIDE + rect.width * mouthXRatio;
      const py = PADDING_TOP + rect.height * mouthYRatio;
      return { x: px, y: py, rect: rect };
    }

    // タバコと吹き出しの配置更新
    function updateCigarettePosition() {
      const isRound = imgEl.classList.contains('speaker-photo');
      if (isRound) {
        cigEl.style.left = '48%';
        cigEl.style.top = '58%';
        bubbleEl.style.left = '65%';
        bubbleEl.style.top = '8%';
      } else {
        cigEl.style.left = '47%';
        cigEl.style.top = '54%';
        bubbleEl.style.left = '65%';
        bubbleEl.style.top = '15%';
      }
    }

    // アニメーションループ
    function startAnimation() {
      if (!animFrameId) {
        loop();
      }
    }

    function loop() {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      // もくもく中なら口元から自動で煙を生成
      if (isSmoking) {
        const mouth = getMouthPosition();
        // タバコの先端あたり（口元から少し右斜め上）
        const tipX = mouth.x + 40;
        const tipY = mouth.y - 12;

        const spawnRate = clickCount >= 12 ? 4 : (clickCount >= 8 ? 3 : 2);
        for (let i = 0; i < spawnRate; i++) {
          particles.push(new SmokeParticle(tipX, tipY, Math.min(clickCount * 0.25, 3)));
        }
      }

      // パーティクル更新 & 描画
      particles = particles.filter(p => {
        const alive = p.update();
        if (alive) p.draw(ctx);
        return alive;
      });

      if (particles.length > 0 || isSmoking) {
        animFrameId = requestAnimationFrame(loop);
      } else {
        animFrameId = null;
      }
    }

    // クリックイベント
    imgEl.addEventListener('click', (e) => {
      e.preventDefault();
      resizeCanvas();
      updateCigarettePosition();

      clickCount++;

      // クリック位置から小さな煙
      const rect = imgEl.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) + PADDING_SIDE;
      const clickY = (e.clientY - rect.top) + PADDING_TOP;

      for (let i = 0; i < 4; i++) {
        particles.push(new SmokeParticle(clickX, clickY, 1.2));
      }
      startAnimation();

      // 写真のバウンス効果
      imgEl.style.transform = 'scale(0.95)';
      setTimeout(() => { imgEl.style.transform = ''; }, 120);

      // 5回連打でもくもくモード発動！
      if (clickCount >= 5) {
        if (!isSmoking) {
          isSmoking = true;
          cigEl.classList.add('active');
          bubbleEl.classList.add('active');
        }

        // セリフの変化
        if (clickCount >= 16) {
          bubbleEl.textContent = '大炎上もくもく！！🔥';
        } else if (clickCount >= 12) {
          bubbleEl.textContent = 'もくもくもく…！🌫️';
        } else if (clickCount >= 8) {
          bubbleEl.textContent = '一服中…💨';
        } else {
          bubbleEl.textContent = 'ふぅ… 一服。🚬';
        }
      }

      // タイマーリセット（4.5秒操作がなければ鎮火）
      clearTimeout(clickResetTimer);
      clickResetTimer = setTimeout(() => {
        isSmoking = false;
        clickCount = 0;
        cigEl.classList.remove('active');
        bubbleEl.classList.remove('active');
      }, 4500);
    });

    window.addEventListener('resize', () => {
      resizeCanvas();
      updateCigarettePosition();
    });
  }

  // 初期化
  function setup() {
    const targets = document.querySelectorAll('.speaker-photo, .fig-main');
    targets.forEach(img => {
      if (img.complete) {
        initEasterEgg(img);
      } else {
        img.addEventListener('load', () => initEasterEgg(img));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

