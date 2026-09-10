// Each gift-grid section instance on the page runs independently - no
// Liquid-injected id needed, we just scope every query to this root.
document.querySelectorAll('.gift-grid').forEach(function (root) {

    // Maps common color-option values to a swatch hex, since Shopify only
    // gives us the option's text value, not an actual color. "White" falls
    // back to a visible gray since true white would disappear on the pill's
    // white background; anything unrecognized falls back to neutral gray.
    var COLOR_SWATCH_MAP = {
      black: '#000000',
      white: '#bbbbbb',
      grey: '#808080',
      gray: '#808080',
      blue: '#2b4fa2',
      navy: '#1b2a4a',
      red: '#c0392b',
      maroon: '#6e1e2c',
      burgundy: '#5c1a2b',
      green: '#2e7d32',
      olive: '#6b6b2a',
      khaki: '#c3b091',
      yellow: '#f1c40f',
      gold: '#c9a227',
      pink: '#e59ab3',
      purple: '#7d3c98',
      lavender: '#b49bc9',
      orange: '#e07a2c',
      brown: '#6b4423',
      tan: '#d2b48c',
      beige: '#e8dcc8',
      cream: '#f2e8d5',
      teal: '#1a7a6e',
      turquoise: '#30bfa4',
      cyan: '#3fb8c9',
      silver: '#c0c0c0',
    };

    function getSwatchColor(value) {
      var key = (value || '').trim().toLowerCase();
      return COLOR_SWATCH_MAP[key] || '#cccccc';
    }

    // Products often use different conventions for the same size ("Medium"
    // vs "M" vs "Med"), so the cross-sell rule below normalizes both the
    // configured trigger value and the variant's actual option value to a
    // common form before comparing, instead of requiring an exact match.
    var SIZE_SYNONYMS = {
      'extra small': 'xs',
      xs: 'xs',
      small: 's',
      s: 's',
      medium: 'm',
      med: 'm',
      m: 'm',
      large: 'l',
      l: 'l',
      'extra large': 'xl',
      xl: 'xl',
      'extra extra large': 'xxl',
      xxl: 'xxl',
      '2xl': 'xxl',
    };

    function normalizeOptionValue(value) {
      var key = (value || '').trim().toLowerCase();
      return SIZE_SYNONYMS[key] || key;
    }

    var overlay = root.querySelector('[data-gift-grid-overlay]');
    var backdrop = root.querySelector('[data-gift-grid-backdrop]');
    var modal = root.querySelector('[data-gift-grid-modal]');
    var modalImage = root.querySelector('[data-gift-grid-modal-image]');
    var modalTitle = root.querySelector('[data-gift-grid-modal-title]');
    var modalPrice = root.querySelector('[data-gift-grid-modal-price]');
    var modalDescription = root.querySelector('[data-gift-grid-modal-description]');
    var modalOptions = root.querySelector('[data-gift-grid-modal-options]');
    var modalMessage = root.querySelector('[data-gift-grid-modal-message]');
    var addToCartBtn = root.querySelector('[data-gift-grid-add-to-cart]');
    var addToCartLabel = addToCartBtn.querySelector('.gift-grid__btn-label');
    var closeButton = root.querySelector('[data-gift-grid-close]');

    var trigger1 = normalizeOptionValue(root.dataset.trigger1);
    var trigger2 = normalizeOptionValue(root.dataset.trigger2);
    var bonusVariantId = root.dataset.bonusVariantId;

    var selected = [];
    var resolvedVariant = null;

    function openOverlay() {
      overlay.hidden = false;
      document.documentElement.classList.add('gift-grid-lock-scroll');
    }

    function closeOverlay() {
      overlay.hidden = true;
      modal.hidden = true;
      document.documentElement.classList.remove('gift-grid-lock-scroll');
    }

    function setBackdrop(imageUrl) {
      backdrop.style.backgroundImage = imageUrl ? 'url(' + imageUrl + ')' : 'none';
    }

    // Positions the modal card over the tile that was actually clicked
    // (rather than always dead-center of the viewport), clamped so it never
    // renders off-screen regardless of where that tile sits in the grid.
    function positionModalNear(triggerEl) {
      var card = modal.querySelector('.gift-grid__modal-card');
      if (!triggerEl || !card) return;

      var rect = triggerEl.getBoundingClientRect();
      var margin = 16;
      var cardWidth = card.offsetWidth;
      var cardHeight = card.offsetHeight;

      var left = rect.left + rect.width / 2 - cardWidth / 2;
      var top = rect.top + rect.height / 2 - cardHeight / 2;

      var maxLeft = Math.max(margin, window.innerWidth - cardWidth - margin);
      var maxTop = Math.max(margin, window.innerHeight - cardHeight - margin);

      card.style.position = 'fixed';
      card.style.margin = '0';
      card.style.left = Math.min(Math.max(left, margin), maxLeft) + 'px';
      card.style.top = Math.min(Math.max(top, margin), maxTop) + 'px';
    }

    // The mini popup (image/name/price) lives inline in each tile and is
    // just toggled open/closed; only one can be open at a time and the
    // hotspot's "+" morphs into "x" while it is.
    function closeMiniPopup(hotspot) {
      var anchor = hotspot.closest('.gift-grid__anchor');
      anchor.querySelector('[data-gift-grid-mini]').hidden = true;
      hotspot.setAttribute('aria-expanded', 'false');
      hotspot.classList.remove('is-open');
    }

    function closeAllMiniPopups() {
      root.querySelectorAll('[data-gift-grid-hotspot].is-open').forEach(closeMiniPopup);
    }

    // Closes any open custom size/etc. dropdown (see buildOptionControls).
    function closeAllSelectLists() {
      modalOptions.querySelectorAll('.gift-grid__select-list').forEach(function (list) {
        list.hidden = true;
      });
      modalOptions.querySelectorAll('.gift-grid__select-toggle').forEach(function (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
      });
    }

    // Resolves the variant matching the current option selections. Variant
    // "options" arrays are positional (e.g. ["Blue", "Small"]), so once every
    // position has a value we can match them directly against each variant.
    function updateVariant(product) {
      resolvedVariant = null;
      var allSelected = selected.length && selected.indexOf(null) === -1 && selected.indexOf('') === -1;

      if (allSelected) {
        for (var i = 0; i < product.variants.length; i++) {
          var variant = product.variants[i];
          var isMatch = variant.options.length === selected.length;
          for (var j = 0; isMatch && j < variant.options.length; j++) {
            if (variant.options[j] !== selected[j]) isMatch = false;
          }
          if (isMatch) {
            resolvedVariant = variant;
            break;
          }
        }
      }

      modalMessage.hidden = true;

      if (resolvedVariant) {
        modalPrice.textContent = resolvedVariant.price;
        addToCartBtn.disabled = !resolvedVariant.available;
        addToCartLabel.textContent = resolvedVariant.available ? 'Add to cart' : 'Sold out';
      } else {
        modalPrice.textContent = product.price;
        addToCartBtn.disabled = true;
        addToCartLabel.textContent = 'Add to cart';
      }
    }

    // Builds one control per product option. Small option sets named
    // "Color"/"Colour" get the sliding pill selector and are always shown
    // first (before Size etc.), regardless of the option order set in
    // Shopify admin. Rebuilt fresh per product since option count/names vary.
    function buildOptionControls(product) {
      modalOptions.innerHTML = '';
      selected = product.options.map(function () {
        return null;
      });

      // Keep each option's original index (used to read/write `selected`
      // and to match against `variant.options`, which stay in admin order)
      // while displaying color options first.
      var displayOrder = product.options.map(function (option, index) {
        return { option: option, index: index };
      });
      displayOrder.sort(function (a, b) {
        var aIsColor = /colou?r/i.test(a.option.name) ? 0 : 1;
        var bIsColor = /colou?r/i.test(b.option.name) ? 0 : 1;
        return aIsColor - bIsColor;
      });

      displayOrder.forEach(function (entry) {
        var option = entry.option;
        var index = entry.index;
        var group = document.createElement('div');
        group.className = 'gift-grid__option-group';

        var label = document.createElement('p');
        label.className = 'gift-grid__option-label';
        label.textContent = option.name;
        group.appendChild(label);

        var isSwatchStyle = /colou?r/i.test(option.name) && option.values.length <= 4;

        if (isSwatchStyle) {
          var pillWrap = document.createElement('div');
          pillWrap.className = 'gift-grid__pills';
          pillWrap.style.setProperty('--count', option.values.length);

          // Indicator slides between buttons via translateX(index * 100%);
          // each button occupies an equal share of the row (--count).
          var indicator = document.createElement('span');
          indicator.className = 'gift-grid__pill-indicator';
          pillWrap.appendChild(indicator);

          option.values.forEach(function (value, valueIndex) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gift-grid__pill';

            var swatch = document.createElement('span');
            swatch.className = 'gift-grid__pill-swatch';
            swatch.style.background = getSwatchColor(value);
            swatch.setAttribute('aria-hidden', 'true');
            btn.appendChild(swatch);

            var pillLabel = document.createElement('span');
            pillLabel.className = 'gift-grid__pill-label';
            pillLabel.textContent = value;
            btn.appendChild(pillLabel);

            btn.addEventListener('click', function () {
              selected[index] = value;
              pillWrap.querySelectorAll('.gift-grid__pill').forEach(function (b) {
                b.classList.remove('is-selected');
              });
              btn.classList.add('is-selected');
              indicator.style.opacity = '1';
              indicator.style.transform = 'translateX(' + valueIndex * 100 + '%)';
              updateVariant(product);
            });
            pillWrap.appendChild(btn);
          });

          group.appendChild(pillWrap);
        } else {
          // Native <select> options can't be reliably styled (the open list
          // is rendered by the OS/browser shell, not the page), so this is a
          // custom button + listbox instead - fully stylable hover/selected
          // states, same look everywhere.
          var selectWrap = document.createElement('div');
          selectWrap.className = 'gift-grid__select-wrap';

          var toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'gift-grid__select-toggle';
          toggle.setAttribute('aria-haspopup', 'listbox');
          toggle.setAttribute('aria-expanded', 'false');

          var valueLabel = document.createElement('span');
          valueLabel.className = 'gift-grid__select-value';
          valueLabel.textContent = 'Choose your ' + option.name.toLowerCase();
          toggle.appendChild(valueLabel);

          var chevron = document.createElement('span');
          chevron.className = 'gift-grid__select-chevron';
          chevron.setAttribute('aria-hidden', 'true');
          chevron.innerHTML =
            '<svg viewBox="0 0 12 8" fill="none"><path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          toggle.appendChild(chevron);

          var list = document.createElement('ul');
          list.className = 'gift-grid__select-list';
          list.setAttribute('role', 'listbox');
          list.hidden = true;

          option.values.forEach(function (value) {
            var item = document.createElement('li');
            item.className = 'gift-grid__select-option';
            item.setAttribute('role', 'option');
            item.textContent = value;
            item.addEventListener('click', function () {
              selected[index] = value;
              valueLabel.textContent = value;
              list.querySelectorAll('.gift-grid__select-option').forEach(function (li) {
                li.classList.remove('is-selected');
              });
              item.classList.add('is-selected');
              closeAllSelectLists();
              updateVariant(product);
            });
            list.appendChild(item);
          });

          toggle.addEventListener('click', function (event) {
            event.stopPropagation();
            var wasOpen = !list.hidden;
            closeAllSelectLists();
            if (wasOpen) return;
            list.hidden = false;
            toggle.setAttribute('aria-expanded', 'true');
          });

          selectWrap.appendChild(toggle);
          selectWrap.appendChild(list);
          group.appendChild(selectWrap);
        }

        modalOptions.appendChild(group);
      });
    }

    function openModal(product, triggerTile) {
      setBackdrop(product.image);
      modalImage.src = product.image;
      modalImage.alt = product.title;
      modalTitle.textContent = product.title;
      modalPrice.textContent = product.price;
      modalDescription.innerHTML = product.description;

      buildOptionControls(product);
      updateVariant(product);

      modal.hidden = false;
      openOverlay();
      // Card must be visible (and its final content in place) before we can
      // measure its rendered size to position it.
      positionModalNear(triggerTile);
    }

    function getTileProduct(tile) {
      return JSON.parse(tile.querySelector('script[data-product-json]').textContent);
    }

    // Hotspot click toggles that tile's inline mini popup open/closed ("+"
    // morphs into "x"); opening one closes any other that's open.
    root.querySelectorAll('[data-gift-grid-hotspot]').forEach(function (hotspot) {
      hotspot.addEventListener('click', function (event) {
        event.stopPropagation();
        var wasOpen = hotspot.classList.contains('is-open');
        closeAllMiniPopups();
        if (wasOpen) return;

        var anchor = hotspot.closest('.gift-grid__anchor');
        anchor.querySelector('[data-gift-grid-mini]').hidden = false;
        hotspot.setAttribute('aria-expanded', 'true');
        hotspot.classList.add('is-open');
      });
    });

    // Clicking the mini card's content opens the full quick-view modal.
    root.querySelectorAll('[data-gift-grid-mini-card]').forEach(function (card) {
      card.addEventListener('click', function () {
        var tile = card.closest('.gift-grid__tile');
        closeAllMiniPopups();
        openModal(getTileProduct(tile), tile);
      });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          card.click();
        }
      });
    });

    // Clicking anywhere outside an open mini popup / dropdown closes it.
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.gift-grid__anchor')) closeAllMiniPopups();
      if (!event.target.closest('.gift-grid__select-wrap')) closeAllSelectLists();
    });

    closeButton.addEventListener('click', closeOverlay);
    backdrop.addEventListener('click', closeOverlay);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeAllSelectLists();
        closeAllMiniPopups();
        if (!overlay.hidden) closeOverlay();
      }
    });

    addToCartBtn.addEventListener('click', function () {
      if (!resolvedVariant || !resolvedVariant.available) return;

      addToCartBtn.disabled = true;

      var items = [{ id: resolvedVariant.id, quantity: 1 }];

      // Cross-sell rule: if the chosen variant's option values include both
      // configured trigger values (e.g. "Black" + "Medium"), add the bonus
      // product's variant as a second line item in the same request. Values
      // are normalized (see normalizeOptionValue) so "Medium" also matches
      // a variant using "M".
      var values = resolvedVariant.options.map(normalizeOptionValue);
      var hasBoth = trigger1 && trigger2 && values.indexOf(trigger1) !== -1 && values.indexOf(trigger2) !== -1;

      if (hasBoth && bonusVariantId) {
        items.push({ id: parseInt(bonusVariantId, 10), quantity: 1 });
      }

      fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: items }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          addToCartBtn.disabled = false;
          modalMessage.classList.toggle('is-error', !result.ok);
          modalMessage.hidden = false;

          if (!result.ok) {
            modalMessage.textContent = result.data.description || result.data.message || 'Something went wrong.';
            return;
          }

          modalMessage.textContent = hasBoth ? 'Added to cart (+ Soft Winter Jacket)!' : 'Added to cart!';

          if (typeof publish === 'function' && typeof PUB_SUB_EVENTS === 'object') {
            publish(PUB_SUB_EVENTS.cartUpdate, { source: 'gift-grid', cartData: result.data });
          }
        })
        .catch(function () {
          addToCartBtn.disabled = false;
          modalMessage.classList.add('is-error');
          modalMessage.textContent = 'Something went wrong.';
          modalMessage.hidden = false;
        });
    });
});
