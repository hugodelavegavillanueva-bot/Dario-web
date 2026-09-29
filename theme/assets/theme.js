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
    initReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Theme editor support
  document.addEventListener('shopify:section:load', (e) => {
    $$('[data-product]', e.target).forEach((root) => { initProduct(root); initGallery(root); });
    $$('.reveal', e.target).forEach((el) => el.classList.add('is-visible'));
    initAnnouncement();
  });
})();
