/* ==========================================================
   DOKKANI — Aperçu interactif (démonstration)

   Règles de sécurité de ce fichier :
   - aucune requête réseau (pas de fetch, XMLHttpRequest, WebSocket, import) ;
   - aucune base de données : uniquement les données fictives de data.js ;
   - aucune donnée personnelle saisie ni stockée : les coordonnées du client
     de démonstration sont fixes et fictives ;
   - le stockage du navigateur ne contient que l'état de la démo (panier,
     produits fictifs ajoutés, statuts des commandes fictives) ;
   - le DOM est construit avec textContent (jamais innerHTML).
   ========================================================== */
(function () {
  "use strict";

  const D = window.DOKKANI_DEMO_DATA;
  const icon = window.dokkaniIcon;
  const STORAGE_KEY = "dokkani-apercu-v1";
  const DELIVERY_FEE = 400; // frais de livraison fictifs, par commande
  const DEMO_CUSTOMER = Object.freeze({
    name: "Client de démonstration",
    phone: "05 •• •• •• ••",
    address: "Adresse fictive, quartier de démonstration"
  });

  const app = document.getElementById("app");
  const toastBox = document.getElementById("toast");
  const cartCount = document.getElementById("cartCount");

  /* ==========================================================
     Outils
     ========================================================== */
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    const p = props || {};
    if (p.class) node.className = p.class;
    if (p.text !== undefined) node.textContent = p.text;
    if (p.attrs) Object.keys(p.attrs).forEach(k => {
      const v = p.attrs[k];
      if (v === false || v === null || v === undefined) return;
      node.setAttribute(k, v === true ? "" : String(v));
    });
    if (p.on) Object.keys(p.on).forEach(evt => node.addEventListener(evt, p.on[evt]));
    appendAll(node, children);
    return node;
  }

  function appendAll(node, children) {
    children.flat(Infinity).forEach(child => {
      if (child === null || child === undefined || child === false) return;
      node.append(typeof child === "string" || typeof child === "number" ? String(child) : child);
    });
  }

  const ico = (name, size, className) => icon(name, { size: size || 20, className });

  const priceFmt = new Intl.NumberFormat("fr-DZ");
  const price = n => priceFmt.format(n) + " DA";

  const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const formatDate = iso => dateFmt.format(new Date(iso));

  const normalize = text => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  let toastTimer = null;
  function toast(message) {
    toastBox.textContent = message;
    toastBox.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove("show"), 3200);
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /* ==========================================================
     État de la démonstration (stocké localement, sans donnée personnelle)
     ========================================================== */
  function defaultState() {
    return {
      cart: [],               // [{ id, qty }]
      favorites: [],          // [productId]
      addedProducts: [],      // produits fictifs ajoutés par le commerçant de démo
      removedProducts: [],    // produits fictifs retirés
      stock: {},              // { productId: stock modifié }
      orderStatus: {},        // { orderId: statut modifié }
      orderHistory: {},       // { orderId: [{ status, at }] }
      clientOrders: [],       // commandes passées dans la démo (client fictif)
      shopEdit: {},           // présentation modifiée de la boutique de démo
      nextOrder: 1049,
      nextProduct: 9001
    };
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && typeof raw === "object") return Object.assign(defaultState(), raw);
    } catch (_) { /* stockage indisponible ou abîmé : on repart de zéro */ }
    return defaultState();
  }

  let state = loadState();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* sans conséquence */ }
    updateCartCount();
  }

  function resetDemo() {
    state = defaultState();
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* sans conséquence */ }
    updateCartCount();
    toast("La démonstration a été réinitialisée.");
    go("#/");
  }

  /* ==========================================================
     Accès aux données (fictives + modifications locales)
     ========================================================== */
  const shopById = id => D.SHOPS.find(s => s.id === id);
  const categoryById = id => D.CATEGORIES.find(c => c.id === id);

  function allProducts() {
    const removed = new Set(state.removedProducts);
    return D.PRODUCTS.concat(state.addedProducts)
      .filter(p => !removed.has(p.id))
      .map(p => Object.prototype.hasOwnProperty.call(state.stock, p.id)
        ? Object.assign({}, p, { stock: state.stock[p.id] })
        : p);
  }

  const productById = id => allProducts().find(p => p.id === id);

  function merchantShop() {
    return Object.assign({}, shopById(D.MERCHANT_SHOP_ID), state.shopEdit);
  }

  function shopDisplay(shop) {
    return shop.id === D.MERCHANT_SHOP_ID ? merchantShop() : shop;
  }

  function orderStatus(order) {
    return state.orderStatus[order.id] || order.status;
  }

  function orderTotal(order) {
    const items = order.lines.reduce((sum, line) => {
      const p = productById(line.productId);
      return sum + (p ? p.price * line.qty : 0);
    }, 0);
    return items + DELIVERY_FEE;
  }

  function lineShopId(line) {
    const p = productById(line.productId);
    return p ? p.shopId : null;
  }

  // Commandes visibles par le commerçant de démo : les fictives + celles
  // passées dans l'espace client qui concernent sa boutique.
  function merchantOrders() {
    const fromClient = state.clientOrders
      .filter(o => o.shopId === D.MERCHANT_SHOP_ID)
      .map(o => Object.assign({}, o, { customer: DEMO_CUSTOMER.name }));
    return fromClient.slice().reverse().concat(D.MERCHANT_ORDERS);
  }

  function findOrder(id) {
    return merchantOrders().find(o => o.id === id) || state.clientOrders.find(o => o.id === id);
  }

  function setStatus(order, status, message) {
    state.orderStatus[order.id] = status;
    const history = state.orderHistory[order.id] || [];
    history.push({ status, at: new Date().toISOString() });
    state.orderHistory[order.id] = history;
    save();
    if (message) toast(message);
    render();
  }

  /* ==========================================================
     Panier
     ========================================================== */
  function cartItems() {
    return state.cart
      .map(item => ({ item, product: productById(item.id) }))
      .filter(x => x.product);
  }

  function updateCartCount() {
    const n = state.cart.reduce((sum, i) => sum + i.qty, 0);
    cartCount.textContent = String(n);
    cartCount.hidden = n === 0;
  }

  function addToCart(product, qty) {
    if (!product || product.stock <= 0) {
      toast("Ce produit est en rupture de stock.");
      return;
    }
    const existing = state.cart.find(i => i.id === product.id);
    const wanted = (existing ? existing.qty : 0) + (qty || 1);
    if (wanted > product.stock) {
      toast("Stock fictif insuffisant : il en reste " + product.stock + ".");
      return;
    }
    if (existing) existing.qty = wanted;
    else state.cart.push({ id: product.id, qty: qty || 1 });
    save();
    toast("« " + product.name + " » ajouté au panier.");
  }

  function changeQty(id, delta) {
    const item = state.cart.find(i => i.id === id);
    const product = productById(id);
    if (!item || !product) return;
    const next = item.qty + delta;
    if (next <= 0) state.cart = state.cart.filter(i => i.id !== id);
    else if (next > product.stock) { toast("Stock fictif maximum atteint."); return; }
    else item.qty = next;
    save();
    render();
  }

  function toggleFavorite(id) {
    const set = new Set(state.favorites);
    if (set.has(id)) set.delete(id); else set.add(id);
    state.favorites = [...set];
    save();
  }

  /* ==========================================================
     Composants communs
     ========================================================== */
  function productVisual(product, size) {
    const box = h("div", { class: "visual tone-" + (product.tone || "lilac") + (size ? " visual-" + size : "") });
    box.append(ico(product.icon || "image", size === "lg" ? 72 : 44, "visual-ico"));
    box.setAttribute("aria-hidden", "true");
    return box;
  }

  function statusBadge(status) {
    const s = D.STATUSES[status] || { short: status, tone: "muted", icon: "info" };
    return h("span", { class: "badge badge-" + s.tone }, ico(s.icon, 14), s.short);
  }

  function backLink(hash, label) {
    return h("a", { class: "back-link", attrs: { href: hash } }, ico("arrow-left", 18), label);
  }

  function pageHead(title, subtitle, extra) {
    return h("div", { class: "page-head" },
      h("div", null,
        h("h1", { text: title, attrs: { tabindex: "-1" } }),
        subtitle ? h("p", { class: "muted", text: subtitle }) : null),
      extra || null);
  }

  function emptyState(title, text, actionLabel, actionHash) {
    return h("div", { class: "empty" },
      h("h1", { text: title, attrs: { tabindex: "-1" } }),
      h("p", { class: "muted", text: text }),
      actionLabel ? h("a", { class: "btn btn-primary", text: actionLabel, attrs: { href: actionHash } }) : null);
  }

  function productCard(product) {
    const shop = shopDisplay(shopById(product.shopId) || {});
    const isFav = state.favorites.includes(product.id);
    const out = product.stock <= 0;

    const favBtn = h("button", {
      class: "icon-btn fav-btn" + (isFav ? " is-active" : ""),
      attrs: { type: "button", "aria-pressed": String(isFav), "aria-label": (isFav ? "Retirer " : "Ajouter ") + product.name + (isFav ? " des favoris" : " aux favoris") },
      on: { click: () => { toggleFavorite(product.id); render(); } }
    }, icon("heart", { size: 18, filled: isFav }));

    const cartBtn = h("button", {
      class: "icon-btn",
      attrs: { type: "button", disabled: out, "aria-label": out ? product.name + " est en rupture de stock" : "Ajouter " + product.name + " au panier" },
      on: { click: () => addToCart(product, 1) }
    }, ico("shopping-cart", 18));

    return h("article", { class: "card product-card" },
      h("a", { class: "product-link", attrs: { href: "#/client/produit/" + product.id } },
        productVisual(product),
        h("div", { class: "product-body" },
          h("h3", { text: product.name }),
          h("p", { class: "muted small", text: shop.name || "" }),
          out ? h("span", { class: "badge badge-error", text: "Rupture de stock" }) : null)),
      h("div", { class: "product-foot" },
        h("span", { class: "price", text: price(product.price) }),
        h("div", { class: "product-actions" }, favBtn, cartBtn)));
  }

  function shopCard(shop) {
    const s = shopDisplay(shop);
    const count = allProducts().filter(p => p.shopId === shop.id).length;
    return h("a", { class: "card shop-card", attrs: { href: "#/client/boutique/" + shop.id } },
      h("div", { class: "shop-avatar tone-" + shop.tone, attrs: { "aria-hidden": "true" } }, ico("store", 24)),
      h("div", { class: "shop-card-body" },
        h("h3", { text: s.name }),
        h("p", { class: "muted small", text: s.tagline }),
        h("p", { class: "shop-meta small" },
          ico("map-pin", 14), s.wilaya, " · ", count + " produit(s)")),
      ico("chevron-right", 18, "shop-chevron"));
  }

  /* ==========================================================
     Accueil de l'aperçu
     ========================================================== */
  function viewHome() {
    return h("div", { class: "stack-lg" },
      h("section", { class: "hero" },
        h("p", { class: "eyebrow" }, h("span", { class: "pill", text: "Démonstration interactive — données fictives" })),
        h("h1", { text: "Découvrez DOKKANI, avant son lancement.", attrs: { tabindex: "-1" } }),
        h("p", { class: "lead", text: "Les boutiques que vous aimez, réunies au même endroit." }),
        h("p", { class: "hero-text", text: "DOKKANI réunit une marketplace pour découvrir les boutiques algériennes et un outil simple pour que les commerçants gèrent leur catalogue et leurs commandes, avec paiement à la livraison et confirmation des commandes par lien sécurisé." }),
        h("div", { class: "hero-actions" },
          h("a", { class: "btn btn-primary btn-lg", attrs: { href: "#/client" } }, ico("shopping-basket", 20), "Découvrir l'espace client"),
          h("a", { class: "btn btn-secondary btn-lg", attrs: { href: "#/commercant" } }, ico("store", 20), "Découvrir l'espace commerçant"))),

      h("section", { class: "grid-3" },
        featureCard("search", "Découvrir et comparer", "Recherchez un produit, parcourez les catégories et les boutiques, ajoutez vos coups de cœur aux favoris."),
        featureCard("shield", "Commander en confiance", "Paiement à la livraison. Chaque commande est confirmée par le client grâce à un lien sécurisé, pour limiter les fausses commandes."),
        featureCard("chart", "Gérer sa boutique", "Le commerçant suit ses commandes, met à jour ses produits et son stock depuis un tableau de bord simple.")),

      h("section", { class: "card info-card" },
        h("div", { class: "info-icon", attrs: { "aria-hidden": "true" } }, ico("info", 22)),
        h("div", null,
          h("h2", { text: "Comment fonctionne cet aperçu ?" }),
          h("p", { class: "muted", text: "Tout se passe dans votre navigateur : les boutiques, les produits, les clients et les commandes sont inventés. Aucune commande n'est réellement passée, aucun paiement n'est demandé, aucune information n'est envoyée à un serveur. Vous pouvez tout réinitialiser à tout moment en bas de page." }),
          h("div", { class: "hero-actions" },
            h("a", { class: "btn btn-soft", attrs: { href: "https://preinscription.dokkani-dz.com/", rel: "noopener" } }, "Se préinscrire au lancement"),
            h("a", { class: "btn btn-ghost", attrs: { href: "../" } }, ico("arrow-left", 18), "Retour au site officiel")))));
  }

  function featureCard(iconName, title, text) {
    return h("article", { class: "card feature" },
      h("div", { class: "feature-icon", attrs: { "aria-hidden": "true" } }, ico(iconName, 22)),
      h("h2", { text: title }),
      h("p", { class: "muted", text: text }));
  }

  /* ==========================================================
     Espace client
     ========================================================== */
  const ui = { category: "all", query: "", sort: "pertinence", favoritesOnly: false };

  function clientTabs(active) {
    const tabs = [
      ["catalogue", "#/client", "Découvrir"],
      ["commandes", "#/client/commandes", "Mes commandes"],
      ["panier", "#/client/panier", "Panier"]
    ];
    return h("nav", { class: "subnav", attrs: { "aria-label": "Espace client" } },
      h("span", { class: "subnav-label" }, ico("user", 16), "Espace client"),
      tabs.map(([key, href, label]) => h("a", {
        class: "subnav-link" + (active === key ? " is-active" : ""),
        text: label,
        attrs: { href, "aria-current": active === key ? "page" : false }
      })));
  }

  function filteredProducts() {
    const q = normalize(ui.query);
    const words = q.split(/\s+/).filter(Boolean);
    let list = allProducts().filter(p => {
      if (ui.category !== "all" && p.category !== ui.category) return false;
      if (ui.favoritesOnly && !state.favorites.includes(p.id)) return false;
      if (!words.length) return true;
      const shop = shopDisplay(shopById(p.shopId) || {});
      const hay = normalize([p.name, p.description, shop.name, (categoryById(p.category) || {}).name].join(" "));
      return words.every(w => hay.includes(w));
    });
    if (ui.sort === "prix-asc") list = list.slice().sort((a, b) => a.price - b.price);
    if (ui.sort === "prix-desc") list = list.slice().sort((a, b) => b.price - a.price);
    if (ui.sort === "nom") list = list.slice().sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return list;
  }

  function viewClientHome() {
    const resultsBox = h("div", { class: "grid-products" });
    const countBox = h("p", { class: "muted", attrs: { role: "status", "aria-live": "polite" } });

    function refresh() {
      const list = filteredProducts();
      resultsBox.replaceChildren();
      if (!list.length) {
        resultsBox.append(h("div", { class: "empty span-all" },
          h("h2", { text: ui.favoritesOnly ? "Aucun favori pour le moment" : "Aucun produit trouvé" }),
          h("p", { class: "muted", text: "Essayez un autre mot-clé ou une autre catégorie." })));
      } else {
        list.forEach(p => resultsBox.append(productCard(p)));
      }
      countBox.textContent = list.length + " produit(s)";
      catButtons.forEach(btn => btn.setAttribute("aria-pressed", String(btn.dataset.cat === ui.category)));
      favBtn.setAttribute("aria-pressed", String(ui.favoritesOnly));
    }

    const searchInput = h("input", {
      attrs: { id: "searchInput", type: "search", placeholder: "Robe, miel, écouteurs…", autocomplete: "off", value: ui.query },
      on: { input: e => { ui.query = e.target.value; refresh(); } }
    });

    const searchForm = h("form", {
      class: "search",
      attrs: { role: "search", novalidate: true },
      on: { submit: e => { e.preventDefault(); ui.query = searchInput.value; refresh(); resultsBox.scrollIntoView({ behavior: "smooth", block: "start" }); } }
    },
      h("label", { class: "sr-only", text: "Rechercher un produit", attrs: { for: "searchInput" } }),
      h("span", { class: "search-ico", attrs: { "aria-hidden": "true" } }, ico("search", 20)),
      searchInput,
      h("button", { class: "btn btn-primary", text: "Rechercher", attrs: { type: "submit" } }));

    const allCats = [{ id: "all", name: "Tout voir", icon: "layout-grid" }].concat(D.CATEGORIES);
    const catButtons = allCats.map(c => {
      const btn = h("button", {
        class: "category",
        attrs: { type: "button", "aria-pressed": String(ui.category === c.id) },
        on: { click: () => { ui.category = c.id; refresh(); } }
      }, h("span", { class: "category-icon", attrs: { "aria-hidden": "true" } }, ico(c.icon, 22)), h("span", { text: c.name }));
      btn.dataset.cat = c.id;
      return btn;
    });

    const sortSelect = h("select", {
      class: "select",
      attrs: { id: "sortSelect" },
      on: { change: e => { ui.sort = e.target.value; refresh(); } }
    },
      [["pertinence", "Pertinence"], ["prix-asc", "Prix croissant"], ["prix-desc", "Prix décroissant"], ["nom", "Nom (A à Z)"]]
        .map(([v, l]) => h("option", { text: l, attrs: { value: v, selected: ui.sort === v } })));

    const favBtn = h("button", {
      class: "btn btn-soft",
      attrs: { type: "button", "aria-pressed": String(ui.favoritesOnly) },
      on: { click: () => { ui.favoritesOnly = !ui.favoritesOnly; refresh(); } }
    }, ico("heart", 18), "Mes favoris");

    const view = h("div", { class: "stack-lg" },
      clientTabs("catalogue"),
      h("section", { class: "hero hero-client" },
        h("p", { class: "eyebrow", text: "Votre marketplace en Algérie" }),
        h("h1", { text: "Découvrez vos prochaines pépites.", attrs: { tabindex: "-1" } }),
        h("p", { class: "hero-text", text: "Explorez des boutiques fictives, trouvez un produit et passez une commande simulée." }),
        searchForm),
      h("section", { attrs: { "aria-labelledby": "catTitle" } },
        h("h2", { text: "Catégories", attrs: { id: "catTitle" } }),
        h("div", { class: "categories", attrs: { role: "group", "aria-label": "Filtrer par catégorie" } }, catButtons)),
      h("section", { attrs: { "aria-labelledby": "prodTitle" } },
        h("div", { class: "section-head" },
          h("div", null, h("h2", { text: "Produits", attrs: { id: "prodTitle" } }), countBox),
          h("div", { class: "toolbar" },
            favBtn,
            h("label", { class: "sr-only", text: "Trier les produits", attrs: { for: "sortSelect" } }),
            sortSelect)),
        resultsBox),
      h("section", { attrs: { "aria-labelledby": "shopTitle" } },
        h("h2", { text: "Boutiques", attrs: { id: "shopTitle" } }),
        h("div", { class: "grid-shops" }, D.SHOPS.map(shopCard))));

    refresh();
    return view;
  }

  function viewProduct(id) {
    const product = productById(id);
    if (!product) return h("div", null, clientTabs(""), emptyState("Produit introuvable", "Ce produit fictif n'existe pas ou a été retiré.", "Retour au catalogue", "#/client"));
    const shop = shopDisplay(shopById(product.shopId) || {});
    const out = product.stock <= 0;
    const isFav = state.favorites.includes(product.id);
    let qty = 1;

    const qtyValue = h("span", { class: "qty-value", text: "1", attrs: { "aria-live": "polite" } });
    const setQty = n => { qty = Math.max(1, Math.min(n, Math.max(1, product.stock))); qtyValue.textContent = String(qty); };

    const similar = allProducts().filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

    return h("div", { class: "stack-lg" },
      clientTabs(""),
      backLink("#/client", "Retour au catalogue"),
      h("article", { class: "card product-detail" },
        productVisual(product, "lg"),
        h("div", { class: "product-detail-body" },
          h("p", { class: "eyebrow", text: (categoryById(product.category) || {}).name || "" }),
          h("h1", { text: product.name, attrs: { tabindex: "-1" } }),
          h("a", { class: "shop-inline", attrs: { href: "#/client/boutique/" + shop.id } }, ico("store", 16), "Vendu par " + shop.name),
          h("p", { class: "price price-lg", text: price(product.price) }),
          h("p", { text: product.description }),
          h("p", { class: "muted small" },
            out ? "Rupture de stock (fictive)." : "Stock fictif disponible : " + product.stock),
          h("div", { class: "buy-row" },
            h("div", { class: "qty", attrs: { role: "group", "aria-label": "Quantité" } },
              h("button", { class: "icon-btn", attrs: { type: "button", "aria-label": "Diminuer la quantité", disabled: out }, on: { click: () => setQty(qty - 1) } }, ico("minus", 18)),
              qtyValue,
              h("button", { class: "icon-btn", attrs: { type: "button", "aria-label": "Augmenter la quantité", disabled: out }, on: { click: () => setQty(qty + 1) } }, ico("plus", 18))),
            h("button", { class: "btn btn-primary", attrs: { type: "button", disabled: out }, on: { click: () => addToCart(product, qty) } },
              ico("shopping-cart", 18), out ? "Indisponible" : "Ajouter au panier"),
            h("button", {
              class: "btn btn-soft",
              attrs: { type: "button", "aria-pressed": String(isFav) },
              on: { click: () => { toggleFavorite(product.id); render(); } }
            }, icon("heart", { size: 18, filled: isFav }), isFav ? "Dans mes favoris" : "Ajouter aux favoris")),
          h("ul", { class: "assurances" },
            h("li", null, ico("banknote", 18), "Paiement à la livraison"),
            h("li", null, ico("shield", 18), "Confirmation de la commande par lien sécurisé"),
            h("li", null, ico("truck", 18), "Livraison organisée par le vendeur")))),
      similar.length ? h("section", null,
        h("h2", { text: "Dans la même catégorie" }),
        h("div", { class: "grid-products" }, similar.map(productCard))) : null);
  }

  function viewShop(id) {
    const base = shopById(id);
    if (!base) return h("div", null, clientTabs(""), emptyState("Boutique introuvable", "Cette boutique fictive n'existe pas.", "Retour au catalogue", "#/client"));
    const shop = shopDisplay(base);
    const products = allProducts().filter(p => p.shopId === id);
    return h("div", { class: "stack-lg" },
      clientTabs(""),
      backLink("#/client", "Retour au catalogue"),
      h("section", { class: "card shop-header" },
        h("div", { class: "shop-avatar shop-avatar-lg tone-" + base.tone, attrs: { "aria-hidden": "true" } }, ico("store", 36)),
        h("div", null,
          h("p", { class: "eyebrow", text: (categoryById(base.category) || {}).name || "Boutique" }),
          h("h1", { text: shop.name, attrs: { tabindex: "-1" } }),
          h("p", { class: "lead-sm", text: shop.tagline }),
          h("p", { class: "muted", text: shop.description }),
          h("ul", { class: "shop-facts" },
            h("li", null, ico("map-pin", 16), shop.wilaya),
            h("li", null, ico("star", 16), String(shop.rating).replace(".", ",") + " / 5 (avis fictifs)"),
            h("li", null, ico("phone", 16), "Téléphone masqué dans la démo"),
            h("li", null, ico("clock", 16), "Sur DOKKANI depuis " + shop.since)),
          h("button", {
            class: "btn btn-soft",
            attrs: { type: "button" },
            on: { click: () => toast("Démonstration : la messagerie avec le vendeur n'est pas active.") }
          }, ico("message", 18), "Contacter le vendeur"))),
      h("section", null,
        h("h2", { text: "Produits de la boutique (" + products.length + ")" }),
        products.length
          ? h("div", { class: "grid-products" }, products.map(productCard))
          : h("p", { class: "muted", text: "Cette boutique n'a pas encore de produit." })));
  }

  function cartGroups() {
    const groups = new Map();
    cartItems().forEach(({ item, product }) => {
      if (!groups.has(product.shopId)) groups.set(product.shopId, []);
      groups.get(product.shopId).push({ item, product });
    });
    return groups;
  }

  function viewCart() {
    const groups = cartGroups();
    if (!groups.size) {
      return h("div", { class: "stack-lg" }, clientTabs("panier"),
        pageHead("Votre panier", "Panier de démonstration, conservé uniquement sur cet appareil."),
        emptyState("Votre panier est vide", "Ajoutez des produits fictifs depuis le catalogue.", "Parcourir le catalogue", "#/client"));
    }

    let itemsTotal = 0;
    const blocks = [];
    groups.forEach((rows, shopId) => {
      const shop = shopDisplay(shopById(shopId) || {});
      blocks.push(h("section", { class: "card cart-group" },
        h("h2", { class: "cart-shop" }, ico("store", 18), shop.name),
        h("ul", { class: "cart-list" }, rows.map(({ item, product }) => {
          itemsTotal += product.price * item.qty;
          return h("li", { class: "cart-line" },
            productVisual(product, "sm"),
            h("div", { class: "cart-line-info" },
              h("a", { text: product.name, attrs: { href: "#/client/produit/" + product.id } }),
              h("span", { class: "muted small", text: price(product.price) + " l'unité" })),
            h("div", { class: "qty", attrs: { role: "group", "aria-label": "Quantité de " + product.name } },
              h("button", { class: "icon-btn", attrs: { type: "button", "aria-label": "Retirer une unité de " + product.name }, on: { click: () => changeQty(product.id, -1) } }, ico("minus", 16)),
              h("span", { class: "qty-value", text: String(item.qty) }),
              h("button", { class: "icon-btn", attrs: { type: "button", "aria-label": "Ajouter une unité de " + product.name, disabled: item.qty >= product.stock }, on: { click: () => changeQty(product.id, 1) } }, ico("plus", 16))),
            h("strong", { class: "cart-line-total", text: price(product.price * item.qty) }),
            h("button", {
              class: "icon-btn danger",
              attrs: { type: "button", "aria-label": "Retirer " + product.name + " du panier" },
              on: { click: () => changeQty(product.id, -item.qty) }
            }, ico("trash", 16)));
        }))));
    });

    const delivery = DELIVERY_FEE * groups.size;
    return h("div", { class: "stack-lg" },
      clientTabs("panier"),
      pageHead("Votre panier", groups.size > 1 ? "Vos articles viennent de " + groups.size + " boutiques : une commande sera créée pour chacune." : "Panier de démonstration, conservé uniquement sur cet appareil."),
      h("div", { class: "cart-layout" },
        h("div", { class: "stack" }, blocks),
        h("aside", { class: "card summary" },
          h("h2", { text: "Récapitulatif" }),
          summaryRow("Articles", price(itemsTotal)),
          summaryRow("Livraison (fictive)", price(delivery)),
          h("hr"),
          summaryRow("Total", price(itemsTotal + delivery), true),
          h("p", { class: "muted small", text: "Paiement à la livraison. Aucun paiement en ligne." }),
          h("a", { class: "btn btn-primary btn-block", attrs: { href: "#/client/commande" } }, "Passer la commande (simulation)"))));
  }

  function summaryRow(label, value, strong) {
    return h("div", { class: "summary-row" + (strong ? " is-total" : "") }, h("span", { text: label }), h("span", { text: value }));
  }

  function viewCheckout() {
    const groups = cartGroups();
    if (!groups.size) return h("div", null, clientTabs("panier"), emptyState("Votre panier est vide", "Ajoutez d'abord des produits fictifs.", "Parcourir le catalogue", "#/client"));

    const wilayaSelect = h("select", { class: "select", attrs: { id: "coWilaya", required: true } },
      D.WILAYAS.map(w => h("option", { text: w, attrs: { value: w, selected: w === "Oran" } })));

    let itemsTotal = 0;
    cartItems().forEach(({ item, product }) => { itemsTotal += product.price * item.qty; });

    const form = h("form", {
      class: "card form",
      attrs: { novalidate: true },
      on: { submit: e => { e.preventDefault(); placeOrder(wilayaSelect.value); } }
    },
      h("h2", { text: "Informations de livraison" }),
      h("p", { class: "notice notice-info" }, ico("shield", 18),
        "Démonstration : les coordonnées ci-dessous sont fictives et ne peuvent pas être modifiées. Rien n'est envoyé ni enregistré."),
      readonlyField("Nom complet", DEMO_CUSTOMER.name),
      readonlyField("Téléphone", DEMO_CUSTOMER.phone),
      h("label", { class: "field" }, h("span", { text: "Wilaya de livraison" }), wilayaSelect),
      readonlyField("Adresse", DEMO_CUSTOMER.address),
      h("div", { class: "pay-method" }, ico("banknote", 20),
        h("div", null, h("strong", { text: "Paiement à la livraison" }), h("p", { class: "muted small", text: "Aucun paiement n'est demandé dans cette démonstration." }))),
      h("button", { class: "btn btn-primary btn-block", attrs: { type: "submit" } }, ico("check", 18), "Confirmer la commande fictive"));

    return h("div", { class: "stack-lg" },
      clientTabs("panier"),
      backLink("#/client/panier", "Retour au panier"),
      pageHead("Passer la commande", "Étape simulée : aucune commande réelle n'est créée."),
      h("div", { class: "cart-layout" },
        form,
        h("aside", { class: "card summary" },
          h("h2", { text: "Votre commande" }),
          cartItems().map(({ item, product }) => summaryRow(product.name + " × " + item.qty, price(product.price * item.qty))),
          summaryRow("Livraison (fictive)", price(DELIVERY_FEE * groups.size)),
          h("hr"),
          summaryRow("Total", price(itemsTotal + DELIVERY_FEE * groups.size), true))));
  }

  function readonlyField(label, value) {
    return h("div", { class: "field" },
      h("span", { text: label }),
      h("div", { class: "readonly", text: value }));
  }

  function placeOrder(wilaya) {
    const groups = cartGroups();
    if (!groups.size) return;
    const created = [];
    const now = new Date().toISOString();
    groups.forEach((rows, shopId) => {
      const id = "DK-" + state.nextOrder++;
      state.clientOrders.push({
        id, shopId, wilaya: D.WILAYAS.includes(wilaya) ? wilaya : "Oran", createdAt: now, status: "en_attente",
        lines: rows.map(({ item, product }) => ({ productId: product.id, qty: item.qty }))
      });
      state.orderHistory[id] = [{ status: "en_attente", at: now }];
      rows.forEach(({ item, product }) => { state.stock[product.id] = Math.max(0, product.stock - item.qty); });
      created.push(id);
    });
    state.cart = [];
    save();
    toast(created.length > 1 ? created.length + " commandes fictives créées." : "Commande fictive " + created[0] + " créée.");
    go("#/client/suivi/" + created[0]);
  }

  function viewClientOrders() {
    const orders = state.clientOrders.slice().reverse();
    return h("div", { class: "stack-lg" },
      clientTabs("commandes"),
      pageHead("Mes commandes", "Commandes fictives passées pendant cette démonstration."),
      orders.length
        ? h("ul", { class: "order-list" }, orders.map(o => {
          const shop = shopDisplay(shopById(o.shopId) || {});
          return h("li", null, h("a", { class: "card order-row", attrs: { href: "#/client/suivi/" + o.id } },
            h("div", null, h("strong", { text: o.id }), h("p", { class: "muted small", text: shop.name + " · " + formatDate(o.createdAt) })),
            statusBadge(orderStatus(o)),
            h("strong", { class: "order-total", text: price(orderTotal(o)) }),
            ico("chevron-right", 18)));
        }))
        : emptyState("Aucune commande pour le moment", "Ajoutez un produit au panier puis passez une commande simulée.", "Parcourir le catalogue", "#/client"));
  }

  const TRACK_STEPS = [
    ["en_attente", "Commande passée", "Le vendeur reçoit votre commande et vous envoie un lien de confirmation sécurisé."],
    ["confirmee", "Confirmée par vous", "Vous confirmez la commande depuis le lien : le vendeur la prépare."],
    ["expediee", "Expédiée", "Le colis est remis au livreur."],
    ["livree", "Livrée", "Vous payez à la livraison."]
  ];

  function timeline(status) {
    const order = ["en_attente", "confirmee", "expediee", "livree"];
    let reached = order.indexOf(status);
    if (status === "modification_demandee") reached = 0;
    const stopped = status === "annulee" || status === "refusee";
    return h("ol", { class: "timeline" }, TRACK_STEPS.map(([key, title, text], i) => {
      const done = !stopped && i <= reached;
      const current = !stopped && i === reached;
      return h("li", { class: "timeline-step" + (done ? " is-done" : "") + (current ? " is-current" : "") },
        h("span", { class: "timeline-dot", attrs: { "aria-hidden": "true" } }, done ? ico("check", 14) : null),
        h("div", null,
          h("strong", { text: title }),
          h("p", { class: "muted small", text: text }),
          current ? h("span", { class: "sr-only", text: "(étape actuelle)" }) : null));
    }));
  }

  function viewTracking(id) {
    const order = state.clientOrders.find(o => o.id === id);
    if (!order) return h("div", null, clientTabs("commandes"), emptyState("Commande introuvable", "Cette commande fictive n'existe pas sur cet appareil.", "Mes commandes", "#/client/commandes"));
    const status = orderStatus(order);
    const shop = shopDisplay(shopById(order.shopId) || {});

    const actions = [];
    if (status === "en_attente") {
      actions.push(
        h("button", { class: "btn btn-primary", attrs: { type: "button" }, on: { click: () => setStatus(order, "confirmee", "Commande confirmée (simulation du lien sécurisé).") } },
          ico("circle-check", 18), "Confirmer ma commande"),
        h("button", { class: "btn btn-soft", attrs: { type: "button" }, on: { click: () => setStatus(order, "modification_demandee", "Demande de modification envoyée au vendeur (simulation).") } },
          ico("pencil", 18), "Demander une modification"));
    } else if (status === "confirmee") {
      actions.push(h("button", { class: "btn btn-soft", attrs: { type: "button" }, on: { click: () => setStatus(order, "expediee", "Le vendeur a expédié la commande (simulation).") } },
        ico("truck", 18), "Simuler l'expédition par le vendeur"));
    } else if (status === "expediee") {
      actions.push(h("button", { class: "btn btn-soft", attrs: { type: "button" }, on: { click: () => setStatus(order, "livree", "Commande livrée (simulation).") } },
        ico("package", 18), "Simuler la livraison"));
    }

    return h("div", { class: "stack-lg" },
      clientTabs("commandes"),
      backLink("#/client/commandes", "Mes commandes"),
      pageHead("Suivi de la commande " + order.id, shop.name + " · passée le " + formatDate(order.createdAt), statusBadge(status)),
      h("div", { class: "cart-layout" },
        h("section", { class: "card" },
          h("h2", { text: "Où en est ma commande ?" }),
          (status === "annulee" || status === "refusee")
            ? h("p", { class: "notice notice-error", text: "Cette commande fictive a été " + (status === "annulee" ? "annulée" : "refusée") + " par le vendeur." })
            : timeline(status),
          status === "modification_demandee"
            ? h("p", { class: "notice notice-warning", text: "Votre demande de modification a été transmise au vendeur (simulation). Il vous recontactera." })
            : null,
          status === "en_attente"
            ? h("div", { class: "secure-link" },
              ico("shield", 20),
              h("div", null,
                h("strong", { text: "Lien de confirmation sécurisé (simulé)" }),
                h("p", { class: "muted small", text: "Dans DOKKANI, ce lien unique est envoyé par le vendeur et ne donne accès qu'à cette commande. Il permet de confirmer la commande avant l'expédition, pour réduire les fausses commandes et les colis non récupérés." })))
            : null,
          actions.length ? h("div", { class: "actions" }, actions) : null),
        h("aside", { class: "card summary" },
          h("h2", { text: "Détail" }),
          order.lines.map(line => {
            const p = productById(line.productId);
            return p ? summaryRow(p.name + " × " + line.qty, price(p.price * line.qty)) : null;
          }),
          summaryRow("Livraison (fictive)", price(DELIVERY_FEE)),
          h("hr"),
          summaryRow("Total à payer à la livraison", price(orderTotal(order)), true),
          h("p", { class: "muted small", text: "Livraison : " + order.wilaya + " · " + DEMO_CUSTOMER.address }))));
  }

  /* ==========================================================
     Espace commerçant
     ========================================================== */
  function merchantTabs(active) {
    const tabs = [
      ["dashboard", "#/commercant", "Tableau de bord", "chart"],
      ["commandes", "#/commercant/commandes", "Commandes", "clipboard-list"],
      ["produits", "#/commercant/produits", "Produits", "package"],
      ["boutique", "#/commercant/boutique", "Ma boutique", "store"]
    ];
    const pending = merchantOrders().filter(o => orderStatus(o) === "en_attente").length;
    return h("nav", { class: "subnav", attrs: { "aria-label": "Espace commerçant" } },
      h("span", { class: "subnav-label" }, ico("store", 16), merchantShop().name),
      tabs.map(([key, href, label, iconName]) => h("a", {
        class: "subnav-link" + (active === key ? " is-active" : ""),
        attrs: { href, "aria-current": active === key ? "page" : false }
      }, ico(iconName, 16), label,
        key === "commandes" && pending ? h("span", { class: "count-dot", text: String(pending), attrs: { "aria-label": pending + " en attente" } }) : null)));
  }

  function merchantProducts() {
    return allProducts().filter(p => p.shopId === D.MERCHANT_SHOP_ID);
  }

  function statCard(iconName, label, value, hint) {
    return h("div", { class: "card stat" },
      h("div", { class: "stat-icon", attrs: { "aria-hidden": "true" } }, ico(iconName, 20)),
      h("p", { class: "muted small", text: label }),
      h("p", { class: "stat-value", text: value }),
      hint ? h("p", { class: "muted small", text: hint }) : null);
  }

  function viewMerchantDashboard() {
    const orders = merchantOrders();
    const statuses = orders.map(orderStatus);
    const count = s => statuses.filter(x => x === s).length;
    const revenue = orders.filter(o => ["confirmee", "expediee", "livree"].includes(orderStatus(o)))
      .reduce((sum, o) => sum + orderTotal(o) - DELIVERY_FEE, 0);
    const decided = statuses.filter(s => s !== "en_attente").length;
    const confirmedLike = statuses.filter(s => ["confirmee", "expediee", "livree"].includes(s)).length;
    const rate = decided ? Math.round(confirmedLike / decided * 100) : 0;
    const products = merchantProducts();
    const outOfStock = products.filter(p => p.stock <= 0).length;

    // Ventes fictives des 7 derniers jours (illustration)
    const week = [["Lun", 3], ["Mar", 5], ["Mer", 2], ["Jeu", 6], ["Ven", 8], ["Sam", 4], ["Dim", 7]];
    const max = Math.max.apply(null, week.map(w => w[1]));

    const chart = h("div", { class: "bars", attrs: { role: "img", "aria-label": "Commandes fictives des 7 derniers jours : " + week.map(w => w[0] + " " + w[1]).join(", ") } },
      week.map(([day, n]) => {
        const bar = h("div", { class: "bar" });
        bar.style.height = Math.round(n / max * 100) + "%";
        return h("div", { class: "bar-col" }, h("span", { class: "bar-value", text: String(n) }), h("div", { class: "bar-track" }, bar), h("span", { class: "bar-label", text: day }));
      }));

    const recent = orders.slice(0, 4);

    return h("div", { class: "stack-lg" },
      merchantTabs("dashboard"),
      pageHead("Bonjour, " + merchantShop().name,"Tableau de bord de démonstration : chiffres et commandes fictifs."),
      h("div", { class: "grid-stats" },
        statCard("banknote", "Ventes confirmées", price(revenue), "hors livraison"),
        statCard("clipboard-list", "Commandes", String(orders.length), count("en_attente") + " en attente de confirmation"),
        statCard("trending-up", "Taux de confirmation", rate + " %", "commandes confirmées par lien"),
        statCard("package", "Produits en ligne", String(products.length), outOfStock ? outOfStock + " en rupture" : "tous disponibles")),
      h("div", { class: "dash-layout" },
        h("section", { class: "card" },
          h("div", { class: "section-head" },
            h("h2", { text: "Commandes récentes" }),
            h("a", { class: "btn btn-ghost", attrs: { href: "#/commercant/commandes" } }, "Tout voir", ico("chevron-right", 16))),
          h("ul", { class: "order-list compact" }, recent.map(merchantOrderRow))),
        h("section", { class: "card" },
          h("h2", { text: "Activité de la semaine" }),
          h("p", { class: "muted small", text: "Nombre de commandes par jour (données fictives)." }),
          chart)),
      workflowCard());
  }

  function workflowCard() {
    const steps = [
      ["clipboard-list", "1. Réception", "Une commande arrive depuis la marketplace ou est saisie à partir d'un message."],
      ["shield", "2. Confirmation", "Le client reçoit un lien sécurisé et confirme, ou demande une modification."],
      ["truck", "3. Expédition", "Une fois confirmée, la commande est préparée puis expédiée."],
      ["banknote", "4. Livraison et paiement", "Le client paie à la livraison ; la commande passe en « Livrée »."]
    ];
    return h("section", { class: "card" },
      h("h2", { text: "Le parcours d'une commande sur DOKKANI" }),
      h("ol", { class: "workflow" }, steps.map(([iconName, title, text]) =>
        h("li", null,
          h("div", { class: "workflow-icon", attrs: { "aria-hidden": "true" } }, ico(iconName, 22)),
          h("strong", { text: title }),
          h("p", { class: "muted small", text: text })))));
  }

  function merchantOrderRow(o) {
    return h("li", null, h("a", { class: "card order-row", attrs: { href: "#/commercant/commandes/" + o.id } },
      h("div", null,
        h("strong", { text: o.id }),
        h("p", { class: "muted small", text: o.customer + " · " + o.wilaya + " · " + formatDate(o.createdAt) })),
      statusBadge(orderStatus(o)),
      h("strong", { class: "order-total", text: price(orderTotal(o)) }),
      ico("chevron-right", 18)));
  }

  const merchantUi = { filter: "all" };

  function viewMerchantOrders() {
    const orders = merchantOrders();
    const filters = [["all", "Toutes"], ["en_attente", "En attente"], ["modification_demandee", "Modification"], ["confirmee", "Confirmées"], ["expediee", "Expédiées"], ["livree", "Livrées"], ["annulee", "Annulées / refusées"]];
    const list = orders.filter(o => {
      const s = orderStatus(o);
      if (merchantUi.filter === "all") return true;
      if (merchantUi.filter === "annulee") return s === "annulee" || s === "refusee";
      return s === merchantUi.filter;
    });

    return h("div", { class: "stack-lg" },
      merchantTabs("commandes"),
      pageHead("Commandes", "Cliquez sur une commande pour la traiter. Les actions sont simulées dans votre navigateur."),
      h("div", { class: "chips", attrs: { role: "group", "aria-label": "Filtrer par statut" } },
        filters.map(([key, label]) => {
          const n = key === "all" ? orders.length : orders.filter(o => {
            const s = orderStatus(o);
            return key === "annulee" ? (s === "annulee" || s === "refusee") : s === key;
          }).length;
          return h("button", {
            class: "chip",
            attrs: { type: "button", "aria-pressed": String(merchantUi.filter === key) },
            on: { click: () => { merchantUi.filter = key; render(); } }
          }, label, h("span", { class: "chip-count", text: String(n) }));
        })),
      list.length
        ? h("ul", { class: "order-list" }, list.map(merchantOrderRow))
        : h("p", { class: "muted", text: "Aucune commande dans ce statut." }));
  }

  function viewMerchantOrder(id) {
    const order = merchantOrders().find(o => o.id === id);
    if (!order) return h("div", null, merchantTabs("commandes"), emptyState("Commande introuvable", "Cette commande fictive n'existe pas.", "Retour aux commandes", "#/commercant/commandes"));
    const status = orderStatus(order);

    const btn = (label, iconName, next, message, variant) =>
      h("button", { class: "btn " + (variant || "btn-soft"), attrs: { type: "button" }, on: { click: () => setStatus(order, next, message) } }, ico(iconName, 18), label);

    const actions = [];
    if (status === "en_attente") {
      actions.push(
        h("button", {
          class: "btn btn-soft", attrs: { type: "button" },
          on: { click: () => toast("Démonstration : le lien de confirmation serait envoyé au client par SMS ou WhatsApp.") }
        }, ico("message", 18), "Envoyer le lien de confirmation"),
        btn("Simuler la confirmation du client", "circle-check", "confirmee", "Le client a confirmé la commande (simulation).", "btn-primary"),
        btn("Refuser la commande", "x", "refusee", "Commande refusée (simulation).", "btn-danger"));
    } else if (status === "modification_demandee") {
      actions.push(
        btn("Modification traitée : renvoyer pour confirmation", "pencil", "en_attente", "Commande remise en attente de confirmation (simulation).", "btn-primary"),
        btn("Annuler la commande", "x", "annulee", "Commande annulée (simulation).", "btn-danger"));
    } else if (status === "confirmee") {
      actions.push(
        btn("Marquer comme expédiée", "truck", "expediee", "Commande marquée expédiée (simulation).", "btn-primary"),
        btn("Annuler la commande", "x", "annulee", "Commande annulée (simulation).", "btn-danger"));
    } else if (status === "expediee") {
      actions.push(btn("Marquer comme livrée", "package", "livree", "Commande marquée livrée (simulation).", "btn-primary"));
    }

    const statusSelect = h("select", { class: "select", attrs: { id: "statusSelect" } },
      Object.keys(D.STATUSES).map(k => h("option", { text: D.STATUSES[k].label, attrs: { value: k, selected: k === status } })));

    const history = (state.orderHistory[order.id] || []).slice().reverse();

    return h("div", { class: "stack-lg" },
      merchantTabs("commandes"),
      backLink("#/commercant/commandes", "Toutes les commandes"),
      pageHead("Commande " + order.id, order.customer + " · " + order.wilaya + " · " + formatDate(order.createdAt), statusBadge(status)),
      h("div", { class: "cart-layout" },
        h("div", { class: "stack" },
          h("section", { class: "card" },
            h("h2", { text: "Traiter la commande" }),
            h("p", { class: "muted", text: D.STATUSES[status] ? D.STATUSES[status].label + "." : "" }),
            order.note ? h("p", { class: "notice notice-warning", text: "Note : " + order.note }) : null,
            actions.length
              ? h("div", { class: "actions" }, actions)
              : h("p", { class: "muted", text: "Cette commande est terminée : aucune action n'est nécessaire." }),
            h("form", {
              class: "inline-form",
              attrs: { novalidate: true },
              on: { submit: e => { e.preventDefault(); if (statusSelect.value !== status) setStatus(order, statusSelect.value, "Statut modifié (simulation)."); } }
            },
              h("label", { class: "field" }, h("span", { text: "Modifier le statut manuellement" }), statusSelect),
              h("button", { class: "btn btn-ghost", text: "Appliquer", attrs: { type: "submit" } }))),
          h("section", { class: "card" },
            h("h2", { text: "Client" }),
            h("ul", { class: "shop-facts" },
              h("li", null, ico("user", 16), order.customer),
              h("li", null, ico("phone", 16), "Téléphone masqué (démonstration)"),
              h("li", null, ico("map-pin", 16), order.wilaya + " — adresse fictive"))),
          history.length ? h("section", { class: "card" },
            h("h2", { text: "Historique (cette session)" }),
            h("ul", { class: "history" }, history.map(ev => h("li", null, statusBadge(ev.status), h("span", { class: "muted small", text: formatDate(ev.at) }))))) : null),
        h("aside", { class: "card summary" },
          h("h2", { text: "Articles" }),
          order.lines.map(line => {
            const p = productById(line.productId);
            return p ? summaryRow(p.name + " × " + line.qty, price(p.price * line.qty)) : summaryRow("Produit retiré × " + line.qty, "—");
          }),
          summaryRow("Livraison (fictive)", price(DELIVERY_FEE)),
          h("hr"),
          summaryRow(["annulee", "refusee"].includes(status) ? "Total de la commande (non encaissé)" : "Total encaissé à la livraison", price(orderTotal(order)), true))));
  }

  function viewMerchantProducts() {
    const products = merchantProducts();
    const msg = h("p", { class: "form-message", attrs: { role: "status", "aria-live": "polite" } });

    const fName = h("input", { attrs: { id: "pName", type: "text", maxlength: "80", required: true, placeholder: "Ex. Robe d'intérieur brodée" } });
    const fPrice = h("input", { attrs: { id: "pPrice", type: "number", min: "1", max: "10000000", step: "1", required: true, inputmode: "numeric", placeholder: "Ex. 4500" } });
    const fStock = h("input", { attrs: { id: "pStock", type: "number", min: "0", max: "100000", step: "1", required: true, value: "10", inputmode: "numeric" } });
    const fCat = h("select", { class: "select", attrs: { id: "pCat" } }, D.CATEGORIES.map(c => h("option", { text: c.name, attrs: { value: c.id, selected: c.id === "mode" } })));
    const fDesc = h("textarea", { attrs: { id: "pDesc", rows: "3", maxlength: "400", placeholder: "Matière, tailles, entretien…" } });

    const form = h("form", {
      class: "card form",
      attrs: { novalidate: true },
      on: {
        submit: e => {
          e.preventDefault();
          const name = fName.value.trim();
          const priceVal = Number(fPrice.value);
          const stockVal = Number(fStock.value);
          if (name.length < 2) { msg.className = "form-message is-error"; msg.textContent = "Indiquez un nom de produit (2 caractères minimum)."; fName.focus(); return; }
          if (!Number.isInteger(priceVal) || priceVal <= 0) { msg.className = "form-message is-error"; msg.textContent = "Indiquez un prix entier supérieur à 0."; fPrice.focus(); return; }
          if (!Number.isInteger(stockVal) || stockVal < 0) { msg.className = "form-message is-error"; msg.textContent = "Indiquez un stock entier (0 ou plus)."; fStock.focus(); return; }
          const cat = categoryById(fCat.value) || D.CATEGORIES[0];
          const tones = ["lilac", "mint", "pink", "amber", "blue"];
          state.addedProducts.push({
            id: state.nextProduct++, shopId: D.MERCHANT_SHOP_ID, name, category: cat.id,
            price: priceVal, stock: stockVal, icon: cat.icon, tone: tones[state.addedProducts.length % tones.length],
            description: fDesc.value.trim() || "Produit ajouté pendant la démonstration.", addedInDemo: true
          });
          save();
          toast("Produit fictif ajouté. Il apparaît aussi dans l'espace client.");
          render();
        }
      }
    },
      h("h2", { text: "Ajouter un produit (fictif)" }),
      h("p", { class: "muted small", text: "Le produit est gardé uniquement dans ce navigateur. Les photos ne sont pas proposées dans la démonstration." }),
      h("label", { class: "field" }, h("span", { text: "Nom du produit" }), fName),
      h("div", { class: "field-row" },
        h("label", { class: "field" }, h("span", { text: "Prix (DA)" }), fPrice),
        h("label", { class: "field" }, h("span", { text: "Stock" }), fStock)),
      h("label", { class: "field" }, h("span", { text: "Catégorie" }), fCat),
      h("label", { class: "field" }, h("span", { text: "Description" }), fDesc),
      h("button", { class: "btn btn-primary btn-block", attrs: { type: "submit" } }, ico("plus", 18), "Ajouter le produit"),
      msg);

    const rows = products.map(p => h("li", { class: "card product-row" },
      productVisual(p, "sm"),
      h("div", { class: "product-row-info" },
        h("strong", { text: p.name }),
        h("span", { class: "muted small", text: price(p.price) + " · " + ((categoryById(p.category) || {}).name || "") }),
        p.addedInDemo ? h("span", { class: "badge badge-primary", text: "Ajouté dans la démo" }) : null),
      h("div", { class: "qty", attrs: { role: "group", "aria-label": "Stock de " + p.name } },
        h("button", { class: "icon-btn", attrs: { type: "button", "aria-label": "Diminuer le stock de " + p.name, disabled: p.stock <= 0 }, on: { click: () => { state.stock[p.id] = Math.max(0, p.stock - 1); save(); render(); } } }, ico("minus", 16)),
        h("span", { class: "qty-value" + (p.stock <= 0 ? " is-out" : ""), text: String(p.stock) }),
        h("button", { class: "icon-btn", attrs: { type: "button", "aria-label": "Augmenter le stock de " + p.name }, on: { click: () => { state.stock[p.id] = p.stock + 1; save(); render(); } } }, ico("plus", 16))),
      p.stock <= 0 ? h("span", { class: "badge badge-error", text: "Rupture" }) : h("span", { class: "badge badge-success", text: "En ligne" }),
      h("button", {
        class: "icon-btn danger",
        attrs: { type: "button", "aria-label": "Retirer " + p.name + " du catalogue" },
        on: {
          click: () => {
            if (p.addedInDemo) state.addedProducts = state.addedProducts.filter(x => x.id !== p.id);
            else state.removedProducts.push(p.id);
            state.cart = state.cart.filter(i => i.id !== p.id);
            save();
            toast("« " + p.name + " » retiré du catalogue (simulation).");
            render();
          }
        }
      }, ico("trash", 16))));

    return h("div", { class: "stack-lg" },
      merchantTabs("produits"),
      pageHead("Produits", products.length + " produit(s) dans la boutique. Ajustez le stock ou ajoutez un produit fictif."),
      h("div", { class: "cart-layout" },
        h("ul", { class: "product-rows" }, rows.length ? rows : h("li", { class: "muted", text: "Aucun produit." })),
        form));
  }

  function viewMerchantShop() {
    const shop = merchantShop();
    const fTagline = h("input", { attrs: { id: "sTagline", type: "text", maxlength: "60", value: shop.tagline } });
    const fDesc = h("textarea", { attrs: { id: "sDesc", rows: "4", maxlength: "400" } });
    fDesc.value = shop.description;
    const msg = h("p", { class: "form-message", attrs: { role: "status", "aria-live": "polite" } });

    return h("div", { class: "stack-lg" },
      merchantTabs("boutique"),
      pageHead("Ma boutique", "Ce que les clients voient sur la marketplace."),
      h("div", { class: "cart-layout" },
        h("section", { class: "card shop-header" },
          h("div", { class: "shop-avatar shop-avatar-lg tone-" + shop.tone, attrs: { "aria-hidden": "true" } }, ico("store", 36)),
          h("div", null,
            h("h2", { text: shop.name }),
            h("p", { class: "lead-sm", text: shop.tagline }),
            h("p", { class: "muted", text: shop.description }),
            h("ul", { class: "shop-facts" },
              h("li", null, ico("map-pin", 16), shop.wilaya),
              h("li", null, ico("star", 16), String(shop.rating).replace(".", ",") + " / 5 (avis fictifs)"),
              h("li", null, ico("package", 16), merchantProducts().length + " produit(s)")),
            h("div", { class: "actions" },
              h("a", { class: "btn btn-soft", attrs: { href: "#/client/boutique/" + shop.id } }, ico("store", 18), "Voir ma boutique côté client"),
              h("button", { class: "btn btn-ghost", attrs: { type: "button" }, on: { click: () => toast("Démonstration : le lien public de la boutique serait copié pour être partagé.") } }, "Copier le lien de ma boutique")))),
        h("form", {
          class: "card form",
          attrs: { novalidate: true },
          on: {
            submit: e => {
              e.preventDefault();
              const tagline = fTagline.value.trim();
              if (tagline.length < 3) { msg.className = "form-message is-error"; msg.textContent = "Le slogan doit contenir au moins 3 caractères."; return; }
              state.shopEdit = { tagline, description: fDesc.value.trim() || shop.description };
              save();
              toast("Présentation mise à jour (simulation locale).");
              render();
            }
          }
        },
          h("h2", { text: "Modifier la présentation" }),
          h("p", { class: "muted small", text: "Les modifications restent dans ce navigateur." }),
          h("label", { class: "field" }, h("span", { text: "Slogan" }), fTagline),
          h("label", { class: "field" }, h("span", { text: "Description" }), fDesc),
          h("button", { class: "btn btn-primary btn-block", text: "Enregistrer (simulation)", attrs: { type: "submit" } }),
          msg)),
      workflowCard());
  }

  /* ==========================================================
     Routeur (adresses en #/…, aucune requête serveur)
     ========================================================== */
  function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
    const [space, page, param] = parts;

    if (!space) return { view: viewHome, nav: "" };
    if (space === "client") {
      if (!page) return { view: viewClientHome, nav: "client" };
      if (page === "produit") return { view: () => viewProduct(Number(param)), nav: "client" };
      if (page === "boutique") return { view: () => viewShop(Number(param)), nav: "client" };
      if (page === "panier") return { view: viewCart, nav: "panier" };
      if (page === "commande") return { view: viewCheckout, nav: "panier" };
      if (page === "commandes") return { view: viewClientOrders, nav: "client" };
      if (page === "suivi") return { view: () => viewTracking(param || ""), nav: "client" };
    }
    if (space === "commercant") {
      if (!page) return { view: viewMerchantDashboard, nav: "commercant" };
      if (page === "commandes" && param) return { view: () => viewMerchantOrder(param), nav: "commercant" };
      if (page === "commandes") return { view: viewMerchantOrders, nav: "commercant" };
      if (page === "produits") return { view: viewMerchantProducts, nav: "commercant" };
      if (page === "boutique") return { view: viewMerchantShop, nav: "commercant" };
    }
    return { view: () => emptyState("Page introuvable", "Cette page n'existe pas dans l'aperçu.", "Retour à l'accueil de l'aperçu", "#/"), nav: "" };
  }

  let lastHash = null;
  function render() {
    const r = route();
    const scrollY = window.scrollY;
    app.replaceChildren(r.view());
    document.querySelectorAll("[data-nav]").forEach(a => {
      const active = a.dataset.nav === r.nav;
      a.classList.toggle("is-active", active);
      if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const heading = app.querySelector("h1");
    document.title = (heading ? heading.textContent + " — " : "") + "Aperçu DOKKANI (démonstration)";
    if (lastHash !== location.hash) {
      // Nouvelle page : retour en haut et focus sur le titre (lecteurs d'écran)
      window.scrollTo(0, 0);
      if (heading && lastHash !== null) heading.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, scrollY);
    }
    lastHash = location.hash;
  }

  /* ==========================================================
     Démarrage
     ========================================================== */
  document.querySelectorAll("[data-icon]").forEach(slot => slot.replaceChildren(ico(slot.getAttribute("data-icon"), 20)));
  document.getElementById("resetDemo").addEventListener("click", resetDemo);
  window.addEventListener("hashchange", render);
  updateCartCount();
  render();
})();
