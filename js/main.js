/* ==========================================================================
   藤井冷熱 — main.js
   ------------------------------------------------------------------------
   1. 見出しを行に割る（行マスクで1行ずつ起こすため）
   2. 数字を桁に割る（電話番号を1桁ずつ立ち上げるため）
   3. まとまりの中で順番に出す（data-seq）
   4. 出現の監視
   5. 数字のカウントアップ
   6. SVGの線の実長を測って描く
   7. ボタン：ポインタが入った位置から塗りを広げる
   8. ヘッダーの状態
   すべて prefers-reduced-motion を尊重する。
   ========================================================================== */
(function () {
	'use strict';

	var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* ------------------------------------------------------------------
	   1. 見出しを行に割る
	      <br> で区切って、1行ずつマスクの中に入れる。
	      行の高さは line-height のままなので、割っても字送りは変わらない。
	   ------------------------------------------------------------------ */
	function splitLines() {
		document.querySelectorAll('.js-inview-lines').forEach(function (el) {
			if (el.dataset.split) return;
			var parts = el.innerHTML.split(/<br\s*\/?>/i);
			el.innerHTML = parts.map(function (p) {
				return '<span class="ln"><i class="js-inview-ln">' + p + '</i></span>';
			}).join('');
			el.dataset.split = '1';
			var step = parseInt(el.getAttribute('data-line-step'), 10) || 105;
			var base = parseFloat(el.style.getPropertyValue('--d')) || 0;
			el.querySelectorAll('.js-inview-ln').forEach(function (i, n) {
				i.style.setProperty('--d', (base + n * step) + 'ms');
			});
		});
	}

	/* ------------------------------------------------------------------
	   2. 数字を桁に割る
	   ------------------------------------------------------------------ */
	function splitDigits() {
		document.querySelectorAll('.js-inview-digits').forEach(function (el) {
			if (el.dataset.split) return;
			var txt = el.textContent;
			var step = parseInt(el.getAttribute('data-digit-step'), 10) || 34;
			el.textContent = '';
			txt.split('').forEach(function (ch, n) {
				var s = document.createElement('span');
				s.className = 'dg js-inview-dg';
				s.style.setProperty('--dd', (n * step) + 'ms');
				s.textContent = ch;
				el.appendChild(s);
			});
			el.dataset.split = '1';
		});
	}

	/* ------------------------------------------------------------------
	   3. まとまりの中で順番に出す
	      data-seq="120"      … 子を120msずつずらす
	      data-seq-from="400" … 全体の開始を400ms遅らせる
	   ------------------------------------------------------------------ */
	function buildSequences() {
		document.querySelectorAll('[data-seq]').forEach(function (group) {
			var step = parseInt(group.getAttribute('data-seq'), 10) || 90;
			var from = parseInt(group.getAttribute('data-seq-from'), 10) || 0;
			var kids = group.querySelectorAll(':scope > .js-fadein, :scope > .js-inview-lines, :scope > .js-inview-draw, :scope > * > .js-fadein');
			Array.prototype.forEach.call(kids, function (el, i) {
				if (el.style.getPropertyValue('--d')) return;
				el.style.setProperty('--d', (from + i * step) + 'ms');
			});
		});
	}

	/* ------------------------------------------------------------------
	   4. 出現の監視
	   ------------------------------------------------------------------ */
	function initReveal() {
		var sel = '.js-fadein, .js-inview-lines, .js-inview-draw, .js-inview-digits, .js-inview-sheen, .js-inview-zoom, .p-zbar';
		var targets = document.querySelectorAll(sel);
		if (!targets.length) return;

		// 演出の所要時間を過ぎたら is-done を付ける。
		// これが無いと、トランジションが完走しなかった環境で
		// 要素が永久に隠れたままになる。
		function show(el) {
			el.classList.add('is-inview');
			var d = parseFloat(el.style.getPropertyValue('--d')) || 0;
			setTimeout(function () { el.classList.add('is-done'); }, d + 1500);
		}

		if (reduce || !('IntersectionObserver' in window)) {
			targets.forEach(show);
			return;
		}

		// ページ全体がビューポートに収まっている場合（全画面キャプチャ等）は
		// 監視を待たずに全部出す。撮影結果を決定的にするため。
		if (document.documentElement.scrollHeight <= window.innerHeight + 4) {
			targets.forEach(show);
			return;
		}

		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) return;
				show(entry.target);
				io.unobserve(entry.target);
			});
			// 画面に入りきる前に動きはじめる。入り切ってから始めると
			// 速くスクロールされたときに「何も無い区間」に見える。
		}, { rootMargin: '0px 0px 8% 0px', threshold: 0 });

		targets.forEach(function (el) {
			if (el.closest('[data-reveal="load"]')) {
				// rAF は使わない。タブが裏や省電力だと止まり、
				// その間コンテンツが消えたままになる。
				setTimeout(function () { show(el); }, 20);
				return;
			}
			io.observe(el);
		});

		// 保険その2。IntersectionObserver のコールバックが来ない状況
		// （タブが裏で凍っている、対応が古い等）でも取りこぼさないよう、
		// スクロールでも拾う。処理対象は出したぶんだけ減っていく。
		var pending = Array.prototype.slice.call(targets).filter(function (el) {
			return !el.closest('[data-reveal="load"]');
		});
		var ticking = false;

		function sweep() {
			ticking = false;
			if (!pending.length) return;
			var vh = window.innerHeight;
			pending = pending.filter(function (el) {
				if (el.classList.contains('is-inview')) return false;
				var r = el.getBoundingClientRect();
				if (r.top < vh * 1.08 && r.bottom > -40) { show(el); return false; }
				return true;
			});
		}

		function onScroll() {
			if (ticking) return;
			ticking = true;
			setTimeout(sweep, 100);
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		setTimeout(sweep, 900);
	}

	/* ------------------------------------------------------------------
	   5. 数字のカウントアップ
	      HTMLには最終値を書いておく。JSは表示に入った瞬間だけ0から数え直す。
	   ------------------------------------------------------------------ */
	function initCount() {
		var els = document.querySelectorAll('.js-count');
		if (!els.length || reduce || !('IntersectionObserver' in window)) return;

		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) return;
				io.unobserve(entry.target);
				run(entry.target);
			});
		}, { threshold: 0.6 });

		els.forEach(function (el) { io.observe(el); });

		function run(el) {
			var final = el.textContent;
			var m = final.match(/^(\D*)(\d+)(?:(\D+)(\d+))?(\D*)$/);
			if (!m) return;
			var pre = m[1] || '', a = parseInt(m[2], 10);
			var sep = m[3] || '', b = m[4] ? parseInt(m[4], 10) : null;
			var post = m[5] || '';
			var delay = parseInt(el.getAttribute('data-count-delay'), 10) || 0;
			var dur = 1150, t0 = null, done = false;

			function finish() {
				if (done) return;
				done = true;
				el.textContent = final;
			}

			function frame(t) {
				// 保険が先に走った後にフレームが来ると、
				// 最終値を途中の値で上書きしてしまう。必ず抜ける。
				if (done) return;
				if (t0 === null) t0 = t;
				var p = Math.min((t - t0) / dur, 1);
				var e = 1 - Math.pow(1 - p, 3);
				el.textContent = b !== null
					? pre + Math.round(a * e) + sep + Math.round(b * e) + post
					: pre + Math.round(a * e) + post;
				if (p < 1) requestAnimationFrame(frame);
				else finish();
			}
			// rAF が止まる環境でも必ず最終値になるよう、保険を置く。
			setTimeout(function () { requestAnimationFrame(frame); }, delay);
			setTimeout(finish, delay + dur + 400);
		}
	}

	/* ------------------------------------------------------------------
	   6. SVGの線を実長で測って描く
	      固定値にすると線を変えたとき破綻するので、必ず測る。
	   ------------------------------------------------------------------ */
	function initDraw() {
		document.querySelectorAll('.js-inview-draw').forEach(function (svg) {
			svg.querySelectorAll('path, polyline').forEach(function (p) {
				var len;
				try { len = p.getTotalLength(); } catch (e) { len = 1200; }
				if (!len || !isFinite(len)) len = 1200;
				p.style.setProperty('--len', Math.ceil(len));
			});
		});
	}

	/* ------------------------------------------------------------------
	   7. ボタン：ポインタが入った位置から塗りを広げる
	      「面のどこを押したか」が返るので、板を押した感じになる。
	   ------------------------------------------------------------------ */
	function initButtons() {
		if (reduce) return;
		document.querySelectorAll('.c-btn').forEach(function (btn) {
			function origin(e) {
				var r = btn.getBoundingClientRect();
				btn.style.setProperty('--mx', (e.clientX - r.left) + 'px');
				btn.style.setProperty('--my', (e.clientY - r.top) + 'px');
			}
			btn.addEventListener('pointerenter', origin);
			btn.addEventListener('pointerdown', origin);
		});
	}

	/* ------------------------------------------------------------------
	   8. 電話の開示
	      番号を常時表示しない。押したら現れて、そこからかける。
	   ------------------------------------------------------------------ */
	function initTel() {
		document.querySelectorAll('.c-tel__trigger').forEach(function (btn) {
			var wrap = btn.closest('.c-tel');
			var panel = wrap && wrap.querySelector('.c-tel__panel');
			if (!panel) return;
			var label = btn.querySelector('span');
			var openText = btn.getAttribute('data-open-text') || '番号を隠す';
			var closeText = label ? label.textContent : '';

			btn.addEventListener('click', function () {
				var open = wrap.classList.contains('is-open');
				if (open) {
					wrap.classList.remove('is-open');
					btn.setAttribute('aria-expanded', 'false');
					if (label) label.textContent = closeText;
					setTimeout(function () {
						if (!wrap.classList.contains('is-open')) panel.hidden = true;
					}, 380);
				} else {
					panel.hidden = false;
					// hidden を外した直後だと遷移が走らないので1フレーム待つ。
					// rAF が来ない環境（ヘッドレス等）でも必ず開くよう、
					// タイマーでも保険をかける。
					setTimeout(function () {
						wrap.classList.add('is-open');
					}, 30);
					btn.setAttribute('aria-expanded', 'true');
					if (label) label.textContent = openText;
				}
			});
		});

		// ヘッダーの開示は、外側を押したら閉じる
		document.addEventListener('click', function (e) {
			document.querySelectorAll('.c-tel--head.is-open').forEach(function (wrap) {
				if (wrap.contains(e.target)) return;
				var btn = wrap.querySelector('.c-tel__trigger');
				if (btn) btn.click();
			});
		});
	}

	/* ------------------------------------------------------------------
	   9. ヘッダー
	   ------------------------------------------------------------------ */
	function initHeader() {
		var head = document.querySelector('.l-header');
		if (!head) return;
		var last = null;
		function onScroll() {
			var on = window.scrollY > 24;
			if (on !== last) { head.classList.toggle('is-scrolled', on); last = on; }
		}
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
	}

	/* ------------------------------------------------------------------
	   10. アコーディオン（よくある質問）
	       高さは触らず grid-template-rows で開閉する。
	       中身の量が変わっても壊れない。
	   ------------------------------------------------------------------ */
	function initAccordion() {
		document.querySelectorAll('.c-acc__q').forEach(function (btn) {
			var item = btn.closest('.c-acc__item');
			var panel = item && item.querySelector('.c-acc__a');
			if (!panel) return;
			if (!panel.id) panel.id = 'acc-' + Math.random().toString(36).slice(2, 8);
			btn.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');
			btn.setAttribute('aria-controls', panel.id);

			btn.addEventListener('click', function () {
				var open = item.classList.toggle('is-open');
				btn.setAttribute('aria-expanded', open ? 'true' : 'false');
			});
		});
	}

	/* ------------------------------------------------------------------
	   11. カテゴリのタブ
	   ------------------------------------------------------------------ */
	function initTabs() {
		document.querySelectorAll('[data-tabs]').forEach(function (nav) {
			var btns = nav.querySelectorAll('button[data-tab]');
			btns.forEach(function (btn) {
				btn.addEventListener('click', function () {
					var key = btn.getAttribute('data-tab');
					btns.forEach(function (b) {
						var on = b === btn;
						b.classList.toggle('is-active', on);
						b.setAttribute('aria-selected', on ? 'true' : 'false');
					});
					document.querySelectorAll('[data-tabpanel]').forEach(function (p) {
						p.hidden = p.getAttribute('data-tabpanel') !== key;
					});
				});
			});
		});
	}


	/* ------------------------------------------------------------------
	   10. アコーディオン
	      高さは grid-template-rows: 0fr → 1fr で開く。
	      max-height を決め打ちしないので、中身が伸びても破綻しない。
	   ------------------------------------------------------------------ */
	function initAcc() {
		document.querySelectorAll('.c-acc__q').forEach(function (btn) {
			var item = btn.closest('.c-acc__item');
			if (!item) return;
			btn.setAttribute('aria-expanded', 'false');
			btn.addEventListener('click', function () {
				var open = item.classList.toggle('is-open');
				btn.setAttribute('aria-expanded', open ? 'true' : 'false');
			});
		});
	}

	/* ------------------------------------------------------------------ */

	/* スマホのメニュー。開いている間は背面をスクロールさせない。 */
	function initDrawer() {
		var btn = document.querySelector('.js-drawer');
		var dr = document.getElementById('drawer');
		if (!btn || !dr) return;
		var y = 0;

		function open() {
			y = window.scrollY;
			dr.hidden = false;
			// hidden を外した直後だと transition が効かないので1フレーム待つ
			setTimeout(function () { dr.classList.add('is-open'); }, 10);
			btn.setAttribute('aria-expanded', 'true');
			// ドロワーはヘッダーより上に重なるので、そのままだと
			// 閉じるボタン（ヘッダー内）が押せなくなる。開いている間だけ持ち上げる。
			document.documentElement.classList.add('is-drawer-open');
			document.body.style.position = 'fixed';
			document.body.style.top = -y + 'px';
			document.body.style.width = '100%';
		}
		function close() {
			dr.classList.remove('is-open');
			btn.setAttribute('aria-expanded', 'false');
			document.documentElement.classList.remove('is-drawer-open');
			document.body.style.position = '';
			document.body.style.top = '';
			document.body.style.width = '';
			window.scrollTo(0, y);
			setTimeout(function () { dr.hidden = true; }, 320);
		}
		btn.addEventListener('click', function () {
			dr.hidden ? open() : close();
		});
		// 背景を押したら閉じる
		dr.addEventListener('click', function (e) {
			if (e.target === dr) close();
		});
		// リンクを押したら閉じる（同じページ内のアンカーでも閉じる必要がある）
		dr.querySelectorAll('a').forEach(function (a) {
			a.addEventListener('click', close);
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && !dr.hidden) close();
		});
	}


	/* 代表紹介の開閉。既定は閉じておく。 */
	/* 折りたたみの中身は、共有の監視では扱えない。
	   畳まれている間に一度「画面内」と判定されて監視を外されており、
	   開いてから付け直しても再通知が来ないため。
	   開くたびに専用の監視を作り直す。 */
	function stage(panel) {
		var nodes = [].slice.call(panel.querySelectorAll('.js-ceo-r'));
		if (!nodes.length) return;
		nodes.forEach(function (el) { el.classList.remove('is-inview', 'is-done'); });

		function show(el) {
			el.classList.add('is-inview');
			var d = parseFloat(el.style.getPropertyValue('--d')) || 0;
			setTimeout(function () { el.classList.add('is-done'); }, d + 1500);
		}
		if (reduce || !('IntersectionObserver' in window)) { nodes.forEach(show); return; }

		// パネルが開ききってから監視を始める。
		// 開いている途中は高さが足りず、画面内と判定されない。
		setTimeout(function () {
			var o = new IntersectionObserver(function (es) {
				es.forEach(function (e) {
					if (!e.isIntersecting) return;
					show(e.target);
					o.unobserve(e.target);
				});
			}, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
			nodes.forEach(function (el) { o.observe(el); });
			// 監視が働かない環境でも必ず出す最終防衛線
			setTimeout(function () { nodes.forEach(show); }, 6000);
		}, 480);
	}

	function initCeo() {
		var btn = document.querySelector('.js-ceo');
		if (!btn) return;
		/* ヒーローの丸写真から開く。開いてから移動しないと、
		   スクロール先の高さが変わって位置がずれる。 */
		var jump = document.querySelector('.js-open-ceo');
		if (jump) {
			jump.addEventListener('click', function () {
				if (btn.getAttribute('aria-expanded') !== 'true') btn.click();
				setTimeout(function () {
					var sec = document.getElementById('ceo');
					if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}, 60);
			});
		}
		var panel = document.getElementById(btn.getAttribute('aria-controls'));
		var label = btn.querySelector('.p-ceo__toggle__t');
		btn.addEventListener('click', function () {
			var open = btn.getAttribute('aria-expanded') !== 'true';
			btn.setAttribute('aria-expanded', open ? 'true' : 'false');
			panel.classList.toggle('is-open', open);
			if (open) stage(panel);
			if (label) label.textContent = open ? '閉じる' : '代表の考えを読む';
		});
	}

	function init() {
		splitLines();
		splitDigits();
		buildSequences();
		initDraw();
		initReveal();
		initCount();
		initButtons();
		initTel();
		initAccordion();
		initTabs();
		initHeader();
		initDrawer();
		initCeo();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
