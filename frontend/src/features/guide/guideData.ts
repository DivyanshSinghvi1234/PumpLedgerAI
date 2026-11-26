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
    title: "Dashboard",
    titleHi: "डैशबोर्ड",
    overview:
      "Your live command view of today's fuel sales, cash vs. digital collections, 5-Point Auto-Audit health, and pending tasks.",
    overviewHi:
      "आज की ईंधन बिक्री, नकद बनाम डिजिटल संग्रह, 5-पॉइंट ऑटो-ऑडिट और लंबित कार्यों का लाइव डैशबोर्ड।",
    steps: [
      "Check the 'Pending Today' strip at the top for missing nozzle readings, open Day Closing, or payroll due.",
      "Inspect the '5-Point Auto-Audit' banner — click any mismatch to fix it in 1 click.",
      "Review Today's Fuel Distribution, Recent Vouchers, and Debtor Aging cards.",
    ],
    stepsHi: [
      "ऊपर 'आज के लंबित कार्य' पट्टी में छूटे नोज़ल रीडिंग या खुले दिन बंद की जांच करें।",
      "'5-Point Auto-Audit' बैनर देखें — किसी भी अंतर को 1 क्लिक में ठीक करें।",
      "आज के ईंधन वितरण, हाल के वाउचर और बकाया रिपोर्ट की समीक्षा करें।",
    ],
    sections: [
      {
        id: "pending-today",
        header: "Pending Today Action Strip",
        headerHi: "आज के लंबित कार्य पट्टी",
        summary: "Shows only what still needs attention today with 1-click links.",
        summaryHi: "आज जो काम बाकी हैं, उन्हें 1-क्लिक लिंक के साथ दिखाता है।",
        details: [
          "Flags active nozzles that still need closing meter readings.",
          "Alerts if Day Closing is still open or if unbilled cash fuel remains.",
          "Shows a Payroll Due alert in the last 3 days of the month.",
        ],
        detailsHi: [
          "उन सक्रिय नोज़ल को दिखाता है जिनकी क्लोज़िंग रीडिंग बाकी है।",
          "यदि दिन बंद करना बाकी है या अघोषित नकद ईंधन है तो अलर्ट देता है।",
          "महीने के अंतिम 3 दिनों में वेतन भुगतान अलर्ट दिखाता है।",
        ],
      },
      {
        id: "five-point-audit",
        header: "5-Point Auto-Audit Banner",
        headerHi: "5-पॉइंट ऑटो-ऑडिट बैनर",
        summary: "Continuously cross-checks the 5 places where petrol pumps lose money or drift.",
        summaryHi: "पेट्रोल पंप पर हिसाब गड़बड़ाने वाले 5 मुख्य बिंदुओं की लगातार जांच करता है।",
        details: [
          "1. Meters vs. Billed: Meter Sales (₹) vs. Credit + UPI + Card + Cash.",
          "2. Tank Dips vs. Nozzles: Physical Tank Drop (L) vs. Nozzle Liters Dispensed.",
          "3. Expected vs. Counted Cash: Opening + Inflows − Outflows vs. Note Count.",
          "4. Customer Ledger vs. Unpaid Bills: Stored balance vs. actual unpaid bills.",
          "5. UPI/Bank Entries Without Linked Bank: Catches digital entries missing HDFC/SBI.",
        ],
        detailsHi: [
          "1. मीटर बनाम बिल: मीटर बिक्री (₹) बनाम उधार + UPI + कार्ड + नकद।",
          "2. टैंक डिप बनाम नोज़ल: टैंक में कमी (L) बनाम नोज़ल से निकला ईंधन।",
          "3. अपेक्षित बनाम गिना गया कैश: ओपनिंग + आवक − खर्च बनाम नोट गिनती।",
          "4. ग्राहक खाता बनाम बकाया बिल: खाता बैलेंस बनाम अनपेड बिल।",
          "5. बिना बैंक लिंक के UPI/बैंक एंट्री: छूटे हुए HDFC/SBI लिंक पकड़ता है।",
        ],
      },
      {
        id: "analytics",
        header: "Detailed Analytics & Margin Cards",
        headerHi: "विस्तृत विश्लेषण और मार्जिन कार्ड",
        summary: "Toggle 'Show Detailed Analytics' for margins, customer churn, NPS, and stock variance.",
        summaryHi: "मार्जिन, ग्राहक विश्लेषण, NPS और स्टॉक अंतर देखने के लिए विस्तृत विश्लेषण खोलें।",
        details: [
          "Displays tank-wise gross margin, debtor aging buckets, and stock variance trends.",
        ],
        detailsHi: [
          "टैंक-वार ग्रॉस मार्जिन, बकाया उम्र और स्टॉक अंतर के रुझान दिखाता है।",
        ],
      },
    ],
  },
  {
    path: "/dashboard/inventory",
    title: "Inventory & Pricing",
    titleHi: "इन्वेंटरी और मूल्य निर्धारण",
    overview:
      "Manage underground fuel tanks, OMC tanker deliveries, daily nozzle meter readings, lubricants, and 6 AM fuel price schedules.",
    overviewHi:
      "भूमिगत ईंधन टैंक, टैंकर डिलीवरी, दैनिक नोज़ल मीटर रीडिंग, ल्यूब्रिकेंट और सुबह 6 बजे की ईंधन दरें प्रबंधित करें।",
    steps: [
      "Start in 'Fuel Storage' to check tank levels, record physical dips, and log tanker deliveries.",
      "Use 'Meter Readings' daily to enter opening/closing readings (with 6 AM interim reading on rate-change days).",
      "Update 'Price Schedules' whenever OMC revises Petrol/Diesel/Speed rates.",
    ],
    stepsHi: [
      "'Fuel Storage' में टैंक स्तर जांचें, डिप रीडिंग और टैंकर डिलीवरी दर्ज करें।",
      "रोज़ाना 'Meter Readings' में ओपनिंग/क्लोज़िंग रीडिंग दर्ज करें।",
      "कीमत बदलने पर 'Price Schedules' में नई दरें अपडेट करें।",
    ],
    sections: [
      {
        id: "dips",
        header: "1. Fuel Storage (First Header)",
        headerHi: "1. फ्यूल स्टोरेज (पहला टैब)",
        summary: "Track underground tanks, physical dip readings, tanker deliveries, and tank-wise profit.",
        summaryHi: "भूमिगत टैंक, फिजिकल डिप, टैंकर डिलीवरी और टैंक-वार मुनाफा ट्रैक करें।",
        details: [
          "Record Tanker Deliveries with optional Dip Before / Dip After check and auto-bank debit.",
          "Use 'OMC Invoice OCR Auto-Pilot' to scan IOCL/BPCL/HPCL bills, match indents, and update avg cost/L.",
          "View Tank-Wise Margin, Gross Profit, and Procurement Cost/L Trend.",
        ],
        detailsHi: [
          "टैंकर डिलीवरी के साथ डिप पहले/बाद की जांच और बैंक डेबिट दर्ज करें।",
          "IOCL/BPCL/HPCL बिल स्कैन करने के लिए 'OMC Invoice OCR Auto-Pilot' उपयोग करें।",
          "टैंक-वार मार्जिन, शुद्ध मुनाफा और खरीद लागत का ग्राफ देखें।",
        ],
      },
      {
        id: "indents",
        header: "2. OMC Indents & TTs",
        headerHi: "2. OMC इंडेंट और टैंकर",
        summary: "Plan upcoming tanker orders and check if your bank balance is sufficient.",
        summaryHi: "आगामी टैंकर ऑर्डर की योजना बनाएं और बैंक बैलेंस की पर्याप्तता जांचें।",
        details: [
          "Create Purchase Indents for Petrol/Diesel/Speed.",
          "Low Bank Balance Alert warns if HDFC/SBI balance is short for pending indents.",
        ],
        detailsHi: [
          "पेट्रोल/डीज़ल/स्पीड के लिए परचेज़ इंडेंट बनाएं।",
          "बैंक बैलेंस कम होने पर डैशबोर्ड और इन्वेंटरी में अलर्ट दिखता है।",
        ],
      },
      {
        id: "readings",
        header: "3. Meter Readings",
        headerHi: "3. मीटर रीडिंग",
        summary: "Daily bulk nozzle meter entry with auto-rollover, 6 AM split, and sanity guards.",
        summaryHi: "दैनिक नोज़ल मीटर एंट्री, 6 AM रेट स्प्लिट और गलती-रोक सुरक्षा के साथ।",
        details: [
          "Opening reading auto-fills from yesterday's closing (warns if edited to differ).",
          "Shows Today vs. Yesterday sales delta (+/- L) and warns if sales jump >3× the 7-day average.",
          "Expand 'Add 6 AM' on price-change days to split pre-6 AM and post-6 AM revenue.",
        ],
        detailsHi: [
          "ओपनिंग रीडिंग कल की क्लोज़िंग से अपने-आप भरती है (बदलने पर चेतावनी)।",
          "कल की तुलना में बिक्री अंतर (+/- L) और 7-दिन के औसत से >3× उछाल पर अलर्ट।",
          "रेट बदलने पर 'Add 6 AM' खोलकर सुबह 6 बजे से पहले/बाद की बिक्री अलग करें।",
        ],
      },
      {
        id: "lubricants",
        header: "4. Lube & DEF Stock",
        headerHi: "4. ल्यूब्रिकेंट और DEF स्टॉक",
        summary: "Manage packaged engine oil, grease, and AdBlue/DEF cans.",
        summaryHi: "पैक्ड इंजन ऑयल, ग्रीस और AdBlue/DEF स्टॉक प्रबंधित करें।",
        details: [
          "Track stock quantity and unit price; lubricant vouchers auto-deduct stock.",
        ],
        detailsHi: [
          "स्टॉक मात्रा और कीमत ट्रैक करें; वाउचर बनने पर स्टॉक स्वतः घटता है।",
        ],
      },
      {
        id: "prices",
        header: "5. Price Schedules",
        headerHi: "5. मूल्य अनुसूची (Price Schedules)",
        summary: "Set Petrol, Diesel, and Speed rates and view 6 AM overnight stock gain/loss.",
        summaryHi: "पेट्रोल, डीज़ल और स्पीड की दरें सेट करें और 6 AM स्टॉक लाभ/हानि देखें।",
        details: [
          "Rates automatically pre-fill across Quick Entry, Vouchers, and Day Closing.",
          "6 AM Revision banner shows exact overnight tank stock gain or loss in ₹.",
        ],
        detailsHi: [
          "सेट की गई दरें Quick Entry, वाउचर और दिन बंद में अपने-आप भर जाती हैं।",
          "सुबह 6 बजे दर बदलने पर टैंक स्टॉक पर हुए लाभ/हानि की गणना दिखती है।",
        ],
      },
      {
        id: "dispensers",
        header: "6. Dispensers",
        headerHi: "6. डिस्पेंसर और नोज़ल",
        summary: "Configure fuel dispensers, nozzles, and link each nozzle to an underground tank.",
        summaryHi: "डिस्पेंसर, नोज़ल सेट करें और प्रत्येक नोज़ल को टैंक से लिंक करें।",
        details: [
          "Linking nozzles to tanks enables real-time Tank-to-Nozzle-to-Sale tracking.",
        ],
        detailsHi: [
          "नोज़ल को टैंक से जोड़ने पर रियल-टाइम स्टॉक और मुनाफा ट्रैकिंग चलती है।",
        ],
      },
      {
        id: "history",
        header: "7. Meter Logs",
        headerHi: "7. मीटर लॉग इतिहास",
        summary: "View historical nozzle meter readings across dates.",
        summaryHi: "पिछली तारीखों की सभी नोज़ल मीटर रीडिंग का इतिहास देखें।",
        details: [
          "Audit past opening, closing, testing liters, and net sales per nozzle.",
        ],
        detailsHi: [
          "प्रत्येक नोज़ल की पिछली ओपनिंग, क्लोज़िंग और शुद्ध बिक्री जांचें।",
        ],
      },
    ],
  },
  {
    path: "/dashboard/quick-entry",
    title: "Quick Entry Mode",
    titleHi: "त्वरित एंट्री मोड",
    overview:
      "Fast forecourt billing for Cash, Credit, and UPI slips with auto-filled rates, night-shift toggle, and 8-second Undo.",
    overviewHi:
      "नकद, उधार और UPI पर्चियों के लिए तेज़ एंट्री — ऑटो रेट, नाइट-शिफ्ट टॉगल और 8-सेकंड Undo के साथ।",
    steps: [
      "Pick Fuel Type (Diesel / Petrol / Speed) and Payment Mode (Credit / Cash / UPI).",
      "Select Customer or Vehicle (both auto-link to each other).",
      "Enter Liters or Amount and press Cmd/Ctrl+Enter to save.",
    ],
    stepsHi: [
      "ईंधन का प्रकार और भुगतान का तरीका चुनें।",
      "ग्राहक या वाहन चुनें (दोनों एक-दूसरे से अपने-आप जुड़ जाते हैं)।",
      "लीटर या राशि भरें और सेव करने के लिए Cmd/Ctrl+Enter दबाएं।",
    ],
    sections: [
      {
        id: "night-shift",
        header: "Night-Shift Business Date Toggle (12 AM – 6 AM)",
        headerHi: "नाइट-शिफ्ट बिज़नेस डेट टॉगल (रात 12 – सुबह 6)",
        summary: "Assign after-midnight sales to yesterday's business day in 1 click.",
        summaryHi: "रात 12 से सुबह 6 बजे की बिक्री को 1 क्लिक में कल के बिज़नेस दिन में जोड़ें।",
        details: [
          "Automatically suggested between 12 AM and 6 AM so night shift books stay clean.",
        ],
        detailsHi: [
          "रात 12 से सुबह 6 के बीच अपने-आप सक्रिय होता है ताकि नाइट शिफ्ट का हिसाब सही रहे।",
        ],
      },
      {
        id: "sanity-guards",
        header: "Hard Sanity Guards & 8-Second Undo",
        headerHi: "गलती-रोक चेतावनी और 8-सेकंड Undo",
        summary: "Catches rate typos (>₹2/L diff), Qty×Rate mismatches, and missing credit customers.",
        summaryHi: "गलत रेट, मात्रा×दर अंतर और बिना ग्राहक उधार एंट्री को तुरंत पकड़ता है।",
        details: [
          "After saving, an Undo button stays in the confirmation toast for 8 seconds.",
        ],
        detailsHi: [
          "सेव करने के बाद 8 सेकंड तक Undo बटन दिखता है जिससे गलती तुरंत वापस ली जा सकती है।",
        ],
      },
    ],
  },
  {
    path: "/dashboard/day-closing",
    title: "One-Click Day Closing",
    titleHi: "वन-क्लिक दिन बंद",
    overview:
      "3-step end-of-day reconciliation: Tank Dips → Cash Count (synced with Daily Register) → 4-Checkpoint Gate & Bank Sync.",
    overviewHi:
      "3-चरणीय दिन बंद: टैंक डिप → कैश गिनती (रजिस्टर से सिंक) → 4-चेकपॉइंट जांच और बैंक सिंक।",
    steps: [
      "Step 1: Verify nozzle meter totals and enter physical tank dips.",
      "Step 2: Enter note counts (auto-synced with Daily Register) and Cash Handed to Next Day.",
      "Step 3: Click 'Post Summary Cash Sale' if unbilled cash remains, pass all 4 checkpoints, and Lock Day.",
    ],
    stepsHi: [
      "चरण 1: नोज़ल मीटर टोटल जांचें और टैंक डिप दर्ज करें।",
      "चरण 2: नोटों की गिनती भरें (दैनिक रजिस्टर से सिंक) और अगले दिन के लिए कैश फ्लोट सेट करें।",
      "चरण 3: अघोषित कैश हो तो 'Post Summary Cash Sale' दबाएं, 4 जांच पास करें और दिन लॉक करें।",
    ],
    sections: [
      {
        id: "auto-balance",
        header: "1-Click Auto-Balance Unbilled Cash",
        headerHi: "1-क्लिक अघोषित कैश संतुलन",
        summary: "Posts Gross Meter Sales − Total Billed Vouchers as a Summary Cash Sale.",
        summaryHi: "मीटर बिक्री और वाउचर बिक्री के अंतर को एक समरी कैश सेल के रूप में दर्ज करता है।",
        details: [
          "Reconciles Meter Totals, Voucher Totals, and Cash Drawer to ₹0.00.",
        ],
        detailsHi: [
          "मीटर टोटल, वाउचर टोटल और कैश ड्रॉअर को ₹0.00 अंतर पर मिलाता है।",
        ],
      },
      {
        id: "safety-gate",
        header: "4-Checkpoint Day Closing Gate",
        headerHi: "4-चेकपॉइंट दिन बंद सुरक्षा जांच",
        summary: "Blocks locking an incomplete day until all 4 checks are green.",
        summaryHi: "अधूरे दिन को लॉक होने से रोकता है जब तक सभी 4 जांच हरी न हों।",
        details: [
          "1. All active nozzles have closing readings.",
          "2. Zero unreviewed OCR slips for that date.",
          "3. Zero UPI/Bank entries missing a linked Bank Account.",
          "4. Cash variance beyond ±₹100 has a remark or staff tag.",
        ],
        detailsHi: [
          "1. सभी सक्रिय नोज़ल की क्लोज़िंग रीडिंग दर्ज हो।",
          "2. उस तारीख की कोई OCR पर्ची समीक्षा के लिए लंबित न हो।",
          "3. सभी UPI/बैंक एंट्री किसी बैंक खाते से जुड़ी हों।",
          "4. ±₹100 से अधिक कैश अंतर का कारण या स्टाफ टैग दर्ज हो।",
        ],
      },
    ],
  },
  {
    path: "/dashboard/vouchers",
    title: "Vouchers",
    titleHi: "वाउचर",
    overview:
      "Search, filter, repeat/clone, settle (including Split Cash+UPI), or send WhatsApp bills for all fuel & lube vouchers.",
    overviewHi:
      "सभी ईंधन और ल्यूब वाउचर खोजें, फ़िल्टर करें, दोहराएं, निपटान (Cash+UPI स्प्लिट) करें या WhatsApp बिल भेजें।",
    steps: [
      "Use 1-Tap Quick Filter Pills (Today, Unpaid, Cash, UPI) to slice records instantly.",
      "Click 'Repeat' on any row to clone Customer/Vehicle/Fuel/Rate for a fast new bill.",
      "Click 'Settle' on Unpaid/Partial credit bills to record Cash, UPI, or Split settlement.",
    ],
    stepsHi: [
      "तुरंत फ़िल्टर के लिए 1-टैप पिल्स (Today, Unpaid, Cash, UPI) का उपयोग करें।",
      "किसी भी वाउचर को क्लोन करने के लिए 'Repeat' दबाएं।",
      "बकाया बिल पर Cash, UPI या Split भुगतान के लिए 'Settle' दबाएं।",
    ],
    sections: [
      {
        id: "quick-filters",
        header: "Quick Filter Pills & Live Summary Strip",
        headerHi: "क्विक फ़िल्टर और लाइव सारांश पट्टी",
        summary: "Instant totals for Cash, UPI, Bank, Credit, and Unpaid above the table.",
        summaryHi: "टेबल के ठीक ऊपर Cash, UPI, Bank, Credit और बकाया का लाइव टोटल।",
        details: [
          "Updates live as you toggle Today, Unpaid, Cash, or UPI filters.",
        ],
        detailsHi: [
          "फ़िल्टर बदलने पर सभी योग तुरंत अपडेट होते हैं।",
        ],
      },
    ],
  },
  {
    path: "/dashboard/bank-accounts",
    title: "Bank & Cash Accounts",
    titleHi: "बैंक और कैश खाते",
    overview:
      "Track HDFC/SBI balances, deposit cash with printable slips, match Day Closings, run Books Health Check, and view the live Rupee timeline.",
    overviewHi:
      "HDFC/SBI बैलेंस देखें, नकद जमा पर्ची प्रिंट करें, दिन बंद मैच करें, बुक्स हेल्थ चेक और लाइव टाइमलाइन देखें।",
    steps: [
      "Check the Opening vs. Closing Cash Verification Strip at the top.",
      "Click 'Match Day Closing' to sync digital sales & cash deposits idempotently.",
      "Use 'Books Health Check' at the bottom to fix any legacy unlinked bank entries or customer balance drifts in 1 click.",
    ],
    stepsHi: [
      "ऊपर ओपनिंग बनाम क्लोज़िंग कैश पट्टी की जांच करें।",
      "डिजिटल बिक्री और कैश डिपॉज़िट सिंक करने के लिए 'Match Day Closing' दबाएं।",
      "नीचे 'Books Health Check' से पुरानी छूटी बैंक एंट्री या ग्राहक बैलेंस 1 क्लिक में ठीक करें।",
    ],
    sections: [
      {
        id: "deposit-slip",
        header: "Deposit Cash & Printable Slip Generator",
        headerHi: "बैंक कैश जमा और प्रिंट स्लिप",
        summary: "Enter note counts (500×, 200×, 100×, 50×) and print a bank deposit slip.",
        summaryHi: "नोटों की गिनती भरें और बैंक में ले जाने के लिए जमा पर्ची प्रिंट करें।",
        details: [
          "Auto-calculates deposit total from note denominations.",
        ],
        detailsHi: [
          "नोटों की संख्या से कुल जमा राशि अपने-आप गणना होती है।",
        ],
      },
      {
        id: "books-health",
        header: "Books Health Check & Cash/Bank Timeline",
        headerHi: "बुक्स हेल्थ चेक और लाइव टाइमलाइन",
        summary: "Detects unlinked bank entries, drifted customer balances, negative tanks, and shows every rupee chronologically.",
        summaryHi: "अधूरी बैंक एंट्री, ग्राहक बैलेंस अंतर और हर रुपये का समय-क्रम दिखाता है।",
        details: [
          "Includes 1-click 'Fix in 1 Click' buttons for legacy backfill and balance recalculation.",
        ],
        detailsHi: [
          "पुरानी एंट्री और बैलेंस ठीक करने के लिए 1-क्लिक बटन उपलब्ध हैं।",
        ],
      },
    ],
  },
  {
    path: "/dashboard/customers",
    title: "Customers",
    titleHi: "ग्राहक",
    overview:
      "Manage credit customers, monitor Red/Amber/Green risk scores, send Day 15/30 WhatsApp reminders, and merge duplicate accounts.",
    overviewHi:
      "उधार ग्राहकों का प्रबंधन, रेड/एम्बर/ग्रीन जोखिम स्कोर, WhatsApp रिमाइंडर और डुप्लिकेट मर्ज।",
    steps: [
      "Review the 'Credit Collection Priority' strip for Red (Soft Hold >30d) and Amber (Day 15) customers.",
      "Click a customer name to open their Ledger, select specific bills to pay, or settle full due.",
      "Use 'Merge' if near-duplicate customer names are detected.",
    ],
    stepsHi: [
      "रेड (>30 दिन) और एम्बर (15 दिन) ग्राहकों के लिए फॉलो-अप पट्टी देखें।",
      "ग्राहक के नाम पर क्लिक करके खाता खोलें और चुनिंदा बिलों का भुगतान करें।",
      "डुप्लिकेट नाम मिलने पर 1 क्लिक में मर्ज करें।",
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
