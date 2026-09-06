/* ==========================================================================
   藤井冷熱 — nav.js（ページ遷移の演出）
   ------------------------------------------------------------------------
   スマホでページを移るとき、View Transitions API で短い演出を挟む。
   演出の中身はすべて CSS 側（style.css 47章）にあり、
   ここがやるのは「どの種類の遷移か」を <html data-vt> に書くことだけ。

   種類は4つ。ページ同士の関係で選ぶ。
     fwd   … 同じ導線の中で、深い階層へ進む（採用トップ → 働き方）
     back  … 浅い階層へ戻る。ブラウザバックも含む
     side  … 同じ階層の行き来（働き方 → 仕事を知る）。左右に動かす
     world … お客様の導線と採用の導線をまたぐ。ここだけ斜めのワイプ

   対応していないブラウザでは何も起きない。従来どおり瞬時に切り替わる。
   PC は style.css 側でメディアクエリを外してあるので、この処理は
   走っても演出が付かない。
   ========================================================================== */
(function () {
	'use strict';

	if (!('onpagereveal' in window)) return;

	/* 採用の下層ページ。左右の向きを決めるために順番を持たせる。
	   ヘッダーのメニューの並びと同じ順にしてある。 */
	var SIBS = ['recruit-work.html', 'recruit-job.html', 'recruit-about.html', 'recruit-faq.html'];

	function file(url) {
		if (!url) return '';
		var p = String(url).split('#')[0].split('?')[0];
		var f = p.substring(p.lastIndexOf('/') + 1);
		return f || 'index.html';
	}

	function sameSite(url) {
		if (!url) return false;
		try { return new URL(url, location.href).origin === location.origin; }
		catch (e) { return false; }
	}

	/* 0 = お客様のトップ、1 = 採用のトップ、2 = 採用の下層 */
	function depth(f) {
		if (f === 'index.html') return 0;
		if (f === 'recruit.html') return 1;
		return 2;
	}

	function world(f) {
		return f.indexOf('recruit') === 0 ? 'recruit' : 'client';
	}

	function kind(fromUrl, toUrl, navType) {
		var to = file(toUrl);
		if (!sameSite(fromUrl)) return 'fwd';
		var from = file(fromUrl);
		if (from === to) return 'fwd';

		if (world(from) !== world(to)) return 'world';
		if (navType === 'traverse') return 'back';

		var df = depth(from), dt = depth(to);
		if (dt > df) return 'fwd';
		if (dt < df) return 'back';

		/* 同じ階層。メニューの並び順で左右を決める。 */
		var i = SIBS.indexOf(from), j = SIBS.indexOf(to);
		if (i > -1 && j > -1) return j > i ? 'side' : 'side-r';
		return 'fwd';
	}

	/* 入ってくるページの1画面目は、演出が始まる前に出し切っておく。
	   ここを既存のスクロール演出に任せると、遷移が終わってから
	   見出しが立ち上がることになり、二段階に見えて遅く感じる。 */
	function settleFirstScreen() {
		var tops = document.querySelectorAll('.p-hero, .p-rhero, .l-pagehead');
		var sel = '.js-fadein, .js-inview-lines, .js-inview-digits, .js-inview-draw, .js-inview-zoom, .js-inview-sheen';
		Array.prototype.forEach.call(tops, function (sec) {
			Array.prototype.forEach.call(sec.querySelectorAll(sel), function (el) {
				el.classList.add('is-inview', 'is-done');
			});
			if (sec.matches(sel)) sec.classList.add('is-inview', 'is-done');
		});
	}

	window.addEventListener('pagereveal', function (e) {
		if (!e.viewTransition) return;

		var from = '', type = '';
		var act = window.navigation && window.navigation.activation;
		if (act) {
			from = act.from ? act.from.url : '';
			type = act.navigationType;
		} else {
			from = document.referrer;
			var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
			if (nav && nav.type === 'back_forward') type = 'traverse';
		}

		var root = document.documentElement;
		root.dataset.vt = kind(from, location.href, type);
		settleFirstScreen();

		e.viewTransition.finished.then(clear, clear);
		function clear() { delete root.dataset.vt; }
	});

	/* 出ていく側。演出中にドロワーが開いたままだと写り込むので閉じる。 */
	window.addEventListener('pageswap', function (e) {
		if (!e.viewTransition) return;
		document.documentElement.classList.remove('is-drawer-open');
	});
})();
