/* ==========================================================
   DOKKANI — Aperçu : données 100 % FICTIVES
   Boutiques, produits, clients et commandes sont inventés pour la
   démonstration. Aucun lien avec une base de données, aucune personne réelle.
   ========================================================== */
(function () {
  "use strict";

  const CATEGORIES = Object.freeze([
    { id: "mode", name: "Mode", icon: "shirt" },
    { id: "beaute", name: "Beauté", icon: "droplet" },
    { id: "accessoires", name: "Accessoires", icon: "watch" },
    { id: "maison", name: "Maison", icon: "house" },
    { id: "technologie", name: "Technologie", icon: "headphones" },
    { id: "epicerie", name: "Épicerie fine", icon: "shopping-basket" },
    { id: "jouets", name: "Jouets", icon: "toy-brick" }
  ]);

  // Boutiques fictives. Téléphones volontairement masqués (aucun vrai numéro).
  const SHOPS = Object.freeze([
    {
      id: 1, name: "Atelier Yasmina", category: "mode", wilaya: "Oran", tone: "lilac",
      tagline: "Mode féminine faite main",
      description: "Robes, ensembles et foulards confectionnés en petites séries dans un atelier fictif d'Oran.",
      rating: 4.8, since: "2025"
    },
    {
      id: 2, name: "Nour Cosmétiques", category: "beaute", wilaya: "Alger", tone: "pink",
      tagline: "Soins naturels",
      description: "Savons, huiles et soins inspirés des recettes traditionnelles. Boutique de démonstration.",
      rating: 4.6, since: "2024"
    },
    {
      id: 3, name: "Dar Déco", category: "maison", wilaya: "Tlemcen", tone: "amber",
      tagline: "Décoration artisanale",
      description: "Objets de décoration, textiles et vaisselle d'inspiration artisanale. Boutique de démonstration.",
      rating: 4.7, since: "2025"
    },
    {
      id: 4, name: "Sétif Tech", category: "technologie", wilaya: "Sétif", tone: "blue",
      tagline: "Accessoires high-tech",
      description: "Écouteurs, chargeurs et petits accessoires du quotidien. Boutique de démonstration.",
      rating: 4.5, since: "2024"
    },
    {
      id: 5, name: "Saveurs du Sud", category: "epicerie", wilaya: "Biskra", tone: "mint",
      tagline: "Épicerie fine du terroir",
      description: "Dattes, miels et épices sélectionnés. Boutique de démonstration.",
      rating: 4.9, since: "2025"
    }
  ]);

  const PRODUCTS = Object.freeze([
    { id: 101, shopId: 1, name: "Robe Kaftan brodée", category: "mode", price: 8900, stock: 6, icon: "shirt", tone: "lilac",
      description: "Robe longue en crêpe fluide, broderies dorées à la main. Tailles S à XL." },
    { id: 102, shopId: 1, name: "Ensemble lin été", category: "mode", price: 6500, stock: 12, icon: "shirt", tone: "mint",
      description: "Chemise et pantalon en lin léger, coupe ample, idéal pour les journées chaudes." },
    { id: 103, shopId: 1, name: "Foulard en soie", category: "accessoires", price: 2400, stock: 20, icon: "watch", tone: "pink",
      description: "Foulard carré imprimé de motifs géométriques, 90 × 90 cm." },
    { id: 104, shopId: 1, name: "Sac cabas tressé", category: "accessoires", price: 3900, stock: 0, icon: "shopping-basket", tone: "amber",
      description: "Cabas en fibres naturelles tressées, anses en cuir. Actuellement en rupture." },
    { id: 201, shopId: 2, name: "Savon noir à l'eucalyptus", category: "beaute", price: 750, stock: 40, icon: "droplet", tone: "mint",
      description: "Savon noir traditionnel pour le hammam, parfum eucalyptus. Pot de 250 g." },
    { id: 202, shopId: 2, name: "Huile d'argan pure", category: "beaute", price: 2200, stock: 18, icon: "droplet", tone: "amber",
      description: "Huile d'argan pressée à froid, flacon de 100 ml avec pipette." },
    { id: 203, shopId: 2, name: "Coffret soin visage", category: "beaute", price: 4800, stock: 7, icon: "star", tone: "pink",
      description: "Coffret découverte : nettoyant, sérum et crème hydratante." },
    { id: 301, shopId: 3, name: "Coussin brodé berbère", category: "maison", price: 2900, stock: 14, icon: "house", tone: "amber",
      description: "Housse de coussin 45 × 45 cm, motifs berbères tissés." },
    { id: 302, shopId: 3, name: "Lanterne en cuivre", category: "maison", price: 5600, stock: 5, icon: "star", tone: "lilac",
      description: "Lanterne ajourée en cuivre martelé, effet lumineux étoilé." },
    { id: 303, shopId: 3, name: "Service à thé 6 verres", category: "maison", price: 4200, stock: 9, icon: "utensils", tone: "blue",
      description: "Théière et six verres décorés, plateau assorti." },
    { id: 401, shopId: 4, name: "Écouteurs sans fil", category: "technologie", price: 5900, stock: 15, icon: "headphones", tone: "blue",
      description: "Écouteurs Bluetooth, boîtier de recharge, autonomie annoncée de 24 h." },
    { id: 402, shopId: 4, name: "Chargeur rapide 30 W", category: "technologie", price: 2500, stock: 30, icon: "phone", tone: "lilac",
      description: "Chargeur USB-C compact compatible charge rapide." },
    { id: 501, shopId: 5, name: "Dattes Deglet Nour 1 kg", category: "epicerie", price: 1400, stock: 50, icon: "shopping-basket", tone: "amber",
      description: "Dattes Deglet Nour de la récolte de l'année, boîte de 1 kg." },
    { id: 502, shopId: 5, name: "Miel de jujubier", category: "epicerie", price: 4500, stock: 8, icon: "droplet", tone: "amber",
      description: "Miel de jujubier, pot de 500 g." },
    { id: 503, shopId: 5, name: "Coffret épices du Sud", category: "epicerie", price: 1900, stock: 25, icon: "utensils", tone: "mint",
      description: "Six épices sélectionnées : ras el-hanout, cumin, paprika, cannelle, curcuma, carvi." },
    { id: 601, shopId: 3, name: "Jeu de dominos en bois", category: "jouets", price: 1600, stock: 11, icon: "toy-brick", tone: "mint",
      description: "Dominos en bois gravé dans une boîte coulissante." }
  ]);

  // Boutique utilisée pour l'espace commerçant de démonstration
  const MERCHANT_SHOP_ID = 1;

  // Commandes fictives de la boutique de démonstration.
  // Clients inventés ; téléphones volontairement masqués.
  const MERCHANT_ORDERS = Object.freeze([
    { id: "DK-1048", customer: "Amel B. (fictif)", wilaya: "Oran", createdAt: "2026-11-23T09:15:00",
      status: "en_attente", lines: [{ productId: 101, qty: 1 }, { productId: 103, qty: 1 }] },
    { id: "DK-1047", customer: "Sofiane K. (fictif)", wilaya: "Mostaganem", createdAt: "2026-11-22T18:40:00",
      status: "confirmee", lines: [{ productId: 102, qty: 2 }] },
    { id: "DK-1046", customer: "Lina M. (fictif)", wilaya: "Alger", createdAt: "2026-11-22T11:05:00",
      status: "modification_demandee", note: "Souhaite la taille M au lieu de S.",
      lines: [{ productId: 101, qty: 1 }] },
    { id: "DK-1045", customer: "Yacine D. (fictif)", wilaya: "Tlemcen", createdAt: "2026-11-21T16:20:00",
      status: "expediee", lines: [{ productId: 103, qty: 3 }] },
    { id: "DK-1044", customer: "Nadia H. (fictif)", wilaya: "Oran", createdAt: "2026-11-20T10:00:00",
      status: "livree", lines: [{ productId: 102, qty: 1 }, { productId: 103, qty: 1 }] },
    { id: "DK-1043", customer: "Karim S. (fictif)", wilaya: "Sidi Bel Abbès", createdAt: "2026-11-19T14:30:00",
      status: "annulee", note: "Client injoignable après trois appels.",
      lines: [{ productId: 101, qty: 1 }] }
  ]);

  // Statuts : même vocabulaire que DOKKANI
  const STATUSES = Object.freeze({
    en_attente: { label: "En attente de confirmation", short: "En attente", tone: "warning", icon: "clock" },
    confirmee: { label: "Confirmée par le client", short: "Confirmée", tone: "info", icon: "circle-check" },
    modification_demandee: { label: "Modification demandée", short: "Modification", tone: "warning", icon: "pencil" },
    expediee: { label: "Expédiée", short: "Expédiée", tone: "primary", icon: "truck" },
    livree: { label: "Livrée", short: "Livrée", tone: "success", icon: "package" },
    annulee: { label: "Annulée", short: "Annulée", tone: "error", icon: "x" },
    refusee: { label: "Refusée", short: "Refusée", tone: "error", icon: "x" }
  });

  const WILAYAS = Object.freeze([
    "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar",
    "Blida", "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Alger",
    "Djelfa", "Jijel", "Sétif", "Saïda", "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma",
    "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara", "Ouargla", "Oran", "El Bayadh",
    "Illizi", "Bordj Bou Arréridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "El Oued",
    "Khenchela", "Souk Ahras", "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent",
    "Ghardaïa", "Relizane", "Timimoun", "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès",
    "In Salah", "In Guezzam", "Touggourt", "Djanet", "El M'Ghair", "El Meniaa"
  ]);

  window.DOKKANI_DEMO_DATA = Object.freeze({
    CATEGORIES, SHOPS, PRODUCTS, MERCHANT_SHOP_ID, MERCHANT_ORDERS, STATUSES, WILAYAS
  });
})();
