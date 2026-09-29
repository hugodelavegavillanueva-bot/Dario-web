/* Maison Archive — theme scripts (vanilla, no dependencies) */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Money ---------- */
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    const fmt = format || (window.theme && window.theme.moneyFormat) || '{{amount}} €';
    const match = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    if (!match) return fmt;
    const withDelimiters = (number, precision, thousands, decimal) => {
      thousands = thousands === undefined ? ',' : thousands;
      decimal = decimal === undefined ? '.' : decimal;
      if (isNaN(number) || number == null) return 0;
      number = (number / 100.0).toFixed(precision);
      const parts = number.split('.');
      const dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      const centsPart = parts[1] ? decimal + parts[1] : '';
      return dollars + centsPart;
    };
    let value;
    switch (match[1]) {
      case 'amount': value = withDelimiters(cents, 2); break;
      case 'amount_no_decimals': value = withDelimiters(cents, 0); break;
      case 'amount_with_comma_separator': value = withDelimiters(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': value = withDelimiters(cents, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': value = withDelimiters(cents, 2, "'", '.'); break;
      default: value = withDelimiters(cents, 2);
    }
    return fmt.replace(match[0], value);
  }

  /* ---------- Header ---------- */
  function initHeader() {
    const header = $('.site-header');
    if (!header) return;
    const setHeight = () => document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    setHeight();
    window.addEventListener('resize', setHeight);
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const firstSection = document.querySelector('main > .shopify-section');
    const overlay = header.classList.contains('site-header--transparent') &&
      document.body.classList.contains('template-index') &&
      firstSection && firstSection.querySelector('.hero');
    document.body.classList.toggle('has-overlay-header', !!overlay);
  }

  /* ---------- Announcement rotation ---------- */
  function initAnnouncement() {
    $$('.announcement').forEach((bar) => {
      const items = $$('.announcement__item', bar);
      if (items.length < 2) return;
      let i = 0;
      setInterval(() => {
        items[i].classList.remove('is-active');
        i = (i + 1) % items.length;
        items[i].classList.add('is-active');
      }, parseInt(bar.dataset.speed || '4500', 10));
    });
  }

  /* ---------- Drawers ---------- */
  let lastFocus = null;
  function openDrawer(id) {
    const drawer = document.getElementById(id);
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    const header = $('.site-header');
    if (header) header.classList.add('menu-open');
    const focusable = $('input, button, a', drawer.querySelector('.drawer__panel'));
    if (focusable) setTimeout(() => focusable.focus(), 120);
  }
  function closeDrawer(drawer) {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    const header = $('.site-header');
    if (header) header.classList.remove('menu-open');
    if (lastFocus) lastFocus.focus();
  }
  function initDrawers() {
    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-drawer-open]');
      if (opener) {
        if (opener.dataset.drawerOpen === 'CartDrawer' && window.theme.cartType === 'page') return;
        e.preventDefault();
        openDrawer(opener.dataset.drawerOpen);
        return;
      }
      if (e.target.closest('[data-drawer-close]')) {
        const drawer = e.target.closest('.drawer');
        if (drawer) closeDrawer(drawer);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      $$('.drawer.is-open').forEach(closeDrawer);
      const lb = $('.lightbox.is-open');
      if (lb) lb.classList.remove('is-open');
    });
  }

  /* ---------- Cart (AJAX) ---------- */
  async function refreshCartDrawer(sectionsHtml) {
    const drawer = document.getElementById('CartDrawer');
    let html = sectionsHtml && sectionsHtml['cart-drawer'];
    if (!html) {
      const res = await fetch(window.theme.routes.root.replace(/\/$/, '') + '/?section_id=cart-drawer');
      html = await res.text();
    }
    if (drawer && html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.getElementById('CartDrawer');
      if (fresh) {
        $('.drawer__panel', drawer).innerHTML = $('.drawer__panel', fresh).innerHTML;
      }
    }
    const cart = await fetch(window.theme.routes.cart + '.js').then((r) => r.json());
    $$('[data-cart-count]').forEach((el) => {
      el.hidden = cart.item_count === 0;
      const span = $('span', el);
      if (span) span.textContent = cart.item_count;
    });
    return cart;
  }

  async function addToCart(form) {
    const button = $('[type="submit"]', form);
    const errorEl = $('.product-form__error', form.closest('[data-product]') || form);
    if (errorEl) errorEl.textContent = '';
    if (button) { button.setAttribute('aria-disabled', 'true'); button.classList.add('is-loading'); }
    const formData = new FormData(form);
    formData.append('sections', 'cart-drawer');
    formData.append('sections_url', window.location.pathname);
    try {
      const res = await fetch(window.theme.routes.cartAdd + '.js', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || data.status) {
        if (errorEl) errorEl.textContent = data.description || data.message || window.theme.strings.error;
        return;
      }
      await refreshCartDrawer(data.sections);
      document.dispatchEvent(new CustomEvent('cart:added'));
      if (window.theme.cartType === 'page') {
        window.location.href = window.theme.routes.cart;
      } else {
        openDrawer('CartDrawer');
      }
    } catch (err) {
      if (errorEl) errorEl.textContent = window.theme.strings.error;
    } finally {
      if (button) { button.removeAttribute('aria-disabled'); button.classList.remove('is-loading'); }
    }
  }

  async function changeLine(key, quantity) {
    const res = await fetch(window.theme.routes.cartChange + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity, sections: 'cart-drawer', sections_url: window.location.pathname })
    });
    const data = await res.json();
    if (document.body.classList.contains('template-cart')) {
      window.location.reload();
      return;
    }
    await refreshCartDrawer(data.sections);
  }

  function initCart() {
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-ajax-cart]');
      if (!form) return;
      e.preventDefault();
      addToCart(form);
    });
    document.addEventListener('click', (e) => {
      const remove = e.target.closest('[data-line-remove]');
      if (remove) {
        e.preventDefault();
        changeLine(remove.dataset.lineRemove, 0);
        return;
      }
      const step = e.target.closest('[data-qty-step]');
      if (step) {
        e.preventDefault();
        const wrap = step.closest('.qty');
        const input = $('input', wrap);
        const next = Math.max(0, parseInt(input.value, 10) + parseInt(step.dataset.qtyStep, 10));
        input.value = next;
        changeLine(wrap.dataset.key, next);
      }
    });
  }

  /* ---------- Product: variants ---------- */
  function initProduct(root) {
    const dataEl = $('[data-product-json]', root);
    if (!dataEl) return;
    const product = JSON.parse(dataEl.textContent);
    const form = $('form[data-ajax-cart]', root);
    const idInput = form && $('input[name="id"]', form);
    const priceEl = $('[data-price]', root);
    const submit = form && $('[type="submit"]', form);
    const submitLabel = submit && $('span', submit);
    const pickers = $$('[data-option-index]', root);

    const currentOptions = () => pickers.map((fs) => {
      const checked = $('input:checked', fs);
      return checked ? checked.value : null;
    });

    function update() {
      const selected = currentOptions();
      const variant = product.variants.find((v) => v.options.every((opt, i) => opt === selected[i]));
      pickers.forEach((fs) => {
        const label = $('[data-selected-value]', fs);
        const checked = $('input:checked', fs);
        if (label && checked) label.textContent = checked.value;
      });
      // mark unavailable combos
      pickers.forEach((fs, idx) => {
        $$('input', fs).forEach((input) => {
          const test = selected.slice();
          test[idx] = input.value;
          const match = product.variants.find((v) => v.options.every((opt, i) => opt === test[i]));
          input.classList.toggle('is-unavailable', !match || !match.available);
        });
      });
      if (!variant) {
        if (submit) { submit.setAttribute('disabled', ''); submitLabel.textContent = window.theme.strings.soldOut; }
        return;
      }
      if (idInput) idInput.value = variant.id;
      if (submit) {
        if (variant.available) {
          submit.removeAttribute('disabled');
          submitLabel.textContent = window.theme.strings.addToCart;
        } else {
          submit.setAttribute('disabled', '');
          submitLabel.textContent = window.theme.strings.soldOut;
        }
      }
      if (priceEl) {
        const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
        priceEl.classList.toggle('price--sale', !!onSale);
        let html = '<span class="price__current">' + formatMoney(variant.price) + '</span>';
        if (onSale) {
          const pct = Math.round((1 - variant.price / variant.compare_at_price) * 100);
          html += '<s class="price__compare">' + formatMoney(variant.compare_at_price) + '</s>';
          html += '<span class="price__saving">−' + pct + '%</span>';
        }
        priceEl.innerHTML = html;
      }
      if (variant.featured_media) {
        const target = root.querySelector('[data-media-id="' + variant.featured_media.id + '"]');
        if (target && window.innerWidth < 990) {
          target.parentElement.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
        }
      }
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
      const sticky = $('.sticky-atc [data-sticky-price]');
      if (sticky) sticky.textContent = formatMoney(variant.price);
    }

    pickers.forEach((fs) => fs.addEventListener('change', update));
    if (pickers.length) update();
  }

  /* ---------- Product gallery ---------- */
  function initGallery(root) {
    const gallery = $('.product-gallery', root);
    if (!gallery) return;
    const dots = $$('.product-gallery__dots span', root);
    if (dots.length) {
      gallery.addEventListener('scroll', () => {
        const items = $$('.product-gallery__item', gallery);
        const idx = Math.round(gallery.scrollLeft / (items[0].offsetWidth || 1));
        dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
      }, { passive: true });
    }
    const lightbox = $('.lightbox', root);
    if (!lightbox) return;
    $$('.product-gallery__item', gallery).forEach((item) => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 990) return;
        lightbox.classList.add('is-open');
        const target = lightbox.querySelector('[data-lightbox-id="' + item.dataset.mediaId + '"]');
        if (target) target.scrollIntoView();
      });
    });
    lightbox.addEventListener('click', () => lightbox.classList.remove('is-open'));
  }

  /* ---------- Sticky add to cart ---------- */
  function initStickyAtc() {
    const bar = $('.sticky-atc');
    const main = $('.product-form__buttons');
    if (!bar || !main || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([entry]) => {
      bar.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }).observe(main);
    const btn = $('button', bar);
    if (btn) btn.addEventListener('click', () => {
      const form = $('form[data-ajax-cart]');
      if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
    });
  }

  /* ---------- Predictive search ---------- */
  function initSearch() {
    const input = $('[data-predictive-search]');
    const results = $('[data-predictive-results]');
    if (!input || !results) return;
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ''; return; }
      timer = setTimeout(async () => {
        try {
          const url = window.theme.routes.predictiveSearch + '?q=' + encodeURIComponent(q) +
            '&resources[type]=product&resources[limit]=8&section_id=predictive-search';
          const html = await fetch(url).then((r) => r.text());
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const content = $('[data-predictive-content]', doc);
          results.innerHTML = content ? content.innerHTML : '';
        } catch (e) { results.innerHTML = ''; }
      }, 250);
    });
  }

  /* ---------- Collection filters ---------- */
  function initFilters() {
    $$('form[data-filter-form]').forEach((form) => {
      form.addEventListener('submit', (e) => { e.preventDefault(); submitFilters(form); });
    });
    $$('select[data-sort-by]').forEach((select) => {
      select.addEventListener('change', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('sort_by', select.value);
        url.searchParams.delete('page');
        window.location.href = url.toString();
      });
    });
    $$('[data-grid-switch] button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const grid = $('[data-collection-grid]');
        if (!grid) return;
        grid.style.setProperty('--cols', btn.dataset.cols);
        grid.style.setProperty('--cols-mobile', btn.dataset.colsMobile);
        $$('[data-grid-switch] button').forEach((b) => b.classList.toggle('is-active', b === btn));
        try { localStorage.setItem('grid-cols', btn.dataset.cols); } catch (e) {}
      });
    });
    try {
      const saved = localStorage.getItem('grid-cols');
      if (saved) {
        const btn = $('[data-grid-switch] button[data-cols="' + saved + '"]');
        if (btn) btn.click();
      }
    } catch (e) {}
  }
  function submitFilters(form) {
    const params = new URLSearchParams(new FormData(form));
    for (const [k, v] of Array.from(params.entries())) { if (v === '') params.delete(k); }
    const sort = new URL(window.location.href).searchParams.get('sort_by');
    if (sort) params.set('sort_by', sort);
    window.location.href = window.location.pathname + '?' + params.toString();
  }

  /* ---------- Product recommendations ---------- */
  function initRecommendations() {
    $$('[data-recommendations-url]').forEach(async (el) => {
      if (el.children.length) return;
      try {
        const html = await fetch(el.dataset.recommendationsUrl).then((r) => r.text());
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const fresh = $('[data-recommendations-url]', doc);
        if (fresh && fresh.innerHTML.trim()) el.innerHTML = fresh.innerHTML;
      } catch (e) {}
    });
  }


  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('[data-toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  /* ---------- Storage helpers ---------- */
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  };

  async function fetchCard(handle) {
    const res = await fetch(window.theme.routes.root.replace(/\/$/, '') + '/products/' + handle + '?section_id=product-card-render');
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const card = $('[data-rendered-card]', doc);
    return card ? card.innerHTML : null;
  }

  /* ---------- Wishlist ---------- */
  const WL = 'ma-wishlist';
  function wishlist() { return store.get(WL, []); }
  function syncWishlistUI() {
    const list = wishlist();
    $$('[data-wishlist-toggle]').forEach((btn) => {
      const on = list.includes(btn.dataset.wishlistToggle);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $$('[data-wishlist-count]').forEach((el) => {
      el.hidden = list.length === 0;
      const span = $('span', el);
      if (span) span.textContent = list.length;
    });
  }
  function initWishlist() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wishlist-toggle]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const handle = btn.dataset.wishlistToggle;
      let list = wishlist();
      if (list.includes(handle)) {
        list = list.filter((h) => h !== handle);
        toast(window.theme.strings.wishlistRemoved);
        const gridItem = btn.closest('[data-wishlist-grid] > *');
        if (gridItem) { gridItem.remove(); if (!list.length) { const empty = $('[data-wishlist-empty]'); if (empty) empty.hidden = false; } }
      } else {
        list.unshift(handle);
        toast(window.theme.strings.wishlistAdded);
      }
      store.set(WL, list);
      syncWishlistUI();
    });
    syncWishlistUI();
    renderHandleGrid($('[data-wishlist-grid]'), wishlist(), $('[data-wishlist-empty]'));
  }
  async function renderHandleGrid(grid, handles, emptyEl) {
    if (!grid) return;
    if (!handles.length) { if (emptyEl) emptyEl.hidden = false; return false; }
    const cards = await Promise.all(handles.map((h) => fetchCard(h).catch(() => null)));
    grid.innerHTML = cards.filter(Boolean).map((c) => '<div>' + c + '</div>').join('');
    if (!grid.children.length && emptyEl) emptyEl.hidden = false;
    syncWishlistUI();
    return grid.children.length > 0;
  }

  /* ---------- Recently viewed ---------- */
  function initRecentlyViewed() {
    const RV = 'ma-recent';
    const current = window.theme.product;
    let list = store.get(RV, []);
    if (current && window.theme.settings && window.theme.settings.recentlyViewed) {
      list = [current].concat(list.filter((h) => h !== current)).slice(0, 12);
      store.set(RV, list);
    }
    $$('[data-recently-viewed]').forEach(async (section) => {
      const limit = parseInt(section.dataset.limit || '4', 10);
      const handles = list.filter((h) => h !== section.dataset.exclude).slice(0, limit);
      if (!handles.length) return;
      const ok = await renderHandleGrid($('[data-recently-viewed-grid]', section), handles);
      if (ok) section.hidden = false;
    });
  }

  /* ---------- Quick view ---------- */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
  }
  function closeModal(m) {
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }
  function initQuickView() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-quick-view]');
      if (btn) {
        e.preventDefault();
        const content = $('[data-quick-view-content]');
        content.innerHTML = '<div class="modal__loading"></div>';
        openModal('QuickView');
        try {
          const url = btn.dataset.quickView.split('?')[0] + '?section_id=quick-view';
          const doc = new DOMParser().parseFromString(await fetch(url).then((r) => r.text()), 'text/html');
          const qv = $('.quick-view', doc);
          content.innerHTML = qv ? qv.outerHTML : '';
          const root = $('[data-product]', content);
          if (root) initProduct(root);
          syncWishlistUI();
        } catch (err) { content.innerHTML = '<p>' + window.theme.strings.error + '</p>'; }
        return;
      }
      if (e.target.closest('[data-modal-close]')) {
        const m = e.target.closest('.modal');
        if (m) closeModal(m);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') $$('.modal.is-open').forEach(closeModal);
    });
    // close quick view after successful add
    document.addEventListener('cart:added', () => $$('.modal.is-open').forEach(closeModal));
  }

  /* ---------- Slideshow ---------- */
  function initSlideshows(ctx = document) {
    $$('[data-slideshow]', ctx).forEach((el) => {
      const slides = $$('.slideshow__slide', el);
      if (slides.length < 2) return;
      const dots = $$('[data-slide-to]', el);
      const counter = $('[data-slide-current]', el);
      let i = 0, timer;
      const go = (n) => {
        slides[i].classList.remove('is-active');
        if (dots[i]) dots[i].classList.remove('is-active');
        i = (n + slides.length) % slides.length;
        slides[i].classList.add('is-active');
        if (dots[i]) { dots[i].classList.remove('is-active'); void dots[i].offsetWidth; dots[i].classList.add('is-active'); }
        if (counter) counter.textContent = String(i + 1).padStart(2, '0');
      };
      const play = () => {
        if (el.dataset.autoplay !== 'true') return;
        clearInterval(timer);
        el.style.setProperty('--slide-speed', (parseInt(el.dataset.speed, 10) || 6000) + 'ms');
        timer = setInterval(() => go(i + 1), parseInt(el.dataset.speed, 10) || 6000);
      };
      dots.forEach((d) => d.addEventListener('click', () => { go(parseInt(d.dataset.slideTo, 10)); play(); }));
      const prev = $('[data-slide-prev]', el), next = $('[data-slide-next]', el);
      if (prev) prev.addEventListener('click', () => { go(i - 1); play(); });
      if (next) next.addEventListener('click', () => { go(i + 1); play(); });
      let x0 = null;
      el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 50) { go(dx < 0 ? i + 1 : i - 1); play(); }
        x0 = null;
      });
      el.classList.toggle('is-autoplay', el.dataset.autoplay === 'true');
      play();
    });
  }

  /* ---------- Carousels ---------- */
  function initCarousels(ctx = document) {
    $$('[data-carousel]', ctx).forEach((el) => {
      const track = $('[data-carousel-track]', el);
      if (!track) return;
      const step = () => { const item = track.firstElementChild; return item ? item.getBoundingClientRect().width + 16 : 300; };
      const prev = $('[data-carousel-prev]', el), next = $('[data-carousel-next]', el);
      if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
      if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
      const bar = $('[data-carousel-progress]', el);
      const update = () => {
        const max = track.scrollWidth - track.clientWidth;
        const ratio = max > 0 ? track.scrollLeft / max : 1;
        if (bar) { const w = Math.max(12, (track.clientWidth / track.scrollWidth) * 100); bar.style.width = w + '%'; bar.style.marginLeft = ratio * (100 - w) + '%'; }
        if (prev) prev.disabled = track.scrollLeft <= 2;
        if (next) next.disabled = track.scrollLeft >= max - 2;
      };
      track.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    });
  }

  /* ---------- Tabs ---------- */
  function initTabs(ctx = document) {
    $$('[data-tabs]', ctx).forEach((el) => {
      const tabs = $$('[data-tab]', el), panels = $$('[data-tab-panel]', el);
      tabs.forEach((t) => t.addEventListener('click', () => {
        tabs.forEach((x) => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
        panels.forEach((p) => { const on = p.dataset.tabPanel === t.dataset.tab; p.hidden = !on; p.classList.toggle('is-active', on); });
        $$('.reveal', el).forEach((r) => r.classList.add('is-visible'));
      }));
    });
  }

  /* ---------- Hotspots ---------- */
  function initHotspots(ctx = document) {
    $$('[data-hotspot]', ctx).forEach((dot) => {
      const section = dot.closest('.section');
      const item = section && section.querySelector('[data-hotspot-item="' + dot.dataset.hotspot + '"]');
      const on = (v) => { dot.classList.toggle('is-active', v); if (item) item.classList.toggle('is-active', v); };
      dot.addEventListener('mouseenter', () => on(true));
      dot.addEventListener('mouseleave', () => on(false));
      dot.addEventListener('click', () => { if (item) { item.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); on(true); setTimeout(() => on(false), 1600); } });
      if (item) { item.addEventListener('mouseenter', () => on(true)); item.addEventListener('mouseleave', () => on(false)); }
    });
  }

  /* ---------- Countdown ---------- */
  function initCountdowns(ctx = document) {
    $$('[data-countdown]', ctx).forEach((el) => {
      const target = new Date(el.dataset.countdown).getTime();
      if (isNaN(target)) return;
      const f = (n) => String(n).padStart(2, '0');
      const tick = () => {
        const d = target - Date.now();
        if (d <= 0) {
          const timer = $('[data-countdown-timer]', el); if (timer) timer.hidden = true;
          const done = $('[data-countdown-done]', el); if (done) done.hidden = false;
          return clearInterval(iv);
        }
        $('[data-cd="d"]', el).textContent = f(Math.floor(d / 864e5));
        $('[data-cd="h"]', el).textContent = f(Math.floor((d % 864e5) / 36e5));
        $('[data-cd="m"]', el).textContent = f(Math.floor((d % 36e5) / 6e4));
        $('[data-cd="s"]', el).textContent = f(Math.floor((d % 6e4) / 1e3));
      };
      const iv = setInterval(tick, 1000);
      tick();
    });
  }

  /* ---------- Count up ---------- */
  function initCounters(ctx = document) {
    const els = $$('[data-count-to]', ctx);
    if (!els.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const el = entry.target, to = parseFloat(el.dataset.countTo) || 0, t0 = performance.now();
        const run = (t) => {
          const p = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(to * e).toLocaleString();
          if (p < 1) requestAnimationFrame(run);
        };
        requestAnimationFrame(run);
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Video toggle ---------- */
  function initVideos(ctx = document) {
    $$('[data-video-toggle]', ctx).forEach((btn) => {
      const video = btn.closest('[data-video-banner]').querySelector('video');
      if (!video) return;
      btn.addEventListener('click', () => {
        if (video.paused) { video.play(); btn.textContent = '❚❚'; } else { video.pause(); btn.textContent = '▶'; }
      });
    });
  }

  /* ---------- Newsletter popup ---------- */
  function initPopup() {
    const popup = $('[data-popup]');
    if (!popup) return;
    const KEY = 'ma-popup-closed';
    const closed = store.get(KEY, 0);
    const days = parseInt(popup.dataset.days || '14', 10);
    const posted = /customer_posted=true/.test(window.location.search) || popup.querySelector('.popup__code');
    const open = () => { popup.classList.add('is-open'); popup.setAttribute('aria-hidden', 'false'); };
    const close = () => { popup.classList.remove('is-open'); popup.setAttribute('aria-hidden', 'true'); store.set(KEY, Date.now()); };
    popup.addEventListener('click', (e) => { if (e.target.closest('[data-popup-close]')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && popup.classList.contains('is-open')) close(); });
    if (posted && window.location.hash.indexOf('PopupNewsletter') > -1) { open(); return; }
    if (closed && Date.now() - closed < days * 864e5) return;
    setTimeout(() => { if (!document.body.classList.contains('is-locked')) open(); }, parseInt(popup.dataset.delay || '8', 10) * 1000);
  }

  /* ---------- Cookie banner (Shopify Customer Privacy API) ---------- */
  function initCookies() {
    const banner = $('[data-cookie-banner]');
    if (!banner) return;
    const show = () => { banner.hidden = false; requestAnimationFrame(() => banner.classList.add('is-visible')); };
    const decide = (accepted) => {
      store.set('ma-cookies', accepted ? 'yes' : 'no');
      const api = window.Shopify && window.Shopify.customerPrivacy;
      if (api && api.setTrackingConsent) {
        api.setTrackingConsent({ analytics: accepted, marketing: accepted, preferences: accepted }, () => {});
      }
      banner.classList.remove('is-visible');
      setTimeout(() => { banner.hidden = true; }, 400);
    };
    $$('[data-cookie]', banner).forEach((b) => b.addEventListener('click', () => decide(b.dataset.cookie === 'accept')));
    if (store.get('ma-cookies', null)) return;
    if (window.Shopify && window.Shopify.loadFeatures) {
      window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }], (err) => {
        const api = window.Shopify.customerPrivacy;
        if (!err && api && api.shouldShowBanner && !api.shouldShowBanner()) return;
        show();
      });
    } else {
      show();
    }
  }

  /* ---------- Back to top, copy, delivery, load more ---------- */
  function initMisc() {
    const btt = $('[data-back-to-top]');
    if (btt) {
      window.addEventListener('scroll', () => btt.classList.toggle('is-visible', window.scrollY > 900), { passive: true });
      btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
    document.addEventListener('click', async (e) => {
      const c = e.target.closest('[data-copy]');
      if (!c) return;
      try { await navigator.clipboard.writeText(c.dataset.copy); toast(window.theme.strings.copied); } catch (err) {}
    });
    $$('[data-delivery]').forEach((el) => {
      const addBusinessDays = (n) => {
        const d = new Date();
        while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
        return d;
      };
      const fmt = (d) => d.toLocaleDateString(document.documentElement.lang || 'es', { weekday: 'short', day: 'numeric', month: 'short' });
      const out = $('[data-delivery-range]', el);
      if (out) out.textContent = fmt(addBusinessDays(parseInt(el.dataset.min, 10))) + ' – ' + fmt(addBusinessDays(parseInt(el.dataset.max, 10)));
    });
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-load-more]');
      if (!btn) return;
      e.preventDefault();
      btn.setAttribute('aria-disabled', 'true');
      try {
        const doc = new DOMParser().parseFromString(await fetch(btn.href).then((r) => r.text()), 'text/html');
        const grid = $('[data-collection-grid]');
        $$('[data-collection-grid] > .grid-item', doc).forEach((item) => grid.appendChild(item));
        const fresh = $('.load-more', doc), wrap = btn.closest('.load-more');
        if (fresh) wrap.replaceWith(fresh); else wrap.remove();
        window.history.replaceState({}, '', btn.href);
        syncWishlistUI();
      } catch (err) { btn.removeAttribute('aria-disabled'); }
    });
    $$('form[data-auto-submit]').forEach((form) => {
      form.addEventListener('change', (e) => { if (!e.target.matches('input[type="number"]')) submitFilters(form); });
    });
  }

  /* ---------- Reveal ---------- */
  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Boot ---------- */
  function boot() {
    window.theme = window.theme || {};
    const body = document.body;
    window.theme.cartType = body.dataset.cartType || 'drawer';
    initHeader();
    initAnnouncement();
    initDrawers();
    initCart();
    $$('[data-product]').forEach((root) => { initProduct(root); initGallery(root); });
    initStickyAtc();
    initSearch();
    initFilters();
    initRecommendations();
    initWishlist();
    initRecentlyViewed();
    initQuickView();
    initSlideshows();
    initCarousels();
    initTabs();
    initHotspots();
    initCountdowns();
    initCounters();
    initVideos();
    initPopup();
    initCookies();
    initMisc();
    initReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Theme editor support
  document.addEventListener('shopify:section:load', (e) => {
    $$('[data-product]', e.target).forEach((root) => { initProduct(root); initGallery(root); });
    $$('.reveal', e.target).forEach((el) => el.classList.add('is-visible'));
    initAnnouncement();
    initSlideshows(e.target);
    initCarousels(e.target);
    initTabs(e.target);
    initHotspots(e.target);
    initCountdowns(e.target);
    initCounters(e.target);
    initVideos(e.target);
  });
})();
