┌─────────────────────────────────────────────────────────────────────┐
│                    THAICOMPLY SOCIAL SCANNER                        │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Website   │  │  Facebook   │  │    LINE     │  │   TikTok   │ │
│  │   Scanner   │  │   Scanner   │  │   Scanner   │  │  Scanner   │ │
│  │   (Go)      │  │   (Python)  │  │   (Node.js) │  │  (Python)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              UNIFIED PDPA RISK ENGINE                        │   │
│  │  • Cross-platform data mapping                                │   │
│  │  • Consent gap analysis                                       │   │
│  │  • Breach probability scoring                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

| Data Point                 | PDPA Risk | How to Detect                              |
| -------------------------- | --------- | ------------------------------------------ |
| **Lead Ads forms**         | High      | Graph API → `leadgen_forms` endpoint       |
| **Messenger bots**         | High      | Page settings → `messaging_feature_status` |
| **Page comments with PII** | Critical  | Scrape + regex for phone/email/ID          |
| **Custom audiences**       | High      | `customaudiences` API → data source        |
| **Pixel tracking**         | Medium    | `/<page-id>/events` → pixel config         |
| **Group member lists**     | High      | Group API → member export capability       |
| **Marketplace listings**   | Medium    | Listing description + contact methods      |

| Data Point                 | PDPA Risk | Detection Method                     |
| -------------------------- | --------- | ------------------------------------ |
| **LINE OA rich menus**     | High      | OA Manager API → menu configuration  |
| **Auto-reply messages**    | High      | Messaging API → auto-reply settings  |
| **Chat history storage**   | Critical  | OA settings → chat history retention |
| **Member profile export**  | Critical  | Member API → profile data access     |
| **LINE Login integration** | Medium    | Login channel → scope permissions    |
| **LINE Pay**               | Critical  | Payment API → transaction data       |
| **Group chat admin**       | Medium    | Group settings → member visibility   |

| Data Point                | PDPA Risk | Detection                                 |
| ------------------------- | --------- | ----------------------------------------- |
| **Bio link tracking**     | Medium    | Bio URL → UTM parameters, tracking pixels |
| **DM auto-responses**     | High      | Business account settings                 |
| **Comment PII**           | Critical  | Public comments with phone/email          |
| **Lead generation forms** | High      | TikTok Lead Gen ads                       |
| **Pixel/TikTok Events**   | Medium    | TikTok Pixel configuration                |

┌─────────────────────────────────────────────────────────────┐
│           THAICOMPLY SOCIAL MEDIA AUDIT REPORT              │
│           Khun Somchai — Bangkok Real Estate                │
├─────────────────────────────────────────────────────────────┤
│ OVERALL RISK SCORE: 78/100  🔴 CRITICAL                     │
│ PDPA Compliance: 32%                                        │
│ Estimated Fine Exposure: 1M-5M THB                          │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM BREAKDOWN                                          │
│                                                             │
│ Facebook Page:        45 pts  (Critical)                     │
│   • Lead forms without consent: 3 forms                     │
│   • Public comments with phone numbers: 12 instances        │
│   • Pixel advanced matching without consent                 │
│   • Custom audience with unverified sources                 │
│                                                             │
│ LINE Official Account: 28 pts  (Critical)                  │
│   • Auto-reply collects PII without consent               │
│   • 2,450 followers — no consent audit                      │
│   • Chat history retention unknown                         │
│                                                             │
│ Website:              5 pts   (Low)                        │
│   • Basic privacy policy present                            │
│   • Missing cookie consent banner                           │
│                                                             │
│ TikTok:               0 pts   (Not scanned)                │
│   • Manual review required                                  │
├─────────────────────────────────────────────────────────────┤
│ TOP 3 URGENT ACTIONS                                        │
│ 1. Add consent checkboxes to all Facebook lead forms        │
│ 2. Implement LINE auto-reply consent confirmation           │
│ 3. Delete 12 public comments exposing phone numbers         │
├─────────────────────────────────────────────────────────────┤
│ RECOMMENDED: ThaiComply Platform                            │
│ • Automated consent management across all platforms         │
│ • Encrypted data vault for lead information                 │
│ • Auto-generated privacy policies (Thai + English)          │
│ • PDPA-compliant website with lead capture                  │
│                                                             │
│ Price: 3,900 THB/month (Growth plan)                        │
│ ROI: Prevents 1M+ THB fine + builds customer trust          │
└─────────────────────────────────────────────────────────────┘

| Aspect           | Website Scan          | Social Media Scan                            |
| ---------------- | --------------------- | -------------------------------------------- |
| **Access**       | Public crawl          | Requires API tokens / permissions            |
| **Consent**      | Cookie banners, forms | Platform-specific (lead forms, chat opt-ins) |
| **Data storage** | Your server           | Platform's server (Facebook, LINE)           |
| **Control**      | Full control          | Limited — platform terms apply               |
| **Retention**    | You define            | Platform defines (often unclear)             |
| **Deletion**     | You can delete        | Harder — platform-dependent                  |
| **Audit trail**  | You control           | Platform-controlled                          |

// services/api/src/routes/social-scan.js
const { FacebookScanner } = require('../scanners/facebook');
const { LINEScanner } = require('../scanners/line');
const { TikTokScanner } = require('../scanners/tiktok');
const { UnifiedScorer } = require('../scanners/unified');

app.post('/api/v1/scan/social', async (request, reply) => {
    const { customer_id, facebook_token, line_token, tiktok_username } = request.body;

    // Run all scanners in parallel
    const [facebook_findings, line_findings, tiktok_findings] = await Promise.all([
        facebook_token ? scanFacebook(facebook_token, customer_id) : [],
        line_token ? scanLINE(line_token, customer_id) : [],
        tiktok_username ? scanTikTok(tiktok_username) : [],
    ]);
    
    // Also scan website
    const website_findings = await scanWebsite(customer_id);
    
    // Combine and score
    const all_findings = [...facebook_findings, ...line_findings, ...tiktok_findings, ...website_findings];
    const report = new UnifiedScorer().calculateScore(all_findings);
    
    // Store report
    await request.server.knex('social_audit_reports').insert({
        customer_id,
        report: JSON.stringify(report),
        created_at: new Date(),
    });
    
    // Auto-generate sales proposal if high risk
    if (report.overall_risk_score > 50) {
        await generateSalesProposal(customer_id, report);
    }
    
    return report;
});
