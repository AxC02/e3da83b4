/* Phone grocery app. Everything stays in localStorage. */
(function () {
  'use strict';

  var KEY = 'grocery.app.v1';
  var L = window.GroceryLogic;
  var PHOTO_OK = 180000;
  var PHOTO_MAX = 250000;

  var state = null;
  var view = 'home';
  var query = '';
  var selectedId = null;
  var pinSelection = false;
  var editor = null;
  var toastTimer = 0;
  var pendingDeleteId = null;
  var pendingTimer = 0;

  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function toast(msg) {
    var node = $('toast');
    node.textContent = msg;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 2400);
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    var parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }
    if (!parsed || !Array.isArray(parsed.recipes)) {
      parsed = { recipes: [], removedStarterIds: [], grocery: [] };
    }
    var merged = L.mergeStarters(parsed);
    state = {
      recipes: merged.recipes,
      removedStarterIds: merged.removedStarterIds,
      grocery: merged.grocery
    };
    if (!raw || merged.added) persist();
  }

  function persist() {
    var backupPhoto = state.recipes.map(function (r) { return r.photo || ''; });
    function write() {
      localStorage.setItem(KEY, JSON.stringify(state));
    }
    try {
      write();
      return { ok: true, strippedPhoto: false };
    } catch (e) { /* quota */ }
    var stripped = false;
    var i;
    for (i = 0; i < state.recipes.length; i++) {
      if (state.recipes[i].photo) {
        state.recipes[i].photo = '';
        stripped = true;
        try {
          write();
          return { ok: true, strippedPhoto: true };
        } catch (e2) { /* keep stripping */ }
      }
    }
    for (i = 0; i < state.recipes.length; i++) state.recipes[i].photo = backupPhoto[i];
    return { ok: false, strippedPhoto: false };
  }

  function commit() {
    var backup = JSON.stringify(state);
    var res = persist();
    if (!res.ok) {
      state = JSON.parse(backup);
      toast('Could not save. Phone storage is full.');
      render();
      return false;
    }
    if (res.strippedPhoto) toast('Saved without the photo to fit on this phone.');
    return true;
  }

  function visibleMeals() {
    var q = query.trim().toLowerCase();
    return state.recipes.filter(function (r) {
      if (r.hidden) return false;
      if (!q) return true;
      return r.name.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function syncSelection() {
    var meals = visibleMeals();
    if (pinSelection && meals.some(function (m) { return m.id === selectedId; })) return;
    if (!query.trim()) {
      if (!pinSelection) selectedId = null;
      return;
    }
    selectedId = meals.length ? meals[0].id : null;
  }

  function uncheckedCount() {
    return state.grocery.filter(function (g) { return !g.checked; }).length;
  }

  function updateChrome() {
    var title = {
      home: 'Home',
      grocery: 'Grocery list',
      recipes: 'Recipes',
      editor: editor ? editor.title : 'Recipe'
    }[view] || 'Home';
    $('title').textContent = title;
    var back = $('back');
    var inEditor = view === 'editor';
    back.hidden = !inEditor;
    var current = inEditor ? 'recipes' : view;
    document.querySelectorAll('.tab').forEach(function (tab) {
      var on = tab.getAttribute('data-tab') === current;
      tab.setAttribute('aria-current', on ? 'page' : 'false');
    });
    var n = uncheckedCount();
    var badge = $('g-badge');
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
  }

  function render() {
    updateChrome();
    var main = $('main');
    main.innerHTML = '';
    if (view === 'home') renderHome(main);
    else if (view === 'grocery') renderGrocery(main);
    else if (view === 'recipes') renderRecipes(main);
    else renderEditor(main);
  }

  function renderHome(main) {
    var input = el('input', 'ask');
    input.id = 'q';
    input.type = 'text';
    input.placeholder = 'What do you want to make?';
    input.enterKeyHint = 'search';
    input.autocomplete = 'off';
    input.value = query;
    input.setAttribute('aria-label', 'What do you want to make?');
    input.addEventListener('input', function () {
      query = input.value;
      pinSelection = false;
      syncSelection();
      renderResults();
    });
    main.appendChild(input);

    var results = el('div', 'results');
    results.id = 'results';
    main.appendChild(results);
    renderResults();
  }

  function renderResults() {
    var box = $('results');
    if (!box) return;
    box.innerHTML = '';
    var meals = visibleMeals();
    if (!meals.length) {
      var empty = el('p', 'empty', state.recipes.some(function (r) { return !r.hidden; })
        ? 'No meals match that.'
        : 'No meals to show. Add or unhide one in Recipes.');
      box.appendChild(empty);
      return;
    }
    meals.forEach(function (meal) {
      var open = meal.id === selectedId;
      var card = el('article', 'meal' + (open ? ' open' : ''));
      var hit = el('button', 'meal-hit');
      hit.type = 'button';
      hit.appendChild(el('span', 'meal-name', meal.name));
      var meta = [];
      if (meal.photo) meta.push('Photo');
      if (meal.sourceUrl) meta.push('Link');
      meta.push(meal.ingredients.length + (meal.ingredients.length === 1 ? ' ingredient' : ' ingredients'));
      hit.appendChild(el('span', 'meal-meta', meta.join(' · ')));
      hit.addEventListener('click', function () {
        query = meal.name;
        pinSelection = true;
        selectedId = meal.id;
        var q = $('q');
        if (q) q.value = query;
        renderResults();
        var opened = box.querySelector('.meal.open');
        if (opened && opened.scrollIntoView) opened.scrollIntoView({ block: 'nearest' });
      });
      card.appendChild(hit);
      if (open) card.appendChild(ingredientPanel(meal));
      box.appendChild(card);
    });
  }

  function ingredientPanel(meal) {
    var panel = el('div', 'panel');
    panel.appendChild(el('p', 'for-one', 'For one person'));
    if (safePhoto(meal.photo)) {
      var img = el('img', 'meal-photo');
      img.src = safePhoto(meal.photo);
      img.alt = '';
      panel.appendChild(img);
    }
    var ul = el('ul', 'ings');
    meal.ingredients.forEach(function (ing) {
      ul.appendChild(el('li', null, L.formatLine(ing)));
    });
    panel.appendChild(ul);
    if (meal.sourceUrl && /^https?:\/\//i.test(meal.sourceUrl)) {
      var a = el('a', 'src-link', 'Recipe link');
      a.href = meal.sourceUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      panel.appendChild(a);
    } else if (meal.sourceUrl) {
      panel.appendChild(el('p', 'src-note', meal.sourceUrl));
    }
    var add = el('button', 'btn primary', 'Add to grocery list');
    add.type = 'button';
    add.addEventListener('click', function () { addMeal(meal); });
    panel.appendChild(add);
    return panel;
  }

  function addMeal(meal) {
    state.grocery = L.addIngredients(state.grocery, meal.ingredients);
    if (!commit()) return;
    toast('Added ' + meal.name);
    updateChrome();
  }

  function renderGrocery(main) {
    var checked = state.grocery.filter(function (g) { return g.checked; }).length;
    if (checked) {
      var clear = el('button', 'btn ghost', 'Clear checked');
      clear.type = 'button';
      clear.addEventListener('click', function () {
        state.grocery = L.clearChecked(state.grocery);
        if (!commit()) return;
        toast('Cleared checked items');
        render();
      });
      main.appendChild(clear);
    }
    if (!state.grocery.length) {
      main.appendChild(el('p', 'empty', 'Your list is empty. Add a meal from Home.'));
      return;
    }
    var ul = el('ul', 'glist');
    state.grocery.forEach(function (g) {
      var li = el('li', g.checked ? 'done' : '');
      var label = el('label', 'g-row');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!g.checked;
      cb.addEventListener('change', function () {
        g.checked = cb.checked;
        if (!commit()) return;
        render();
      });
      label.appendChild(cb);
      label.appendChild(el('span', 'g-text', L.lineText(g)));
      li.appendChild(label);
      ul.appendChild(li);
    });
    main.appendChild(ul);
    var left = uncheckedCount();
    main.appendChild(el('p', 'fine', left ? (left + ' still to buy') : 'All checked'));
  }

  function renderRecipes(main) {
    var actions = el('div', 'actions');
    actions.appendChild(actionButton('New recipe', function () {
      openEditor(null, { title: 'New recipe', focus: 'name' });
    }));
    actions.appendChild(actionButton('From a link', function () {
      openEditor(null, { title: 'Save from a link', focus: 'url' });
    }));
    var photoBtn = actionButton('From a photo', function () {
      pickPhoto(function (result) {
        openEditor(null, {
          title: 'Save from a photo',
          focus: 'name',
          photo: result.photo,
          photoNote: result.note
        });
      });
    });
    actions.appendChild(photoBtn);
    main.appendChild(actions);

    var visible = state.recipes.filter(function (r) { return !r.hidden; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    var hidden = state.recipes.filter(function (r) { return r.hidden; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });

    if (!visible.length) main.appendChild(el('p', 'empty', 'No recipes yet.'));
    else main.appendChild(recipeList(visible, false));

    if (hidden.length) {
      main.appendChild(el('h2', 'subhead', 'Hidden'));
      main.appendChild(recipeList(hidden, true));
    }
    main.appendChild(el('p', 'fine', 'Saved on this phone only. Works offline.'));
  }

  function actionButton(label, onClick) {
    var b = el('button', 'btn block', label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function recipeList(list) {
    var wrap = el('div', 'rcards');
    list.forEach(function (meal) {
      var card = el('article', 'rcard');
      var top = el('div', 'rcard-top');
      if (safePhoto(meal.photo)) {
        var img = el('img', 'thumb');
        img.src = safePhoto(meal.photo);
        img.alt = '';
        top.appendChild(img);
      }
      var info = el('div', 'rcard-info');
      info.appendChild(el('h3', null, meal.name));
      var bits = [meal.ingredients.length + (meal.ingredients.length === 1 ? ' ingredient' : ' ingredients')];
      if (meal.sourceUrl) bits.push('link saved');
      info.appendChild(el('p', 'meal-meta', bits.join(' · ')));
      top.appendChild(info);
      card.appendChild(top);

      var row = el('div', 'row-actions');
      row.appendChild(smallButton('Edit', function () {
        openEditor(meal, { title: 'Edit recipe', focus: 'name' });
      }));
      row.appendChild(smallButton(meal.hidden ? 'Unhide' : 'Hide', function () {
        meal.hidden = !meal.hidden;
        if (meal.hidden && selectedId === meal.id) {
          selectedId = null;
          pinSelection = false;
        }
        if (!commit()) return;
        toast(meal.hidden ? 'Hidden from Home' : 'Showing on Home');
        render();
      }));
      var delLabel = pendingDeleteId === meal.id ? 'Delete?' : 'Delete';
      var del = smallButton(delLabel, function () {
        if (pendingDeleteId !== meal.id) {
          pendingDeleteId = meal.id;
          clearTimeout(pendingTimer);
          pendingTimer = setTimeout(function () {
            pendingDeleteId = null;
            if (view === 'recipes') render();
          }, 2800);
          render();
          return;
        }
        pendingDeleteId = null;
        deleteRecipe(meal);
      });
      if (pendingDeleteId === meal.id) del.classList.add('danger');
      row.appendChild(del);
      card.appendChild(row);
      wrap.appendChild(card);
    });
    return wrap;
  }

  function smallButton(label, onClick) {
    var b = el('button', 'btn small', label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function deleteRecipe(meal) {
    state.recipes = state.recipes.filter(function (r) { return r.id !== meal.id; });
    if (meal.starter || String(meal.id).indexOf('starter-') === 0) {
      if (state.removedStarterIds.indexOf(meal.id) === -1) state.removedStarterIds.push(meal.id);
    }
    if (selectedId === meal.id) {
      selectedId = null;
      pinSelection = false;
    }
    if (!commit()) return;
    toast('Deleted ' + meal.name);
    render();
  }

  function blankLine() { return { qty: '', unit: '', item: '' }; }

  function linesFrom(meal) {
    if (!meal || !meal.ingredients || !meal.ingredients.length) return [blankLine()];
    return meal.ingredients.map(function (i) {
      return {
        qty: i.qty == null ? '' : L.formatQty(i.qty),
        unit: i.unit || '',
        item: i.item || ''
      };
    });
  }

  function openEditor(meal, opts) {
    opts = opts || {};
    editor = {
      id: meal ? meal.id : null,
      title: opts.title || (meal ? 'Edit recipe' : 'New recipe'),
      name: meal ? meal.name : '',
      sourceUrl: meal ? (meal.sourceUrl || '') : '',
      photo: opts.photo != null ? opts.photo : (meal ? (meal.photo || '') : ''),
      photoNote: opts.photoNote || '',
      lines: linesFrom(meal),
      focus: opts.focus || 'name',
      didFocus: false,
      dirty: false
    };
    view = 'editor';
    render();
  }

  function pickPhoto(done) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      fileToPhoto(file).then(done);
    });
    input.click();
  }

  function fileToPhoto(file) {
    return new Promise(function (resolve) {
      if (file.size > 25 * 1024 * 1024) {
        resolve({ photo: '', note: 'That photo is too big to keep on the phone. You can still save the recipe.' });
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        try { resolve(shrink(img)); }
        catch (e) {
          resolve({ photo: '', note: 'Could not read that photo. You can still save the recipe.' });
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve({ photo: '', note: 'Could not read that photo. You can still save the recipe.' });
      };
      img.src = url;
    });
  }

  function paint(img, maxEdge, quality) {
    var longest = Math.max(img.width, img.height) || 1;
    var scale = Math.min(1, maxEdge / longest);
    var w = Math.max(1, Math.round(img.width * scale));
    var h = Math.max(1, Math.round(img.height * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10241c';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function shrink(img) {
    var attempts = [[720, 0.72], [480, 0.6], [320, 0.5]];
    var last = '';
    for (var i = 0; i < attempts.length; i++) {
      last = paint(img, attempts[i][0], attempts[i][1]);
      if (last.length <= PHOTO_OK) return { photo: last, note: '' };
    }
    if (last && last.length <= PHOTO_MAX) return { photo: last, note: '' };
    return { photo: '', note: 'That photo is too big to keep on the phone. You can still save the recipe.' };
  }

  function renderEditor(main) {
    var form = el('form', 'editor');
    form.autocomplete = 'off';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      saveEditor();
    });

    if (editor.photoNote) form.appendChild(el('p', 'note', editor.photoNote));

    form.appendChild(field('Meal name', 'meal-name', editor.name, 'Name the meal', 'text'));
    var url = field('Recipe link', 'meal-url', editor.sourceUrl, 'Paste a URL', 'url');
    form.appendChild(url);
    if (editor.focus === 'url') {
      form.appendChild(el('p', 'note', 'Paste the page address. This phone does not open other sites to read the recipe. Type the ingredients below.'));
    }

    var photoRow = el('div', 'photo-row');
    if (safePhoto(editor.photo)) {
      var img = el('img', 'meal-photo');
      img.src = safePhoto(editor.photo);
      img.alt = 'Recipe photo';
      photoRow.appendChild(img);
      var remove = el('button', 'btn small', 'Remove photo');
      remove.type = 'button';
      remove.addEventListener('click', function () {
        editor.photo = '';
        editor.photoNote = '';
        editor.dirty = true;
        render();
      });
      photoRow.appendChild(remove);
    } else {
      var choose = el('button', 'btn block', 'Choose photo');
      choose.type = 'button';
      choose.addEventListener('click', function () {
        pickPhoto(function (result) {
          editor.photo = result.photo || '';
          editor.photoNote = result.note || '';
          editor.dirty = true;
          render();
        });
      });
      photoRow.appendChild(choose);
    }
    form.appendChild(photoRow);

    form.appendChild(el('h2', 'subhead', 'Ingredients for one person'));
    var lines = el('div', 'lines');
    editor.lines.forEach(function (line, index) {
      var row = el('div', 'line');
      row.appendChild(lineInput('qty', index, line.qty, 'Amt', 'text'));
      row.appendChild(lineInput('unit', index, line.unit, 'Unit', 'text'));
      row.appendChild(lineInput('item', index, line.item, 'Ingredient', 'text'));
      var x = el('button', 'icon-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Remove ingredient');
      x.addEventListener('click', function () {
        editor.lines.splice(index, 1);
        if (!editor.lines.length) editor.lines.push(blankLine());
        editor.dirty = true;
        render();
      });
      row.appendChild(x);
      lines.appendChild(row);
    });
    form.appendChild(lines);

    var addLine = el('button', 'btn ghost', 'Add ingredient');
    addLine.type = 'button';
    addLine.addEventListener('click', function () {
      editor.lines.push(blankLine());
      editor.dirty = true;
      render();
      var items = document.querySelectorAll('.line .item');
      if (items.length) items[items.length - 1].focus();
    });
    form.appendChild(addLine);

    var save = el('button', 'btn primary', 'Save recipe');
    save.type = 'submit';
    form.appendChild(save);
    main.appendChild(form);

    form.addEventListener('input', function (e) {
      var t = e.target;
      editor.dirty = true;
      if (t.name === 'meal-name') editor.name = t.value;
      else if (t.name === 'meal-url') editor.sourceUrl = t.value;
      else if (t.dataset && t.dataset.field != null) {
        editor.lines[+t.dataset.i][t.dataset.field] = t.value;
      }
    });

    if (!editor.didFocus) {
      editor.didFocus = true;
      var focusEl = editor.focus === 'url'
        ? form.querySelector('[name="meal-url"]')
        : form.querySelector('[name="meal-name"]');
      if (focusEl) setTimeout(function () { focusEl.focus(); }, 30);
    }
  }

  function safePhoto(src) {
    return typeof src === 'string' && src.indexOf('data:image/') === 0 ? src : '';
  }

  function field(label, name, value, placeholder, type) {
    var wrap = el('label', 'field');
    wrap.appendChild(el('span', null, label));
    var input = document.createElement('input');
    input.name = name;
    input.type = type || 'text';
    input.placeholder = placeholder || '';
    input.value = value || '';
    if (name === 'meal-name') input.autocapitalize = 'words';
    if (type === 'url') input.inputMode = 'url';
    wrap.appendChild(input);
    return wrap;
  }

  function lineInput(fieldName, index, value, placeholder) {
    var input = document.createElement('input');
    input.className = fieldName;
    input.dataset.field = fieldName;
    input.dataset.i = String(index);
    input.value = value || '';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    input.autocomplete = 'off';
    return input;
  }

  function saveEditor() {
    var name = editor.name.trim();
    if (!name) {
      toast('Name the meal');
      return;
    }
    var ingredients = [];
    var i;
    for (i = 0; i < editor.lines.length; i++) {
      var line = editor.lines[i];
      var item = line.item.trim();
      var qtyText = line.qty.trim();
      var unit = line.unit.trim();
      if (!item && !qtyText && !unit) continue;
      if (!item) {
        toast('Each amount needs an ingredient name');
        return;
      }
      var qty = null;
      if (qtyText) {
        qty = L.parseQty(qtyText);
        if (qty == null) {
          toast('Use amounts like 2, 1/2, or 1 1/2');
          return;
        }
      }
      ingredients.push({ qty: qty, unit: unit, item: item });
    }
    if (!ingredients.length) {
      toast('Add at least one ingredient');
      return;
    }
    var existing = editor.id ? state.recipes.filter(function (r) { return r.id === editor.id; })[0] : null;
    var recipe = {
      id: existing ? existing.id : ('meal-' + Math.random().toString(36).slice(2, 10)),
      name: name,
      ingredients: ingredients,
      sourceUrl: editor.sourceUrl.trim(),
      photo: editor.photo || '',
      hidden: existing ? !!existing.hidden : false,
      starter: existing ? !!existing.starter : false
    };
    if (existing) {
      var idx = state.recipes.indexOf(existing);
      state.recipes[idx] = recipe;
    } else {
      state.recipes.push(recipe);
    }
    if (!commit()) return;
    editor.dirty = false;
    editor = null;
    selectedId = recipe.id;
    pinSelection = true;
    query = recipe.name;
    view = 'home';
    toast('Saved ' + recipe.name);
    render();
  }

  function leaveEditor() {
    if (editor && editor.dirty && !window.confirm('Leave without saving?')) return;
    editor = null;
    view = 'recipes';
    render();
  }

  function go(tab) {
    if (view === 'editor') {
      if (editor && editor.dirty && !window.confirm('Leave without saving?')) return;
      editor = null;
    }
    view = tab;
    if (tab === 'home') {
      query = '';
      selectedId = null;
      pinSelection = false;
    }
    render();
    window.scrollTo(0, 0);
  }

  function bind() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { go(tab.getAttribute('data-tab')); });
    });
    $('back').addEventListener('click', leaveEditor);
    // Coming back to the app (after the phone's Home button) shows the full meal list again.
    var backToList = function () {
      if (document.visibilityState === 'hidden' || view !== 'home') return;
      if (!selectedId && !query) return;
      query = '';
      selectedId = null;
      pinSelection = false;
      render();
      window.scrollTo(0, 0);
    };
    document.addEventListener('visibilitychange', backToList);
    window.addEventListener('pageshow', backToList);
  }

  function boot() {
    load();
    bind();
    render();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
