# GitHub PDPA Standard Contractual Clauses (SCCs)
## For Thailand Cross-Border Data Transfer Compliance

**Document Version:** 1.0  
**Effective Date:** 2026-06-05  
**Jurisdiction:** Thailand Personal Data Protection Act B.E. 2562 (2019)  
**Transfer Mechanism:** Standard Contractual Clauses per PDPA Section 29(3)  
**Data Exporter:** [Your Company Name], Thailand  
**Data Importer:** GitHub, Inc. (Microsoft subsidiary), United States  

---

## 1. Executive Summary

If you choose to use GitHub for repositories containing **Thai personal data**, you must execute Standard Contractual Clauses (SCCs) with GitHub to comply with Thailand PDPA Section 29. This document provides the contractual framework, implementation checklist, and ongoing compliance obligations.

**Key Risk:** The United States has **no PDPA adequacy decision** from Thailand's Personal Data Protection Committee (PDPC). citeweb_search:19#2 Therefore, SCCs are the primary lawful transfer mechanism.

---

## 2. PDPA Legal Basis for Transfer

### Section 29 Requirements

Per Thailand PDPA Section 29, personal data may be transferred abroad only if: citeweb_search:19#0

| Condition | GitHub Situation | Your Action |
|-----------|-----------------|-------------|
| (1) Adequacy decision by PDPC | **No** — US not whitelisted | N/A |
| (2) SCCs for protection | **Required** — This document | Execute with GitHub |
| (3) Consent from data subject | **Impractical** — Individual consent for every repo access | Use SCCs instead |
| (4) Necessary for contract | **Partial** — Only if processing is contractually required | Document basis |
| (5) Prevent harm to data subject | **N/A** — Not emergency situation | N/A |
| (6) Important public interest | **N/A** — Commercial SaaS | N/A |

### PDPA Section 28(2) — Additional Safeguards

Even with SCCs, you must ensure: citeweb_search:19#4

> "The protection standards of the destination country or international organization do not materially impair the protection afforded by this Act."

**Assessment:** US CLOUD Act and FISA 702 create material impairment risks. You must document this assessment and implement **supplementary measures** (see Section 6).

---

## 3. GitHub SCC Template (Thailand-Adapted)

Based on ASEAN Model Contractual Clauses (MCCs) and EU SCCs, adapted for Thailand PDPA: citeweb_search:19#3

```
STANDARD CONTRACTUAL CLAUSES FOR THE TRANSFER OF PERSONAL DATA
TO THIRD COUNTRIES UNDER THE THAILAND PERSONAL DATA PROTECTION ACT B.E. 2562 (2019)

MODULE ONE: Transfer controller to controller

Clause 1: Purpose and Scope
(a) The purpose of these standard contractual clauses is to ensure compliance with the 
    requirements of Section 29 of the Thailand PDPA for the transfer of personal data 
    to a third country.

(b) The Parties:
    (i)   the natural or legal person(s), public authority/ies, agency/ies or other 
          body/ies (hereinafter 'entity/ies') transferring the personal data, as listed 
          in Annex I.A (hereinafter each 'data exporter'); and
    (ii)  the entity/ies in a third country receiving the personal data from the data 
          exporter, directly or indirectly via another entity also Party to these Clauses, 
          as listed in Annex I.A (hereinafter each 'data importer')
    have agreed to these standard contractual clauses (hereinafter: 'Clauses').

(c) These Clauses apply with respect to the transfer of personal data as specified in 
    Annex I.B.

(d) The Appendix to these Clauses containing the Annexes referred to therein forms an 
    integral part of these Clauses.

Clause 2: Effect and Invariability of the Clauses
(a) These Clauses set out appropriate safeguards, including enforceable data subject rights 
    and effective legal remedies, pursuant to Section 29(2) of the Thailand PDPA for the 
    transfer of personal data by the data exporter to the data importer.

(b) The Parties undertake not to vary or modify the Clauses, except to update the 
    information in the Annexes.

(c) These Clauses do not exempt the Parties from their obligations under the Thailand PDPA.

Clause 3: Interpretation
(a) Where these Clauses use terms that are defined in the Thailand PDPA, those terms shall 
    have the same meaning as in the PDPA.

(b) These Clauses shall be read and interpreted in the light of the provisions of the 
    Thailand PDPA.

(c) These Clauses shall not be interpreted in a way that conflicts with rights and 
    obligations provided for in the Thailand PDPA.

Clause 4: Hierarchy
In the event of a contradiction between these Clauses and the provisions of related 
agreements between the Parties, existing at the time these Clauses are agreed or entered 
into thereafter, these Clauses shall prevail.

Clause 5: Transfer Impact Assessment (TIA)
(a) The data exporter warrants that it has used reasonable efforts to determine that the 
    data importer is able, through the implementation of appropriate technical and 
    organisational measures, to satisfy its obligations under these Clauses.

(b) The Parties declare that in providing the warranty in paragraph (a), the data exporter 
    has taken into account the following:
    (i)   the specific circumstances of the transfer, including the laws and practices of 
          the third country of destination;
    (ii)  the laws and practices of the third country of destination — including those 
          requiring the disclosure of data to public authorities or authorising access by 
          such authorities — relevant in light of the specific circumstances of the transfer, 
          and the applicable limitations and safeguards;
    (iii) any supplementary measures taken by the data importer to supplement the safeguards 
          under these Clauses.

(c) The data importer warrants that in assessing the level of protection afforded by the 
    laws of the third country of destination, it has taken into account the following guidelines:
    (i)   Thailand PDPC Guidelines on Cross-Border Data Transfers (2024);
    (ii)  ASEAN Cross-Border Data Flows Mechanism;
    (iii) European Data Protection Board recommendations on measures that supplement transfer 
          tools (01/2020).

Clause 6: Data Importer Obligations
(a) The data importer shall process the personal data only on documented instructions from 
    the data exporter, including with regard to transfers of personal data to a third country 
    or an international organisation.

(b) The data importer shall ensure that persons authorised to process the personal data 
    have committed themselves to confidentiality or are under an appropriate statutory 
    obligation of confidentiality.

(c) The data importer shall implement appropriate technical and organisational measures to 
    ensure a level of security appropriate to the risk, including:
    (i)   pseudonymisation and encryption of personal data;
    (ii)  ensuring ongoing confidentiality, integrity, availability and resilience of 
          processing systems and services;
    (iii) ensuring the ability to restore the availability and access to personal data in a 
          timely manner in the event of a physical or technical incident;
    (iv)  a process for regularly testing, assessing and evaluating the effectiveness of 
          technical and organisational measures.

(d) The data importer shall not engage another processor without prior specific or general 
    written authorisation of the data exporter.

(e) The data importer shall notify the data exporter without undue delay after becoming 
    aware of:
    (i)   a personal data breach;
    (ii)  a request from a public authority for access to personal data, including for 
          national security or law enforcement purposes;
    (iii) any accidental or unlawful destruction, loss, alteration, unauthorised disclosure 
          of, or access to the personal data transmitted, stored or otherwise processed.

(f) The data importer shall make available to the data exporter all information necessary 
    to demonstrate compliance with the obligations laid down in these Clauses.

(g) The data importer shall allow for and contribute to audits by the data exporter or 
    an auditor mandated by the data exporter.

Clause 7: Data Subject Rights
(a) The data importer shall inform data subjects in a transparent and easily accessible form, 
    using clear and plain language, of:
    (i)   their identity and contact details;
    (ii)  the categories of personal data concerned;
    (iii) the recipients or categories of recipients;
    (iv)  the purpose of processing;
    (v)   the right to access, rectification, erasure, restriction of processing, and data 
          portability;
    (vi)  the right to lodge a complaint with the PDPC;
    (vii) the existence of automated decision-making, including profiling.

(b) The data importer shall promptly notify the data exporter of any request received from 
    a data subject and shall not respond to that request without the data exporter's 
    authorisation.

(c) The data importer shall assist the data exporter in fulfilling its obligation to respond 
    to data subjects' requests.

Clause 8: Accountability — Data Protection Officer
(a) The data importer shall designate a contact person within its organisation authorised 
    to respond to inquiries concerning the processing of personal data under these Clauses.

(b) The data importer shall designate a data protection officer (DPO) if required by the 
    Thailand PDPA or the laws of the data importer's country.

(c) The data importer shall cooperate, in particular, with the PDPC in the event of any 
    inquiry or investigation.

Clause 9: Redress
(a) The data importer shall inform data subjects of their right to obtain redress for 
    breach of their rights under these Clauses from the data exporter or the data importer 
    as data controller.

(b) The data importer shall accept the jurisdiction of the courts of Thailand for disputes 
    brought by a data subject.

(c) The data importer agrees that any data subject may also bring a legal action against 
    the data importer before the courts of any country in the ASEAN region.

Clause 10: Liability
(a) Each Party shall be liable to the other Party/ies for any damage it causes the other 
    Party/ies by any breach of these Clauses.

(b) The data importer shall be liable to the data subject, and the data subject shall be 
    entitled to receive compensation from the data importer, for any material or non-material 
    damage caused by the data importer's breach of these Clauses.

(c) In the event of joint and several liability, the data importer shall be entitled to 
    claim back from the other Party/ies that part of the compensation corresponding to 
    their part of responsibility for the damage.

Clause 11: Supervision
(a) The PDPC shall have the power to supervise compliance with these Clauses.

(b) The data importer shall submit itself to the jurisdiction of the PDPC and cooperate 
    with the PDPC in the performance of its tasks.

Clause 12: Local Laws and Practices Affecting Compliance — US Specific
(a) The Parties warrant that they have no reason to believe that the laws and practices in 
    the third country of destination applicable to the processing of the personal data by 
    the data importer, including the requirements to disclose data to public authorities or 
    authorise access by such authorities, prevent the data importer from fulfilling its 
    obligations under these Clauses.

(b) The data importer specifically warrants that:
    (i)   It has assessed the relevant laws and practices of the United States, including 
          the CLOUD Act, FISA 702, and Executive Order 12333;
    (ii)  It has implemented supplementary measures (see Annex III) to ensure that the 
          level of protection afforded by the Thailand PDPA is not materially impaired;
    (iii) It will promptly inform the data exporter of any changes in US law that may 
          affect its ability to comply with these Clauses.

(c) The data importer agrees to provide the data exporter, upon request, with copies of 
    government requests for data access and its responses thereto.

Clause 13: Monitoring and Compliance — Audit
(a) The data importer shall make available to the data exporter all information necessary to 
    demonstrate compliance with the obligations under these Clauses, including the results 
    of technical and organisational measures and data protection impact assessments.

(b) The data importer shall allow for and contribute to audits by the data exporter or an 
    auditor mandated by the data exporter, at least annually or upon request by the PDPC.

(c) The Parties shall make the information referred to in paragraph (a), including the 
    results of any audits, available to the PDPC upon request.

Clause 14: Data Breach Notification
(a) The data importer shall notify the data exporter without undue delay and, where feasible, 
    not later than 72 hours after having become aware of a personal data breach.

(b) The notification shall:
    (i)   describe the nature of the breach including the categories and approximate number 
          of data subjects concerned;
    (ii)  communicate the name and contact details of the data protection officer or other 
          contact point;
    (iii) describe the likely consequences of the breach;
    (iv)  describe the measures taken or proposed to address the breach.

(c) The data exporter shall notify the PDPC within 72 hours of becoming aware of the breach, 
    unless the breach is unlikely to result in a risk to the rights and freedoms of natural 
    persons.

(d) The data importer shall document all personal data breaches, comprising the facts 
    relating to the breach, its effects and the remedial action taken.

Clause 15: Termination
(a) In the event that the data importer is in breach of its obligations under these Clauses, 
    the data exporter may temporarily suspend the transfer of personal data to the data 
    importer until the breach is remedied or the Clauses are terminated.

(b) The data exporter shall be entitled to terminate these Clauses where:
    (i)   the data importer has substantially or persistently breached its obligations under 
          these Clauses;
    (ii)  the data importer fails to comply with a binding decision of a competent court or 
          the PDPC regarding its obligations under these Clauses.

(c) The data exporter shall be entitled to terminate these Clauses where the data importer 
    is in breach of its obligations under these Clauses and the transfer of personal data 
    would infringe the Thailand PDPA.

(d) Upon termination, the data importer shall, at the choice of the data exporter, return 
    all personal data transferred and the copies thereof to the data exporter, or shall 
    destroy all personal data and certify to the data exporter that it has done so.

Clause 16: Governing Law
These Clauses shall be governed by the law of Thailand.

Clause 17: Jurisdiction
Any dispute arising from these Clauses shall be resolved by the courts of Thailand.

Clause 18: Variation of Annexes
The Parties may agree to change the Annexes by written agreement. Such changes do not 
constitute a modification of these Clauses.

Clause 19: Sub-Processor Engagement
(a) The data importer shall not engage sub-processors without the prior specific written 
    authorisation of the data exporter.

(b) The data importer shall inform the data exporter of any intended changes concerning 
    the addition or replacement of sub-processors.

(c) The data importer shall ensure that the sub-processor is bound by the same data 
    protection obligations as the data importer under these Clauses.

Clause 20: PDPC Supervision
The data importer agrees to submit to the supervision of the PDPC and to cooperate with 
the PDPC in the performance of its tasks.
```

---

## 4. Annexes

### Annex I.A — List of Parties

| Role | Name | Address | Contact | Activities |
|------|------|---------|---------|------------|
| Data Exporter | [Your Company] | [Thailand Address] | [DPO Email] | SaaS platform processing Thai personal data |
| Data Importer | GitHub, Inc. | 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA | privacy@github.com | Code repository hosting, CI/CD processing |

### Annex I.B — Description of Transfer

| Element | Details |
|---------|---------|
| **Categories of data subjects** | Thai customers, end-users, website visitors whose data is processed by the SaaS platform |
| **Categories of personal data** | Names, email addresses, IP addresses, usage logs, payment information (if applicable), support tickets |
| **Sensitive data** | [Yes/No — specify categories if yes] |
| **Volume** | Approximately [X] data subjects, [Y] records/month |
| **Frequency** | Continuous (real-time sync) / Batch (daily) |
| **Nature of processing** | Storage, automated analysis (CI/CD logs), backup, disaster recovery |
| **Purpose** | Software development, version control, continuous integration/deployment |
| **Retention period** | Duration of customer contract + [X] years for legal compliance |
| **Data subjects under 20** | [Yes/No — if yes, additional parental consent required per PDPA Section 23] |

### Annex I.C — Competent Supervisory Authority

The Personal Data Protection Committee (PDPC) of Thailand  
Address: [Current PDPC address]  
Website: https://www.pdpc.or.th

### Annex II — Technical and Organisational Measures

| Measure | Implementation by GitHub | Verification |
|---------|-------------------------|------------|
| Encryption at rest | AES-256 (GitHub Enterprise) | SOC 2 Type II report |
| Encryption in transit | TLS 1.2+ | Certificate transparency logs |
| Access controls | RBAC, SSO, 2FA | GitHub audit logs |
| Data minimisation | Configurable retention | Repository settings |
| Incident response | 24/7 SOC, 72h notification | Incident response plan |
| Staff training | Annual security training | Training records |
| Physical security | ISO 27001 certified DCs | Certification audit |
| Penetration testing | Annual third-party testing | Test reports |

### Annex III — Supplementary Measures (US CLOUD Act / FISA 702 Mitigation)

| Risk | Supplementary Measure | Implementation |
|------|----------------------|----------------|
| US government data access (CLOUD Act) | **Encryption in transit and at rest with keys controlled by data exporter** | Use AWS KMS with Thai-managed keys; GitHub never has decryption keys |
| FISA 702 upstream collection | **Pseudonymisation of data subject identifiers before transfer** | Hash/email masking in logs |
| Executive Order 12333 | **Technical measures preventing bulk collection** | VPN tunneling, IP whitelisting |
| No judicial redress for non-US persons | **Contractual commitment to challenge unlawful requests** | GitHub's transparency reports + legal challenge fund |
| Lack of PDPC enforcement in US | **Thai law governing + Thai jurisdiction clause** | Clause 16-17 of SCCs |

---

## 5. GitHub-Specific Considerations

### 5.1 GitHub Data Processing Agreement (DPA)

GitHub provides a Data Protection Addendum: citeweb_search:19#8
- **URL:** https://github.com/customer-terms/github-data-protection-addendum
- **Coverage:** GitHub.com, GitHub Enterprise Cloud, GitHub Enterprise Server
- **SCCs:** Incorporates EU SCCs (which can be adapted for Thailand)
- **Sub-processors:** Listed at https://github.com/subprocessors

**Gap Analysis:**

| Requirement | GitHub DPA | Thailand PDPA | Gap |
|-------------|-----------|---------------|-----|
| SCCs for Thailand | EU SCCs referenced | Thailand-specific SCCs required | **Adaptation needed** |
| 72h breach notification to PDPC | To data exporter only | Direct to PDPC if exporter fails | **Add contractual obligation** |
| Data subject rights enforcement | EU-focused | Thai DPA jurisdiction | **Add Thai jurisdiction clause** |
| DPO appointment | Not required by GitHub | Required for large-scale processing | **Your obligation** |
| Cross-border transfer records | Not maintained by GitHub | Required by PDPA Section 39 | **Your obligation** |
| Consent for sensitive data | Not addressed | Explicit consent required | **Your obligation** |

### 5.2 GitHub Enterprise vs. GitHub.com

| Feature | GitHub.com | GitHub Enterprise Cloud | GitHub Enterprise Server |
|---------|-----------|------------------------|-------------------------|
| Data residency options | US/EU only | US/EU only | **Any AWS/Azure/GCP region** |
| Thailand hosting | ❌ No | ❌ No | ✅ Yes (self-managed) |
| PDPA compliance | Requires SCCs | Requires SCCs | **Best option** |
| Cost | Free/$4-21/mo | $21-39/user/mo | ~$150-300/user/year + infra |
| Management overhead | None | None | High (self-hosted) |

**Recommendation:** If you must use GitHub, **GitHub Enterprise Server** self-hosted in AWS Thailand is the closest to compliance. But at that point, GitLab CE/EE self-hosted is simpler and cheaper.

### 5.3 GitHub Actions & Data Processing

**Critical Issue:** GitHub Actions runners execute in GitHub's infrastructure (US/EU). If your CI/CD pipelines process Thai personal data (e.g., database migrations with PII, log analysis, test data), that data touches GitHub's servers.

| Scenario | PDPA Risk | Mitigation |
|----------|-----------|------------|
| Build/test code only (no PII) | None | No action needed |
| CI/CD with anonymised test data | Low | Document anonymisation method |
| CI/CD with production DB dumps | **High** | Use self-hosted runners in Thailand |
| GitHub Issues with customer names/emails | Medium | SCCs cover this; consider sanitisation |
| GitHub Projects with PII | Medium | SCCs + access controls |

**GitHub Self-Hosted Runners:** You can run GitHub Actions runners on your own AWS Thailand infrastructure, keeping execution local. But the orchestration (job queue, logs, artifacts) still flows through GitHub's US servers.

---

## 6. Implementation Checklist

### Phase 1: Pre-Transfer (Before using GitHub for Thai PII)

| # | Task | Owner | Timeline | Evidence |
|---|------|-------|----------|----------|
| 1 | Conduct Transfer Impact Assessment (TIA) | DPO | Week 1 | TIA document |
| 2 | Execute SCCs with GitHub (adapted for Thailand) | Legal | Week 2 | Signed contract |
| 3 | Document lawful basis for transfer (Section 29) | DPO | Week 2 | PDPA compliance register |
| 4 | Notify PDPC of cross-border transfer (if required) | DPO | Week 3 | PDPC notification receipt |
| 5 | Implement supplementary measures (Annex III) | Engineering | Week 3-4 | Technical documentation |
| 6 | Configure GitHub Enterprise encryption settings | Engineering | Week 4 | Screenshot/settings export |
| 7 | Set up GitHub audit log forwarding to Thailand | Engineering | Week 4 | CloudWatch/Splunk config |
| 8 | Train staff on PDPA-compliant GitHub usage | HR/DPO | Week 5 | Training records |
| 9 | Publish privacy notice mentioning GitHub transfer | Legal | Week 5 | Website privacy policy |
| 10 | Establish 72h breach notification procedure | DPO | Week 6 | Runbook + contact tree |

### Phase 2: Ongoing Compliance

| # | Task | Frequency | Evidence |
|---|------|-----------|----------|
| 1 | Review GitHub sub-processor list | Monthly | https://github.com/subprocessors |
| 2 | Audit GitHub access logs | Quarterly | Audit report |
| 3 | Test breach notification procedure | Quarterly | Drill report |
| 4 | Review SCCs for legal changes | Annually | Legal memo |
| 5 | Update TIA based on US law changes | As needed | Updated TIA |
| 6 | PDPC inspection readiness | Continuous | Compliance file |

---

## 7. Cost Comparison: GitHub + SCCs vs. GitLab Self-Hosted

| Cost Category | GitHub + SCCs (Annual) | GitLab Self-Hosted (Annual) |
|--------------|------------------------|----------------------------|
| **Platform licensing** | GitHub Enterprise: ~$4,680 (20 users × $234) | GitLab CE: $0 / EE: ~$2,400 |
| **Legal/SCC management** | ~$15,000 (lawyer hours, contract negotiation, TIA) | ~$2,000 (initial setup only) |
| **DPO oversight** | ~$30,000 (ongoing monitoring, audits, PDPC liaison) | ~$10,000 (reduced complexity) |
| **AWS infrastructure** | ~$3,000 (self-hosted runners, audit logging) | ~$16,944 (full GitLab stack, see Architecture doc) |
| **Compliance tooling** | ~$5,000 (audit log analysis, breach detection) | ~$3,000 (simpler, single region) |
| **Risk reserve** (fines, remediation) | ~$50,000 (CLOUD Act exposure) | ~$5,000 |
| **Total Year 1** | **~$107,680** | **~$37,344** |
| **Total Year 2+** | **~$57,680** | **~$19,944** |

*Note: GitLab becomes significantly cheaper after Year 1 because legal/SCC overhead is eliminated. GitHub requires ongoing legal monitoring due to changing US surveillance laws.*

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|------|-----------|--------|------------|---------------|
| PDPC issues adequacy decision for US | Low | High | Monitor PDPC announcements; update SCCs if positive | Low |
| US expands surveillance (new EO) | Medium | High | Supplementary measures; encryption with Thai keys | Medium |
| GitHub changes sub-processors to non-adequate country | Medium | Medium | Monthly sub-processor review; contractual veto right | Low |
| PDPC audits cross-border transfers | Medium | High | Maintain TIA, SCCs, audit logs; quarterly self-audit | Low |
| Data subject requests erasure from GitHub | Medium | Medium | 30-day deletion SLA in SCCs; automated deletion workflow | Low |
| GitHub breach affects Thai data | Low | Critical | 72h notification; cyber insurance; incident response plan | Low |
| Developer accidentally commits PII to public repo | Medium | High | Pre-commit hooks; secret scanning; training | Low |

---

## 9. Decision Matrix

| Factor | Weight | GitHub + SCCs | GitLab Self-Hosted |
|--------|--------|---------------|-------------------|
| PDPA compliance confidence | 30% | 6/10 | 10/10 |
| Cost (3-year TCO) | 20% | 4/10 | 8/10 |
| Developer experience | 20% | 9/10 | 7/10 |
| Operational overhead | 15% | 7/10 | 5/10 |
| Customer trust (Thai market) | 15% | 5/10 | 9/10 |
| **Weighted Score** | | **6.1/10** | **8.2/10** |

---

## 10. Recommended Action

**Primary Recommendation:** Deploy GitLab self-hosted in AWS Thailand (see Architecture document). This eliminates cross-border transfer complexity, reduces legal overhead, and strengthens your PDPA compliance product's credibility.

**If GitHub is mandatory** (e.g., existing enterprise contract, specific features):
1. Use **GitHub Enterprise Server** self-hosted in AWS Thailand
2. If using GitHub.com/Enterprise Cloud, execute these SCCs with GitHub
3. Implement all supplementary measures in Annex III
4. Use self-hosted runners in Thailand for CI/CD
5. Never store production PII in GitHub Issues/Projects
6. Maintain quarterly TIA reviews
7. Budget ~$108K Year 1 for compliance overhead

---

*Document Version: 1.0*  
*Prepared for: PrivacyReady PDPA Compliance Platform*  
*Date: 2026-06-05*  
*Legal Review: Required before execution*  
*Next Review Date: 2026-12-05*
