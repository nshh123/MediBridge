# MediBridge Responsive Wireframes & Multi-Device Layout Specifications (Requirement 3)

MediBridge is engineered with a **Mobile-First Responsive Grid** using **React 19** and **Tailwind CSS v4**. Every screen adapts across three primary viewport tiers:

1. **Mobile (`< 640px` / `375px` viewport)**: Single-column vertical stack, collapsible drawer navigation (`Navbar.jsx`), touch-friendly full-width reservation and verification CTAs.
2. **Tablet (`640px – 1023px` / `md:` breakpoint)**: 2-column medication card grid, 2-column form inputs, horizontal scrollable filter pills.
3. **Desktop (`>= 1024px` / `lg:` breakpoint)**: 3-column asymmetric workspace (2/3 primary catalog or E-Prescription ledger on the left + 1/3 real-time reservations, composer, or RabbitMQ message stream on the right).

---

## 1. Desktop Widescreen Layout Wireframe (`>= 1024px`)

```text
+--------------------------------------------------------------------------------------------------+
| [Shield] RBAC & OAuth2 Live Session: Aline Uwase [PATIENT]   | 1-Click Switch: [PAT][DOC][PHM][ADM] |
+--------------------------------------------------------------------------------------------------+
| [Logo] MediBridge Rwanda     | [Stock Finder] [E-Prescriptions] [Inventory] [AI Triage] [RabbitMQ] |
+--------------------------------------------------------------------------------------------------+
|  HERO SEARCH & PERFORMANCE BANNER                                                                |
|  Stop Visiting 5 Pharmacies for Out-of-Stock Medicine                +------------------------+  |
|  [ Search: Augmentin, Coartem, Lantus... ] [District] [Insurance]    | X-Cache: HIT (< 2ms)   |  |
|  Classes: [All] [Antibiotic] [Antimalarial] [Cardiovascular]         +------------------------+  |
+--------------------------------------------------------------------------------------------------+
|  LEFT 2/3: VERIFIED PHARMACY STOCK CARDS (2-Col Grid)      | RIGHT 1/3: ACTIVE RESERVATIONS      |
|  +---------------------------+ +-------------------------+ | +---------------------------------+ |
|  | [Antibiotic]    8,500 RWF | | [Endocrine]  13,875 RWF | | | RSV-8941            [RESERVED]  | |
|  | Augmentin 625mg           | | Lantus SoloStar (-25%)  | | | 2x Augmentin 625mg              | |
|  | Goodlife Pharmacy (Gasabo)| | Goodlife Pharmacy       | | | Goodlife Pharmacy — 17,000 RWF  | |
|  | [RSSB][MMI]   48 in stock | | [RSSB]        9 in stock| | | [Mark Dispensed] [Cancel]       | |
|  | [Reserve 6h Pickup]       | | [Reserve 6h Pickup]     | | +---------------------------------+ |
|  +---------------------------+ +-------------------------+ |                                     |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Tablet Viewport Wireframe (`768px`)

```text
+-----------------------------------------------------------------------+
| RBAC Session: Dr. Eric Mugisha [DOCTOR] | [PAT][DOC][PHM][ADM]        |
+-----------------------------------------------------------------------+
| [Logo] MediBridge Rwanda                        [≡ Responsive Drawer] |
+-----------------------------------------------------------------------+
| [ Search Medication Input...             ] [ District: All Districts ]|
| [ Insurance: RSSB / MMI / Radiant        ] [ Sort: Lowest Price RWF  ]|
+-----------------------------------------------------------------------+
| +---------------------------------+ +-------------------------------+ |
| | Augmentin 625mg       8,500 RWF | | Coartem 80/480mg    4,200 RWF | |
| | Goodlife Kimironko (Gasabo)     | | Kipharma Central (Nyarugenge) | |
| | [RSSB] [MMI]        48 in stock | | [RSSB] [MMI]      62 in stock | |
| | [     Reserve 6h Pickup       ] | | [     Reserve 6h Pickup     ] | |
| +---------------------------------+ +-------------------------------+ |
+-----------------------------------------------------------------------+
| ACTIVE RESERVATIONS & E-PRESCRIPTION VERIFICATION PANEL (Full-Width)  |
+-----------------------------------------------------------------------+
```

---

## 3. Mobile Smartphone Wireframe (`375px`)

```text
+----------------------------------------+
| [Shield] Aline Uwase [PATIENT]         |
| Switch: [PAT] [DOC] [PHM] [ADM]        |
+----------------------------------------+
| [Logo] MediBridge         [≡ Menu Btn] |
+----------------------------------------+
| Stop Visiting 5 Pharmacies             |
| [X-Cache: HIT]                         |
| [ Search drug name...                ] |
| [ District: Gasabo District        v ] |
| [ Insurance: RSSB Accepted         v ] |
+----------------------------------------+
| +------------------------------------+ |
| | [Antibiotic]             8,500 RWF | |
| | Augmentin 625mg                    | |
| | Amoxicillin + Clavulanic Acid      | |
| | Goodlife Pharmacy Kimironko        | |
| | [RSSB] [MMI] [RADIANT] 48 in stock | |
| | [   Reserve 6h Pickup (SMS PIN)  ] | |
| +------------------------------------+ |
| +------------------------------------+ |
| | [Endocrine]   -25%      13,875 RWF | |
| | Lantus SoloStar Pen                | |
| | Goodlife Pharmacy Kimironko        | |
| | [   Reserve 6h Pickup (SMS PIN)  ] | |
| +------------------------------------+ |
+----------------------------------------+
```
