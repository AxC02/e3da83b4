/* Pure grocery math and starter meals. No network, no DOM. */
(function (root) {
  'use strict';

  var VOL = { tsp: 1, tbsp: 3, cup: 48 };
  var WT = { oz: 1, lb: 16 };

  var UNIT_ALIAS = {
    teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
    tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp',
    cup: 'cup', cups: 'cup',
    ounce: 'oz', ounces: 'oz', oz: 'oz',
    pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
    slice: 'slice', slices: 'slice',
    can: 'can', cans: 'can',
    clove: 'clove', cloves: 'clove',
    leaf: 'leaf', leaves: 'leaf',
    bunch: 'bunch', bunches: 'bunch',
    package: 'package', packages: 'package', pkg: 'package',
    patty: 'patty', patties: 'patty'
  };

  var MASS = {
    beef: 1, rice: 1, milk: 1, lettuce: 1, butter: 1, salsa: 1, cheese: 1,
    soup: 1, oil: 1, sauce: 1, broth: 1, macaroni: 1, mix: 1, syrup: 1,
    dressing: 1, ketchup: 1, mustard: 1, salt: 1, pepper: 1, spaghetti: 1,
    cheddar: 1, cream: 1, noodles: 1, beans: 1, powder: 1, vegetables: 1
  };

  function normItem(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function normUnit(u) {
    var s = String(u || '').trim().toLowerCase().replace(/\.$/, '');
    if (!s) return '';
    return UNIT_ALIAS[s] || s;
  }

  function parseQty(s) {
    if (s == null) return null;
    if (typeof s === 'number') return (isFinite(s) && s >= 0) ? s : null;
    var t = String(s).trim();
    if (!t) return null;
    var m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (m) {
      if (+m[3] === 0) return null;
      return +m[1] + (+m[2]) / (+m[3]);
    }
    m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) {
      if (+m[2] === 0) return null;
      return +m[1] / +m[2];
    }
    var n = Number(t);
    if (isFinite(n) && n >= 0) return n;
    return null;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a || 1;
  }

  function snap(n) {
    if (n == null || !isFinite(n)) return n;
    var neg = n < 0;
    n = Math.abs(n);
    var whole = Math.floor(n + 1e-9);
    var frac = n - whole;
    var denoms = [1, 2, 3, 4, 8, 12];
    var best = n;
    var bestD = Infinity;
    var d, num, v, diff, i;
    for (i = 0; i < denoms.length; i++) {
      d = denoms[i];
      num = Math.round(frac * d);
      v = whole + num / d;
      diff = Math.abs(n - v);
      if (diff < bestD) {
        bestD = diff;
        best = v;
      }
    }
    if (bestD > 0.012) best = Math.round(n * 100) / 100;
    return neg ? -best : best;
  }

  function formatQty(n) {
    if (n == null || !isFinite(n)) return '';
    var neg = n < 0;
    var snapped = snap(Math.abs(n));
    if (snapped < 1e-9) return '0';
    var whole = Math.floor(snapped + 1e-9);
    var frac = snapped - whole;
    var denoms = [2, 3, 4, 8, 12];
    var label = '';
    var i, d, num, g;
    if (frac >= 1e-9) {
      for (i = 0; i < denoms.length; i++) {
        d = denoms[i];
        num = Math.round(frac * d);
        if (num > 0 && num < d && Math.abs(frac - num / d) <= 0.012) {
          g = gcd(num, d);
          label = (num / g) + '/' + (d / g);
          break;
        }
      }
    }
    var out;
    if (frac < 1e-9) out = String(whole);
    else if (!label) out = String(Math.round(Math.abs(n) * 100) / 100);
    else if (whole) out = whole + ' ' + label;
    else out = label;
    return neg ? '-' + out : out;
  }

  function unitLabel(qty, unit) {
    unit = normUnit(unit);
    if (!unit) return '';
    var plural = qty != null && qty > 1.001;
    var irregular = {
      slice: plural ? 'slices' : 'slice',
      can: plural ? 'cans' : 'can',
      leaf: plural ? 'leaves' : 'leaf',
      clove: plural ? 'cloves' : 'clove',
      bunch: plural ? 'bunches' : 'bunch',
      package: plural ? 'packages' : 'package',
      patty: plural ? 'patties' : 'patty',
      cup: plural ? 'cups' : 'cup'
    };
    if (irregular[unit]) return irregular[unit];
    return unit;
  }

  function pluralWord(w) {
    var irreg = { patty: 'patties', potato: 'potatoes', tomato: 'tomatoes', leaf: 'leaves', loaf: 'loaves' };
    if (irreg[w]) return irreg[w];
    if (/(s|x|z|ch|sh)$/.test(w)) return w + 'es';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    if (w.endsWith('s')) return w;
    return w + 's';
  }

  function pluralizeItem(item, qty) {
    if (qty == null || qty <= 1.001) return item;
    var parts = item.split(' ');
    if (!parts.length) return item;
    var last = parts[parts.length - 1];
    var key = last.toLowerCase();
    if (MASS[key]) return item;
    var next = pluralWord(key);
    if (last[0] && last[0] === last[0].toUpperCase()) {
      next = next.charAt(0).toUpperCase() + next.slice(1);
    }
    parts[parts.length - 1] = next;
    return parts.join(' ');
  }

  function formatLine(ing) {
    var unit = normUnit(ing.unit);
    var qty = ing.qty == null ? null : snap(ing.qty);
    var item = String(ing.item || '').trim();
    if (!unit) item = pluralizeItem(item, qty);
    var measure = '';
    if (qty != null) measure = formatQty(qty);
    var u = unitLabel(qty, unit);
    if (u) measure = measure ? (measure + ' ' + u) : u;
    return [measure, item].filter(Boolean).join(' ');
  }

  function familyOf(unit) {
    var u = normUnit(unit);
    if (VOL[u]) return 'vol';
    if (WT[u]) return 'wt';
    return 'unit:' + u;
  }

  function toBase(qty, unit) {
    if (qty == null) return null;
    var u = normUnit(unit);
    if (VOL[u]) return qty * VOL[u];
    if (WT[u]) return qty * WT[u];
    return qty;
  }

  function nearInt(n) {
    return Math.abs(n - Math.round(n)) < 1e-6;
  }

  function isQuarter(n) {
    return nearInt(n * 4);
  }

  function isNice(n) {
    var denoms = [1, 2, 3, 4, 8, 12];
    var i;
    for (i = 0; i < denoms.length; i++) {
      if (nearInt(n * denoms[i])) return true;
    }
    return false;
  }

  function chooseDisplay(family, base) {
    var unit, cups, tbsp, lb;
    if (base == null) {
      unit = family.indexOf('unit:') === 0 ? family.slice(5) : '';
      return { qty: null, unit: unit };
    }
    if (family === 'vol') {
      cups = snap(base / 48);
      if (cups >= 0.25 - 1e-9 && Math.abs(cups * 48 - base) < 0.6 && isNice(cups)) {
        return { qty: cups, unit: 'cup' };
      }
      tbsp = snap(base / 3);
      if (tbsp >= 1 && Math.abs(tbsp * 3 - base) < 0.25) {
        return { qty: tbsp, unit: 'tbsp' };
      }
      return { qty: snap(base), unit: 'tsp' };
    }
    if (family === 'wt') {
      lb = snap(base / 16);
      if (lb >= 0.25 - 1e-9 && Math.abs(lb * 16 - base) < 0.25 && isQuarter(lb)) {
        return { qty: lb, unit: 'lb' };
      }
      return { qty: snap(base), unit: 'oz' };
    }
    return { qty: snap(base), unit: family.slice(5) };
  }

  function lineText(g) {
    var d = chooseDisplay(g.family, g.baseQty);
    return formatLine({ qty: d.qty, unit: d.unit, item: g.item });
  }

  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 10);
  }

  function addIngredients(grocery, ingredients) {
    var next = grocery.map(function (g) {
      return {
        id: g.id,
        itemKey: g.itemKey,
        item: g.item,
        family: g.family,
        baseQty: g.baseQty,
        checked: g.checked
      };
    });
    var i, ing, item, itemKey, unit, family, addBase, existing;
    for (i = 0; i < ingredients.length; i++) {
      ing = ingredients[i];
      item = String(ing.item || '').trim();
      if (!item) continue;
      itemKey = normItem(item);
      unit = normUnit(ing.unit);
      family = familyOf(unit);
      addBase = toBase(ing.qty == null ? null : +ing.qty, unit);
      if (addBase != null) addBase = Math.round(addBase * 1e6) / 1e6;
      existing = null;
      for (var j = 0; j < next.length; j++) {
        if (!next[j].checked && next[j].itemKey === itemKey && next[j].family === family) {
          existing = next[j];
          break;
        }
      }
      if (!existing) {
        next.push({
          id: uid('g'),
          itemKey: itemKey,
          item: item,
          family: family,
          baseQty: addBase,
          checked: false
        });
        continue;
      }
      if (existing.baseQty == null) existing.baseQty = addBase;
      else if (addBase != null) existing.baseQty = Math.round((existing.baseQty + addBase) * 1e6) / 1e6;
    }
    return next;
  }

  function clearChecked(grocery) {
    return grocery.filter(function (g) { return !g.checked; });
  }

  function ing(qty, unit, item) {
    return { qty: qty, unit: unit, item: item };
  }

  function meal(id, name, ingredients) {
    return {
      id: id,
      name: name,
      ingredients: ingredients,
      sourceUrl: '',
      photo: '',
      hidden: false,
      starter: true
    };
  }

  function starterRecipes() {
    return [
      meal('starter-tacos', 'Tacos', [
        ing(0.25, 'lb', 'ground beef'),
        ing(2, '', 'taco shell'),
        ing(0.25, 'cup', 'shredded cheddar'),
        ing(0.5, 'cup', 'shredded lettuce'),
        ing(2, 'tbsp', 'salsa'),
        ing(1, 'tbsp', 'sour cream')
      ]),
      meal('starter-spaghetti', 'Spaghetti', [
        ing(4, 'oz', 'spaghetti'),
        ing(0.25, 'lb', 'ground beef'),
        ing(0.5, 'cup', 'marinara sauce'),
        ing(1, 'tbsp', 'olive oil'),
        ing(1, 'tbsp', 'grated parmesan')
      ]),
      meal('starter-burgers', 'Burgers', [
        ing(0.25, 'lb', 'ground beef'),
        ing(1, '', 'hamburger bun'),
        ing(1, 'slice', 'American cheese'),
        ing(1, '', 'lettuce leaf'),
        ing(1, 'slice', 'tomato'),
        ing(1, 'tbsp', 'ketchup'),
        ing(1, 'tsp', 'mustard')
      ]),
      meal('starter-grilled-cheese', 'Grilled cheese', [
        ing(2, 'slice', 'bread'),
        ing(2, 'slice', 'cheddar cheese'),
        ing(1, 'tbsp', 'butter')
      ]),
      meal('starter-chicken-rice', 'Chicken and rice', [
        ing(6, 'oz', 'chicken breast'),
        ing(0.5, 'cup', 'rice'),
        ing(1, 'cup', 'chicken broth'),
        ing(1, 'tbsp', 'olive oil'),
        ing(0.5, 'cup', 'frozen mixed vegetables')
      ]),
      meal('starter-eggs-toast', 'Eggs and toast', [
        ing(2, '', 'egg'),
        ing(2, 'slice', 'bread'),
        ing(1, 'tbsp', 'butter')
      ]),
      meal('starter-chili', 'Chili', [
        ing(0.25, 'lb', 'ground beef'),
        ing(0.5, 'cup', 'kidney beans'),
        ing(0.5, 'cup', 'diced tomatoes'),
        ing(0.25, '', 'onion'),
        ing(1, 'tbsp', 'chili powder'),
        ing(0.5, 'cup', 'beef broth')
      ]),
      meal('starter-baked-potato', 'Baked potato', [
        ing(1, '', 'russet potato'),
        ing(1, 'tbsp', 'butter'),
        ing(2, 'tbsp', 'sour cream'),
        ing(2, 'tbsp', 'shredded cheddar'),
        ing(1, '', 'green onion')
      ]),
      meal('starter-quesadilla', 'Quesadilla', [
        ing(1, '', 'flour tortilla'),
        ing(0.5, 'cup', 'shredded cheddar'),
        ing(2, 'oz', 'chicken breast'),
        ing(1, 'tbsp', 'salsa')
      ]),
      meal('starter-stir-fry', 'Stir fry', [
        ing(6, 'oz', 'chicken breast'),
        ing(1, 'cup', 'frozen stir-fry vegetables'),
        ing(1, 'tbsp', 'soy sauce'),
        ing(1, 'tbsp', 'vegetable oil'),
        ing(0.5, 'cup', 'rice')
      ]),
      meal('starter-pancakes', 'Pancakes', [
        ing(0.5, 'cup', 'pancake mix'),
        ing(1 / 3, 'cup', 'milk'),
        ing(1, '', 'egg'),
        ing(1, 'tbsp', 'butter'),
        ing(2, 'tbsp', 'maple syrup')
      ]),
      meal('starter-salad', 'Salad', [
        ing(2, 'cup', 'lettuce'),
        ing(0.5, 'cup', 'cherry tomatoes'),
        ing(0.25, '', 'cucumber'),
        ing(2, 'tbsp', 'ranch dressing'),
        ing(0.25, 'cup', 'shredded cheddar')
      ]),
      meal('starter-mac', 'Mac and cheese', [
        ing(1, 'cup', 'elbow macaroni'),
        ing(0.5, 'cup', 'shredded cheddar'),
        ing(0.25, 'cup', 'milk'),
        ing(1, 'tbsp', 'butter')
      ]),
      meal('starter-soup', 'Soup', [
        ing(2, 'cup', 'chicken broth'),
        ing(1, 'cup', 'egg noodles'),
        ing(0.5, 'cup', 'frozen mixed vegetables'),
        ing(3, 'oz', 'chicken breast')
      ]),
      meal('starter-breakfast-burrito', 'Breakfast burrito', [
        ing(1, '', 'flour tortilla'),
        ing(2, '', 'egg'),
        ing(0.25, 'cup', 'shredded cheddar'),
        ing(2, 'tbsp', 'salsa'),
        ing(1, '', 'sausage patty')
      ]),
      meal('starter-waffle-sandwich', 'Waffle sausage egg sandwich', [
        ing(2, '', 'frozen waffle'),
        ing(1, '', 'sausage patty'),
        ing(1, '', 'egg'),
        ing(1, 'slice', 'American cheese'),
        ing(1, 'tsp', 'butter'),
        ing(1, 'tsp', 'maple syrup')
      ])
    ];
  }

  function mergeStarters(state) {
    var recipes = (state.recipes || []).map(function (r) {
      return {
        id: r.id,
        name: r.name,
        ingredients: (r.ingredients || []).map(function (i) {
          return { qty: i.qty, unit: i.unit, item: i.item };
        }),
        sourceUrl: r.sourceUrl || '',
        photo: r.photo || '',
        hidden: !!r.hidden,
        starter: !!r.starter
      };
    });
    var removed = (state.removedStarterIds || []).slice();
    var removedSet = {};
    var have = {};
    var i;
    for (i = 0; i < removed.length; i++) removedSet[removed[i]] = 1;
    for (i = 0; i < recipes.length; i++) have[recipes[i].id] = 1;
    var starters = starterRecipes();
    var added = 0;
    for (i = 0; i < starters.length; i++) {
      if (!have[starters[i].id] && !removedSet[starters[i].id]) {
        recipes.push(JSON.parse(JSON.stringify(starters[i])));
        added++;
      }
    }
    return {
      recipes: recipes,
      removedStarterIds: removed,
      grocery: (state.grocery || []).map(function (g) {
        return {
          id: g.id,
          itemKey: g.itemKey,
          item: g.item,
          family: g.family,
          baseQty: g.baseQty,
          checked: !!g.checked
        };
      }),
      added: added
    };
  }

  root.GroceryLogic = {
    parseQty: parseQty,
    formatQty: formatQty,
    formatLine: formatLine,
    lineText: lineText,
    addIngredients: addIngredients,
    clearChecked: clearChecked,
    starterRecipes: starterRecipes,
    mergeStarters: mergeStarters,
    normItem: normItem,
    normUnit: normUnit,
    chooseDisplay: chooseDisplay,
    familyOf: familyOf,
    toBase: toBase
  };
})(typeof window !== 'undefined' ? window : globalThis);
