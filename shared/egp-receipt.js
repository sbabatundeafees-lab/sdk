/* EGP-RECEIPT-BEGIN */
/* ======================================================================
 * EgolePay shared e-Receipt + result modal
 *
 * This exact block is embedded in pulsebridge-sdk.js, standardpaymentsdk.js
 * and webbridge.js so every gateway shows the same receipt. Edit
 * shared/egp-receipt.js and run `python3 shared/embed.py`; never edit the
 * embedded copies by hand.
 *
 * Each SDK installs it with `Object.assign(<Class>.prototype, EgolePayReceipt)`
 * and supplies a `receipt` object (see buildReceipt in each SDK):
 *   { merchantReference, gatewayReference, paymentReference, status,
 *     statusLabel, message, total, currency, description, channel,
 *     paidAt, paidAtLabel, customer:{name,email,phone}, card, bank,
 *     metadata, mode, externalReceipts:[{label,url}], externalReceiptsTitle }
 *
 * Per Mr Emma (19 Sep 2026): the receipt shows the TOTAL only — no
 * amount / service-charge split.
 * ====================================================================== */
const EgolePayReceipt = {
    _esc(value) {
        if (value === null || value === undefined)
            return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },
    _formatMoney(value, currency) {
        const code = currency || this.currency || "NGN";
        const symbol = {
            NGN: "₦",
            USD: "$",
            GBP: "£",
            EUR: "€",
            GHS: "₵",
            KES: "KSh",
            ZAR: "R",
        }[code];
        const amount = Number(value || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return symbol ? `${symbol}${amount}` : `${code} ${amount}`;
    },
    _formatReceiptDate(date) {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime()))
            return "";
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const pad = (n) => String(n).padStart(2, "0");
        const meridiem = d.getHours() >= 12 ? "PM" : "AM";
        const hour = d.getHours() % 12 || 12;
        const offset = -d.getTimezoneOffset();
        const tz = `GMT${offset >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
        return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(hour)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${meridiem} (${tz})`;
    },
    _sealReceipt(receipt) {
        const material = [
            receipt.merchantReference,
            receipt.gatewayReference,
            receipt.paymentReference,
            receipt.status,
            Number(receipt.total || 0).toFixed(2),
            receipt.currency,
            receipt.paidAt,
        ].join("|");
        let fnv = 0x811c9dc5;
        let djb = 5381;
        for (let i = 0; i < material.length; i++) {
            const code = material.charCodeAt(i);
            fnv = (fnv ^ code) >>> 0;
            fnv = (fnv + ((fnv << 1) + (fnv << 4) + (fnv << 7) + (fnv << 8) + (fnv << 24))) >>> 0;
            djb = ((djb << 5) + djb + code) >>> 0;
        }
        const block = (n) => n.toString(36).toUpperCase().padStart(7, "0").slice(-7);
        return `${block(fnv).slice(0, 4)}-${block(fnv).slice(4)}${block(djb).slice(0, 1)}-${block(djb).slice(1, 5)}`;
    },
    _statusLabel(status) {
        return {
            success: "SUCCESSFUL",
            failed: "FAILED",
            pending: "PENDING",
            cancelled: "CANCELLED",
        }[status] || String(status || "").toUpperCase();
    },

    /* ---- external (agency / LIRS) receipts ----
     * The gateway returns one merchantReturnUrl per settled item, several
     * joined by "$$". Harmonized bills now also carry the purchased item's
     * name after a "#":   https://host/receipt.pdf#Ground Rent 2026
     * Either order is accepted (whichever side is the URL is the link).
     * Returns [{label, url}] with duplicates removed, order preserved. */
    _parseExternalReceipts(rawUrls, names = [], fallbackLabel = "LIRS Receipt") {
        const list = Array.isArray(rawUrls)
            ? rawUrls
            : typeof rawUrls === "string" ? rawUrls.split("$$") : [];
        const isUrl = (v) => /^https?:\/\//i.test(String(v || "").trim());
        const seen = new Set();
        const out = [];
        list.forEach((raw, i) => {
            const text = String(raw || "").trim();
            if (!text)
                return;
            let url = text;
            let label = "";
            const hash = text.indexOf("#");
            if (hash > -1) {
                const a = text.slice(0, hash).trim();
                const b = text.slice(hash + 1).trim();
                if (isUrl(a)) {
                    url = a;
                    label = b;
                }
                else if (isUrl(b)) {
                    url = b;
                    label = a;
                }
            }
            if (!isUrl(url) || seen.has(url))
                return;
            seen.add(url);
            if (!label)
                label = (names && names[i]) || "";
            out.push({ url, label, fallback: !label });
        });
        // No name from "#" or the notifylist: number the fallbacks when there
        // are several so the payer can still tell the receipts apart.
        const unnamed = out.filter((x) => x.fallback);
        unnamed.forEach((x, n) => {
            x.label = unnamed.length > 1 ? `${fallbackLabel} ${n + 1}` : fallbackLabel;
        });
        out.forEach((x) => delete x.fallback);
        return out;
    },
    _openExternalReceipt(url) {
        if (!url)
            return;
        // The agency PDF is cross-origin with no CORS headers, so it cannot be
        // fetched into a blob. Desktop: new tab renders it. Mobile webviews
        // block new tabs, so trigger a same-context anchor click instead and
        // let the host app's download handler / PDF viewer take over.
        const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
        if (isMobile) {
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "receipt.pdf";
            anchor.rel = "noopener";
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            return;
        }
        window.open(url, "_blank", "noopener");
    },

    /* ---- logo + watermarks ---- */
    async _resolveLogo() {
        if (this._logoDataUri !== undefined)
            return this._logoDataUri;
        this._logoDataUri = null;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            const response = await fetch(this.companyLogo, { mode: "cors", signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok)
                throw new Error(`logo ${response.status}`);
            const blob = await response.blob();
            if (blob.size > 512 * 1024)
                throw new Error("logo too large to inline");
            this._logoDataUri = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
        }
        catch (err) {
            this._logoDataUri = null;
        }
        return this._logoDataUri;
    },
    _watermarkTile(receipt) {
        const tag = this._esc((receipt.gatewayReference || receipt.merchantReference || "").slice(0, 28));
        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="210" viewBox="0 0 340 210">',
            '<g transform="rotate(-28 170 105)" fill="#0F172A" fill-opacity="0.055"',
            ' font-family="Helvetica,Arial,sans-serif" text-anchor="middle">',
            '<text x="170" y="96" font-size="34" font-weight="700" letter-spacing="3">EGOLEPAY</text>',
            `<text x="170" y="122" font-size="11" font-weight="600" letter-spacing="1.6">${tag}</text>`,
            "</g></svg>",
        ].join("");
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    },
    _watermarkGhost() {
        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">',
            '<text x="320" y="150" text-anchor="middle" fill="#0F172A" fill-opacity="0.055"',
            ' font-family="Helvetica,Arial,sans-serif" font-size="86" font-weight="700" letter-spacing="8">EGOLEPAY</text>',
            "</svg>",
        ].join("");
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    },

    /* ---- the receipt document (rendered in the iframe, printed, downloaded) ---- */
    buildReceiptDocument(receipt, logoSrc) {
        const esc = (v) => this._esc(v);
        const money = (v) => this._formatMoney(v, receipt.currency);
        const tone = {
            success: { accent: "#0F9D58", soft: "#E8F5E9", label: "PAID" },
            failed: { accent: "#D93025", soft: "#FDECEA", label: "NOT PAID" },
            pending: { accent: "#F09300", soft: "#FFF4E0", label: "PENDING" },
            cancelled: { accent: "#5F6368", soft: "#F1F3F4", label: "CANCELLED" },
        }[receipt.status] || { accent: "#5F6368", soft: "#F1F3F4", label: esc(receipt.statusLabel) };
        const brandMark = logoSrc
            ? `<img class="brand-logo" src="${esc(logoSrc)}" alt="EgolePay">`
            : `<span class="brand-word">EGOLEPAY</span>`;
        const row = (label, value, opts = {}) => {
            if (value === null || value === undefined || value === "")
                return "";
            return `<div class="row${opts.strong ? " row-strong" : ""}">
            <div class="row-label">${esc(label)}</div>
            <div class="row-value${opts.mono ? " mono" : ""}">${esc(value)}</div>
          </div>`;
        };
        const metaRows = Object.keys(receipt.metadata || {})
            .filter((key) => {
                const value = receipt.metadata[key];
                return value !== null && value !== undefined && typeof value !== "object" && String(value).length <= 120;
            })
            .slice(0, 8)
            .map((key) => row(key, receipt.metadata[key]))
            .join("");
        const customer = receipt.customer || {};
        const externals = Array.isArray(receipt.externalReceipts) ? receipt.externalReceipts.filter((x) => x && x.url) : [];
        const externalRows = externals
            .map((x, i) => `<div class="row row-ext">
            <div class="row-label ext-name">${esc(x.label || `Receipt ${i + 1}`)}</div>
            <a class="ext-btn" href="${esc(x.url)}" target="_blank" rel="noopener" data-egp-ext="${i}">${externals.length === 1 ? "Download LIRS Receipt" : "Download"}</a>
          </div>`)
            .join("");
        return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EgolePay Receipt ${esc(receipt.gatewayReference || receipt.merchantReference)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #EEF1F5;
    color: #0F172A;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    position: relative;
    max-width: 640px;
    margin: 18px auto;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 4px;
    overflow: hidden;
  }

  /* ---- watermark layers: non-selectable, non-copyable, always printed ---- */
  .wm { position: absolute; inset: 0; pointer-events: none; user-select: none;
        -webkit-user-select: none; z-index: 0; }
  .wm-tile { background-image: url("${this._watermarkTile(receipt)}");
             background-repeat: repeat; background-size: 340px 210px; }
  .wm-ghost { background-image: url("${logoSrc ? esc(logoSrc) : this._watermarkGhost()}");
              background-repeat: no-repeat; background-position: center 46%;
              background-size: ${logoSrc ? "62%" : "78%"} auto;
              opacity: ${logoSrc ? "0.07" : "1"}; }
  .content { position: relative; z-index: 1; }

  .head { display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; padding: 22px 26px 16px; border-bottom: 1px solid #EDF1F6; }
  .brand-logo { height: 34px; width: auto; display: block; }
  .brand-word { font-size: 19px; font-weight: 800; letter-spacing: 2px; color: #0F172A; }
  .doc-title { font-size: 11px; font-weight: 700; letter-spacing: 1.4px;
               text-transform: uppercase; color: #64748B; margin-top: 7px; }
  .head-right { text-align: right; }
  .stamp { display: inline-block; padding: 6px 13px; border-radius: 4px;
           border: 2px solid ${tone.accent}; color: ${tone.accent};
           background: ${tone.soft}; font-size: 12px; font-weight: 800;
           letter-spacing: 1.6px; transform: rotate(-4deg); }
  .mode { display: block; margin-top: 8px; font-size: 10px; font-weight: 700;
          letter-spacing: 1.2px; color: #B45309; }

  .amount { padding: 22px 26px 18px; text-align: center; border-bottom: 1px dashed #E2E8F0; }
  .amount-label { font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: #94A3B8; }
  .amount-value { font-size: 34px; font-weight: 800; color: ${tone.accent}; margin-top: 5px;
                  letter-spacing: -0.5px; }
  .amount-desc { font-size: 13px; color: #475569; margin-top: 7px; }

  .section { padding: 16px 26px; border-bottom: 1px solid #F1F5F9; }
  .section:last-of-type { border-bottom: 0; }
  .section-title { font-size: 10px; font-weight: 700; letter-spacing: 1.3px;
                   text-transform: uppercase; color: #94A3B8; margin-bottom: 10px; }
  .row { display: flex; align-items: baseline; justify-content: space-between;
         gap: 18px; padding: 5px 0; }
  .row-label { font-size: 12.5px; color: #64748B; flex: 0 0 auto; }
  .row-value { font-size: 12.5px; color: #0F172A; font-weight: 600;
               text-align: right; word-break: break-word; }
  .row-strong .row-value { font-size: 14px; font-weight: 800; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 12px; letter-spacing: 0.2px; }

  /* ---- agency / LIRS receipts: one download per purchased item ---- */
  .row-ext { align-items: center; padding: 7px 0; border-bottom: 1px dashed #EDF1F6; }
  .row-ext:last-child { border-bottom: 0; }
  .ext-name { flex: 1 1 auto; color: #0F172A; font-weight: 600; word-break: break-word; }
  .ext-btn { flex: 0 0 auto; display: inline-block; padding: 5px 12px; border-radius: 3px;
             border: 1px solid #E07D00; background-color: #FF8C00; color: #FFFFFF;
             font-size: 12px; font-weight: 700; line-height: 1.42857; text-decoration: none;
             white-space: nowrap; -webkit-transition: background-color .15s ease-in-out;
             transition: background-color .15s ease-in-out; }
  .ext-btn:hover { background-color: #E67E00; border-color: #C46C00; }
  .ext-btn:active { -webkit-box-shadow: inset 0 3px 5px rgba(0,0,0,.125); box-shadow: inset 0 3px 5px rgba(0,0,0,.125); }
  .ext-note { font-size: 10.5px; color: #94A3B8; margin-top: 8px; line-height: 1.5; }

  .foot { padding: 16px 26px 22px; background: #F8FAFC; }
  .seal { display: flex; align-items: center; justify-content: space-between;
          gap: 14px; padding: 10px 13px; border: 1px dashed #CBD5E1;
          border-radius: 4px; background: #FFFFFF; }
  .seal-label { font-size: 10px; letter-spacing: 1.1px; text-transform: uppercase; color: #94A3B8; }
  .seal-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
               font-size: 14px; font-weight: 700; letter-spacing: 1.5px; color: #0F172A; }
  .note { margin-top: 12px; font-size: 10.5px; line-height: 1.6; color: #94A3B8; text-align: center; }

  @media print {
    html, body { background: #FFFFFF; }
    .sheet { margin: 0; border: 0; border-radius: 4px; max-width: none; }
    .ext-btn { background: #FFFFFF; color: #B45309; border: 1px solid #FDBA74; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="wm wm-tile" aria-hidden="true"></div>
    <div class="wm wm-ghost" aria-hidden="true"></div>

    <div class="content">
      <div class="head">
        <div>
          ${brandMark}
          <div class="doc-title">Payment Receipt</div>
        </div>
        <div class="head-right">
          <span class="stamp">${esc(receipt.statusLabel)}</span>
          ${receipt.mode === "TEST" ? '<span class="mode">TEST MODE - NOT A REAL PAYMENT</span>' : ""}
        </div>
      </div>

      <div class="amount">
        <div class="amount-label">${receipt.status === "success" ? "Amount Paid" : "Amount"}</div>
        <div class="amount-value">${esc(money(receipt.total))}</div>
        <div class="amount-desc">${esc(receipt.description)}</div>
      </div>

      ${externalRows ? `<div class="section">
        <div class="section-title">${esc(receipt.externalReceiptsTitle || "LIRS Receipts")}</div>
        ${externalRows}
        <div class="ext-note">Each item paid has its own agency receipt. Download and keep them together with this EgolePay receipt.</div>
      </div>` : ""}

      <div class="section">
        <div class="section-title">Transaction Details</div>
        ${row("Merchant Reference", receipt.merchantReference, { mono: true })}
        ${row("Payment Reference", receipt.paymentReference, { mono: true })}
        ${row("Description", receipt.description)}
        ${row("Payment Channel", receipt.channel)}
        ${row("Date & Time", receipt.paidAtLabel)}
        ${row("Status", receipt.statusLabel)}
        ${receipt.status !== "success" && receipt.message ? row("Reason", receipt.message) : ""}
      </div>

      <div class="section">
        <div class="section-title">Amount</div>
        ${row("Total", money(receipt.total), { strong: true })}
      </div>

      <div class="section">
        <div class="section-title">Payer</div>
        ${row("Name", customer.name)}
        ${row("Email", customer.email)}
        ${row("Phone", customer.phone)}
        ${receipt.card ? row("Card", receipt.card.maskedPan) : ""}
        ${receipt.bank ? row("Bank", receipt.bank.bankName) : ""}
        ${receipt.bank ? row("Account", receipt.bank.accountNumber) : ""}
      </div>

      ${metaRows ? `<div class="section"><div class="section-title">Additional Details</div>${metaRows}</div>` : ""}

      <div class="foot">
        <div class="seal">
          <span class="seal-label">Verification Code</span>
          <span class="seal-code">${esc(receipt.paymentReference || receipt.verificationCode)}</span>
        </div>
        <div class="note">
          This receipt was generated by EgolePay and is valid only with the verification
          code above. Any alteration to the amount, references or date voids it.<br>
          System generated, no signature required.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
    },

    /* ---- result modal (logo, status icon, inline e-Receipt, Print / Done) ---- */
    _injectReceiptStyles() {
        if (document.getElementById("egp-receipt-styles"))
            return;
        const style = document.createElement("style");
        style.id = "egp-receipt-styles";
        style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
#egp-result-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:92%;max-width:420px;max-height:92vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.18);z-index:10003;padding:28px 26px;text-align:center;font-family:'DM Sans',sans-serif;color:#0f172a;line-height:1.45;}
#egp-result-modal *{box-sizing:border-box;}
#egp-result-modal.egp-wide{max-width:560px;padding:24px 22px;}
#egp-result-modal img.egp-logo{max-width:170px;max-height:38px;display:block;margin:0 auto 18px;object-fit:contain;}
#egp-result-modal .egp-icon{width:56px;height:56px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:700;}
#egp-result-modal h3{margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a;}
#egp-result-modal p.egp-sub{margin:0 0 18px;font-size:13px;color:#64748b;}
#egp-result-modal .egp-ref{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px;text-align:left;}
#egp-result-modal .egp-ref-line{display:flex;justify-content:space-between;gap:12px;padding:4px 0;}
#egp-result-modal .egp-ref-key{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;flex:0 0 auto;font-weight:600;}
#egp-result-modal .egp-ref-val{font-size:12.5px;font-weight:600;color:#0f172a;text-align:right;word-break:break-all;}
#egp-result-modal .egp-actions{display:flex;flex-direction:column;gap:8px;}
#egp-result-modal button{display:block;width:100%;padding:10px 16px;border:1px solid transparent;border-radius:3px;font-size:14px;line-height:1.42857;font-weight:600;text-align:center;cursor:pointer;font-family:'DM Sans',sans-serif;-webkit-transition:background-color .15s ease-in-out,border-color .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out;}
#egp-result-modal button:active{-webkit-box-shadow:inset 0 3px 5px rgba(0,0,0,.125);box-shadow:inset 0 3px 5px rgba(0,0,0,.125);}
#egp-result-modal button:focus{outline:thin dotted;outline:5px auto -webkit-focus-ring-color;outline-offset:-2px;}
#egp-result-modal .egp-btn-done{background-color:#5cb85c;border-color:#4cae4c;color:#fff;}
#egp-result-modal .egp-btn-done:hover{background-color:#449d44;border-color:#398439;}
#egp-result-modal .egp-btn-done.egp-neutral{background-color:#555;border-color:#444;}
#egp-result-modal .egp-btn-done.egp-neutral:hover{background-color:#444;border-color:#333;}
#egp-result-modal .egp-btn-primary{background-color:#ff8c00;border-color:#e07d00;color:#fff;}
#egp-result-modal .egp-btn-primary:hover{background-color:#e67e00;border-color:#c46c00;}
#egp-result-modal .egp-btn-ghost{background-color:#fff;border-color:#ccc;color:#333;}
#egp-result-modal .egp-btn-ghost:hover{background-color:#e6e6e6;border-color:#adadad;}
#egp-result-modal .egp-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
#egp-result-modal .egp-row2 button{min-width:0;}
#egp-result-modal .egp-receipt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 8px;padding-top:14px;border-top:1px solid #f1f5f9;text-align:left;}
#egp-result-modal .egp-receipt-head strong{font-size:12px;letter-spacing:.5px;color:#64748b;text-transform:uppercase;font-weight:700;}
#egp-result-modal iframe#egp-receipt-frame{width:100%;height:46vh;min-height:300px;border:1.5px solid #e2e8f0;border-radius:10px;background:#f8fafc;display:block;margin-bottom:12px;}
#egp-result-modal .egp-toast{font-size:12px;color:#22c55e;min-height:16px;margin:2px 0 8px;}
#egp-result-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10002;}
@media(max-width:640px){#egp-result-modal .egp-row2{grid-template-columns:1fr;}}
@media print{#egp-result-modal .egp-actions,#egp-result-modal .egp-toast{display:none;}}`;
        document.head.appendChild(style);
    },
    _resultTone(status) {
        return {
            success: { color: "#0F9D58", glyph: "✓", title: "Payment successful", sub: "Your transaction was completed successfully." },
            failed: { color: "#D93025", glyph: "!", title: "Payment not completed", sub: "This transaction did not go through." },
            pending: {
                color: "#F09300",
                glyph: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/></svg>',
                title: "Payment pending",
                sub: "We have not confirmed this payment yet.",
            },
            cancelled: { color: "#5F6368", glyph: "✕", title: "Payment cancelled", sub: "The payment was cancelled." },
        }[status] || { color: "#5F6368", glyph: "•", title: "Transaction closed", sub: "" };
    },
    /* Mounts the modal. `receipt` may be null (no e-Receipt pane, e.g. a
     * failure before any transaction existed). Returns the modal node.
     *   { status, title, message, receipt, retry, retryLabel, onDone, doneLabel, backdrop } */
    _mountResultModal(options = {}) {
        const status = options.status || "success";
        const tone = this._resultTone(status);
        const receipt = options.receipt || null;
        const esc = (v) => this._esc(v);
        this._injectReceiptStyles();
        ["egp-result-modal", "egp-result-backdrop"].forEach((id) => {
            const node = document.getElementById(id);
            if (node)
                node.remove();
        });
        this._receipt = receipt;
        this._receiptHtml = null;
        if (options.backdrop !== false && !document.getElementById("payment-overlay") && !document.getElementById("egp-backdrop")) {
            const backdrop = document.createElement("div");
            backdrop.id = "egp-result-backdrop";
            document.body.appendChild(backdrop);
        }
        const modal = document.createElement("div");
        modal.id = "egp-result-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", `${options.title || tone.title} - EgolePay`);
        const retryable = typeof options.retry === "function";
        modal.innerHTML = `
      <img class="egp-logo" src="${esc(this.companyLogo)}" alt="EgolePay" onerror="this.style.display='none'">
      <div class="egp-icon" style="background:${tone.color}">${tone.glyph}</div>
      <h3>${esc(options.title || tone.title)}</h3>
      <p class="egp-sub">${esc(options.message || tone.sub)}</p>
      ${receipt ? `<div class="egp-receipt-head">
        <strong>e-Receipt</strong>
        <span class="egp-ref-val">${esc(receipt.verificationCode || "")}</span>
      </div>
      <iframe id="egp-receipt-frame" title="EgolePay e-Receipt" sandbox="allow-same-origin allow-modals"></iframe>` : ""}
      <div class="egp-toast" id="egp-toast" role="status" aria-live="polite"></div>
      <div class="egp-actions">
        ${retryable ? `<button type="button" id="egp-retry" class="egp-btn-primary">${esc(options.retryLabel || (status === "pending" ? "Check Again" : "Try Again"))}</button>` : ""}
        ${receipt ? `<button type="button" id="egp-print" class="egp-btn-ghost">Print as PDF</button>` : ""}
        <button type="button" id="egp-done" class="egp-btn-done${status === "success" ? "" : " egp-neutral"}">${esc(options.doneLabel || "Done")}</button>
      </div>`;
        if (receipt)
            modal.classList.add("egp-wide");
        document.body.appendChild(modal);
        if (receipt)
            this._renderInlineReceipt(receipt);
        const bind = (id, handler) => {
            const node = document.getElementById(id);
            if (node)
                node.addEventListener("click", handler);
        };
        bind("egp-done", () => {
            if (typeof options.onDone === "function")
                options.onDone();
        });
        bind("egp-print", () => this.printReceipt());
        if (retryable)
            bind("egp-retry", () => options.retry());
        const focusTarget = document.getElementById("egp-done");
        if (focusTarget)
            focusTarget.focus();
        return modal;
    },
    _removeResultModal() {
        ["egp-result-modal", "egp-result-backdrop"].forEach((id) => {
            const node = document.getElementById(id);
            if (node)
                node.remove();
        });
    },

    /* ---- receipt actions ---- */
    async _renderInlineReceipt(receipt) {
        const frame = document.getElementById("egp-receipt-frame");
        if (!frame || frame.dataset.rendered === "1")
            return;
        const logo = await this._resolveLogo();
        this._receiptHtml = this.buildReceiptDocument(receipt, logo || this.companyLogo);
        this._receiptReady = new Promise((resolve) => {
            frame.addEventListener("load", () => resolve(), { once: true });
            setTimeout(resolve, 2500);
        });
        // The agency download buttons live inside the receipt. The frame is
        // sandboxed without popups, so route the click through this window
        // (same-origin srcdoc, so the document is reachable) and keep the
        // mobile-aware opener in one place.
        frame.addEventListener("load", () => {
            try {
                const doc = frame.contentDocument;
                if (!doc)
                    return;
                doc.addEventListener("click", (e) => {
                    const link = e.target && e.target.closest ? e.target.closest("a[data-egp-ext]") : null;
                    if (!link)
                        return;
                    e.preventDefault();
                    this._openExternalReceipt(link.getAttribute("href"));
                });
            }
            catch (err) {
            }
        }, { once: true });
        frame.srcdoc = this._receiptHtml;
        frame.dataset.rendered = "1";
    },
    async _ensureReceiptHtml() {
        if (this._receiptHtml)
            return this._receiptHtml;
        const receipt = this._receipt || (typeof this.buildReceipt === "function"
            ? this.buildReceipt(this.currentStep === "success" ? "success" : "pending")
            : null);
        if (!receipt)
            throw new Error("No receipt to render");
        const logo = await this._resolveLogo();
        this._receiptHtml = this.buildReceiptDocument(receipt, logo || this.companyLogo);
        return this._receiptHtml;
    },
    async printReceipt() {
        const html = await this._ensureReceiptHtml();
        const mounted = document.getElementById("egp-receipt-frame");
        const fire = (frame) => {
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
            }
            catch (err) {
                this._toast("Could not open the print dialog", true);
            }
        };
        if (mounted && mounted.dataset.rendered === "1") {
            if (this._receiptReady)
                await this._receiptReady;
            fire(mounted);
            return;
        }
        const hidden = document.createElement("iframe");
        hidden.id = "egp-print-frame";
        hidden.setAttribute("sandbox", "allow-same-origin allow-modals");
        hidden.setAttribute("aria-hidden", "true");
        hidden.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
        hidden.addEventListener("load", () => {
            fire(hidden);
            setTimeout(() => hidden.parentNode && hidden.parentNode.removeChild(hidden), 60000);
        });
        document.body.appendChild(hidden);
        hidden.srcdoc = html;
    },
    async downloadReceipt() {
        try {
            const html = await this._ensureReceiptHtml();
            const receipt = this._receipt || {};
            const name = `EgolePay-Receipt-${(receipt.gatewayReference || receipt.merchantReference || "transaction").replace(/[^A-Za-z0-9_-]/g, "")}.html`;
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            this._objectUrls = this._objectUrls || [];
            this._objectUrls.push(url);
            const link = document.createElement("a");
            link.href = url;
            link.download = name;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this._toast("Receipt downloaded");
        }
        catch (err) {
            this._toast("Could not download the receipt", true);
        }
    },
    _toast(message, isError) {
        const node = document.getElementById("egp-toast");
        if (!node)
            return;
        node.textContent = message;
        node.style.color = isError ? "#D93025" : "#0F9D58";
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            if (node.isConnected)
                node.textContent = "";
        }, 2600);
    },
    _releaseReceiptResources() {
        (this._objectUrls || []).forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            }
            catch (err) {
            }
        });
        this._objectUrls = [];
        clearTimeout(this._toastTimer);
        const frame = document.getElementById("egp-print-frame");
        if (frame)
            frame.remove();
    },
};
/* EGP-RECEIPT-END */
