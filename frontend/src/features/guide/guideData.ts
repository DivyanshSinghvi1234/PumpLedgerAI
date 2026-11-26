export interface GuideSectionItem {
  id: string;
  header: string;
  headerHi: string;
  summary: string;
  summaryHi: string;
  details: string[];
  detailsHi: string[];
}

export interface PageGuide {
  path: string;
  title: string;
  titleHi: string;
  overview: string;
  overviewHi: string;
  steps: string[];
  stepsHi: string[];
  sections: GuideSectionItem[];
}

export const PAGE_GUIDES: PageGuide[] = [
  {
    path: "/dashboard",
    title: "Daily Register",
    titleHi: "दैनिक रजिस्टर",
    overview:
      "Your physical bound daily register book—now directly editable. Enter closing nozzle readings, expenses, and cash notes once; Tank Stock, Customer Balances, Bank, and Commission Profit update automatically.",
    overviewHi:
      "आपकी असली रजिस्टर कॉपी — अब सीधे एडिट करने योग्य। नोज़ल की क्लोज़िंग रीडिंग, खर्च और नोट गिनती एक बार भरें; टैंक स्टॉक, ग्राहक बकाया, बैंक और कमीशन मुनाफा अपने-आप अपडेट हो जाते हैं।",
    steps: [
      "On the Right Page, click each nozzle's closing reading and press Enter to jump to the next nozzle, then click Save Readings.",
      "Use 'Add Expense / Income' to record daily expenses (shown in red ink on the Left Page).",
      "Enter cash note counts (500/200/100/50/20/10) and Bank Deposit on the Left Page.",
      "Click 'Save & Lock Day' and hit 'Send 8 PM WhatsApp' to message the owner in 1 click.",
    ],
    stepsHi: [
      "दाएं पेज पर हर नोज़ल की क्लोज़िंग रीडिंग भरें और अगले नोज़ल पर जाने के लिए Enter दबाएं, फिर 'Save Readings' दबाएं।",
      "'Add Expense / Income' से रोज़ के खर्च डालें (बाएं पेज पर लाल स्याही में दिखेंगे)।",
      "बाएं पेज पर नोटों की गिनती (500/200/100/50/20/10) और बैंक जमा भरें।",
      "'Save & Lock Day' दबाएं और 1 क्लिक में मालिक को 'Send 8 PM WhatsApp' भेजें।",
    ],
    sections: [
      {
        id: "meter-readings",
        header: "Inline Nozzle Readings & 6 AM Split",
        headerHi: "रजिस्टर में नोज़ल रीडिंग और 6 AM रेट बदलाव",
        summary: "Edit closing readings right on the ledger sheet and save directly to tank stock.",
        summaryHi: "रजिस्टर के अंदर ही क्लोज़िंग रीडिंग भरें और सीधे टैंक स्टॉक से घटाएं।",
        details: [
          "Unsaved readings are auto-saved locally so a weak internet connection never loses your typing.",
          "Enable '6 AM Rate Change?' when fuel rates change at 6:00 AM to record the interim reading.",
        ],
        detailsHi: [
          "बिना सेव की रीडिंग आपके ब्राउज़र में सुरक्षित रहती है ताकि नेटवर्क जाने पर डेटा न खोए।",
          "अगर सुबह 6 बजे रेट बदला है, तो '6 AM Rate Change?' चालू करके 6 बजे की रीडिंग डालें।",
        ],
      },
      {
        id: "close-and-whatsapp",
        header: "Lock Day & 8 PM WhatsApp Summary",
        headerHi: "दिन लॉक करना और 8 PM WhatsApp रिपोर्ट",
        summary: "Locks the date, posts walk-in cash sales, syncs UPI/Card/Deposit to Bank, and shares summary.",
        summaryHi: "तारीख लॉक करता है, कैश सेल और बैंक जमा अपडेट करता है और WhatsApp पर सारांश भेजता है।",
        details: [
          "Admin can click 'Reopen' anytime if a correction is needed.",
          "Use the optional 'Tank Dip' toggle before locking to check underground shortage or gain.",
        ],
        detailsHi: [
          "गलती होने पर एडमिन 'Reopen' से दिन फिर से खोल सकते हैं।",
          "लॉक करने से पहले 'Tank Dip (Optional)' खोलकर टैंक की वास्तविक और किताब के स्टॉक का अंतर जांचें।",
        ],
      },
    ],
  },
  {
    path: "/dashboard/slips",
    title: "Slips & OCR",
    titleHi: "पर्ची और OCR",
    overview:
      "Scan handwritten credit slips with AI OCR, enter quick manual slips, and search all stored slip photos forever.",
    overviewHi:
      "हाथ से लिखी उधार पर्चियों को AI OCR से स्कैन करें, फटाफट मैनुअल स्लिप बनाएं और पुरानी सभी पर्चियों की फोटो हमेशा के लिए सुरक्षित रखें।",
    steps: [
      "Tab 1 (Scan Invoice): Upload or snap up to 30 slip photos and approve extracted Customer, Vehicle & Amount.",
      "Tab 2 (Quick Manual Slip): Create a fast slip in 5 seconds without a photo.",
      "Tab 3 (Stored Slips & Invoices): Search, filter, or view original scanned slip images anytime.",
    ],
    stepsHi: [
      "टैब 1 (Scan Invoice): 30 तक पर्ची फोटो अपलोड करें और ग्राहक, गाड़ी व राशि की जांच कर सेव करें।",
      "टैब 2 (Quick Manual Slip): बिना फोटो 5 सेकंड में पर्ची दर्ज करें।",
      "टैब 3 (Stored Slips): किसी भी पुरानी पर्ची और उसकी असली फोटो को कभी भी खोजें।",
    ],
    sections: [],
  },
  {
    path: "/dashboard/customers",
    title: "Customers & Vehicles",
    titleHi: "ग्राहक और गाड़ियाँ",
    overview:
      "Track party-wise credit dues, vehicle-wise fuel lifting, and record payments (FIFO auto-settlement + Cash/Bank sync).",
    overviewHi:
      "ग्राहकों का उधार बकाया, गाड़ी के हिसाब से ईंधन पर्ची और पेमेंट वसूली एक ही जगह देखें।",
    steps: [
      "Tab 1 (Customers & Dues): View pending balances, send WhatsApp reminders, or open full Statement Print.",
      "Tab 2 (Vehicles): Inspect every vehicle's fuel history.",
      "Tab 3 (Payments Received): Record Cash or Bank collections; settles oldest bills automatically.",
    ],
    stepsHi: [
      "टैब 1 (Customers & Dues): बकाया देखें, WhatsApp रिमाइंडर भेजें या पूरा स्टेटमेंट प्रिंट करें।",
      "टैब 2 (Vehicles): हर गाड़ी का ईंधन हिसाब देखें।",
      "टैब 3 (Payments Received): कैश या बैंक में मिली रकम दर्ज करें; पुराने बिल अपने-आप चुकता होंगे।",
    ],
    sections: [],
  },
  {
    path: "/dashboard/inventory",
    title: "Inventory",
    titleHi: "टैंक और स्टॉक",
    overview:
      "Manage underground fuel tanks, tanker deliveries, selling prices, and dispensers/nozzles.",
    overviewHi:
      "भूमिगत ईंधन टैंक, टैंकर डिलीवरी, बेचने के रेट और नोज़ल सेटअप यहां से संभालें।",
    steps: [
      "Tab 1 (Tanks & Stock): Add tanks, check remaining stock, and view tank-wise margins.",
      "Tab 2 (Tanker Deliveries): Record OMC indents and tanker arrivals (updates tank stock + bank balance).",
      "Tab 3 (Prices & Nozzles): Set Petrol/Diesel/Speed rates and link nozzles to tanks.",
    ],
    stepsHi: [
      "टैब 1 (Tanks & Stock): टैंक जोड़ें, बचा हुआ स्टॉक और टैंक मुनाफा देखें।",
      "टैब 2 (Tanker Deliveries): टैंकर डिलीवरी दर्ज करें (टैंक स्टॉक और बैंक बैलेंस अपने-आप अपडेट होते हैं)।",
      "टैब 3 (Prices & Nozzles): पेट्रोल/डीज़ल के रेट सेट करें और नोज़ल को टैंक से जोड़ें।",
    ],
    sections: [],
  },
  {
    path: "/dashboard/money",
    title: "Money & Profit",
    titleHi: "पैसा और मुनाफा",
    overview:
      "Live Cash-in-Hand, Bank Account balances, Fuel Commission (₹/L) Profit, and all accounting reports.",
    overviewHi:
      "हाथ में कैश, हर बैंक खाते का बैलेंस, कमीशन (₹/लीटर) के आधार पर मुनाफा और सभी रिपोर्ट्स यहां देखें।",
    steps: [
      "Tab 1 (Cash & Bank Balances): View Cash in Drawer + HDFC/SBI/Bank balances, deposit cash, or transfer.",
      "Tab 2 (Commission & Profit): Set your Petrol/Diesel/Speed ₹/L dealer commission to see exact daily & monthly profit.",
      "Tab 3 (All Reports): Export Daily Sales, Debtor Aging, Cash Flow, and GST reports.",
    ],
    stepsHi: [
      "टैब 1 (Cash & Bank): कैश और बैंक बैलेंस देखें, बैंक में कैश जमा या ट्रांसफर करें।",
      "टैब 2 (Commission & Profit): पेट्रोल/डीज़ल का कमीशन ₹/L सेट करें और शुद्ध मुनाफा देखें।",
      "टैब 3 (All Reports): दैनिक बिक्री, उधार उम्र, कैश फ्लो और GST रिपोर्ट डाउनलोड करें।",
    ],
    sections: [],
  },
  {
    path: "/dashboard/settings",
    title: "Settings & Tools",
    titleHi: "सेटिंग्स और टूल्स",
    overview:
      "Optional management tools: Staff & Monthly Payroll, Tally XML Export, Activity Log, Station Branding, and Database Backup.",
    overviewHi:
      "वैकल्पिक टूल्स: स्टाफ सैलरी, Tally XML एक्सपोर्ट, ऑडिट लॉग, पंप का नाम और डेटाबेस बैकअप।",
    steps: [
      "Use Staff & Payroll at month-end for attendance, advances, and salaries.",
      "Use Tally Export to generate Sales, Receipt, Payment & Contra XMLs for your CA.",
    ],
    stepsHi: [
      "महीने के अंत में स्टाफ की हाज़िरी और सैलरी के लिए 'Staff & Payroll' का उपयोग करें।",
      "अपने CA के लिए XML निकालने हेतु 'Tally Export' खोलें।",
    ],
    sections: [],
  },
];

export function findGuideForPath(pathname: string): PageGuide {
  const exact = PAGE_GUIDES.find((g) => g.path === pathname);
  if (exact) return exact;
  const prefix = PAGE_GUIDES.find((g) => g.path !== "/dashboard" && pathname.startsWith(g.path));
  return prefix || PAGE_GUIDES[0];
}
